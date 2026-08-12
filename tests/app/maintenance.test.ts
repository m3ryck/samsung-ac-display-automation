import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { runRemove } from '../../src/app/remove.js'
import { runStatus } from '../../src/app/status.js'
import { FakeGateway, FakeTerminal, managedRule } from './helpers.js'

describe('maintenance flows', () => {
  test('status reports only Rules managed by this installer', async () => {
    const gateway = new FakeGateway()
    gateway.rules = [
      managedRule(),
      { id: 'foreign', locationId: 'location-1', name: 'Outra', actions: [] },
    ]
    const terminal = new FakeTerminal()

    const count = await runStatus(gateway, terminal)

    assert.equal(count, 1)
    assert.match(terminal.messages.at(-1)!.message, /5 segundo/i)
  })

  test('remove can delete all managed Rules after confirmation', async () => {
    const gateway = new FakeGateway()
    gateway.rules = [managedRule('rule-1'), managedRule('rule-2')]
    const terminal = new FakeTerminal()
    terminal.selectAnswers = ['all']
    terminal.confirmAnswers = [true]

    const count = await runRemove(gateway, terminal)

    assert.equal(count, 2)
    assert.deepEqual(gateway.deleted.map(call => call.ruleId), ['rule-1', 'rule-2'])
  })
})
