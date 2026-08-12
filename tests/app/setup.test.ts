import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { runSetup } from '../../src/app/setup.js'
import { device, FakeGateway, FakeTerminal, location, managedRule } from './helpers.js'

describe('runSetup', () => {
  test('rejects an account without locations or a location without a compatible AC', async () => {
    const noLocation = new FakeGateway()
    noLocation.locations = []
    await assert.rejects(runSetup(noLocation, new FakeTerminal()), /localização/i)

    const noDevice = new FakeGateway()
    noDevice.devices = []
    await assert.rejects(runSetup(noDevice, new FakeTerminal()), /compatível/i)
  })

  test('automatically uses a sole location and device, then creates the confirmed Rule', async () => {
    const gateway = new FakeGateway()
    const terminal = new FakeTerminal()
    terminal.confirmAnswers = [true, false]

    const result = await runSetup(gateway, terminal)

    assert.equal(result.outcome, 'created')
    assert.equal(gateway.created.length, 1)
    assert.match(gateway.created[0]!.rule.description, /delaySeconds=5/)
    assert.equal(terminal.selections.length, 0)
  })

  test('asks the user to choose when there are several locations and devices', async () => {
    const gateway = new FakeGateway()
    const secondLocation = { locationId: 'location-2', name: 'Praia' }
    const secondDevice = { ...device, deviceId: 'device-2', label: 'Ar da sala' }
    gateway.locations = [location, secondLocation]
    gateway.devices = [device, secondDevice]
    const terminal = new FakeTerminal()
    terminal.selectAnswers = [location, secondDevice]
    terminal.confirmAnswers = [true, false]

    await runSetup(gateway, terminal)

    assert.equal(terminal.selections.length, 2)
    assert.match(gateway.created[0]!.rule.description, /deviceId=device-2/)
  })

  test('does not mutate SmartThings when final confirmation is declined', async () => {
    const gateway = new FakeGateway()
    const terminal = new FakeTerminal()
    terminal.confirmAnswers = [false]

    const result = await runSetup(gateway, terminal)

    assert.equal(result.outcome, 'cancelled')
    assert.equal(gateway.created.length, 0)
  })

  test('keeps an existing managed Rule without creating a duplicate', async () => {
    const gateway = new FakeGateway()
    gateway.rules = [managedRule()]
    const terminal = new FakeTerminal()
    terminal.selectAnswers = ['keep']

    const result = await runSetup(gateway, terminal)

    assert.equal(result.outcome, 'kept')
    assert.equal(gateway.created.length + gateway.updated.length + gateway.deleted.length, 0)
  })

  test('replaces one existing Rule and removes managed duplicates only after success', async () => {
    const gateway = new FakeGateway()
    gateway.rules = [managedRule('rule-1'), managedRule('rule-duplicate')]
    const terminal = new FakeTerminal()
    terminal.selectAnswers = ['replace']
    terminal.inputAnswers = ['8']
    terminal.confirmAnswers = [true, false]

    const result = await runSetup(gateway, terminal)

    assert.equal(result.outcome, 'updated')
    assert.deepEqual(gateway.updated.map(call => call.ruleId), ['rule-1'])
    assert.deepEqual(gateway.deleted.map(call => call.ruleId), ['rule-duplicate'])
    assert.match(gateway.updated[0]!.rule.description, /delaySeconds=8/)
  })

  test('removes every duplicate only after an explicit confirmation', async () => {
    const gateway = new FakeGateway()
    gateway.rules = [managedRule('rule-1'), managedRule('rule-2')]
    const terminal = new FakeTerminal()
    terminal.selectAnswers = ['remove']
    terminal.confirmAnswers = [true]

    const result = await runSetup(gateway, terminal)

    assert.equal(result.outcome, 'removed')
    assert.deepEqual(gateway.deleted.map(call => call.ruleId), ['rule-1', 'rule-2'])
  })
})
