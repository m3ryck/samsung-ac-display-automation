import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { createTranslator } from '../../src/i18n/index.js'
import { en } from '../../src/i18n/resources/en.js'
import { ptBR } from '../../src/i18n/resources/pt-BR.js'

const leaves = (value: unknown, prefix = ''): string[] => {
  if (typeof value === 'string') return [prefix]
  assert.ok(value && typeof value === 'object' && !Array.isArray(value))
  return Object.entries(value).flatMap(([key, child]) =>
    leaves(child, prefix ? `${prefix}.${key}` : key),
  )
}

describe('translation resources', () => {
  test('have identical non-empty key sets', () => {
    assert.deepEqual(leaves(ptBR).sort(), leaves(en).sort())
    for (const resource of [en, ptBR]) {
      const serialized = JSON.stringify(resource)
      assert.doesNotMatch(serialized, /:\s*""/)
    }
  })

  test('interpolate and pluralize naturally', async () => {
    const english = await createTranslator('en')
    const portuguese = await createTranslator('pt-BR')
    assert.equal(english.t('status.delay', { count: 1 }), '1 second of delay')
    assert.equal(english.t('status.delay', { count: 2 }), '2 seconds of delay')
    assert.equal(portuguese.t('status.delay', { count: 1 }), '1 segundo de atraso')
    assert.equal(portuguese.t('status.delay', { count: 2 }), '2 segundos de atraso')
  })

  test('keeps translator instances isolated', async () => {
    const [english, portuguese] = await Promise.all([
      createTranslator('en'),
      createTranslator('pt-BR'),
    ])
    assert.equal(english.t('common.warningPrefix'), 'Warning')
    assert.equal(portuguese.t('common.warningPrefix'), 'Aviso')
  })
})
