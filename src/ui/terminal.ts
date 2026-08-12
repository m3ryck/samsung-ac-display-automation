import { createInterface, type Interface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

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

export class ConsoleTerminal implements Terminal {
  readonly #readline: Interface

  constructor() {
    this.#readline = createInterface({ input: stdin, output: stdout })
  }

  close(): void {
    this.#readline.close()
  }

  info(message: string): void {
    stdout.write(`${message}\n`)
  }

  warning(message: string): void {
    stdout.write(`Aviso: ${message}\n`)
  }

  error(message: string): void {
    stdout.write(`Erro: ${message}\n`)
  }

  async input(message: string, defaultValue = ''): Promise<string> {
    const suffix = defaultValue ? ` [${defaultValue}]` : ''
    const answer = (await this.#readline.question(`${message}${suffix}: `)).trim()
    return answer || defaultValue
  }

  async confirm(message: string, defaultValue = false): Promise<boolean> {
    const hint = defaultValue ? 'S/n' : 's/N'
    while (true) {
      const answer = (await this.#readline.question(`${message} (${hint}): `))
        .trim()
        .toLocaleLowerCase('pt-BR')
      if (!answer) return defaultValue
      if (answer === 's' || answer === 'sim') return true
      if (answer === 'n' || answer === 'não' || answer === 'nao') return false
      this.warning('Responda com sim ou não.')
    }
  }

  async select<T>(message: string, options: readonly TerminalOption<T>[]): Promise<T> {
    if (!options.length) throw new Error('Não há opções disponíveis para seleção.')
    this.info(message)
    options.forEach((option, index) => {
      this.info(`  ${index + 1}. ${option.label}`)
    })

    while (true) {
      const answer = await this.input('Digite o número da opção')
      const selected = Number.parseInt(answer, 10)
      if (String(selected) === answer && selected >= 1 && selected <= options.length) {
        return options[selected - 1]!.value
      }
      this.warning(`Escolha um número entre 1 e ${options.length}.`)
    }
  }
}
