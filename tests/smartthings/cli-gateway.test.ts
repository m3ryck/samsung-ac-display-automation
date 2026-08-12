import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, test } from 'node:test'

import { LIGHTING_CAPABILITY } from '../../src/domain/devices.js'
import type { RuleRequest } from '../../src/domain/types.js'
import { CliSmartThingsGateway } from '../../src/smartthings/cli-gateway.js'
import type { CliCommandRunner } from '../../src/smartthings/cli-runner.js'

class FakeRunner implements CliCommandRunner {
  readonly calls: Array<{ mode: 'json' | 'text'; arguments_: string[] }> = []
  readonly responses = new Map<string, unknown>()
  inspectInput?: (path: string) => Promise<void>

  async runJson(arguments_: string[]): Promise<unknown> {
    this.calls.push({ mode: 'json', arguments_ })
    const inputIndex = arguments_.indexOf('--input')
    if (inputIndex >= 0 && this.inspectInput) {
      await this.inspectInput(arguments_[inputIndex + 1]!)
    }
    return this.responses.get(arguments_[0]!) ?? []
  }

  async run(arguments_: string[]): Promise<string> {
    this.calls.push({ mode: 'text', arguments_ })
    return ''
  }
}

const ruleRequest: RuleRequest = {
  name: 'Rule de teste',
  description: 'descrição',
  actions: [],
}

describe('CliSmartThingsGateway', () => {
  test('uses explicit JSON commands to discover locations, devices, status, capability, and rules', async () => {
    const runner = new FakeRunner()
    runner.responses.set('locations', { items: [{ locationId: 'location-1', name: 'Casa' }] })
    runner.responses.set('devices', [{ deviceId: 'device-1' }])
    runner.responses.set('devices:status', { components: {} })
    runner.responses.set('capabilities', { id: LIGHTING_CAPABILITY, commands: {} })
    runner.responses.set('rules', [{ id: 'rule-1' }])
    const gateway = new CliSmartThingsGateway({ runner })

    assert.equal((await gateway.listLocations())[0]?.locationId, 'location-1')
    assert.equal((await gateway.listDevices('location-1'))[0]?.deviceId, 'device-1')
    await gateway.getDeviceStatus('device-1')
    await gateway.getLightingCapabilityDefinition()
    assert.deepEqual((await gateway.listRules('location-1'))[0], {
      id: 'rule-1',
      locationId: 'location-1',
    })

    assert.deepEqual(runner.calls, [
      { mode: 'json', arguments_: ['locations', '--json'] },
      {
        mode: 'json',
        arguments_: [
          'devices',
          '--location',
          'location-1',
          '--capability',
          LIGHTING_CAPABILITY,
          '--json',
        ],
      },
      { mode: 'json', arguments_: ['devices:status', 'device-1', '--json'] },
      { mode: 'json', arguments_: ['capabilities', LIGHTING_CAPABILITY, '--json'] },
      {
        mode: 'json',
        arguments_: ['rules', '--location', 'location-1', '--json'],
      },
    ])
  })

  test('writes Rule input with restrictive permissions and always removes the temporary directory', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'display-rule-gateway-test-'))
    const runner = new FakeRunner()
    runner.responses.set('rules:create', { id: 'rule-1', ...ruleRequest })
    runner.inspectInput = async path => {
      assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), ruleRequest)
      assert.equal((await stat(path)).mode & 0o777, 0o600)
    }
    const gateway = new CliSmartThingsGateway({ runner, temporaryRoot })

    try {
      const created = await gateway.createRule('location-1', ruleRequest)
      assert.equal(created.id, 'rule-1')
      assert.equal(created.locationId, 'location-1')
      assert.deepEqual(await readdir(temporaryRoot), [])
      assert.equal(runner.calls[0]?.arguments_[0], 'rules:create')
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  })

  test('updates and deletes a Rule by explicit IDs without interactive CLI prompts', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'display-rule-gateway-test-'))
    const runner = new FakeRunner()
    runner.responses.set('rules:update', { id: 'rule-1', ...ruleRequest })
    const gateway = new CliSmartThingsGateway({ runner, temporaryRoot })

    try {
      const updated = await gateway.updateRule('location-1', 'rule-1', ruleRequest)
      await gateway.deleteRule('location-1', 'rule-1')

      assert.equal(updated.locationId, 'location-1')
      assert.deepEqual(runner.calls.map(call => call.arguments_.slice(0, 4)), [
        ['rules:update', 'rule-1', '--location', 'location-1'],
        ['rules:delete', 'rule-1', '--location', 'location-1'],
      ])
      assert.deepEqual(await readdir(temporaryRoot), [])
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  })
})
