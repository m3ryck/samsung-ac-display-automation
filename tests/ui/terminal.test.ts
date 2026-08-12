import assert from 'node:assert/strict'
import { PassThrough, Writable } from 'node:stream'
import { describe, test } from 'node:test'

import type { Translator } from '../../src/i18n/index.js'
import { createTranslator } from '../../src/i18n/index.js'
import { AppError } from '../../src/errors.js'
import { formatError } from '../../src/i18n/format-error.js'
import { ConsoleTerminal } from '../../src/ui/terminal.js'

interface TestTerminal {
  terminal: ConsoleTerminal
  output(): string
}

const terminalWithAnswers = (translator: Translator, answers: string[]): TestTerminal => {
  const input = new PassThrough()
  let rendered = ''
  const output = new Writable({
    write(chunk, _encoding, callback) {
      const text = chunk.toString()
      rendered += text
      if (text.endsWith(': ')) {
        const answer = answers.shift()
        if (answer !== undefined) queueMicrotask(() => input.write(`${answer}\n`))
      }
      callback()
    },
  })
  return {
    terminal: new ConsoleTerminal(translator, { input, output }),
    output: () => rendered,
  }
}

describe('ConsoleTerminal', () => {
  test('accepts every English yes answer', async () => {
    const english = await createTranslator('en')
    for (const answer of ['y', 'yes']) {
      const fixture = terminalWithAnswers(english, [answer])
      assert.equal(await fixture.terminal.confirm('Continue?'), true)
      fixture.terminal.close()
    }
  })

  test('accepts every English no answer', async () => {
    const english = await createTranslator('en')
    for (const answer of ['n', 'no']) {
      const fixture = terminalWithAnswers(english, [answer])
      assert.equal(await fixture.terminal.confirm('Continue?', true), false)
      fixture.terminal.close()
    }
  })

  test('accepts every Portuguese yes answer', async () => {
    const portuguese = await createTranslator('pt-BR')
    for (const answer of ['s', 'sim']) {
      const fixture = terminalWithAnswers(portuguese, [answer])
      assert.equal(await fixture.terminal.confirm('Continuar?'), true)
      fixture.terminal.close()
    }
  })

  test('accepts Portuguese no answers with and without the accent', async () => {
    const portuguese = await createTranslator('pt-BR')
    for (const answer of ['n', 'não', 'nao']) {
      const fixture = terminalWithAnswers(portuguese, [answer])
      assert.equal(await fixture.terminal.confirm('Continuar?', true), false)
      fixture.terminal.close()
    }
  })

  test('retries invalid answers with the localized warning', async () => {
    const expectations = [
      {
        locale: 'en' as const,
        answers: ['maybe', 'yes'],
        prompt: /Continue\? \(y\/N\): /,
        warning: /Warning: Answer yes or no\./,
      },
      {
        locale: 'pt-BR' as const,
        answers: ['talvez', 'sim'],
        prompt: /Continue\? \(s\/N\): /,
        warning: /Aviso: Responda com sim ou não\./,
      },
    ]

    for (const expectation of expectations) {
      const t = await createTranslator(expectation.locale)
      const fixture = terminalWithAnswers(t, expectation.answers)
      assert.equal(await fixture.terminal.confirm('Continue?'), true)
      assert.match(fixture.output(), expectation.prompt)
      assert.match(fixture.output(), expectation.warning)
      fixture.terminal.close()
    }
  })

  test('prints localized warning and error prefixes', async context => {
    const expectations = [
      { locale: 'en' as const, warning: 'Warning: Careful\n', error: 'Error: Broken\n' },
      { locale: 'pt-BR' as const, warning: 'Aviso: Cuidado\n', error: 'Erro: Quebrou\n' },
    ]

    for (const expectation of expectations) {
      const t = await createTranslator(expectation.locale)
      const fixture = terminalWithAnswers(t, [])
      context.after(() => fixture.terminal.close())
      fixture.terminal.warning(expectation.locale === 'en' ? 'Careful' : 'Cuidado')
      fixture.terminal.error(expectation.locale === 'en' ? 'Broken' : 'Quebrou')
      assert.equal(fixture.output(), expectation.warning + expectation.error)
    }
  })

  test('localizes selection prompts, range warnings, and empty-selection errors', async () => {
    const expectations = [
      {
        locale: 'en' as const,
        prompt: 'Enter the option number',
        warning: 'Warning: Choose a number from 1 to 2.',
        empty: 'There are no options available for selection.',
      },
      {
        locale: 'pt-BR' as const,
        prompt: 'Digite o número da opção',
        warning: 'Aviso: Escolha um número entre 1 e 2.',
        empty: 'Não há opções disponíveis para seleção.',
      },
    ]

    for (const expectation of expectations) {
      const t = await createTranslator(expectation.locale)
      const fixture = terminalWithAnswers(t, ['0', '2'])
      const selected = await fixture.terminal.select('Pick', [
        { label: 'One', value: 1 },
        { label: 'Two', value: 2 },
      ])
      assert.equal(selected, 2)
      assert.match(fixture.output(), new RegExp(expectation.prompt))
      assert.match(fixture.output(), new RegExp(expectation.warning.replaceAll('.', '\\.')))
      await assert.rejects(
        fixture.terminal.select('Pick', []),
        (error: unknown) =>
          error instanceof AppError &&
          error.code === 'emptySelection' &&
          formatError(error, t) === expectation.empty,
      )
      fixture.terminal.close()
    }
  })
})
