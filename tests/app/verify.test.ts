import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { verifyInstalledRule, type VerificationClock } from '../../src/app/verify.js'
import { device, FakeGateway, FakeTerminal, status } from './helpers.js'

class FakeClock implements VerificationClock {
  time = 0
  now(): number {
    return this.time
  }
  async wait(milliseconds: number): Promise<void> {
    this.time += milliseconds
  }
}

describe('verifyInstalledRule', () => {
  test('succeeds after observing the AC turn on and its display turn off', async () => {
    const gateway = new FakeGateway()
    gateway.statuses = [status('off', 'on'), status('on', 'on'), status('on', 'off')]
    const terminal = new FakeTerminal()

    const verified = await verifyInstalledRule(gateway, terminal, device, {
      clock: new FakeClock(),
      pollMilliseconds: 1_000,
      timeoutMilliseconds: 5_000,
    })

    assert.equal(verified, true)
    assert.match(terminal.messages.at(-1)!.message, /funcionou/i)
  })

  test('times out without controlling the AC when the display does not turn off', async () => {
    const gateway = new FakeGateway()
    gateway.statuses = [status('off', 'on'), status('on', 'on')]
    const terminal = new FakeTerminal()

    const verified = await verifyInstalledRule(gateway, terminal, device, {
      clock: new FakeClock(),
      pollMilliseconds: 1_000,
      timeoutMilliseconds: 3_000,
    })

    assert.equal(verified, false)
    assert.equal(gateway.created.length, 0)
    assert.match(terminal.messages.at(-1)!.message, /não foi possível confirmar/i)
  })
})
