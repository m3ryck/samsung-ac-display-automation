import {
  deviceDisplayName,
  findCompatibleDevices,
  validateDevice,
} from '../domain/devices.js'
import { buildDisplayOffRule, findManagedRules } from '../domain/rules.js'
import type { Device, ManagedRule } from '../domain/types.js'
import type { SmartThingsGateway } from '../smartthings/gateway.js'
import type { Terminal } from '../ui/terminal.js'
import { selectDevice, selectLocation } from './selection.js'
import { verifyInstalledRule } from './verify.js'

export type SetupOutcome = 'created' | 'updated' | 'kept' | 'removed' | 'cancelled'

export interface SetupResult {
  outcome: SetupOutcome
  device: Device
}

const askDelay = async (terminal: Terminal): Promise<number> => {
  while (true) {
    const answer = await terminal.input(
      'Quantos segundos depois de ligar o ar o visor deve apagar? (0 a 60)',
      '5',
    )
    const delay = Number(answer)
    if (Number.isInteger(delay) && delay >= 0 && delay <= 60) return delay
    terminal.warning('Informe um número inteiro entre 0 e 60.')
  }
}

type ExistingAction = 'keep' | 'replace' | 'remove'

const chooseExistingAction = (
  terminal: Terminal,
  rules: ManagedRule[],
): Promise<ExistingAction> =>
  terminal.select('Já existe uma configuração para este aparelho. O que deseja fazer?', [
    { label: 'Manter como está', value: 'keep' },
    { label: 'Atualizar a configuração', value: 'replace' },
    {
      label: `Remover ${rules.length === 1 ? 'a configuração' : `as ${rules.length} duplicatas`}`,
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
  options: SetupOptions = {},
): Promise<SetupResult> => {
  terminal.info(
    options.mode === 'update'
      ? 'Atualização da regra do visor do ar-condicionado.'
      : 'Configuração da regra do visor do ar-condicionado.',
  )
  terminal.info(
    'A regra ficará no SmartThings e continuará funcionando mesmo com este instalador fechado.',
  )

  const location = await selectLocation(gateway, terminal)
  const compatibleDevices = findCompatibleDevices(await gateway.listDevices(location.locationId))
  const device = await selectDevice(terminal, compatibleDevices)
  const [status, definition, rules] = await Promise.all([
    gateway.getDeviceStatus(device.deviceId),
    gateway.getLightingCapabilityDefinition(),
    gateway.listRules(location.locationId),
  ])
  const current = validateDevice(device, status, definition)
  const managed = findManagedRules(rules, device.deviceId)

  if (managed.length) {
    const action = await chooseExistingAction(terminal, managed)
    if (action === 'keep') {
      terminal.info('A configuração existente foi mantida. Nenhuma alteração foi feita.')
      return { outcome: 'kept', device }
    }
    if (action === 'remove') {
      const confirmed = await terminal.confirm(
        `Confirma a remoção de ${managed.length} configuração(ões) do SmartThings?`,
      )
      if (!confirmed) return { outcome: 'cancelled', device }
      await deleteRules(gateway, managed)
      terminal.info('Configuração removida. O visor não será mais alterado por esta Rule.')
      return { outcome: 'removed', device }
    }
  }

  const delay = await askDelay(terminal)
  const request = buildDisplayOffRule(device, delay)
  terminal.info(`Aparelho: ${deviceDisplayName(device)}`)
  terminal.info(`Estado atual: ar ${current.switchState}; visor ${current.lightingState}.`)
  terminal.info(
    `Ação: ao detectar que o ar ligou, aguardar ${delay} segundo(s) e apagar somente o visor.`,
  )
  const confirmed = await terminal.confirm('Autoriza salvar esta Rule na sua conta SmartThings?')
  if (!confirmed) {
    terminal.info('Operação cancelada. Nenhuma alteração foi feita.')
    return { outcome: 'cancelled', device }
  }

  let outcome: SetupOutcome
  if (managed.length) {
    await gateway.updateRule(location.locationId, managed[0]!.id, request)
    await deleteRules(gateway, managed.slice(1))
    outcome = 'updated'
    terminal.info('Configuração atualizada sem criar uma Rule duplicada.')
  } else {
    await gateway.createRule(location.locationId, request)
    outcome = 'created'
    terminal.info('Configuração instalada com sucesso na nuvem do SmartThings.')
  }

  if (await terminal.confirm('Deseja fazer agora um teste guiado de até 60 segundos?')) {
    await verifyInstalledRule(gateway, terminal, device)
  }
  return { outcome, device }
}
