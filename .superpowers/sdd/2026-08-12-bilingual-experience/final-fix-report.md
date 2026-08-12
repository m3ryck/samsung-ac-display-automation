# Final review fix wave report

Date: 2026-08-12

Base: `aeb9a58776dd32a3e73b9af10a3e01c9a0a7f6c6`

## Scope implemented

- `CliRunner` now omits `details` when a failed process or launch has no diagnostic text. Non-empty diagnostics still pass through the existing sanitizer.
- `formatError` supplies `errors.noDetails` only when launch, process, or unexpected-error details are absent/empty. Existing non-empty third-party detail text is preserved.
- Both catalogs contain the requested English and Portuguese fallback copy.
- i18next is augmented from `typeof en`, strict key checking is enabled, and the Portuguese catalog satisfies a recursively string-widened English resource shape.
- Compile-time assertions reject a nonexistent key and missing interpolation values. Runtime resource parity and base-form plural behavior remain covered.

## TDD test design

The runner regression test fails if production code continues to serialize an empty `details` property. The formatter tests fail if absent diagnostics reach an interpolated template unchanged, and their expected English and Portuguese strings are literal, hand-derived values. The compile-time assertions fail the typecheck if a nonexistent key or an incomplete interpolation options object is accepted.

## RED evidence

Command:

```text
rtk node --import tsx --test tests/smartthings/cli-runner.test.ts tests/i18n/format-error.test.ts tests/i18n/translations.test.ts
```

Output (exit 1; exact failure summary and mismatches):

```text
ℹ tests 20
ℹ suites 5
ℹ pass 17
ℹ fail 3
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 169.830708

✖ failing tests:

✖ substitutes localized details for empty CLI diagnostics in en (1.3475ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected

  + 'SmartThings CLI exited with code 23: '
  - 'SmartThings CLI exited with code 23: No details were provided.'

✖ substitutes localized details for empty CLI diagnostics in pt-BR (0.2305ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected

  + 'A SmartThings CLI terminou com código 23: '
  - 'A SmartThings CLI terminou com código 23: Nenhum detalhe foi fornecido.'

✖ omits diagnostic details when an unsuccessful CLI process has no output (1.050667ms)
  AssertionError [ERR_ASSERTION]: The validation function is expected to return "true". Received false
```

These failures were the expected missing behaviors: the formatter emitted a blank suffix and the runner retained an empty field.

Command:

```text
rtk npm run typecheck
```

Output (exit 2):

```text
tests/i18n/translations.test.ts(9,3): error TS2578: Unused '@ts-expect-error' directive.
tests/i18n/translations.test.ts(11,3): error TS2578: Unused '@ts-expect-error' directive.
```

Both directives were unused because the untyped catalog accepted the bad key and incomplete interpolation options.

## GREEN evidence

Command:

```text
rtk node --import tsx --test tests/smartthings/cli-runner.test.ts tests/i18n/format-error.test.ts tests/i18n/translations.test.ts && rtk npm run typecheck
```

Output (exit 0):

```text
▶ formatError
  ✔ formats invalidDelay in en (1.998ms)
  ✔ translates an invalidCliResponse resource in en (0.282208ms)
  ✔ preserves sanitized cliProcessFailed details in en (0.168625ms)
  ✔ substitutes localized details for empty CLI diagnostics in en (0.40325ms)
  ✔ sanitizes and formats an unexpected native Error in en (0.127ms)
  ✔ formats invalidDelay in pt-BR (0.181334ms)
  ✔ translates an invalidCliResponse resource in pt-BR (0.149375ms)
  ✔ preserves sanitized cliProcessFailed details in pt-BR (0.106ms)
  ✔ substitutes localized details for empty CLI diagnostics in pt-BR (0.17875ms)
  ✔ sanitizes and formats an unexpected native Error in pt-BR (0.509917ms)
✔ formatError (4.591583ms)
▶ translation resources
  ✔ have identical non-empty key sets (1.229208ms)
  ✔ interpolate and pluralize naturally (2.488791ms)
  ✔ keeps translator instances isolated (0.291708ms)
✔ translation resources (4.591708ms)
▶ smartThingsInvocation
  ✔ runs the CLI JavaScript through Node instead of a platform shell shim (0.983667ms)
✔ smartThingsInvocation (1.509208ms)
▶ sanitizeCliError
  ✔ redacts bearer tokens and OAuth secret fields without hiding HTTP status codes (0.233083ms)
✔ sanitizeCliError (0.27975ms)
▶ CliRunner
  ✔ parses JSON returned by a successful shell-free process execution (0.176541ms)
  ✔ throws a sanitized error when the CLI exits unsuccessfully (0.889375ms)
  ✔ omits diagnostic details when an unsuccessful CLI process has no output (0.104291ms)
  ✔ stores a sanitized launch failure as structured details (0.152958ms)
  ✔ rejects malformed JSON with a stable error code (0.100833ms)
✔ CliRunner (1.549041ms)
ℹ tests 20
ℹ suites 5
ℹ pass 20
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 138.436208
ok
```

## Broad verification

Command:

```text
rtk npm test
```

Output (exit 0):

```text
ℹ tests 96
ℹ suites 20
ℹ pass 96
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 302.287625
```

Commands:

```text
rtk npm run typecheck && rtk npm run build
```

Output (exit 0):

```text
ok
ok
```

Command:

```text
rtk git diff --check
```

Output (exit 0): no output.

## Self-review and concerns

- Sanitization remains at the same boundaries: runner-owned process/launch diagnostics and native unexpected errors are sanitized. The formatter does not alter non-empty structured third-party details.
- Existing English and Portuguese copy is unchanged; only `errors.noDetails` was added.
- Base plural calls such as `status.delay` with `{ count }` compile and retain runtime coverage.
- Runtime catalog parity remains as defense in depth in addition to the Portuguese `satisfies` constraint.
- Enabling resource typing exposed that generic `AppError.details` permits a malformed `cliProcessFailed` without `exitCode`; formatting now uses the existing localized `common.unknown` marker for only that malformed case.
- No account-backed commands were run.
- No remaining implementation concerns found.
