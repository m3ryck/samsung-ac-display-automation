import type {
  CapabilityDefinition,
  Device,
  DeviceStatus,
  StatusValue,
  ValidatedDeviceState,
} from './types.js'

export const LIGHTING_CAPABILITY = 'samsungce.airConditionerLighting'

const mainCapabilities = (device: Device): Set<string> => {
  const main = device.components.find(component => component.id === 'main')
  return new Set(main?.capabilities.map(capability => capability.id) ?? [])
}

export const findCompatibleDevices = (devices: Device[]): Device[] =>
  devices.filter(device => {
    const capabilities = mainCapabilities(device)
    return capabilities.has('switch') && capabilities.has(LIGHTING_CAPABILITY)
  })

const statusValue = <T>(value: unknown): T | undefined =>
  typeof value === 'object' && value !== null && 'value' in value
    ? ((value as StatusValue<T>).value as T)
    : undefined

export const validateDevice = (
  device: Device,
  status: DeviceStatus,
  definition: CapabilityDefinition,
): ValidatedDeviceState => {
  const capabilities = mainCapabilities(device)
  if (!capabilities.has('switch') || !capabilities.has(LIGHTING_CAPABILITY)) {
    throw new Error(
      'O dispositivo não possui switch e samsungce.airConditionerLighting no componente main.',
    )
  }

  const main = status.components.main
  const switchState = statusValue<unknown>(main?.switch?.switch)
  if (switchState !== 'on' && switchState !== 'off') {
    throw new Error('O dispositivo não informa main.switch.switch como on ou off.')
  }

  const lighting = main?.[LIGHTING_CAPABILITY]
  const lightingState = statusValue<unknown>(lighting?.lighting)
  if (lightingState !== 'on' && lightingState !== 'off') {
    throw new Error(
      `O dispositivo não informa main.${LIGHTING_CAPABILITY}.lighting como on ou off.`,
    )
  }

  const supportedLevels = statusValue<unknown>(lighting?.supportedLightingLevels)
  if (
    !Array.isArray(supportedLevels) ||
    !supportedLevels.includes('on') ||
    !supportedLevels.includes('off')
  ) {
    throw new Error('O dispositivo não declara suporte aos níveis on e off da iluminação.')
  }

  if (!definition.commands?.setLightingLevel) {
    throw new Error('A capability não oferece o comando setLightingLevel.')
  }

  return {
    switchState,
    lightingState,
    supportedLightingLevels: supportedLevels.filter(
      (level): level is string => typeof level === 'string',
    ),
  }
}

export const deviceDisplayName = (device: Device): string =>
  device.label?.trim() || device.name?.trim() || device.deviceId
