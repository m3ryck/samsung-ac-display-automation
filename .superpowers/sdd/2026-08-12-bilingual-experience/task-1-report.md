# Task 1 report: locale resolution and command-line language parsing

## Implementation

- Added `SupportedLocale`, `LanguageSelection`, `LanguageOptionError`, `normalizeLocale`, and `resolveLanguage` in `src/i18n/locale.ts`.
- Locale normalization accepts underscore or hyphen separators, compares the lower-cased primary language subtag, maps English to `en`, and maps Portuguese variants to `pt-BR`.
- Language resolution accepts `--lang value` and `--lang=value`, removes valid language-option tokens while preserving other arguments, detects missing/unsupported/duplicate options, and falls back from the system locale to English.
- Added the approved `i18next@26.3.6` runtime dependency.

## Files changed

- `src/i18n/locale.ts`
- `tests/i18n/locale.test.ts`
- `package.json`
- `package-lock.json`
- `.superpowers/sdd/2026-08-12-bilingual-experience/task-1-report.md`

## TDD evidence

RED command:

```text
rtk node --import tsx --test tests/i18n/locale.test.ts
```

The command failed as expected before implementation because Node reported `ERR_MODULE_NOT_FOUND` for `src/i18n/locale.js`. This demonstrated that the new tests exercised the not-yet-implemented locale module.

GREEN focused-test command:

```text
rtk node --import tsx --test tests/i18n/locale.test.ts
```

Result: 5 tests passed, 0 failed.

Typecheck command:

```text
rtk npm run typecheck
```

Result: passed (`tsc --noEmit` produced `ok` through the RTK wrapper).

Full-suite command:

```text
rtk npm test
```

Result: 33 tests passed, 0 failed across 13 suites.

## Self-review

- The parser is pure and does not inspect or mutate `process.env`.
- The default system locale is obtained from `Intl.DateTimeFormat().resolvedOptions().locale`.
- Explicit language selection takes precedence over system detection, and only recognized language-option tokens are removed.
- Existing tests and typechecking pass.

## Concerns

None identified for the task contract.

## Fix Round 1

### Changed behavior

Removed the environment-dependent assertion that passed `undefined` as the system locale and expected English. The production behavior remains unchanged: omitting the system-locale argument still uses Node's resolved locale, while the test now verifies deterministic explicit Portuguese detection and English fallback only.

### Covering test files

- `tests/i18n/locale.test.ts`

### Verification

```text
rtk node --import tsx --test tests/i18n/locale.test.ts
```

Result: 5 tests passed, 0 failed.

```text
rtk npm run typecheck
```

Result: passed (`tsc --noEmit` produced `ok` through the RTK wrapper).
