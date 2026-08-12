import { createInterface, type Interface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

import { AppError } from '../errors.js'
import type { Translator } from '../i18n/index.js'

export interface TerminalOption<T> {
  label: string
  value: T
}

export interface Terminal {
  info(message: string): void
  warning(message: string): void
  error(message: string): void
  confirm(message: string, defaultValue?: boolean): Promise<boolean>
  input(message: string, defaultValue?: string): Promise<string>
  select<T>(message: string, options: readonly TerminalOption<T>[]): Promise<T>
}

export interface TerminalStreams {
  input: NodeJS.ReadableStream
  output: NodeJS.WritableStream
}

const answers = {
  en: { yes: new Set(['y', 'yes']), no: new Set(['n', 'no']) },
  'pt-BR': { yes: new Set(['s', 'sim']), no: new Set(['n', 'não', 'nao']) },
} as const

export class ConsoleTerminal implements Terminal {
  readonly #readline: Interface
  readonly #output: NodeJS.WritableStream
  readonly #translator: Translator

  constructor(
    translator: Translator,
    streams: TerminalStreams = { input: stdin, output: stdout },
  ) {
    this.#translator = translator
    this.#output = streams.output
    this.#readline = createInterface(streams)
  }

  close(): void {
    this.#readline.close()
  }

  info(message: string): void {
    this.#output.write(`${message}\n`)
  }

  warning(message: string): void {
    this.#output.write(`${this.#translator.t('common.warningPrefix')}: ${message}\n`)
  }

  error(message: string): void {
    this.#output.write(`${this.#translator.t('common.errorPrefix')}: ${message}\n`)
  }

  async input(message: string, defaultValue = ''): Promise<string> {
    const suffix = defaultValue ? ` [${defaultValue}]` : ''
    const answer = (await this.#readline.question(`${message}${suffix}: `)).trim()
    return answer || defaultValue
  }

  async confirm(message: string, defaultValue = false): Promise<boolean> {
    const hint = this.#translator.t(
      defaultValue ? 'common.yesNoDefaultYes' : 'common.yesNoDefaultNo',
    )
    const accepted: { yes: ReadonlySet<string>; no: ReadonlySet<string> } =
      answers[this.#translator.locale]
    while (true) {
      const answer = (await this.#readline.question(`${message} (${hint}): `))
        .trim()
        .toLocaleLowerCase(this.#translator.locale)
      if (!answer) return defaultValue
      if (accepted.yes.has(answer)) return true
      if (accepted.no.has(answer)) return false
      this.warning(this.#translator.t('common.invalidYesNo'))
    }
  }

  async select<T>(message: string, options: readonly TerminalOption<T>[]): Promise<T> {
    if (!options.length) throw new AppError('emptySelection')
    this.info(message)
    options.forEach((option, index) => {
      this.info(`  ${index + 1}. ${option.label}`)
    })

    while (true) {
      const answer = await this.input(this.#translator.t('common.optionNumber'))
      const selected = Number.parseInt(answer, 10)
      if (String(selected) === answer && selected >= 1 && selected <= options.length) {
        return options[selected - 1]!.value
      }
      this.warning(
        this.#translator.t('common.optionRange', { minimum: 1, maximum: options.length }),
      )
    }
  }
}
