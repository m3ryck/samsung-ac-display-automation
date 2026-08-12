import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  LIGHTING_CAPABILITY,
  findCompatibleDevices,
  validateDevice,
} from '../../src/domain/devices.js'
import type {
  CapabilityDefinition,
  Device,
  DeviceStatus,
} from '../../src/domain/types.js'

const compatibleDevice = (overrides: Partial<Device> = {}): Device => ({
  deviceId: 'device-1',
  label: 'Ar do quarto',
  name: 'Samsung AC',
  locationId: 'location-1',
  components: [
    {
      id: 'main',
      capabilities: [
        { id: 'switch', version: 1 },
        { id: LIGHTING_CAPABILITY, version: 1 },
      ],
    },
  ],
  ...overrides,
})

const validStatus = (): DeviceStatus => ({
  components: {
    main: {
      switch: { switch: { value: 'off' } },
      [LIGHTING_CAPABILITY]: {
        lighting: { value: 'on' },
        supportedLightingLevels: { value: ['on', 'off'] },
      },
    },
  },
})

const validDefinition = (): CapabilityDefinition => ({
  id: LIGHTING_CAPABILITY,
  version: 1,
  commands: {
    setLightingLevel: {
      name: 'setLightingLevel',
      arguments: [{ name: 'level' }],
    },
  },
})

describe('findCompatibleDevices', () => {
  test('keeps only devices with switch and lighting on the main component', () => {
    const wrongComponent = compatibleDevice({
      deviceId: 'device-2',
      components: [
        {
          id: 'secondary',
          capabilities: [
            { id: 'switch', version: 1 },
            { id: LIGHTING_CAPABILITY, version: 1 },
          ],
        },
      ],
    })
    const missingSwitch = compatibleDevice({
      deviceId: 'device-3',
      components: [
        {
          id: 'main',
          capabilities: [{ id: LIGHTING_CAPABILITY, version: 1 }],
        },
      ],
    })

    assert.deepEqual(
      findCompatibleDevices([wrongComponent, compatibleDevice(), missingSwitch]).map(
        device => device.deviceId,
      ),
      ['device-1'],
    )
  })
})

describe('validateDevice', () => {
  test('returns the current switch and lighting state for a valid device', () => {
    assert.deepEqual(
      validateDevice(compatibleDevice(), validStatus(), validDefinition()),
      { switchState: 'off', lightingState: 'on', supportedLightingLevels: ['on', 'off'] },
    )
  })

  test('rejects a device without main.switch status', () => {
    const status = validStatus()
    delete status.components.main?.switch

    assert.throws(
      () => validateDevice(compatibleDevice(), status, validDefinition()),
      /não informa main\.switch\.switch/i,
    )
  })

  test('rejects lighting levels that do not include on and off', () => {
    const status = validStatus()
    status.components.main![LIGHTING_CAPABILITY]!.supportedLightingLevels = {
      value: ['off'],
    }

    assert.throws(
      () => validateDevice(compatibleDevice(), status, validDefinition()),
      /não declara suporte aos níveis on e off/i,
    )
  })

  test('rejects a capability definition without setLightingLevel', () => {
    const definition = validDefinition()
    definition.commands = {}

    assert.throws(
      () => validateDevice(compatibleDevice(), validStatus(), definition),
      /não oferece o comando setLightingLevel/i,
    )
  })
})
