import { runRemove } from './app/remove.js'
import { runSetup } from './app/setup.js'
import { runStatus } from './app/status.js'
import { formatError } from './i18n/format-error.js'
import { createTranslator, type Translator } from './i18n/index.js'
import {
  LanguageOptionError,
  normalizeLocale,
  resolveLanguage,
} from './i18n/locale.js'
import { CliSmartThingsGateway } from './smartthings/cli-gateway.js'
import { CliRunner } from './smartthings/cli-runner.js'
import type { SmartThingsGateway } from './smartthings/gateway.js'
import { ConsoleTerminal, type Terminal } from './ui/terminal.js'

const commands = ['setup', 'status', 'update', 'remove'] as const
type Command = (typeof commands)[number]

interface CliTerminal extends Terminal {
  close(): void
}

export interface CliDependencies {
  systemLocale?: string
  createTerminal?: (translator: Translator) => CliTerminal
  createGateway?: () => SmartThingsGateway
}

const isCommand = (candidate: string | undefined): candidate is Command =>
  commands.some(command => command === candidate)

const defaultTerminal = (translator: Translator): CliTerminal =>
  new ConsoleTerminal(translator)

const defaultGateway = (): SmartThingsGateway =>
  new CliSmartThingsGateway({ runner: new CliRunner() })

const languageErrorMessage = (
  error: LanguageOptionError,
  translator: Translator,
): string => {
  switch (error.reason) {
    case 'missing-value':
      return translator.t('language.missing')
    case 'unsupported':
      return translator.t('language.unsupported', { requested: error.requested ?? '' })
    case 'duplicate':
      return translator.t('language.duplicate')
  }
}

export const runCli = async (
  arguments_: readonly string[],
  dependencies: CliDependencies = {},
): Promise<number> => {
  const createTerminal = dependencies.createTerminal ?? defaultTerminal
  const createGateway = dependencies.createGateway ?? defaultGateway
  let terminal: CliTerminal | undefined
  let translator: Translator | undefined

  try {
    let resolved
    try {
      resolved = resolveLanguage(arguments_, dependencies.systemLocale)
    } catch (error) {
      if (!(error instanceof LanguageOptionError)) throw error
      translator = await createTranslator(normalizeLocale(error.systemLocale) ?? 'en')
      terminal = createTerminal(translator)
      terminal.error(languageErrorMessage(error, translator))
      return 2
    }

    translator = await createTranslator(resolved.locale)
    terminal = createTerminal(translator)

    const command = resolved.arguments_[0]
    if (resolved.arguments_.length !== 1 || !isCommand(command)) {
      terminal.error(translator.t('usage'))
      return 2
    }

    const gateway = createGateway()
    switch (command) {
      case 'setup':
      case 'update':
        await runSetup(gateway, terminal, translator, { mode: command })
        break
      case 'status':
        await runStatus(gateway, terminal, translator)
        break
      case 'remove':
        await runRemove(gateway, terminal, translator)
        break
    }
    return 0
  } catch (error) {
    if (terminal === undefined || translator === undefined) throw error
    terminal.error(formatError(error, translator))
    return 1
  } finally {
    terminal?.close()
  }
}
