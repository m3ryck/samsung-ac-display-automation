import { runRemove } from './app/remove.js'
import { runSetup } from './app/setup.js'
import { runStatus } from './app/status.js'
import { createTranslator } from './i18n/index.js'
import { CliSmartThingsGateway } from './smartthings/cli-gateway.js'
import { CliRunner, sanitizeCliError } from './smartthings/cli-runner.js'
import { ConsoleTerminal } from './ui/terminal.js'

const commands = ['setup', 'status', 'update', 'remove'] as const
type Command = (typeof commands)[number]

const isCommand = (candidate: string | undefined): candidate is Command =>
  commands.some(command => command === candidate)

const main = async (): Promise<void> => {
  const command = process.argv[2]
  if (!isCommand(command)) {
    process.stderr.write(`Uso: npm run <${commands.join('|')}>\n`)
    process.exitCode = 2
    return
  }

  const translator = await createTranslator('pt-BR')
  const terminal = new ConsoleTerminal(translator)
  const gateway = new CliSmartThingsGateway({ runner: new CliRunner() })
  try {
    if (command === 'setup' || command === 'update') {
      await runSetup(gateway, terminal, translator, { mode: command })
    } else if (command === 'status') {
      await runStatus(gateway, terminal)
    } else {
      await runRemove(gateway, terminal)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    terminal.error(sanitizeCliError(message))
    process.exitCode = 1
  } finally {
    terminal.close()
  }
}

await main()
