import { findManagedRules, managedRuleDelay } from '../domain/rules.js'
import type { Translator } from '../i18n/index.js'
import type { SmartThingsGateway } from '../smartthings/gateway.js'
import type { Terminal } from '../ui/terminal.js'

export const runStatus = async (
  gateway: SmartThingsGateway,
  terminal: Terminal,
  translator: Translator,
): Promise<number> => {
  const locations = await gateway.listLocations()
  let count = 0
  for (const location of locations) {
    const managed = findManagedRules(await gateway.listRules(location.locationId))
    for (const rule of managed) {
      count += 1
      const delay = managedRuleDelay(rule)
      terminal.info(
        translator.t('status.entry', {
          location: location.name,
          rule: rule.name,
          delay: delay === undefined
            ? translator.t('common.unknown')
            : translator.t('status.delay', { count: delay }),
          id: rule.id,
        }),
      )
    }
  }
  if (!count) terminal.info(translator.t('common.noManagedConfigurations'))
  return count
}
