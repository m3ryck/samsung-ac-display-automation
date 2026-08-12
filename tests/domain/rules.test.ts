import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { LIGHTING_CAPABILITY } from '../../src/domain/devices.js'
import { AppError, type AppErrorCode } from '../../src/errors.js'
import {
  RULE_MARKER,
  buildDisplayOffRule,
  findManagedRules,
} from '../../src/domain/rules.js'
import type { Device, ManagedRule } from '../../src/domain/types.js'

const device: Device = {
  deviceId: 'device-test-1',
  label: 'Ar-condicionado do quarto',
  name: 'Samsung AC',
  locationId: 'location-1',
  components: [],
}

const hasCode = (code: AppErrorCode) => (error: unknown): boolean =>
  error instanceof AppError && error.code === code

describe('buildDisplayOffRule', () => {
  test('builds the exact transition, delay, and setLightingLevel off action', () => {
    assert.deepEqual(buildDisplayOffRule(device, 5), {
      name: `${RULE_MARKER} Ar-condicionado do quarto`,
      description: `${RULE_MARKER};version=1;deviceId=${device.deviceId};delaySeconds=5`,
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
            then: [
              {
                sleep: {
                  duration: { value: { integer: 5 }, unit: 'Second' },
                },
              },
              {
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
              },
            ],
          },
        },
      ],
    })
  })

  test('omits the sleep action when delay is zero', () => {
    const rule = buildDisplayOffRule(device, 0)
    const action = rule.actions[0]
    assert.ok(action && 'if' in action)
    const condition = action.if

    assert.equal(condition.then.length, 1)
    assert.ok('command' in condition.then[0]!)
  })

  test('rejects delays outside zero through sixty whole seconds', () => {
    for (const delay of [-1, 1.5, 61]) {
      assert.throws(() => buildDisplayOffRule(device, delay), hasCode('invalidDelay'))
    }
  })
})

describe('findManagedRules', () => {
  test('finds only installer rules for the selected device', () => {
    const rules: ManagedRule[] = [
      {
        id: 'rule-1',
        locationId: 'location-1',
        ...buildDisplayOffRule(device, 5),
      },
      {
        id: 'rule-2',
        locationId: 'location-1',
        ...buildDisplayOffRule({ ...device, deviceId: 'other-device' }, 5),
      },
      {
        id: 'rule-3',
        locationId: 'location-1',
        name: 'Outra automação',
        actions: [],
      },
    ]

    assert.deepEqual(findManagedRules(rules, device.deviceId).map(rule => rule.id), ['rule-1'])
  })
})
