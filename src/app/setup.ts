import {
  deviceDisplayName,
  findCompatibleDevices,
  validateDevice,
} from '../domain/devices.js'
import { buildDisplayOffRule, findManagedRules } from '../domain/rules.js'
import type { Device, ManagedRule } from '../domain/types.js'
import type { Translator } from '../i18n/index.js'
import type { SmartThingsGateway } from '../smartthings/gateway.js'
import type { Terminal } from '../ui/terminal.js'
import { selectDevice, selectLocation } from './selection.js'
import { verifyInstalledRule } from './verify.js'

export type SetupOutcome = 'created' | 'updated' | 'kept' | 'removed' | 'cancelled'

export interface SetupResult {
  outcome: SetupOutcome
  device: Device
}

const askDelay = async (terminal: Terminal, translator: Translator): Promise<number> => {
  while (true) {
    const answer = await terminal.input(translator.t('setup.delayPrompt'), '5')
    const delay = Number(answer)
    if (Number.isInteger(delay) && delay >= 0 && delay <= 60) return delay
    terminal.warning(translator.t('setup.invalidDelay'))
  }
}

type ExistingAction = 'keep' | 'replace' | 'remove'

const chooseExistingAction = (
  terminal: Terminal,
  translator: Translator,
  rules: ManagedRule[],
): Promise<ExistingAction> =>
  terminal.select(translator.t('setup.existingPrompt'), [
    { label: translator.t('setup.keepOption'), value: 'keep' },
    { label: translator.t('setup.replaceOption'), value: 'replace' },
    {
      label: translator.t('setup.removeOption', { count: rules.length }),
      value: 'remove',
    },
  ])

const deleteRules = async (
  gateway: SmartThingsGateway,
  rules: ManagedRule[],
): Promise<void> => {
  for (const rule of rules) {
    await gateway.deleteRule(rule.locationId, rule.id)
  }
}

export interface SetupOptions {
  mode?: 'setup' | 'update'
}

export const runSetup = async (
  gateway: SmartThingsGateway,
  terminal: Terminal,
  translator: Translator,
  options: SetupOptions = {},
): Promise<SetupResult> => {
  terminal.info(
    options.mode === 'update'
      ? translator.t('setup.titleUpdate')
      : translator.t('setup.titleSetup'),
  )
  terminal.info(translator.t('setup.cloudPersistence'))

  const location = await selectLocation(gateway, terminal, translator)
  const compatibleDevices = findCompatibleDevices(await gateway.listDevices(location.locationId))
  const device = await selectDevice(terminal, translator, compatibleDevices)
  const [status, definition, rules] = await Promise.all([
    gateway.getDeviceStatus(device.deviceId),
    gateway.getLightingCapabilityDefinition(),
    gateway.listRules(location.locationId),
  ])
  const current = validateDevice(device, status, definition)
  const managed = findManagedRules(rules, device.deviceId)

  if (managed.length) {
    const action = await chooseExistingAction(terminal, translator, managed)
    if (action === 'keep') {
      terminal.info(translator.t('setup.kept'))
      return { outcome: 'kept', device }
    }
    if (action === 'remove') {
      const confirmed = await terminal.confirm(
        translator.t('setup.confirmExistingRemoval', { count: managed.length }),
      )
      if (!confirmed) return { outcome: 'cancelled', device }
      await deleteRules(gateway, managed)
      terminal.info(translator.t('setup.existingRemoved'))
      return { outcome: 'removed', device }
    }
  }

  const delay = await askDelay(terminal, translator)
  const request = buildDisplayOffRule(device, delay)
  terminal.info(translator.t('setup.device', { device: deviceDisplayName(device) }))
  const switchState = translator.t(current.switchState === 'on' ? 'state.on' : 'state.off')
  const lightingState = translator.t(current.lightingState === 'on' ? 'state.on' : 'state.off')
  terminal.info(translator.t('setup.currentState', { switchState, lightingState }))
  terminal.info(translator.t('setup.action', { count: delay }))
  const confirmed = await terminal.confirm(translator.t('setup.saveConfirmation'))
  if (!confirmed) {
    terminal.info(translator.t('common.cancelled'))
    return { outcome: 'cancelled', device }
  }

  let outcome: SetupOutcome
  if (managed.length) {
    await gateway.updateRule(location.locationId, managed[0]!.id, request)
    await deleteRules(gateway, managed.slice(1))
    outcome = 'updated'
    terminal.info(translator.t('setup.updated'))
  } else {
    await gateway.createRule(location.locationId, request)
    outcome = 'created'
    terminal.info(translator.t('setup.created'))
  }

  if (await terminal.confirm(translator.t('setup.offerVerification'))) {
    await verifyInstalledRule(gateway, terminal, device)
  }
  return { outcome, device }
}
