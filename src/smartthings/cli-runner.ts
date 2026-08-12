import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { AppError } from '../errors.js'

export interface ProcessResult {
  exitCode: number
  stdout: string
  stderr: string
}

export type ProcessExecutor = (
  executable: string,
  arguments_: string[],
) => Promise<ProcessResult>

export interface CliCommandRunner {
  runJson(arguments_: string[]): Promise<unknown>
  run(arguments_: string[]): Promise<string>
}

export interface SmartThingsInvocation {
  executable: string
  arguments_: string[]
}

const smartThingsCliEntryPath = (): string => {
  const packageEntry = fileURLToPath(import.meta.resolve('@smartthings/cli'))
  return join(dirname(packageEntry), 'run.js')
}

export const smartThingsInvocation = (
  nodeExecutable = process.execPath,
  cliEntryPath = smartThingsCliEntryPath(),
): SmartThingsInvocation => ({
  executable: nodeExecutable,
  arguments_: [cliEntryPath],
})

const secretPatterns: Array<[RegExp, string]> = [
  [/(Authorization\s*:\s*Bearer\s+)[^\s"']+/gi, '$1[REDACTED]'],
  [/(\"?(?:token|access_token|refresh_token|client_secret|authorization_code)\"?\s*[:=]\s*\"?)[^\s\",'&}]+/gi, '$1[REDACTED]'],
]

export const sanitizeCliError = (message: string): string =>
  secretPatterns.reduce(
    (sanitized, [pattern, replacement]) => sanitized.replace(pattern, replacement),
    message,
  )

const executeProcess: ProcessExecutor = (executable, arguments_) =>
  new Promise((resolve, reject) => {
    const child = spawn(executable, arguments_, {
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => {
      stdout += String(chunk)
    })
    child.stderr.on('data', chunk => {
      stderr += String(chunk)
    })
    child.once('error', reject)
    child.once('close', code => {
      resolve({ exitCode: code ?? 1, stdout, stderr })
    })
  })

export interface CliRunnerOptions {
  execute?: ProcessExecutor
  nodeExecutable?: string
  cliEntryPath?: string
}

export class CliRunner implements CliCommandRunner {
  readonly #executable: string
  readonly #argumentPrefix: string[]
  readonly #execute: ProcessExecutor

  constructor(options: CliRunnerOptions = {}) {
    const invocation = smartThingsInvocation(
      options.nodeExecutable,
      options.cliEntryPath,
    )
    this.#executable = invocation.executable
    this.#argumentPrefix = invocation.arguments_
    this.#execute = options.execute ?? executeProcess
  }

  async run(arguments_: string[]): Promise<string> {
    let result: ProcessResult
    try {
      result = await this.#execute(this.#executable, [
        ...this.#argumentPrefix,
        ...arguments_,
      ])
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const details = sanitizeCliError(message)
      throw new AppError('cliLaunchFailed', details ? { details } : {})
    }

    if (result.exitCode !== 0) {
      const details = result.stderr.trim() || result.stdout.trim()
      throw new AppError('cliProcessFailed', {
        exitCode: result.exitCode,
        ...(details ? { details: sanitizeCliError(details) } : {}),
      })
    }

    return result.stdout
  }

  async runJson(arguments_: string[]): Promise<unknown> {
    const output = await this.run(arguments_)
    try {
      return JSON.parse(output.trim()) as unknown
    } catch {
      throw new AppError('cliInvalidJson')
    }
  }
}
