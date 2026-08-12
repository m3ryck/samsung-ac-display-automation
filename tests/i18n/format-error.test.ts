import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { AppError } from '../../src/errors.js'
import { formatError } from '../../src/i18n/format-error.js'
import { createTranslator } from '../../src/i18n/index.js'
import type { SupportedLocale } from '../../src/i18n/locale.js'

const expectedByLocale: Record<
  SupportedLocale,
  {
    invalidDelay: string
    invalidCliResponse: string
    cliProcessFailed: string
    cliProcessFailedWithoutDetails: string
    cliLaunchFailedWithoutDetails: string
    unexpectedWithoutDetails: string
    unexpected: string
  }
> = {
  en: {
    invalidDelay: 'The delay must be a whole number from 0 to 60 seconds.',
    invalidCliResponse: 'The SmartThings CLI returned an invalid response while reading the created Rule.',
    cliProcessFailed:
      'SmartThings CLI exited with code 1: Authorization: Bearer [REDACTED]\nLogin recusado',
    cliProcessFailedWithoutDetails:
      'SmartThings CLI exited with code 23: No details were provided.',
    cliLaunchFailedWithoutDetails:
      'Could not start the SmartThings CLI: No details were provided.',
    unexpectedWithoutDetails: 'Unexpected error: No details were provided.',
    unexpected: 'Unexpected error: Authorization: Bearer [REDACTED]\nConnection refused',
  },
  'pt-BR': {
    invalidDelay: 'O atraso deve ser um número inteiro entre 0 e 60 segundos.',
    invalidCliResponse:
      'A SmartThings CLI retornou uma resposta inválida ao consultar a Rule criada.',
    cliProcessFailed:
      'A SmartThings CLI terminou com código 1: Authorization: Bearer [REDACTED]\nLogin recusado',
    cliProcessFailedWithoutDetails:
      'A SmartThings CLI terminou com código 23: Nenhum detalhe foi fornecido.',
    cliLaunchFailedWithoutDetails:
      'Não foi possível iniciar a SmartThings CLI: Nenhum detalhe foi fornecido.',
    unexpectedWithoutDetails: 'Erro inesperado: Nenhum detalhe foi fornecido.',
    unexpected: 'Erro inesperado: Authorization: Bearer [REDACTED]\nConnection refused',
  },
}

describe('formatError', () => {
  for (const locale of ['en', 'pt-BR'] as const) {
    test(`formats invalidDelay in ${locale}`, async () => {
      const translator = await createTranslator(locale)
      const expected = expectedByLocale[locale]

      assert.equal(formatError(new AppError('invalidDelay'), translator), expected.invalidDelay)
    })

    test(`translates an invalidCliResponse resource in ${locale}`, async () => {
      const translator = await createTranslator(locale)
      const expected = expectedByLocale[locale]

      assert.equal(
        formatError(
          new AppError('invalidCliResponse', { resource: 'createdRule' }),
          translator,
        ),
        expected.invalidCliResponse,
      )
    })

    test(`preserves sanitized cliProcessFailed details in ${locale}`, async () => {
      const translator = await createTranslator(locale)
      const expected = expectedByLocale[locale]

      assert.equal(
        formatError(
          new AppError('cliProcessFailed', {
            exitCode: 1,
            details: 'Authorization: Bearer [REDACTED]\nLogin recusado',
          }),
          translator,
        ),
        expected.cliProcessFailed,
      )
    })

    test(`substitutes localized details for empty CLI diagnostics in ${locale}`, async () => {
      const translator = await createTranslator(locale)
      const expected = expectedByLocale[locale]

      assert.equal(
        formatError(
          new AppError('cliProcessFailed', { exitCode: 23 }),
          translator,
        ),
        expected.cliProcessFailedWithoutDetails,
      )
      assert.equal(
        formatError(new AppError('cliLaunchFailed'), translator),
        expected.cliLaunchFailedWithoutDetails,
      )
      assert.equal(
        formatError(new Error(''), translator),
        expected.unexpectedWithoutDetails,
      )
    })

    test(`sanitizes and formats an unexpected native Error in ${locale}`, async () => {
      const translator = await createTranslator(locale)
      const expected = expectedByLocale[locale]

      assert.equal(
        formatError(
          new Error('Authorization: Bearer native-secret\nConnection refused'),
          translator,
        ),
        expected.unexpected,
      )
    })
  }
})
