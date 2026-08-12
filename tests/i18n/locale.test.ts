import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  LanguageOptionError,
  normalizeLocale,
  resolveLanguage,
} from '../../src/i18n/locale.js'

describe('normalizeLocale', () => {
  test('maps English and Portuguese variants to supported locales', () => {
    for (const candidate of ['en', 'en-US', 'EN_gb']) {
      assert.equal(normalizeLocale(candidate), 'en')
    }
    for (const candidate of ['pt', 'pt-BR', 'pt_PT']) {
      assert.equal(normalizeLocale(candidate), 'pt-BR')
    }
    assert.equal(normalizeLocale('es-ES'), undefined)
  })
})

describe('resolveLanguage', () => {
  test('prefers and removes an explicit split option', () => {
    assert.deepEqual(resolveLanguage(['setup', '--lang', 'en'], 'pt-BR'), {
      locale: 'en',
      arguments_: ['setup'],
    })
  })

  test('accepts an equals option and preserves command arguments', () => {
    assert.deepEqual(resolveLanguage(['status', '--lang=pt-BR'], 'en-US'), {
      locale: 'pt-BR',
      arguments_: ['status'],
    })
  })

  test('uses the system locale and then English fallback', () => {
    assert.equal(resolveLanguage(['remove'], 'pt-PT').locale, 'pt-BR')
    assert.equal(resolveLanguage(['remove'], 'es-ES').locale, 'en')
  })

  test('rejects missing, unsupported, and duplicate explicit options', () => {
    for (const arguments_ of [
      ['setup', '--lang'],
      ['setup', '--lang', 'es'],
      ['setup', '--lang=en', '--lang=pt-BR'],
    ]) {
      assert.throws(() => resolveLanguage(arguments_, 'pt-BR'), LanguageOptionError)
    }
  })
})
