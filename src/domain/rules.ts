import { LIGHTING_CAPABILITY, deviceDisplayName } from './devices.js'
import type { Device, ManagedRule, RuleAction, RuleRequest } from './types.js'

export const RULE_MARKER = '[Visor AC SmartThings]'
export const RULE_VERSION = 1

const buildDescription = (deviceId: string, delaySeconds: number): string =>
  `${RULE_MARKER};version=${RULE_VERSION};deviceId=${deviceId};delaySeconds=${delaySeconds}`

export const buildDisplayOffRule = (device: Device, delaySeconds: number): RuleRequest => {
  if (!Number.isInteger(delaySeconds) || delaySeconds < 0 || delaySeconds > 60) {
    throw new Error('O atraso deve ser um número inteiro entre 0 e 60 segundos.')
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

  return {
    name: `${RULE_MARKER} ${deviceDisplayName(device)}`.slice(0, 100),
    description: buildDescription(device.deviceId, delaySeconds),
    actions: [
      {
        if: {
          changes: {
            id: 'air-conditioner-turned-on',
            equals: {
              left: {
                device: {
                  devices: [device.deviceId],
                  component: 'main',
                  capability: 'switch',
                  attribute: 'switch',
                  trigger: 'Always',
                },
              },
              right: { string: 'on' },
            },
          },
          then,
        },
      },
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
