import { deviceDisplayName } from '../domain/devices.js'
import type { Device, Location } from '../domain/types.js'
import type { SmartThingsGateway } from '../smartthings/gateway.js'
import type { Terminal } from '../ui/terminal.js'

export const selectLocation = async (
  gateway: SmartThingsGateway,
  terminal: Terminal,
): Promise<Location> => {
  const locations = await gateway.listLocations()
  if (!locations.length) {
    throw new Error('Nenhuma localização SmartThings foi encontrada nesta conta.')
  }
  if (locations.length === 1) return locations[0]!
  return terminal.select(
    'Em qual localização está o ar-condicionado?',
    locations.map(location => ({ label: location.name || location.locationId, value: location })),
  )
}

export const selectDevice = async (
  terminal: Terminal,
  devices: Device[],
): Promise<Device> => {
  if (!devices.length) {
    throw new Error(
      'Nenhum ar-condicionado compatível com o controle de iluminação foi encontrado.',
    )
  }
  if (devices.length === 1) return devices[0]!
  return terminal.select(
    'Qual ar-condicionado deve ter o visor apagado?',
    devices.map(device => ({ label: deviceDisplayName(device), value: device })),
  )
}
