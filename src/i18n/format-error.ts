import { AppError } from '../errors.js'
import { sanitizeCliError } from '../smartthings/cli-runner.js'
import type { Translator } from './index.js'

const exhaustive = (value: never): never => {
  throw new Error(`Unhandled AppError code: ${String(value)}`)
}

const translatedResource = (
  resource: string | number | undefined,
  translator: Translator,
): string => {
  switch (resource) {
    case 'locations':
      return translator.t('errors.resources.locations')
    case 'devices':
      return translator.t('errors.resources.devices')
    case 'deviceStatus':
      return translator.t('errors.resources.deviceStatus')
    case 'lightingCapability':
      return translator.t('errors.resources.lightingCapability')
    case 'rules':
      return translator.t('errors.resources.rules')
    case 'createdRule':
      return translator.t('errors.resources.createdRule')
    case 'updatedRule':
      return translator.t('errors.resources.updatedRule')
    default:
      return translator.t('common.unknown')
  }
}

export const formatError = (error: unknown, translator: Translator): string => {
  if (!(error instanceof AppError)) {
    const details = error instanceof Error ? error.message : String(error)
    return translator.t('errors.unexpected', { details: sanitizeCliError(details) })
  }

  switch (error.code) {
    case 'invalidDelay':
      return translator.t('errors.invalidDelay')
    case 'missingCapabilities':
      return translator.t('errors.missingCapabilities')
    case 'invalidSwitchState':
      return translator.t('errors.invalidSwitchState')
    case 'invalidLightingState':
      return translator.t('errors.invalidLightingState')
    case 'unsupportedLightingLevels':
      return translator.t('errors.unsupportedLightingLevels')
    case 'missingLightingCommand':
      return translator.t('errors.missingLightingCommand')
    case 'noLocations':
      return translator.t('selection.noLocations')
    case 'noCompatibleDevices':
      return translator.t('selection.noDevices')
    case 'invalidCliResponse':
      return translator.t('errors.invalidCliResponse', {
        resource: translatedResource(error.details.resource, translator),
      })
    case 'cliLaunchFailed':
      return translator.t('errors.cliLaunchFailed', {
        details: error.details.details,
      })
    case 'cliProcessFailed':
      return translator.t('errors.cliProcessFailed', {
        exitCode: error.details.exitCode,
        details: error.details.details,
      })
    case 'cliInvalidJson':
      return translator.t('errors.cliInvalidJson')
    case 'emptySelection':
      return translator.t('common.emptySelection')
    default:
      return exhaustive(error.code)
  }
}
