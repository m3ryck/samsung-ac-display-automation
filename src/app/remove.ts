import { findManagedRules } from '../domain/rules.js'
import type { Location, ManagedRule } from '../domain/types.js'
import type { Translator } from '../i18n/index.js'
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
  translator: Translator,
): Promise<number> => {
  const entries: RuleAtLocation[] = []
  for (const location of await gateway.listLocations()) {
    const rules = findManagedRules(await gateway.listRules(location.locationId))
    entries.push(...rules.map(rule => ({ location, rule })))
  }

  if (!entries.length) {
    terminal.info(translator.t('common.noManagedConfigurations'))
    return 0
  }

  let selected: RuleAtLocation[]
  if (entries.length === 1) {
    selected = entries
  } else {
    const options: Array<TerminalOption<RemovalChoice>> = [
      { label: translator.t('remove.allOption', { count: entries.length }), value: 'all' },
      ...entries.map(entry => ({
        label: `${entry.location.name}: ${entry.rule.name}`,
        value: entry,
      })),
    ]
    const choice = await terminal.select(translator.t('remove.choose'), options)
    selected = choice === 'all' ? entries : [choice]
  }

  const confirmed = await terminal.confirm(
    translator.t('remove.confirm', { count: selected.length }),
  )
  if (!confirmed) {
    terminal.info(translator.t('common.cancelled'))
    return 0
  }

  for (const entry of selected) {
    await gateway.deleteRule(entry.location.locationId, entry.rule.id)
  }
  terminal.info(translator.t('remove.removed', { count: selected.length }))
  return selected.length
}
