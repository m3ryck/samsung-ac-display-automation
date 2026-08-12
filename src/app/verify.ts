import { LIGHTING_CAPABILITY, deviceDisplayName } from '../domain/devices.js'
import type { Device, DeviceStatus, StatusValue } from '../domain/types.js'
import type { Translator } from '../i18n/index.js'
import type { SmartThingsGateway } from '../smartthings/gateway.js'
import type { Terminal } from '../ui/terminal.js'

export interface VerificationClock {
  now(): number
  wait(milliseconds: number): Promise<void>
}

const realClock: VerificationClock = {
  now: () => Date.now(),
  wait: milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
}

interface ObservableState {
  switchState?: string
  lightingState?: string
}

const valueOf = (candidate: unknown): unknown =>
  typeof candidate === 'object' && candidate !== null && 'value' in candidate
    ? (candidate as StatusValue).value
    : undefined

const observableState = (status: DeviceStatus): ObservableState => {
  const main = status.components.main
  const switchState = valueOf(main?.switch?.switch)
  const lightingState = valueOf(main?.[LIGHTING_CAPABILITY]?.lighting)
  return {
    ...(typeof switchState === 'string' ? { switchState } : {}),
    ...(typeof lightingState === 'string' ? { lightingState } : {}),
  }
}

export interface VerificationOptions {
  clock?: VerificationClock
  pollMilliseconds?: number
  timeoutMilliseconds?: number
}

export const verifyInstalledRule = async (
  gateway: SmartThingsGateway,
  terminal: Terminal,
  translator: Translator,
  device: Device,
  options: VerificationOptions = {},
): Promise<boolean> => {
  const clock = options.clock ?? realClock
  const pollMilliseconds = options.pollMilliseconds ?? 2_000
  const timeoutMilliseconds = options.timeoutMilliseconds ?? 60_000
  const deadline = clock.now() + timeoutMilliseconds

  let state = observableState(await gateway.getDeviceStatus(device.deviceId))
  if (state.switchState === 'on') {
    terminal.info(
      translator.t('verify.turnOff', { device: deviceDisplayName(device) }),
    )
    while (state.switchState !== 'off' && clock.now() < deadline) {
      await clock.wait(pollMilliseconds)
      state = observableState(await gateway.getDeviceStatus(device.deviceId))
    }
    if (state.switchState !== 'off') {
      terminal.warning(translator.t('verify.turnOffTimeout'))
      return false
    }
  }

  terminal.info(
    translator.t('verify.turnOn', { device: deviceDisplayName(device) }),
  )
  while (clock.now() < deadline) {
    state = observableState(await gateway.getDeviceStatus(device.deviceId))
    if (state.switchState === 'on' && state.lightingState === 'off') {
      terminal.info(translator.t('verify.success'))
      return true
    }
    await clock.wait(pollMilliseconds)
  }

  terminal.warning(
    translator.t('verify.timeout'),
  )
  return false
}
