import { deviceDisplayName } from '../domain/devices.js'
import type { Device, Location } from '../domain/types.js'
import { AppError } from '../errors.js'
import type { Translator } from '../i18n/index.js'
import type { SmartThingsGateway } from '../smartthings/gateway.js'
import type { Terminal } from '../ui/terminal.js'

export const selectLocation = async (
  gateway: SmartThingsGateway,
  terminal: Terminal,
  translator: Translator,
): Promise<Location> => {
  const locations = await gateway.listLocations()
  if (!locations.length) {
    throw new AppError('noLocations')
  }
  if (locations.length === 1) return locations[0]!
  return terminal.select(
    translator.t('selection.chooseLocation'),
    locations.map(location => ({ label: location.name || location.locationId, value: location })),
  )
}

export const selectDevice = async (
  terminal: Terminal,
  translator: Translator,
  devices: Device[],
): Promise<Device> => {
  if (!devices.length) {
    throw new AppError('noCompatibleDevices')
  }
  if (devices.length === 1) return devices[0]!
  return terminal.select(
    translator.t('selection.chooseDevice'),
    devices.map(device => ({ label: deviceDisplayName(device), value: device })),
  )
}
