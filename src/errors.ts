export type AppErrorCode =
  | 'invalidDelay'
  | 'missingCapabilities'
  | 'invalidSwitchState'
  | 'invalidLightingState'
  | 'unsupportedLightingLevels'
  | 'missingLightingCommand'
  | 'noLocations'
  | 'noCompatibleDevices'
  | 'invalidCliResponse'
  | 'cliLaunchFailed'
  | 'cliProcessFailed'
  | 'cliInvalidJson'
  | 'emptySelection'

export type AppErrorDetails = Readonly<Record<string, string | number>>

export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    readonly details: AppErrorDetails = {},
  ) {
    super(code)
    this.name = 'AppError'
  }
}
