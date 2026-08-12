import { spawn } from 'node:child_process'

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

export class CliCommandError extends Error {
  override readonly name = 'CliCommandError'
}

export const smartThingsExecutable = (
  platform: NodeJS.Platform = process.platform,
): string => (platform === 'win32' ? 'smartthings.cmd' : 'smartthings')

const secretPatterns: Array<[RegExp, string]> = [
  [/(Authorization\s*:\s*Bearer\s+)[^\s"']+/gi, '$1[REDACTED]'],
  [/(\"?(?:access_token|refresh_token|client_secret|authorization_code)\"?\s*[:=]\s*\"?)[^\s\",'&}]+/gi, '$1[REDACTED]'],
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
  platform?: NodeJS.Platform
  execute?: ProcessExecutor
}

export class CliRunner implements CliCommandRunner {
  readonly #executable: string
  readonly #execute: ProcessExecutor

  constructor(options: CliRunnerOptions = {}) {
    this.#executable = smartThingsExecutable(options.platform)
    this.#execute = options.execute ?? executeProcess
  }

  async run(arguments_: string[]): Promise<string> {
    let result: ProcessResult
    try {
      result = await this.#execute(this.#executable, arguments_)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new CliCommandError(sanitizeCliError(message))
    }

    if (result.exitCode !== 0) {
      const details = result.stderr.trim() || result.stdout.trim() || 'sem detalhes'
      throw new CliCommandError(
        sanitizeCliError(`SmartThings CLI terminou com código ${result.exitCode}: ${details}`),
      )
    }

    return result.stdout
  }

  async runJson(arguments_: string[]): Promise<unknown> {
    const output = await this.run(arguments_)
    try {
      return JSON.parse(output.trim()) as unknown
    } catch {
      throw new CliCommandError('A SmartThings CLI retornou JSON inválido.')
    }
  }
}
