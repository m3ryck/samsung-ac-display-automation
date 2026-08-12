import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { AppError } from '../src/errors.js'
import type { Translator } from '../src/i18n/index.js'
import type { SupportedLocale } from '../src/i18n/locale.js'
import type { SmartThingsGateway } from '../src/smartthings/gateway.js'
import { runCli } from '../src/cli.js'
import { FakeGateway, FakeTerminal, managedRule } from './app/helpers.js'

class CliTerminal extends FakeTerminal {
  closeCalls = 0

  close(): void {
    this.closeCalls += 1
  }
}

interface CliHarness {
  gateway: FakeGateway
  gatewayCreations: number
  locales: SupportedLocale[]
  terminals: CliTerminal[]
  dependencies: {
    systemLocale: string
    createTerminal(translator: Translator): CliTerminal
    createGateway(): SmartThingsGateway
  }
}

const createHarness = (
  systemLocale: string,
  gateway: FakeGateway = new FakeGateway(),
): CliHarness => {
  const harness: CliHarness = {
    gateway,
    gatewayCreations: 0,
    locales: [],
    terminals: [],
    dependencies: {
      systemLocale,
      createTerminal(translator): CliTerminal {
        harness.locales.push(translator.locale)
        const terminal = new CliTerminal()
        harness.terminals.push(terminal)
        return terminal
      },
      createGateway(): SmartThingsGateway {
        harness.gatewayCreations += 1
        return harness.gateway
      },
    },
  }
  return harness
}

const onlyTerminal = (harness: CliHarness): CliTerminal => {
  assert.equal(harness.terminals.length, 1)
  return harness.terminals[0]!
}

const assertClosedOnce = (harness: CliHarness): void => {
  assert.equal(onlyTerminal(harness).closeCalls, 1)
}

describe('runCli language selection', () => {
  test('automatically selects Brazilian Portuguese from the system locale', async () => {
    const harness = createHarness('pt_BR')

    const exitCode = await runCli(['status'], harness.dependencies)

    assert.equal(exitCode, 0)
    assert.deepEqual(harness.locales, ['pt-BR'])
    assert.equal(
      onlyTerminal(harness).messages.at(-1)?.message,
      'Nenhuma configuração criada por este instalador foi encontrada.',
    )
    assertClosedOnce(harness)
  })

  test('falls back to English when the system locale is unsupported', async () => {
    const harness = createHarness('fr-FR')

    const exitCode = await runCli(['status'], harness.dependencies)

    assert.equal(exitCode, 0)
    assert.deepEqual(harness.locales, ['en'])
    assert.equal(
      onlyTerminal(harness).messages.at(-1)?.message,
      'No configuration created by this installer was found.',
    )
    assertClosedOnce(harness)
  })

  test('explicit language overrides the system locale', async () => {
    const harness = createHarness('pt-BR')

    const exitCode = await runCli(['status', '--lang', 'en'], harness.dependencies)

    assert.equal(exitCode, 0)
    assert.deepEqual(harness.locales, ['en'])
    assertClosedOnce(harness)
  })

  for (const scenario of [
    { name: 'separate value', arguments_: ['status', '--lang', 'pt'], locale: 'pt-BR' },
    { name: 'equals value', arguments_: ['status', '--lang=en-GB'], locale: 'en' },
  ] as const) {
    test(`accepts the --lang ${scenario.name} syntax`, async () => {
      const harness = createHarness(scenario.locale === 'en' ? 'pt-BR' : 'en-US')

      const exitCode = await runCli(scenario.arguments_, harness.dependencies)

      assert.equal(exitCode, 0)
      assert.deepEqual(harness.locales, [scenario.locale])
      assertClosedOnce(harness)
    })
  }
})

describe('runCli command dispatch', () => {
  test('dispatches setup to the setup flow', async () => {
    const harness = createHarness('en')

    const exitCode = await runCli(['setup'], harness.dependencies)

    assert.equal(exitCode, 0)
    assert.equal(
      onlyTerminal(harness).messages[0]?.message,
      'Air conditioner display Rule setup.',
    )
    assert.equal(harness.gatewayCreations, 1)
    assertClosedOnce(harness)
  })

  test('dispatches update to setup flow in update mode', async () => {
    const harness = createHarness('en')

    const exitCode = await runCli(['update'], harness.dependencies)

    assert.equal(exitCode, 0)
    assert.equal(
      onlyTerminal(harness).messages[0]?.message,
      'Air conditioner display Rule update.',
    )
    assert.equal(harness.gatewayCreations, 1)
    assertClosedOnce(harness)
  })

  test('dispatches status to the status flow', async () => {
    const gateway = new FakeGateway()
    gateway.rules = [managedRule('status-rule')]
    const harness = createHarness('en', gateway)

    const exitCode = await runCli(['status'], harness.dependencies)

    assert.equal(exitCode, 0)
    assert.match(onlyTerminal(harness).messages[0]?.message ?? '', /ID status-rule/)
    assert.equal(onlyTerminal(harness).confirmations.length, 0)
    assert.equal(harness.gatewayCreations, 1)
    assertClosedOnce(harness)
  })

  test('dispatches remove to the removal flow', async () => {
    const gateway = new FakeGateway()
    gateway.rules = [managedRule('remove-rule')]
    const harness = createHarness('en', gateway)

    const exitCode = await runCli(['remove'], harness.dependencies)

    assert.equal(exitCode, 0)
    assert.deepEqual(onlyTerminal(harness).confirmations, [
      'Remove this Rule from your SmartThings account?',
    ])
    assert.equal(onlyTerminal(harness).messages.at(-1)?.message, 'Operation cancelled. No changes were made.')
    assert.equal(harness.gatewayCreations, 1)
    assertClosedOnce(harness)
  })
})

describe('runCli validation', () => {
  for (const arguments_ of [[], ['unknown'], ['status', 'remove']] as const) {
    test(`rejects invalid command arguments ${JSON.stringify(arguments_)}`, async () => {
      const harness = createHarness('pt-BR')

      const exitCode = await runCli(arguments_, harness.dependencies)

      assert.equal(exitCode, 2)
      assert.deepEqual(onlyTerminal(harness).messages, [{
        level: 'error',
        message: 'Uso: npm run <setup|status|update|remove> -- [--lang en|pt-BR]',
      }])
      assert.equal(harness.gatewayCreations, 0)
      assertClosedOnce(harness)
    })
  }

  for (const scenario of [
    {
      name: 'missing language value',
      arguments_: ['status', '--lang'],
      systemLocale: 'pt-BR',
      locale: 'pt-BR',
      message: 'A opção --lang exige en ou pt-BR.',
    },
    {
      name: 'unsupported language',
      arguments_: ['status', '--lang=fr'],
      systemLocale: 'en-US',
      locale: 'en',
      message: 'Unsupported language "fr". Use en or pt-BR.',
    },
    {
      name: 'duplicate language option',
      arguments_: ['status', '--lang', 'en', '--lang=pt-BR'],
      systemLocale: 'de-DE',
      locale: 'en',
      message: 'Use --lang only once.',
    },
  ] as const) {
    test(`rejects ${scenario.name} before gateway construction`, async () => {
      const harness = createHarness(scenario.systemLocale)

      const exitCode = await runCli(scenario.arguments_, harness.dependencies)

      assert.equal(exitCode, 2)
      assert.deepEqual(harness.locales, [scenario.locale])
      assert.deepEqual(onlyTerminal(harness).messages, [{
        level: 'error',
        message: scenario.message,
      }])
      assert.equal(harness.gatewayCreations, 0)
      assertClosedOnce(harness)
    })
  }
})

describe('runCli error boundary', () => {
  test('localizes expected application failures', async () => {
    class FailingGateway extends FakeGateway {
      override async listLocations(): Promise<never> {
        throw new AppError('noLocations')
      }
    }
    const harness = createHarness('pt-BR', new FailingGateway())

    const exitCode = await runCli(['status'], harness.dependencies)

    assert.equal(exitCode, 1)
    assert.deepEqual(onlyTerminal(harness).messages, [{
      level: 'error',
      message: 'Nenhuma localização SmartThings foi encontrada nesta conta.',
    }])
    assertClosedOnce(harness)
  })

  test('localizes and sanitizes unexpected failures', async () => {
    class FailingGateway extends FakeGateway {
      override async listLocations(): Promise<never> {
        throw new Error('request failed: token=secret-value')
      }
    }
    const harness = createHarness('en', new FailingGateway())

    const exitCode = await runCli(['status'], harness.dependencies)

    assert.equal(exitCode, 1)
    assert.deepEqual(onlyTerminal(harness).messages, [{
      level: 'error',
      message: 'Unexpected error: request failed: token=[REDACTED]',
    }])
    assertClosedOnce(harness)
  })
})
