# Bilingual Installer Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every project-authored user experience available in English and Brazilian Portuguese, with automatic system-locale selection and a deterministic `--lang` override.

**Architecture:** Bundle English and Brazilian Portuguese resources in isolated `i18next` instances, expose a small translator interface to the application and terminal, and keep domain/gateway failures language-neutral through coded errors formatted at the CLI boundary. Split the GitHub documentation into a complete English `README.md` and equivalent `README.pt-BR.md` while preserving all persisted SmartThings Rule identifiers.

**Tech Stack:** Node.js 24.8+, TypeScript 5.9, `i18next` 26.3.6, Node test runner, SmartThings CLI 2.1.

## Global Constraints

- Support exactly the canonical locales `en` and `pt-BR`; normalize any `en-*` to `en` and any `pt-*` to `pt-BR`.
- Resolve language in this order: explicit `--lang`, Node system locale, then English fallback.
- Accept both `--lang en` and `--lang=en` after any existing npm command.
- Do not add detector, backend, framework, hosted-translation, or runtime resource-loading plugins.
- Keep `[Visor AC SmartThings]`, `RULE_MARKER`, metadata descriptions, device IDs, delay fields, and generated SmartThings Rule JSON unchanged.
- Never translate user-defined names, IDs, capabilities, attributes, commands, or raw third-party SmartThings CLI details.
- Continue sanitizing CLI output before displaying it.
- Keep all production platforms supported: Windows, macOS, and Linux.
- Prefix every shell command with `rtk` per `AGENTS.md`.
- Follow TDD: observe each targeted test fail before writing the corresponding production code.

## File structure

**Create:**

- `src/i18n/locale.ts` — parse `--lang`, normalize locales, and return remaining CLI arguments.
- `src/i18n/resources/en.ts` — canonical English resource object and translation-key source type.
- `src/i18n/resources/pt-BR.ts` — Brazilian Portuguese resource object with the same shape.
- `src/i18n/index.ts` — create an isolated configured `i18next` translator.
- `src/i18n/format-error.ts` — map stable application error codes to localized messages.
- `src/errors.ts` — language-neutral error codes, structured details, and `AppError`.
- `src/cli.ts` — testable command parsing, dependency construction, dispatch, and error boundary.
- `README.pt-BR.md` — complete Brazilian Portuguese documentation.
- `tests/i18n/locale.test.ts` — locale resolution and option parsing.
- `tests/i18n/translations.test.ts` — catalog parity, interpolation, pluralization, and isolation.
- `tests/i18n/format-error.test.ts` — error-code localization and sanitized detail preservation.
- `tests/ui/terminal.test.ts` — localized prefixes, prompts, and yes/no input behavior.
- `tests/cli.test.ts` — command dispatch, overrides, usage, and pre-gateway failures.

**Modify:**

- `package.json`, `package-lock.json` — add `i18next@26.3.6` and use an English package description.
- `src/index.ts` — reduce the executable entry point to invoking `runCli`.
- `src/ui/terminal.ts` — receive locale/translator and localize built-in interaction text.
- `src/domain/devices.ts`, `src/domain/rules.ts` — throw coded errors without localized prose.
- `src/smartthings/cli-runner.ts`, `src/smartthings/cli-gateway.ts` — return coded failures with structured sanitized context.
- `src/app/setup.ts`, `src/app/selection.ts`, `src/app/status.ts`, `src/app/remove.ts`, `src/app/verify.ts` — translate every project-authored message.
- `tests/domain/devices.test.ts`, `tests/domain/rules.test.ts` — assert error codes and preserve Rule compatibility.
- `tests/smartthings/cli-runner.test.ts`, `tests/smartthings/cli-gateway.test.ts` — assert coded failure details.
- `tests/app/helpers.ts`, `tests/app/setup.test.ts`, `tests/app/maintenance.test.ts`, `tests/app/verify.test.ts` — provide translators and exercise both locales.
- `README.md` — become the complete English landing page with reciprocal language navigation.

---

### Task 1: Locale resolution and command-line language parsing

**Files:**

- Create: `src/i18n/locale.ts`
- Create: `tests/i18n/locale.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**

- Produces: `type SupportedLocale = 'en' | 'pt-BR'`
- Produces: `interface LanguageSelection { locale: SupportedLocale; arguments_: string[] }`
- Produces: `class LanguageOptionError extends Error { requested?: string; systemLocale?: string; reason: 'missing-value' | 'unsupported' | 'duplicate' }`
- Produces: `normalizeLocale(candidate: string | undefined): SupportedLocale | undefined`
- Produces: `resolveLanguage(arguments_: readonly string[], systemLocale?: string): LanguageSelection`

- [ ] **Step 1: Write failing locale-resolution tests**

Create table-driven tests that establish the exact contract:

```ts
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
    assert.equal(resolveLanguage(['remove'], undefined).locale, 'en')
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
```

- [ ] **Step 2: Run the locale tests to verify they fail**

Run: `rtk node --import tsx --test tests/i18n/locale.test.ts`

Expected: FAIL because `src/i18n/locale.ts` does not exist.

- [ ] **Step 3: Install the approved dependency and implement locale parsing**

Run: `rtk npm install i18next@26.3.6`

Implement a pure parser. Normalize underscores to hyphens and compare only the lower-cased primary language subtag. Remove only valid language-option tokens; leave all other arguments untouched. Treat a second language option as `duplicate`, an empty/syntactically missing value as `missing-value`, and an unrecognized value as `unsupported`.

```ts
export type SupportedLocale = 'en' | 'pt-BR'

export interface LanguageSelection {
  locale: SupportedLocale
  arguments_: string[]
}

export type LanguageOptionErrorReason = 'missing-value' | 'unsupported' | 'duplicate'

export class LanguageOptionError extends Error {
  constructor(
    readonly reason: LanguageOptionErrorReason,
    readonly requested?: string,
    readonly systemLocale?: string,
  ) {
    super(reason)
    this.name = 'LanguageOptionError'
  }
}

export const normalizeLocale = (candidate: string | undefined): SupportedLocale | undefined => {
  const language = candidate?.replaceAll('_', '-').split('-')[0]?.toLowerCase()
  if (language === 'en') return 'en'
  if (language === 'pt') return 'pt-BR'
  return undefined
}
```

`resolveLanguage()` must default its `systemLocale` parameter to `Intl.DateTimeFormat().resolvedOptions().locale`, use `normalizeLocale(systemLocale) ?? 'en'`, and never inspect or mutate `process.env`.

- [ ] **Step 4: Run the focused tests and type checker**

Run: `rtk node --import tsx --test tests/i18n/locale.test.ts`

Expected: all locale tests PASS.

Run: `rtk npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit locale resolution**

```bash
rtk git add package.json package-lock.json src/i18n/locale.ts tests/i18n/locale.test.ts
rtk git commit -m "feat: resolve installer language"
```

### Task 2: Isolated i18next translators and complete resource catalogs

**Files:**

- Create: `src/i18n/resources/en.ts`
- Create: `src/i18n/resources/pt-BR.ts`
- Create: `src/i18n/index.ts`
- Create: `tests/i18n/translations.test.ts`

**Interfaces:**

- Consumes: `SupportedLocale` from Task 1.
- Produces: `type Translator = { locale: SupportedLocale; t: TFunction<'translation'> }`
- Produces: `createTranslator(locale: SupportedLocale): Promise<Translator>`
- Produces: resource objects `en` and `ptBR`.

- [ ] **Step 1: Write failing catalog and translator tests**

The tests must recursively compare resource paths, reject empty strings, verify exact critical copy, and prove instance isolation:

```ts
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
```

- [ ] **Step 2: Run the translator tests to verify they fail**

Run: `rtk node --import tsx --test tests/i18n/translations.test.ts`

Expected: FAIL because resources and `createTranslator` do not exist.

- [ ] **Step 3: Add the complete English source catalog**

Use intent-based nested keys. Include every key below with finished copy; `_one` and `_other` are i18next plural variants:

```ts
export const en = {
  common: {
    warningPrefix: 'Warning',
    errorPrefix: 'Error',
    yesNoDefaultYes: 'Y/n',
    yesNoDefaultNo: 'y/N',
    invalidYesNo: 'Answer yes or no.',
    emptySelection: 'There are no options available for selection.',
    optionNumber: 'Enter the option number',
    optionRange: 'Choose a number from {{minimum}} to {{maximum}}.',
    noManagedConfigurations: 'No configuration created by this installer was found.',
    cancelled: 'Operation cancelled. No changes were made.',
    unknown: '?',
  },
  usage: 'Usage: npm run <setup|status|update|remove> -- [--lang en|pt-BR]',
  language: {
    missing: 'The --lang option requires en or pt-BR.',
    unsupported: 'Unsupported language "{{requested}}". Use en or pt-BR.',
    duplicate: 'Use --lang only once.',
  },
  selection: {
    noLocations: 'No SmartThings location was found in this account.',
    chooseLocation: 'Which location contains the air conditioner?',
    noDevices: 'No air conditioner compatible with lighting control was found.',
    chooseDevice: 'Which air conditioner should have its display turned off?',
  },
  setup: {
    titleSetup: 'Air conditioner display Rule setup.',
    titleUpdate: 'Air conditioner display Rule update.',
    cloudPersistence: 'The Rule will remain in SmartThings and continue working when this installer is closed.',
    delayPrompt: 'How many seconds after the air conditioner turns on should the display turn off? (0 to 60)',
    invalidDelay: 'Enter a whole number from 0 to 60.',
    existingPrompt: 'A configuration already exists for this device. What would you like to do?',
    keepOption: 'Keep it as it is',
    replaceOption: 'Update the configuration',
    removeOption_one: 'Remove the configuration',
    removeOption_other: 'Remove all {{count}} duplicate configurations',
    kept: 'The existing configuration was kept. No changes were made.',
    confirmExistingRemoval_one: 'Remove this configuration from SmartThings?',
    confirmExistingRemoval_other: 'Remove all {{count}} configurations from SmartThings?',
    existingRemoved: 'Configuration removed. This Rule will no longer change the display.',
    device: 'Device: {{device}}',
    currentState: 'Current state: air conditioner {{switchState}}; display {{lightingState}}.',
    action_one: 'Action: when the air conditioner turns on, wait {{count}} second and turn off only the display.',
    action_other: 'Action: when the air conditioner turns on, wait {{count}} seconds and turn off only the display.',
    saveConfirmation: 'Allow this Rule to be saved to your SmartThings account?',
    updated: 'Configuration updated without creating a duplicate Rule.',
    created: 'Configuration successfully installed in the SmartThings cloud.',
    offerVerification: 'Would you like to run a guided test of up to 60 seconds now?',
  },
  status: {
    delay_one: '{{count}} second of delay',
    delay_other: '{{count}} seconds of delay',
    entry: '{{location}}: {{rule}} — {{delay}} (ID {{id}}).',
  },
  remove: {
    allOption_one: 'Remove the configuration',
    allOption_other: 'Remove all {{count}} configurations',
    choose: 'Which configuration would you like to remove?',
    confirm_one: 'Remove this Rule from your SmartThings account?',
    confirm_other: 'Remove all {{count}} Rules from your SmartThings account?',
    removed_one: '{{count}} configuration removed.',
    removed_other: '{{count}} configurations removed.',
  },
  verify: {
    turnOff: 'Turn off {{device}} normally. The installer will only observe its state.',
    turnOffTimeout: 'Could not confirm that the air conditioner was turned off.',
    turnOn: 'Now turn on {{device}} normally. I will wait for the display to turn off.',
    success: 'The test worked: the air conditioner turned on and the display turned off.',
    timeout: 'Could not confirm operation before the time limit. No command was sent to the device.',
  },
  state: { on: 'on', off: 'off' },
  errors: {
    invalidDelay: 'The delay must be a whole number from 0 to 60 seconds.',
    missingCapabilities: 'The device does not have switch and samsungce.airConditionerLighting on the main component.',
    invalidSwitchState: 'The device does not report main.switch.switch as on or off.',
    invalidLightingState: 'The device does not report main.samsungce.airConditionerLighting.lighting as on or off.',
    unsupportedLightingLevels: 'The device does not declare support for the on and off lighting levels.',
    missingLightingCommand: 'The capability does not provide the setLightingLevel command.',
    invalidCliResponse: 'The SmartThings CLI returned an invalid response while reading {{resource}}.',
    cliLaunchFailed: 'Could not start the SmartThings CLI: {{details}}',
    cliProcessFailed: 'SmartThings CLI exited with code {{exitCode}}: {{details}}',
    cliInvalidJson: 'The SmartThings CLI returned invalid JSON.',
    unexpected: 'Unexpected error: {{details}}',
    resources: {
      locations: 'locations', devices: 'devices', deviceStatus: 'device status',
      lightingCapability: 'lighting capability', rules: 'Rules',
      createdRule: 'the created Rule', updatedRule: 'the updated Rule',
    },
  },
} as const
```

- [ ] **Step 4: Add the equivalent Brazilian Portuguese catalog**

Mirror every English key and use natural Brazilian Portuguese. Preserve the approved existing Portuguese copy where it is already grammatical, but replace parenthetical plurals with proper variants. Critical exact values are:

```ts
export const ptBR = {
  common: {
    warningPrefix: 'Aviso',
    errorPrefix: 'Erro',
    yesNoDefaultYes: 'S/n',
    yesNoDefaultNo: 's/N',
    invalidYesNo: 'Responda com sim ou não.',
    emptySelection: 'Não há opções disponíveis para seleção.',
    optionNumber: 'Digite o número da opção',
    optionRange: 'Escolha um número entre {{minimum}} e {{maximum}}.',
    noManagedConfigurations: 'Nenhuma configuração criada por este instalador foi encontrada.',
    cancelled: 'Operação cancelada. Nenhuma alteração foi feita.',
    unknown: '?',
  },
  usage: 'Uso: npm run <setup|status|update|remove> -- [--lang en|pt-BR]',
  language: {
    missing: 'A opção --lang exige en ou pt-BR.',
    unsupported: 'Idioma "{{requested}}" não suportado. Use en ou pt-BR.',
    duplicate: 'Use --lang apenas uma vez.',
  },
  selection: {
    noLocations: 'Nenhuma localização SmartThings foi encontrada nesta conta.',
    chooseLocation: 'Em qual localização está o ar-condicionado?',
    noDevices: 'Nenhum ar-condicionado compatível com o controle de iluminação foi encontrado.',
    chooseDevice: 'Qual ar-condicionado deve ter o visor apagado?',
  },
  setup: {
    titleSetup: 'Configuração da Rule do visor do ar-condicionado.',
    titleUpdate: 'Atualização da Rule do visor do ar-condicionado.',
    cloudPersistence: 'A Rule ficará no SmartThings e continuará funcionando mesmo com este instalador fechado.',
    delayPrompt: 'Quantos segundos depois de ligar o ar o visor deve apagar? (0 a 60)',
    invalidDelay: 'Informe um número inteiro entre 0 e 60.',
    existingPrompt: 'Já existe uma configuração para este aparelho. O que deseja fazer?',
    keepOption: 'Manter como está',
    replaceOption: 'Atualizar a configuração',
    removeOption_one: 'Remover a configuração',
    removeOption_other: 'Remover as {{count}} configurações duplicadas',
    kept: 'A configuração existente foi mantida. Nenhuma alteração foi feita.',
    confirmExistingRemoval_one: 'Confirma a remoção desta configuração do SmartThings?',
    confirmExistingRemoval_other: 'Confirma a remoção das {{count}} configurações do SmartThings?',
    existingRemoved: 'Configuração removida. Esta Rule não alterará mais o visor.',
    device: 'Aparelho: {{device}}',
    currentState: 'Estado atual: ar {{switchState}}; visor {{lightingState}}.',
    action_one: 'Ação: ao detectar que o ar ligou, aguardar {{count}} segundo e apagar somente o visor.',
    action_other: 'Ação: ao detectar que o ar ligou, aguardar {{count}} segundos e apagar somente o visor.',
    saveConfirmation: 'Autoriza salvar esta Rule na sua conta SmartThings?',
    updated: 'Configuração atualizada sem criar uma Rule duplicada.',
    created: 'Configuração instalada com sucesso na nuvem do SmartThings.',
    offerVerification: 'Deseja fazer agora um teste guiado de até 60 segundos?',
  },
  status: {
    delay_one: '{{count}} segundo de atraso',
    delay_other: '{{count}} segundos de atraso',
    entry: '{{location}}: {{rule}} — {{delay}} (ID {{id}}).',
  },
  remove: {
    allOption_one: 'Remover a configuração',
    allOption_other: 'Remover todas as {{count}} configurações',
    choose: 'Qual configuração deseja remover?',
    confirm_one: 'Confirma a remoção desta Rule da sua conta SmartThings?',
    confirm_other: 'Confirma a remoção das {{count}} Rules da sua conta SmartThings?',
    removed_one: '{{count}} configuração removida.',
    removed_other: '{{count}} configurações removidas.',
  },
  verify: {
    turnOff: 'Desligue {{device}} normalmente. O instalador apenas observará o estado.',
    turnOffTimeout: 'Não foi possível confirmar que o ar-condicionado foi desligado.',
    turnOn: 'Agora ligue {{device}} normalmente. Aguardarei o visor apagar.',
    success: 'O teste funcionou: o ar-condicionado ligou e o visor ficou apagado.',
    timeout: 'Não foi possível confirmar o funcionamento dentro do tempo limite. Nenhum comando foi enviado ao aparelho.',
  },
  state: { on: 'ligado', off: 'desligado' },
  errors: {
    invalidDelay: 'O atraso deve ser um número inteiro entre 0 e 60 segundos.',
    missingCapabilities: 'O dispositivo não possui switch e samsungce.airConditionerLighting no componente main.',
    invalidSwitchState: 'O dispositivo não informa main.switch.switch como on ou off.',
    invalidLightingState: 'O dispositivo não informa main.samsungce.airConditionerLighting.lighting como on ou off.',
    unsupportedLightingLevels: 'O dispositivo não declara suporte aos níveis on e off da iluminação.',
    missingLightingCommand: 'A capability não oferece o comando setLightingLevel.',
    invalidCliResponse: 'A SmartThings CLI retornou uma resposta inválida ao consultar {{resource}}.',
    cliLaunchFailed: 'Não foi possível iniciar a SmartThings CLI: {{details}}',
    cliProcessFailed: 'A SmartThings CLI terminou com código {{exitCode}}: {{details}}',
    cliInvalidJson: 'A SmartThings CLI retornou JSON inválido.',
    unexpected: 'Erro inesperado: {{details}}',
    resources: {
      locations: 'as localizações',
      devices: 'os dispositivos',
      deviceStatus: 'o estado do dispositivo',
      lightingCapability: 'a capability de iluminação',
      rules: 'as Rules',
      createdRule: 'a Rule criada',
      updatedRule: 'a Rule atualizada',
    },
  },
} as const
```

- [ ] **Step 5: Implement isolated translator creation**

```ts
import { createInstance, type TFunction } from 'i18next'
import type { SupportedLocale } from './locale.js'
import { en } from './resources/en.js'
import { ptBR } from './resources/pt-BR.js'

export interface Translator {
  locale: SupportedLocale
  t: TFunction<'translation'>
}

export const createTranslator = async (locale: SupportedLocale): Promise<Translator> => {
  const instance = createInstance()
  await instance.init({
    lng: locale,
    fallbackLng: 'en',
    supportedLngs: ['en', 'pt-BR'],
    resources: {
      en: { translation: en },
      'pt-BR': { translation: ptBR },
    },
    interpolation: { escapeValue: false },
    initAsync: false,
  })
  return { locale, t: instance.getFixedT(locale, 'translation') }
}
```

- [ ] **Step 6: Run translation tests and all existing tests**

Run: `rtk node --import tsx --test tests/i18n/translations.test.ts`

Expected: PASS, including catalog parity and plural copy.

Run: `rtk npm test`

Expected: existing suite still PASS.

- [ ] **Step 7: Commit translation infrastructure**

```bash
rtk git add src/i18n/resources/en.ts src/i18n/resources/pt-BR.ts src/i18n/index.ts tests/i18n/translations.test.ts
rtk git commit -m "feat: add bilingual translation catalogs"
```

### Task 3: Language-neutral coded application errors

**Files:**

- Create: `src/errors.ts`
- Create: `src/i18n/format-error.ts`
- Create: `tests/i18n/format-error.test.ts`
- Modify: `src/domain/devices.ts`
- Modify: `src/domain/rules.ts`
- Modify: `src/smartthings/cli-runner.ts`
- Modify: `src/smartthings/cli-gateway.ts`
- Modify: `tests/domain/devices.test.ts`
- Modify: `tests/domain/rules.test.ts`
- Modify: `tests/smartthings/cli-runner.test.ts`
- Modify: `tests/smartthings/cli-gateway.test.ts`

**Interfaces:**

- Consumes: `Translator` from Task 2.
- Produces: `type AppErrorCode` containing all expected domain/gateway/runner failure codes.
- Produces: `class AppError extends Error { code: AppErrorCode; details: Readonly<Record<string, string | number>> }`.
- Produces: `formatError(error: unknown, translator: Translator): string`.

- [ ] **Step 1: Rewrite error tests to require codes instead of Portuguese prose**

Use a reusable assertion and preserve the secret-redaction assertion:

```ts
const hasCode = (code: AppErrorCode) => (error: unknown): boolean =>
  error instanceof AppError && error.code === code

assert.throws(
  () => validateDevice(compatibleDevice(), statusWithoutSwitch, validDefinition()),
  hasCode('invalidSwitchState'),
)

await assert.rejects(
  runner.runJson(['locations', '--json']),
  (error: unknown) =>
    error instanceof AppError &&
    error.code === 'cliProcessFailed' &&
    error.details.details === 'Authorization: Bearer [REDACTED]\nLogin recusado',
)
```

Add formatter tests for at least `invalidDelay`, `invalidCliResponse`, `cliProcessFailed`, and unexpected native `Error` in both locales. Assert third-party `details` are preserved exactly after sanitization.

- [ ] **Step 2: Run focused error tests to verify they fail**

Run: `rtk node --import tsx --test tests/domain/devices.test.ts tests/domain/rules.test.ts tests/smartthings/cli-runner.test.ts tests/smartthings/cli-gateway.test.ts tests/i18n/format-error.test.ts`

Expected: FAIL because `AppError` and `formatError` do not exist and production still throws localized messages.

- [ ] **Step 3: Implement the error model**

```ts
export type AppErrorCode =
  | 'invalidDelay'
  | 'missingCapabilities'
  | 'invalidSwitchState'
  | 'invalidLightingState'
  | 'unsupportedLightingLevels'
  | 'missingLightingCommand'
  | 'noLocations'
  | 'noCompatibleDevices'
  | 'invalidCliResponse'
  | 'cliLaunchFailed'
  | 'cliProcessFailed'
  | 'cliInvalidJson'
  | 'emptySelection'

export type AppErrorDetails = Readonly<Record<string, string | number>>

export class AppError extends Error {
  constructor(readonly code: AppErrorCode, readonly details: AppErrorDetails = {}) {
    super(code)
    this.name = 'AppError'
  }
}
```

Replace every expected production `throw new Error('<Portuguese>')` with the matching `AppError`. Use stable resource identifiers in `invalidCliResponse.details.resource`: `locations`, `devices`, `deviceStatus`, `lightingCapability`, `rules`, `createdRule`, or `updatedRule`.

In `CliRunner`, sanitize before storing `details`. A child-process launch rejection becomes `cliLaunchFailed`; a non-zero exit becomes `cliProcessFailed` with numeric `exitCode`; JSON parse failure becomes `cliInvalidJson`. Keep `sanitizeCliError()` unchanged and exported.

- [ ] **Step 4: Implement localized error formatting**

`formatError()` switches on `AppError.code`. Map `noLocations` to `selection.noLocations`, `noCompatibleDevices` to `selection.noDevices`, and `emptySelection` to `common.emptySelection`. Map the six domain validation codes and three fixed CLI codes to their same-named keys below `errors`. For `invalidCliResponse`, first translate `errors.resources.<resource>` and pass the result as `resource`. For native/unexpected errors, sanitize their message and translate `errors.unexpected`. Use an exhaustive `never` check so a new error code cannot silently remain untranslated.

```ts
const exhaustive = (value: never): never => {
  throw new Error(`Unhandled AppError code: ${String(value)}`)
}
```

Do not include stack traces, resource keys, or translation keys in user-visible output.

- [ ] **Step 5: Run focused tests and full suite**

Run: `rtk node --import tsx --test tests/domain/devices.test.ts tests/domain/rules.test.ts tests/smartthings/cli-runner.test.ts tests/smartthings/cli-gateway.test.ts tests/i18n/format-error.test.ts`

Expected: PASS.

Run: `rtk npm test`

Expected: PASS.

- [ ] **Step 6: Commit coded errors**

```bash
rtk git add src/errors.ts src/i18n/format-error.ts src/domain/devices.ts src/domain/rules.ts src/smartthings/cli-runner.ts src/smartthings/cli-gateway.ts tests/domain tests/smartthings tests/i18n/format-error.test.ts
rtk git commit -m "refactor: make installer errors localizable"
```

### Task 4: Localized terminal, selection, and setup flow

**Files:**

- Create: `tests/ui/terminal.test.ts`
- Modify: `src/ui/terminal.ts`
- Modify: `src/app/selection.ts`
- Modify: `src/app/setup.ts`
- Modify: `tests/app/helpers.ts`
- Modify: `tests/app/setup.test.ts`

**Interfaces:**

- Consumes: `Translator` and `AppError` from Tasks 2–3.
- Produces: `interface TerminalStreams { input: NodeJS.ReadableStream; output: NodeJS.WritableStream }`.
- Produces: `new ConsoleTerminal(translator: Translator, streams?: TerminalStreams)`; omitted streams use `stdin` and `stdout`.
- Produces: `runSetup(gateway, terminal, translator, options?)`.
- Produces: `selectLocation(gateway, terminal, translator)` and `selectDevice(terminal, translator, devices)`.

- [ ] **Step 1: Write failing terminal interaction tests**

Allow injected input/output streams so tests do not touch the real terminal. Verify English accepts `y`/`yes`, Portuguese accepts `s`/`sim`, both accept `n`/`no`/`não` as appropriate, and invalid input prints the localized retry warning. Also verify localized `Warning:`/`Aviso:` and `Error:`/`Erro:` prefixes.

```ts
const english = await createTranslator('en')
const terminal = terminalWithAnswers(english, ['maybe', 'yes'])
assert.equal(await terminal.confirm('Continue?'), true)
assert.match(terminal.output(), /Warning: Answer yes or no\./)
```

Update `FakeTerminal` only to capture prompt strings in `confirm()` and `input()` as well as selections. Add a `translator(locale)` test helper that calls `createTranslator(locale)`.

- [ ] **Step 2: Parameterize setup tests for English and Portuguese copy**

For each locale, pass the translator explicitly and assert localized title, state, delay action, existing-rule choices, cancellation, and success. Preserve all mutation assertions. Add a zero-delay assertion so pluralization/copy does not regress.

```ts
for (const locale of ['en', 'pt-BR'] as const) {
  test(`creates a Rule through the ${locale} flow`, async () => {
    const t = await createTranslator(locale)
    const result = await runSetup(gateway, terminal, t)
    assert.equal(result.outcome, 'created')
    assert.match(terminal.messages[0]!.message, locale === 'en' ? /setup/i : /configuração/i)
  })
}
```

- [ ] **Step 3: Run focused UI/setup tests to verify they fail**

Run: `rtk node --import tsx --test tests/ui/terminal.test.ts tests/app/setup.test.ts`

Expected: FAIL because constructors/signatures and messages are not localized.

- [ ] **Step 4: Localize `ConsoleTerminal`**

Store the translator. Use translation keys for prefixes, hints, retry messages, empty selection, option-number prompt, and range warning. Locale-specific accepted answers are:

```ts
const answers = {
  en: { yes: new Set(['y', 'yes']), no: new Set(['n', 'no']) },
  'pt-BR': { yes: new Set(['s', 'sim']), no: new Set(['n', 'não', 'nao']) },
} as const
```

Normalize with `toLocaleLowerCase(translator.locale)`. Keep the `Terminal` interface message-oriented so fakes remain simple.

- [ ] **Step 5: Localize selection and setup**

Pass `Translator` through the flow. Replace every literal passed to `terminal.info`, `warning`, `confirm`, `input`, and `select` with a resource key. Convert missing location/device errors to `AppError('noLocations')` and `AppError('noCompatibleDevices')`.

Render conversational state through `translator.t('state.on')` or `translator.t('state.off')`; do not alter `current.switchState`, `current.lightingState`, or any Rule payload. Use `count` for delay/action/removal labels, including zero.

- [ ] **Step 6: Run focused tests and full suite**

Run: `rtk node --import tsx --test tests/ui/terminal.test.ts tests/app/setup.test.ts`

Expected: PASS for both languages.

Run: `rtk npm test`

Expected: PASS after updating all call sites affected by the new signatures.

- [ ] **Step 7: Commit setup localization**

```bash
rtk git add src/ui/terminal.ts src/app/setup.ts src/app/selection.ts tests/ui/terminal.test.ts tests/app/helpers.ts tests/app/setup.test.ts
rtk git commit -m "feat: localize guided setup"
```

### Task 5: Localized maintenance and guided verification

**Files:**

- Modify: `src/app/status.ts`
- Modify: `src/app/remove.ts`
- Modify: `src/app/verify.ts`
- Modify: `tests/app/maintenance.test.ts`
- Modify: `tests/app/verify.test.ts`

**Interfaces:**

- Consumes: `Translator` from Task 2.
- Produces: `runStatus(gateway, terminal, translator)`.
- Produces: `runRemove(gateway, terminal, translator)`.
- Produces: `verifyInstalledRule(gateway, terminal, translator, device, options?)`.

- [ ] **Step 1: Add failing bilingual maintenance tests**

Parameterize status/no-results/removal tests for `en` and `pt-BR`. Assert natural one/two counts and retain exact deletion assertions.

```ts
assert.match(englishStatus, /1 second of delay/)
assert.match(portugueseStatus, /1 segundo de atraso/)
assert.equal(englishRemoved, '2 configurations removed.')
assert.equal(portugueseRemoved, '2 configurações removidas.')
```

- [ ] **Step 2: Add failing bilingual verification tests**

Run success, turn-off timeout, and display timeout once per locale with `FakeClock`. Assert instructions and outcomes in the selected language, and keep the safety assertion that no device command or Rule mutation occurs.

- [ ] **Step 3: Run focused tests to verify they fail**

Run: `rtk node --import tsx --test tests/app/maintenance.test.ts tests/app/verify.test.ts`

Expected: FAIL because the flows do not accept a translator and still contain Portuguese literals.

- [ ] **Step 4: Localize status and removal**

Use `status.delay` to produce the nested delay phrase and interpolate it into `status.entry`. Use `common.unknown` when metadata lacks a delay. Share `common.noManagedConfigurations` between status and removal. Use `count` for all selection labels, confirmations, and completion messages. Do not translate names or IDs.

- [ ] **Step 5: Localize guided verification**

Replace all five verification messages with their keys, interpolate `deviceDisplayName(device)`, and preserve polling/timing behavior byte-for-byte. The translator parameter comes before `device` so every flow uses the consistent `(gateway, terminal, translator, ...)` prefix.

- [ ] **Step 6: Run focused tests and full suite**

Run: `rtk node --import tsx --test tests/app/maintenance.test.ts tests/app/verify.test.ts`

Expected: PASS.

Run: `rtk npm test`

Expected: PASS.

- [ ] **Step 7: Commit maintenance localization**

```bash
rtk git add src/app/status.ts src/app/remove.ts src/app/verify.ts tests/app/maintenance.test.ts tests/app/verify.test.ts
rtk git commit -m "feat: localize maintenance flows"
```

### Task 6: Testable CLI composition and localized error boundary

**Files:**

- Create: `src/cli.ts`
- Create: `tests/cli.test.ts`
- Modify: `src/index.ts`

**Interfaces:**

- Consumes: `resolveLanguage`, `createTranslator`, `formatError`, all localized flows, `ConsoleTerminal`, and `CliSmartThingsGateway`.
- Produces: `runCli(arguments_: readonly string[], dependencies?: CliDependencies): Promise<number>`.
- Produces: `interface CliDependencies` with optional `systemLocale`, `createTerminal`, and `createGateway` factories for deterministic tests.

- [ ] **Step 1: Write failing CLI orchestration tests**

Cover:

- automatic `pt-BR` and English fallback;
- explicit override winning over system locale;
- both `--lang` syntaxes;
- each neutral command dispatching to the corresponding flow;
- unknown command returning exit code `2` with localized usage;
- unsupported/missing/duplicate language returning exit code `2`;
- invalid language and invalid command never invoking `createGateway`;
- expected and unexpected runtime failures returning exit code `1` with localized/sanitized errors;
- terminal closure exactly once on every path after terminal construction.

Use dependency counters and fake terminals/gateways; never invoke the real SmartThings CLI.

- [ ] **Step 2: Run CLI tests to verify they fail**

Run: `rtk node --import tsx --test tests/cli.test.ts`

Expected: FAIL because `runCli` does not exist.

- [ ] **Step 3: Implement `runCli` with lazy gateway creation**

Use the resolved argument array to validate exactly one command from `setup`, `status`, `update`, and `remove`. Create the translator and terminal before displaying usage or language errors. Construct the gateway only after both language and command validation succeed.

For `LanguageOptionError`, choose `normalizeLocale(error.systemLocale) ?? 'en'`, map `missing-value` to `language.missing`, `unsupported` to `language.unsupported`, and `duplicate` to `language.duplicate`, then return `2`. For `AppError`/unexpected execution failures, call `formatError`, write through `terminal.error`, and return `1`. Always close a constructed terminal in `finally`.

Default factories create `ConsoleTerminal(translator)` and `CliSmartThingsGateway({ runner: new CliRunner() })`.

- [ ] **Step 4: Reduce the executable entry point**

```ts
import { runCli } from './cli.js'

process.exitCode = await runCli(process.argv.slice(2))
```

No command parsing, translation, gateway construction, or error formatting remains in `src/index.ts`.

- [ ] **Step 5: Run CLI tests and full verification**

Run: `rtk node --import tsx --test tests/cli.test.ts`

Expected: PASS.

Run: `rtk npm test`

Expected: PASS.

Run: `rtk npm run typecheck`

Expected: PASS.

Run: `rtk npm run build`

Expected: PASS.

- [ ] **Step 6: Commit CLI composition**

```bash
rtk git add src/cli.ts src/index.ts tests/cli.test.ts
rtk git commit -m "feat: select language across CLI commands"
```

### Task 7: Complete bilingual documentation and metadata

**Files:**

- Create: `README.pt-BR.md`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `package-lock.json` only if npm normalizes package metadata during verification.

**Interfaces:**

- Consumes: the final command syntax and locale behavior from Task 6.
- Produces: equivalent public documentation in both supported languages.

- [ ] **Step 1: Preserve the current Portuguese README as the translation**

Copy the complete current functional content into `README.pt-BR.md` and add this navigation immediately after the title:

```markdown
[English](README.md) | **Português (Brasil)**
```

Document automatic system-locale selection and add explicit examples for both accepted forms:

```bash
npm run setup -- --lang pt-BR
npm run status -- --lang=pt-BR
```

- [ ] **Step 2: Translate the complete landing README into English**

Make `README.md` a complete section-for-section English equivalent, beginning with:

```markdown
# Turn off the Samsung air conditioner display

**English** | [Português (Brasil)](README.pt-BR.md)
```

Translate every heading, paragraph, list, warning, troubleshooting section, manual acceptance step, and inline Rule explanation. Keep commands, JSON, URLs, capabilities, code identifiers, product names, and the repository clone URL unchanged. Include:

```bash
npm run setup -- --lang en
npm run status -- --lang=en
```

- [ ] **Step 3: Use English npm metadata**

Set the exact `package.json` description:

```json
"description": "Guided installer for a SmartThings Rule that turns off Samsung air conditioner displays after power-on."
```

- [ ] **Step 4: Check documentation equivalence**

Run: `rtk rg -n '^## ' README.md README.pt-BR.md`

Expected: both documents have matching section counts and order.

Run: `rtk rg -n 'README\.pt-BR\.md|README\.md|--lang' README.md README.pt-BR.md`

Expected: reciprocal language links and explicit language examples appear in both files.

- [ ] **Step 5: Run full automated verification and source-copy scan**

Run: `rtk npm test`

Expected: PASS.

Run: `rtk npm run typecheck`

Expected: PASS.

Run: `rtk npm run build`

Expected: PASS.

Run:

```bash
rtk rg -n "Aviso|Erro|Não há|Nenhuma configuração|Configuração|Qual |Deseja|Informe|Digite|Escolha|segundo\(s\)|Rule\(s\)|configuração\(ões\)" src --glob '!src/i18n/resources/pt-BR.ts'
```

Expected: no project-authored hard-coded Portuguese UI copy. Review any match manually; technical fixtures and proper names are allowed only when they are not presented to users.

Run: `rtk git diff --check`

Expected: PASS with no whitespace errors.

- [ ] **Step 6: Perform manual smoke tests without a real account mutation**

Run invalid/usage paths, which terminate before creating the gateway:

```bash
rtk npm run setup -- --lang es
rtk node --import tsx src/index.ts unknown --lang en
rtk node --import tsx src/index.ts unknown --lang pt-BR
```

Expected: the invalid-language message follows the system locale, and unknown-command usage appears in the explicitly selected language. All exit codes are `2`; no browser or SmartThings authentication starts.

- [ ] **Step 7: Commit public bilingual documentation**

```bash
rtk git add README.md README.pt-BR.md package.json package-lock.json
rtk git commit -m "docs: publish English and Portuguese guides"
```

### Task 8: Final regression and acceptance record

**Files:**

- Modify only files needed to fix a verified regression; do not broaden scope.
- Update: `docs/superpowers/plans/2026-08-12-bilingual-experience.md` by checking completed boxes only after their evidence exists.

**Interfaces:**

- Consumes: all deliverables from Tasks 1–7.
- Produces: a clean, buildable, tested bilingual release candidate.

- [x] **Step 1: Run the complete verification suite from a clean process**

```bash
rtk npm test
rtk npm run typecheck
rtk npm run build
rtk npm audit
rtk git diff --check
rtk git status --short
```

Expected: tests, typecheck, build, audit, and diff check PASS. Status contains only the plan checkbox update, if performed before the final commit.

- [x] **Step 2: Verify persisted Rule compatibility explicitly**

Run: `rtk node --import tsx --test tests/domain/rules.test.ts tests/app/setup.test.ts tests/app/maintenance.test.ts`

Expected: PASS with assertions proving the Rule name begins with `[Visor AC SmartThings]`, the metadata marker/version/device/delay format is unchanged, and both locales discover/update/remove the same managed Rules.

- [ ] **Step 3: Perform the account-backed manual acceptance only with explicit user authorization**

Request permission before using a real SmartThings account because setup, update, and removal mutate external Rules. Once authorized, run `setup`, `status`, `update`, and `remove` once with `--lang en` and once with `--lang pt-BR`; also run without an override from one English system locale and one Portuguese system locale. Confirm language-appropriate yes/no input, natural plurals, localized conversational states, preserved official CLI output, and discovery of the same Rule from either language.

If real-account access or authorization is unavailable, do not simulate or claim this step. Record it explicitly as pending manual acceptance while still reporting the automated verification separately.

- [x] **Step 4: Review the final diff against the approved specification**

Run: `rtk git diff HEAD~7 --stat`

Expected: changes are limited to i18n infrastructure, coded errors, localized flows, tests, package metadata, and bilingual READMEs.

Run: `rtk git log -8 --oneline`

Expected: one focused implementation commit per task plus the prior design/plan documentation commits.

- [x] **Step 5: Record completion**

Check plan boxes only for steps backed by command output. If checkbox changes are committed separately:

```bash
rtk git add docs/superpowers/plans/2026-08-12-bilingual-experience.md
rtk git commit -m "docs: record bilingual installer verification"
```
