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
    unexpected: string
  }
> = {
  en: {
    invalidDelay: 'The delay must be a whole number from 0 to 60 seconds.',
    invalidCliResponse: 'The SmartThings CLI returned an invalid response while reading the created Rule.',
    cliProcessFailed:
      'SmartThings CLI exited with code 1: Authorization: Bearer [REDACTED]\nLogin recusado',
    unexpected: 'Unexpected error: Authorization: Bearer [REDACTED]\nConnection refused',
  },
  'pt-BR': {
    invalidDelay: 'O atraso deve ser um número inteiro entre 0 e 60 segundos.',
    invalidCliResponse:
      'A SmartThings CLI retornou uma resposta inválida ao consultar a Rule criada.',
    cliProcessFailed:
      'A SmartThings CLI terminou com código 1: Authorization: Bearer [REDACTED]\nLogin recusado',
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
