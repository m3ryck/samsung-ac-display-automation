# Bilingual English and Brazilian Portuguese Experience Design

## Goal

Offer the complete project-authored experience in English and Brazilian Portuguese. This includes the GitHub documentation, command usage, guided setup, update, status, removal, verification, validation failures, warnings, confirmations, and success messages.

The installer selects a language automatically from the operating system and accepts an explicit command-line override. Existing SmartThings Rules remain discoverable and unchanged. Text produced directly by the official SmartThings CLI is outside the translation boundary.

## Supported languages and selection

The application supports two canonical locales:

- `en` for English;
- `pt-BR` for Brazilian Portuguese.

Language selection follows this priority:

1. an explicit `--lang` command-line option;
2. the locale reported by the Node.js runtime for the current system;
3. English as the fallback.

Every command accepts both `--lang en` and `--lang=en` forms. Values beginning with `pt` are normalized to `pt-BR`, and values beginning with `en` are normalized to `en`. This lets common variants such as `pt`, `pt-PT`, `en-US`, and `en-GB` select the closest supported project language without expanding the translation catalog.

An unsupported explicit value stops before creating the SmartThings gateway or making any external call. The error uses the supported system language when it can be resolved and otherwise falls back to English. It lists the canonical accepted values, `en` and `pt-BR`.

Locale resolution is stateless. The installer does not persist the user's language in the repository, SmartThings metadata, or a separate configuration file. Each maintenance command resolves it again, while `--lang` remains available as a deterministic override.

## Internationalization architecture

The project will add `i18next` as its only internationalization dependency. Translation resources are TypeScript modules bundled with the application; runtime file loading, network loading, language-detector plugins, and framework adapters are unnecessary.

`src/i18n/` will own:

- the supported-locale type and normalization rules;
- command-line language option parsing;
- system-locale resolution;
- creation of an isolated `i18next` instance for each application execution;
- the English and Brazilian Portuguese resources;
- a small project-facing translator interface.

The `i18next` instance uses embedded resources, `supportedLngs: ['en', 'pt-BR']`, and an explicit English fallback. Creating an instance per execution prevents global translation state from leaking between tests.

Application flows depend on the small translator interface rather than importing a global `i18next` singleton. The console terminal also receives the translator for its built-in warning/error prefixes, yes/no hints, invalid-answer feedback, and numbered selection prompts.

## Translation resources

English is the fallback and source catalog. Keys describe intent rather than embedding natural-language source text, and are grouped by concern, such as `common`, `setup`, `status`, `remove`, `verify`, and `errors`.

Interpolated values include device and location names, IDs, delays, option limits, exit codes, and sanitized third-party details. Counts use the `i18next` `count` convention and language-aware plural forms. User-facing output must use natural singular and plural text instead of constructs such as `second(s)`, `Rule(s)`, or `configuração(ões)`.

The catalogs translate all text authored by this project. They do not translate:

- user-defined device and location names;
- SmartThings IDs;
- capability, attribute, and command identifiers;
- raw `on` and `off` values where they form part of technical diagnostics;
- output emitted directly by the official SmartThings CLI.

When device state is presented conversationally, values are localized as `on`/`off` in English and `ligado`/`desligado` in Portuguese. Project-authored context around official CLI output is localized, while the original sanitized details are preserved.

## Error boundaries

Domain and gateway code will not depend on `i18next`. Expected user-facing failures will use stable error codes plus structured parameters rather than complete Portuguese sentences. The application boundary maps those codes to translation keys.

This covers invalid delays, incompatible device capabilities or status, missing locations or devices, malformed SmartThings CLI responses, failed CLI execution, and invalid JSON. Unexpected errors remain displayable through a safe generic path. Existing secret sanitization remains in force before any third-party error details reach the terminal.

Invalid language syntax and unsupported languages are handled before SmartThings services are constructed. Invalid command usage is localized using the resolved system locale or English fallback and shows the existing neutral command names.

## Command-line experience

The neutral commands remain unchanged:

```text
npm run setup
npm run status
npm run update
npm run remove
```

Each command supports a deterministic language override, for example:

```text
npm run setup -- --lang en
npm run setup -- --lang pt-BR
npm run status -- --lang=en
```

All project-owned titles, questions, selection labels, confirmation hints, warnings, errors, state summaries, success messages, cancellation messages, and verification instructions follow the selected language.

The visible SmartThings Rule name remains `[Visor AC SmartThings] <device name>` in both languages. `RULE_MARKER`, the metadata description, version, device identifier, delay fields, and generated Rule JSON remain unchanged. Existing installations are therefore recognized by setup, update, status, and removal regardless of the selected UI language.

## Documentation

`README.md` becomes the complete English landing page. `README.pt-BR.md` contains the complete Brazilian Portuguese version. Both begin with a reciprocal `English | Português (Brasil)` language navigation line.

The two documents have equivalent sections, installation paths, command examples, behavior descriptions, safety information, troubleshooting guidance, acceptance steps, and external references. Examples show automatic language selection and the explicit `--lang` override.

The single `package.json` description becomes English because npm metadata supports only one description field. Package name, scripts, repository metadata, and technical keywords remain language-neutral.

Internal development specifications and plans do not need duplicate translations because they are maintainer artifacts rather than part of the installer experience.

## Testing

Locale tests cover:

- explicit option priority over the system locale;
- `--lang value` and `--lang=value` parsing;
- normalization of English and Portuguese locale variants;
- absent and unsupported locales;
- English fallback;
- stopping before external operations for invalid explicit input.

A catalog-parity test recursively verifies that English and Portuguese contain the same keys and no empty translations. Translation tests exercise interpolation and pluralization for counts `0`, `1`, and `2`.

Existing application-flow scenarios are parameterized for both locales at critical user-visible points: setup, selection, status, update, removal, and guided verification. Domain tests assert stable error codes rather than translated prose. Regression tests confirm that Rule names, markers, descriptions, discovery, and generated JSON remain compatible.

The final automated verification runs:

```text
npm test
npm run typecheck
npm run build
```

A source scan checks that project-authored Portuguese terminal text has not remained hard-coded under `src/`. The scan allows translation resources and technical test fixtures.

## Manual acceptance

Manual acceptance runs every command at least once with `--lang en` and `--lang pt-BR`. It also runs without an override in one English-locale environment and one Portuguese-locale environment to verify automatic detection.

The reviewer confirms that prompts accept language-appropriate yes/no answers, quantities read naturally, conversational device states are localized, official SmartThings output remains intact, and existing managed Rules are found in both languages.

The English and Portuguese READMEs are reviewed side by side for equivalent functional content and valid reciprocal language links.

## Out of scope

This change does not add more languages, translate the official SmartThings CLI, rename persisted Rules, migrate Rule metadata, persist language preferences, introduce hosted translation services, or change the automation's SmartThings behavior.
