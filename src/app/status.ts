import { findManagedRules, managedRuleDelay } from '../domain/rules.js'
import type { SmartThingsGateway } from '../smartthings/gateway.js'
import type { Terminal } from '../ui/terminal.js'

export const runStatus = async (
  gateway: SmartThingsGateway,
  terminal: Terminal,
): Promise<number> => {
  const locations = await gateway.listLocations()
  let count = 0
  for (const location of locations) {
    const managed = findManagedRules(await gateway.listRules(location.locationId))
    for (const rule of managed) {
      count += 1
      const delay = managedRuleDelay(rule)
      terminal.info(
        `${location.name}: ${rule.name} — ${delay ?? '?'} segundo(s) de atraso (ID ${rule.id}).`,
      )
    }
  }
  if (!count) terminal.info('Nenhuma configuração criada por este instalador foi encontrada.')
  return count
}
