import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  LIGHTING_CAPABILITY,
  findCompatibleDevices,
  validateDevice,
} from '../../src/domain/devices.js'
import { AppError, type AppErrorCode } from '../../src/errors.js'
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

const hasCode = (code: AppErrorCode) => (error: unknown): boolean =>
  error instanceof AppError && error.code === code

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

  test('rejects a device without the required main capabilities', () => {
    const device = compatibleDevice({
      components: [{ id: 'main', capabilities: [{ id: 'switch', version: 1 }] }],
    })

    assert.throws(
      () => validateDevice(device, validStatus(), validDefinition()),
      hasCode('missingCapabilities'),
    )
  })

  test('rejects a device without main.switch status', () => {
    const status = validStatus()
    delete status.components.main?.switch

    assert.throws(
      () => validateDevice(compatibleDevice(), status, validDefinition()),
      hasCode('invalidSwitchState'),
    )
  })

  test('rejects a lighting status other than on or off', () => {
    const status = validStatus()
    status.components.main![LIGHTING_CAPABILITY]!.lighting = { value: 'dimmed' }

    assert.throws(
      () => validateDevice(compatibleDevice(), status, validDefinition()),
      hasCode('invalidLightingState'),
    )
  })

  test('rejects lighting levels that do not include on and off', () => {
    const status = validStatus()
    status.components.main![LIGHTING_CAPABILITY]!.supportedLightingLevels = {
      value: ['off'],
    }

    assert.throws(
      () => validateDevice(compatibleDevice(), status, validDefinition()),
      hasCode('unsupportedLightingLevels'),
    )
  })

  test('rejects a capability definition without setLightingLevel', () => {
    const definition = validDefinition()
    definition.commands = {}

    assert.throws(
      () => validateDevice(compatibleDevice(), validStatus(), definition),
      hasCode('missingLightingCommand'),
    )
  })
})
