import { findManagedRules } from '../domain/rules.js'
import type { Location, ManagedRule } from '../domain/types.js'
import type { SmartThingsGateway } from '../smartthings/gateway.js'
import type { Terminal, TerminalOption } from '../ui/terminal.js'

interface RuleAtLocation {
  location: Location
  rule: ManagedRule
}

type RemovalChoice = RuleAtLocation | 'all'

export const runRemove = async (
  gateway: SmartThingsGateway,
  terminal: Terminal,
): Promise<number> => {
  const entries: RuleAtLocation[] = []
  for (const location of await gateway.listLocations()) {
    const rules = findManagedRules(await gateway.listRules(location.locationId))
    entries.push(...rules.map(rule => ({ location, rule })))
  }

  if (!entries.length) {
    terminal.info('Nenhuma configuração criada por este instalador foi encontrada.')
    return 0
  }

  let selected: RuleAtLocation[]
  if (entries.length === 1) {
    selected = entries
  } else {
    const options: Array<TerminalOption<RemovalChoice>> = [
      { label: `Remover todas as ${entries.length} configurações`, value: 'all' },
      ...entries.map(entry => ({
        label: `${entry.location.name}: ${entry.rule.name}`,
        value: entry,
      })),
    ]
    const choice = await terminal.select('Qual configuração deseja remover?', options)
    selected = choice === 'all' ? entries : [choice]
  }

  const confirmed = await terminal.confirm(
    `Confirma a remoção de ${selected.length} Rule(s) da sua conta SmartThings?`,
  )
  if (!confirmed) {
    terminal.info('Operação cancelada. Nenhuma alteração foi feita.')
    return 0
  }

  for (const entry of selected) {
    await gateway.deleteRule(entry.location.locationId, entry.rule.id)
  }
  terminal.info(`${selected.length} configuração(ões) removida(s).`)
  return selected.length
}
