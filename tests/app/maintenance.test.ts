import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { runRemove } from '../../src/app/remove.js'
import { runStatus } from '../../src/app/status.js'
import { FakeGateway, FakeTerminal, managedRule, translator } from './helpers.js'

const locales = [
  {
    locale: 'en' as const,
    delayOne: '1 second of delay',
    delayTwo: '2 seconds of delay',
    unknown: '?',
    noConfigurations: 'No configuration created by this installer was found.',
    removeAll: 'Remove all 2 configurations',
    choose: 'Which configuration would you like to remove?',
    confirmOne: 'Remove this Rule from your SmartThings account?',
    confirmTwo: 'Remove all 2 Rules from your SmartThings account?',
    removedOne: '1 configuration removed.',
    removedTwo: '2 configurations removed.',
  },
  {
    locale: 'pt-BR' as const,
    delayOne: '1 segundo de atraso',
    delayTwo: '2 segundos de atraso',
    unknown: '?',
    noConfigurations: 'Nenhuma configuração criada por este instalador foi encontrada.',
    removeAll: 'Remover todas as 2 configurações',
    choose: 'Qual configuração deseja remover?',
    confirmOne: 'Confirma a remoção desta Rule da sua conta SmartThings?',
    confirmTwo: 'Confirma a remoção das 2 Rules da sua conta SmartThings?',
    removedOne: '1 configuração removida.',
    removedTwo: '2 configurações removidas.',
  },
]

describe('maintenance flows', () => {
  for (const copy of locales) {
    test(`reports managed Rules and natural delays in ${copy.locale}`, async () => {
      const gateway = new FakeGateway()
      gateway.rules = [
        managedRule('rule-1', 1),
        managedRule('rule-2', 2),
        { id: 'foreign', locationId: 'location-1', name: 'Outra', actions: [] },
      ]
      const terminal = new FakeTerminal()

      const count = await runStatus(gateway, terminal, await translator(copy.locale))

      assert.equal(count, 2)
      assert.equal(
        terminal.messages[0]?.message,
        `Casa: [Visor AC SmartThings] Ar do quarto — ${copy.delayOne} (ID rule-1).`,
      )
      assert.equal(
        terminal.messages[1]?.message,
        `Casa: [Visor AC SmartThings] Ar do quarto — ${copy.delayTwo} (ID rule-2).`,
      )
    })

    test(`uses the localized unknown fallback for missing delay metadata in ${copy.locale}`, async () => {
      const gateway = new FakeGateway()
      gateway.rules = [{
        ...managedRule('rule-unknown'),
        description: '[Visor AC SmartThings];version=1;deviceId=device-1',
      }]
      const terminal = new FakeTerminal()

      const count = await runStatus(gateway, terminal, await translator(copy.locale))

      assert.equal(count, 1)
      assert.equal(
        terminal.messages.at(-1)?.message,
        `Casa: [Visor AC SmartThings] Ar do quarto — ${copy.unknown} (ID rule-unknown).`,
      )
    })

    test(`reports no managed Rules for status and removal in ${copy.locale}`, async () => {
      const statusTerminal = new FakeTerminal()
      const removeTerminal = new FakeTerminal()

      const [statusCount, removeCount] = await Promise.all([
        runStatus(new FakeGateway(), statusTerminal, await translator(copy.locale)),
        runRemove(new FakeGateway(), removeTerminal, await translator(copy.locale)),
      ])

      assert.deepEqual([statusCount, removeCount], [0, 0])
      assert.equal(statusTerminal.messages.at(-1)?.message, copy.noConfigurations)
      assert.equal(removeTerminal.messages.at(-1)?.message, copy.noConfigurations)
    })

    test(`removes one managed Rule with singular copy in ${copy.locale}`, async () => {
      const gateway = new FakeGateway()
      gateway.rules = [managedRule('rule-1')]
      const terminal = new FakeTerminal()
      terminal.confirmAnswers = [true]

      const count = await runRemove(gateway, terminal, await translator(copy.locale))

      assert.equal(count, 1)
      assert.deepEqual(gateway.deleted.map(call => call.ruleId), ['rule-1'])
      assert.deepEqual(terminal.confirmations, [copy.confirmOne])
      assert.equal(terminal.messages.at(-1)?.message, copy.removedOne)
    })

    test(`removes all managed Rules with plural copy in ${copy.locale}`, async () => {
      const gateway = new FakeGateway()
      gateway.rules = [managedRule('rule-1'), managedRule('rule-2')]
      const terminal = new FakeTerminal()
      terminal.selectAnswers = ['all']
      terminal.confirmAnswers = [true]

      const count = await runRemove(gateway, terminal, await translator(copy.locale))

      assert.equal(count, 2)
      assert.deepEqual(gateway.deleted.map(call => call.ruleId), ['rule-1', 'rule-2'])
      assert.deepEqual(terminal.selections, [{ message: copy.choose, labels: [copy.removeAll, 'Casa: [Visor AC SmartThings] Ar do quarto', 'Casa: [Visor AC SmartThings] Ar do quarto'] }])
      assert.deepEqual(terminal.confirmations, [copy.confirmTwo])
      assert.equal(terminal.messages.at(-1)?.message, copy.removedTwo)
    })
  }
})
