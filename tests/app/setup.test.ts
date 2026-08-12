import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { runSetup } from '../../src/app/setup.js'
import type { RuleRequest } from '../../src/domain/types.js'
import { AppError } from '../../src/errors.js'
import {
  device,
  FakeGateway,
  FakeTerminal,
  location,
  managedRule,
  status,
  translator,
} from './helpers.js'

const locales = [
  {
    locale: 'en' as const,
    title: 'Air conditioner display Rule setup.',
    locationPrompt: 'Which location contains the air conditioner?',
    devicePrompt: 'Which air conditioner should have its display turned off?',
    delayPrompt: 'How many seconds after the air conditioner turns on should the display turn off? (0 to 60)',
    invalidDelay: 'Enter a whole number from 0 to 60.',
    currentState: 'Current state: air conditioner on; display off.',
    actionFive: 'Action: when the air conditioner turns on, wait 5 seconds and turn off only the display.',
    actionZero: 'Action: when the air conditioner turns on, wait 0 seconds and turn off only the display.',
    save: 'Allow this Rule to be saved to your SmartThings account?',
    cancelled: 'Operation cancelled. No changes were made.',
    existingPrompt: 'A configuration already exists for this device. What would you like to do?',
    keep: 'Keep it as it is',
    replace: 'Update the configuration',
    removeOne: 'Remove the configuration',
    removeTwo: 'Remove all 2 duplicate configurations',
    kept: 'The existing configuration was kept. No changes were made.',
    removeConfirmation: 'Remove all 2 configurations from SmartThings?',
    removed: 'Configuration removed. This Rule will no longer change the display.',
    updated: 'Configuration updated without creating a duplicate Rule.',
    created: 'Configuration successfully installed in the SmartThings cloud.',
  },
  {
    locale: 'pt-BR' as const,
    title: 'Configuração da Rule do visor do ar-condicionado.',
    locationPrompt: 'Em qual localização está o ar-condicionado?',
    devicePrompt: 'Qual ar-condicionado deve ter o visor apagado?',
    delayPrompt: 'Quantos segundos depois de ligar o ar o visor deve apagar? (0 a 60)',
    invalidDelay: 'Informe um número inteiro entre 0 e 60.',
    currentState: 'Estado atual: ar ligado; visor desligado.',
    actionFive: 'Ação: ao detectar que o ar ligou, aguardar 5 segundos e apagar somente o visor.',
    actionZero: 'Ação: ao detectar que o ar ligou, aguardar 0 segundo e apagar somente o visor.',
    save: 'Autoriza salvar esta Rule na sua conta SmartThings?',
    cancelled: 'Operação cancelada. Nenhuma alteração foi feita.',
    existingPrompt: 'Já existe uma configuração para este aparelho. O que deseja fazer?',
    keep: 'Manter como está',
    replace: 'Atualizar a configuração',
    removeOne: 'Remover a configuração',
    removeTwo: 'Remover as 2 configurações duplicadas',
    kept: 'A configuração existente foi mantida. Nenhuma alteração foi feita.',
    removeConfirmation: 'Confirma a remoção das 2 configurações do SmartThings?',
    removed: 'Configuração removida. Esta Rule não alterará mais o visor.',
    updated: 'Configuração atualizada sem criar uma Rule duplicada.',
    created: 'Configuração instalada com sucesso na nuvem do SmartThings.',
  },
]

const messages = (terminal: FakeTerminal): string[] =>
  terminal.messages.map(entry => entry.message)

const assertRawRuleStates = (rule: RuleRequest): void => {
  const firstAction = rule.actions[0]
  assert.ok(firstAction && 'if' in firstAction)
  assert.deepEqual(firstAction.if.changes.equals.right, { string: 'on' })
  const lastAction = firstAction.if.then.at(-1)
  assert.ok(lastAction && 'command' in lastAction)
  assert.deepEqual(lastAction.command.commands[0]?.arguments, [{ string: 'off' }])
}

describe('runSetup', () => {
  for (const copy of locales) {
    test(`reports typed selection errors through the ${copy.locale} flow`, async () => {
      const t = await translator(copy.locale)
      const noLocation = new FakeGateway()
      noLocation.locations = []
      await assert.rejects(
        runSetup(noLocation, new FakeTerminal(), t),
        (error: unknown) => error instanceof AppError && error.code === 'noLocations',
      )

      const noDevice = new FakeGateway()
      noDevice.devices = []
      await assert.rejects(
        runSetup(noDevice, new FakeTerminal(), t),
        (error: unknown) => error instanceof AppError && error.code === 'noCompatibleDevices',
      )
    })

    test(`creates a Rule through the ${copy.locale} flow`, async () => {
      const gateway = new FakeGateway()
      gateway.statuses = [status('on', 'off')]
      const terminal = new FakeTerminal()
      terminal.confirmAnswers = [true, false]
      const t = await translator(copy.locale)

      const result = await runSetup(gateway, terminal, t)

      assert.equal(result.outcome, 'created')
      assert.equal(gateway.created.length, 1)
      assert.match(gateway.created[0]!.rule.description, /delaySeconds=5/)
      assertRawRuleStates(gateway.created[0]!.rule)
      assert.equal(terminal.selections.length, 0)
      assert.equal(terminal.messages[0]?.message, copy.title)
      assert.ok(messages(terminal).includes(copy.currentState))
      assert.ok(messages(terminal).includes(copy.actionFive))
      assert.ok(messages(terminal).includes(copy.created))
      assert.ok(terminal.inputs.includes(copy.delayPrompt))
      assert.ok(terminal.confirmations.includes(copy.save))
    })

    test(`renders a zero-second delay correctly in the ${copy.locale} flow`, async () => {
      const gateway = new FakeGateway()
      const terminal = new FakeTerminal()
      terminal.inputAnswers = ['invalid', '0']
      terminal.confirmAnswers = [true, false]
      const t = await translator(copy.locale)

      await runSetup(gateway, terminal, t)

      assert.match(gateway.created[0]!.rule.description, /delaySeconds=0/)
      assert.ok(messages(terminal).includes(copy.invalidDelay))
      assert.ok(messages(terminal).includes(copy.actionZero))
    })

    test(`localizes multiple location and device selections in the ${copy.locale} flow`, async () => {
      const gateway = new FakeGateway()
      const secondLocation = { locationId: 'location-2', name: 'Praia' }
      const secondDevice = { ...device, deviceId: 'device-2', label: 'Ar da sala' }
      gateway.locations = [location, secondLocation]
      gateway.devices = [device, secondDevice]
      const terminal = new FakeTerminal()
      terminal.selectAnswers = [location, secondDevice]
      terminal.confirmAnswers = [true, false]
      const t = await translator(copy.locale)

      await runSetup(gateway, terminal, t)

      assert.deepEqual(terminal.selections.map(selection => selection.message), [
        copy.locationPrompt,
        copy.devicePrompt,
      ])
      assert.match(gateway.created[0]!.rule.description, /deviceId=device-2/)
    })

    test(`cancels without mutating SmartThings through the ${copy.locale} flow`, async () => {
      const gateway = new FakeGateway()
      const terminal = new FakeTerminal()
      terminal.confirmAnswers = [false]
      const t = await translator(copy.locale)

      const result = await runSetup(gateway, terminal, t)

      assert.equal(result.outcome, 'cancelled')
      assert.equal(gateway.created.length + gateway.updated.length + gateway.deleted.length, 0)
      assert.ok(messages(terminal).includes(copy.cancelled))
    })

    test(`keeps an existing Rule through the ${copy.locale} flow`, async () => {
      const gateway = new FakeGateway()
      gateway.rules = [managedRule()]
      const terminal = new FakeTerminal()
      terminal.selectAnswers = ['keep']
      const t = await translator(copy.locale)

      const result = await runSetup(gateway, terminal, t)

      assert.equal(result.outcome, 'kept')
      assert.equal(gateway.created.length + gateway.updated.length + gateway.deleted.length, 0)
      assert.deepEqual(terminal.selections[0], {
        message: copy.existingPrompt,
        labels: [copy.keep, copy.replace, copy.removeOne],
      })
      assert.ok(messages(terminal).includes(copy.kept))
    })

    test(`replaces one Rule and removes duplicates through the ${copy.locale} flow`, async () => {
      const gateway = new FakeGateway()
      gateway.rules = [managedRule('rule-1'), managedRule('rule-duplicate')]
      const terminal = new FakeTerminal()
      terminal.selectAnswers = ['replace']
      terminal.inputAnswers = ['8']
      terminal.confirmAnswers = [true, false]
      const t = await translator(copy.locale)

      const result = await runSetup(gateway, terminal, t)

      assert.equal(result.outcome, 'updated')
      assert.deepEqual(gateway.updated.map(call => call.ruleId), ['rule-1'])
      assert.deepEqual(gateway.deleted.map(call => call.ruleId), ['rule-duplicate'])
      assert.match(gateway.updated[0]!.rule.description, /delaySeconds=8/)
      assertRawRuleStates(gateway.updated[0]!.rule)
      assert.deepEqual(terminal.selections[0]?.labels, [copy.keep, copy.replace, copy.removeTwo])
      assert.ok(messages(terminal).includes(copy.updated))
    })

    test(`removes every duplicate only after confirmation in the ${copy.locale} flow`, async () => {
      const gateway = new FakeGateway()
      gateway.rules = [managedRule('rule-1'), managedRule('rule-2')]
      const terminal = new FakeTerminal()
      terminal.selectAnswers = ['remove']
      terminal.confirmAnswers = [true]
      const t = await translator(copy.locale)

      const result = await runSetup(gateway, terminal, t)

      assert.equal(result.outcome, 'removed')
      assert.deepEqual(gateway.deleted.map(call => call.ruleId), ['rule-1', 'rule-2'])
      assert.ok(terminal.confirmations.includes(copy.removeConfirmation))
      assert.ok(messages(terminal).includes(copy.removed))
    })
  }
})
