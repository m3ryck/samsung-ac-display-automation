import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { verifyInstalledRule, type VerificationClock } from '../../src/app/verify.js'
import { device, FakeGateway, FakeTerminal, status, translator } from './helpers.js'

class FakeClock implements VerificationClock {
  time = 0
  now(): number {
    return this.time
  }
  async wait(milliseconds: number): Promise<void> {
    this.time += milliseconds
  }
}

const locales = [
  {
    locale: 'en' as const,
    turnOff: 'Turn off Ar do quarto normally. The installer will only observe its state.',
    turnOffTimeout: 'Could not confirm that the air conditioner was turned off.',
    turnOn: 'Now turn on Ar do quarto normally. I will wait for the display to turn off.',
    success: 'The test worked: the air conditioner turned on and the display turned off.',
    timeout: 'Could not confirm operation before the time limit. No command was sent to the device.',
  },
  {
    locale: 'pt-BR' as const,
    turnOff: 'Desligue Ar do quarto normalmente. O instalador apenas observará o estado.',
    turnOffTimeout: 'Não foi possível confirmar que o ar-condicionado foi desligado.',
    turnOn: 'Agora ligue Ar do quarto normalmente. Aguardarei o visor apagar.',
    success: 'O teste funcionou: o ar-condicionado ligou e o visor ficou apagado.',
    timeout: 'Não foi possível confirmar o funcionamento dentro do tempo limite. Nenhum comando foi enviado ao aparelho.',
  },
]

const assertNoMutation = (gateway: FakeGateway): void => {
  assert.equal(gateway.created.length, 0)
  assert.equal(gateway.updated.length, 0)
  assert.equal(gateway.deleted.length, 0)
}

describe('verifyInstalledRule', () => {
  for (const copy of locales) {
    test(`succeeds after observing the AC and display states in ${copy.locale}`, async () => {
      const gateway = new FakeGateway()
      gateway.statuses = [status('off', 'on'), status('on', 'on'), status('on', 'off')]
      const terminal = new FakeTerminal()

      const verified = await verifyInstalledRule(gateway, terminal, await translator(copy.locale), device, {
        clock: new FakeClock(),
        pollMilliseconds: 1_000,
        timeoutMilliseconds: 5_000,
      })

      assert.equal(verified, true)
      assert.deepEqual(terminal.messages.map(entry => entry.message), [copy.turnOn, copy.success])
      assertNoMutation(gateway)
    })

    test(`warns when the AC does not turn off in ${copy.locale}`, async () => {
      const gateway = new FakeGateway()
      gateway.statuses = [status('on', 'on')]
      const terminal = new FakeTerminal()

      const verified = await verifyInstalledRule(gateway, terminal, await translator(copy.locale), device, {
        clock: new FakeClock(),
        pollMilliseconds: 1_000,
        timeoutMilliseconds: 3_000,
      })

      assert.equal(verified, false)
      assert.deepEqual(terminal.messages.map(entry => entry.message), [copy.turnOff, copy.turnOffTimeout])
      assertNoMutation(gateway)
    })

    test(`warns when the display does not turn off in ${copy.locale}`, async () => {
      const gateway = new FakeGateway()
      gateway.statuses = [status('off', 'on'), status('on', 'on')]
      const terminal = new FakeTerminal()

      const verified = await verifyInstalledRule(gateway, terminal, await translator(copy.locale), device, {
        clock: new FakeClock(),
        pollMilliseconds: 1_000,
        timeoutMilliseconds: 3_000,
      })

      assert.equal(verified, false)
      assert.deepEqual(terminal.messages.map(entry => entry.message), [copy.turnOn, copy.timeout])
      assertNoMutation(gateway)
    })
  }
})
