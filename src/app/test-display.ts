import { deviceDisplayName, findCompatibleDevices } from '../domain/devices.js'
import type { Translator } from '../i18n/index.js'
import type { SmartThingsGateway } from '../smartthings/gateway.js'
import type { Terminal } from '../ui/terminal.js'
import { selectDevice, selectLocation } from './selection.js'

export const runTestDisplay = async (
  gateway: SmartThingsGateway,
  terminal: Terminal,
  translator: Translator,
): Promise<boolean> => {
  const location = await selectLocation(gateway, terminal, translator)
  const devices = findCompatibleDevices(await gateway.listDevices(location.locationId))
  const device = await selectDevice(terminal, translator, devices)

  const ready = await terminal.confirm(
    translator.t('testDisplay.confirmSend', { device: deviceDisplayName(device) }),
  )
  if (!ready) {
    terminal.info(translator.t('common.cancelled'))
    return true
  }

  await gateway.turnDisplayOff(device.deviceId)
  const observed = await terminal.confirm(translator.t('testDisplay.confirmObserved'))
  if (observed) {
    terminal.info(translator.t('testDisplay.observed'))
  } else {
    terminal.warning(translator.t('testDisplay.unconfirmed'))
  }
  return observed
}
