import { COOLING_SETPOINT_CAPABILITY, LIGHTING_CAPABILITY, deviceDisplayName } from './devices.js'
import { AppError } from '../errors.js'
import type { Device, ManagedRule, RuleAction, RuleRequest } from './types.js'

export const RULE_MARKER = '[Visor AC SmartThings]'
export const RULE_VERSION = 1

const buildDescription = (deviceId: string, delaySeconds: number): string =>
  `${RULE_MARKER};version=${RULE_VERSION};deviceId=${deviceId};delaySeconds=${delaySeconds}`

export const buildDisplayOffRule = (
  device: Device,
  delaySeconds: number,
  useCoolingSetpoint = false,
): RuleRequest => {
  if (!Number.isInteger(delaySeconds) || delaySeconds < 0 || delaySeconds > 60) {
    throw new AppError('invalidDelay')
  }

  const commandAction: RuleAction = {
    command: {
      devices: [device.deviceId],
      commands: [
        {
          component: 'main',
          capability: LIGHTING_CAPABILITY,
          command: 'setLightingLevel',
          arguments: [{ string: 'off' }],
        },
      ],
    },
  }

  const then: RuleAction[] = delaySeconds
    ? [
        {
          sleep: {
            duration: { value: { integer: delaySeconds }, unit: 'Second' },
          },
        },
        commandAction,
      ]
    : [commandAction]

  const displayOffCondition = (id: string, capability: string, attribute: string): RuleAction => ({
    if: {
      changes: {
        id,
        equals: {
          left: {
            device: {
              devices: [device.deviceId],
              component: 'main',
              capability,
              attribute,
              trigger: 'Always',
            },
          },
          right: { string: 'on' },
        },
      },
      then,
    },
  })

  const setpointAction: RuleAction = {
    if: {
      // Every reported setpoint in the normal AC range can trigger execution.
      lessThanOrEquals: {
        left: { integer: 0 },
        right: { device: {
          devices: [device.deviceId],
          component: 'main',
          capability: COOLING_SETPOINT_CAPABILITY,
          attribute: 'coolingSetpoint',
          trigger: 'Always',
        } },
      },
      then: [
        ...then.slice(0, -1),
        { if: {
          equals: {
            left: { device: {
              devices: [device.deviceId],
              component: 'main',
              capability: 'switch',
              attribute: 'switch',
              trigger: 'Never',
            } },
            right: { string: 'on' },
          },
          then: [commandAction],
        } },
      ],
    },
  }

  return {
    name: `${RULE_MARKER} ${deviceDisplayName(device)}`.slice(0, 100),
    description: buildDescription(device.deviceId, delaySeconds),
    actions: [
      displayOffCondition('air-conditioner-turned-on', 'switch', 'switch'),
      useCoolingSetpoint
        ? setpointAction
        : displayOffCondition('air-conditioner-display-turned-on', LIGHTING_CAPABILITY, 'lighting'),
    ],
  }
}

export const findManagedRules = (rules: ManagedRule[], deviceId?: string): ManagedRule[] =>
  rules.filter(rule => {
    if (!rule.description?.startsWith(`${RULE_MARKER};version=`)) return false
    return deviceId === undefined || rule.description.includes(`;deviceId=${deviceId};`)
  })

export const managedRuleDelay = (rule: ManagedRule): number | undefined => {
  const match = rule.description?.match(/;delaySeconds=(\d+)(?:;|$)/)
  if (!match?.[1]) return undefined
  return Number.parseInt(match[1], 10)
}
