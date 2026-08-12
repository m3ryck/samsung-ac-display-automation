# SmartThings Display Rule Installer Design

## Goal

Build an open-source, guided installer that creates a SmartThings cloud Rule which turns off a compatible Samsung air conditioner's display five seconds after the air conditioner changes from off to on.

The installer is run once from a cloned GitHub repository. After the Rule is created, no computer, server, Alexa skill, AWS account, Home Assistant instance, or long-running process is required.

## User experience

The user installs Node.js 24.8 or newer, clones the repository, runs `npm install`, and starts `npm run setup`. The bundled official SmartThings CLI opens Samsung's browser login when authentication is required.

The installer lists locations and compatible devices, automatically choosing an unambiguous single result and prompting when multiple choices exist. It validates the selected device, displays the exact automation it will create, asks for confirmation, and optionally guides the user through a real test.

Maintenance commands provide status, update, and removal. Rules are identified from a stable marker in their metadata rather than a local state file, so maintenance also works from a fresh clone on another computer.

## Architecture

- A TypeScript command-line application owns prompts and orchestration.
- A `SmartThingsGateway` interface isolates the application from the official CLI. The production adapter invokes the local `smartthings` executable without a shell and exchanges JSON through temporary files and standard output.
- Pure domain modules normalize API responses, find compatible devices, validate capabilities and current status, generate exact Rule JSON, and identify managed Rules.
- A terminal UI abstraction makes the guided flows deterministic and testable.
- The official CLI owns Samsung authentication and its local session. This project never requests, reads, stores, or prints SmartThings tokens.

## SmartThings behavior

Compatibility requires the `main` component to expose both `switch` and `samsungce.airConditionerLighting`. Full status must contain `main.switch.switch`, `main.samsungce.airConditionerLighting.lighting`, and `supportedLightingLevels` containing both `on` and `off`. The capability definition must expose `setLightingLevel`.

The generated Rule wraps `main.switch.switch == "on"` in a `changes` condition so it fires only on the transition to on. Its serial actions sleep for the selected number of seconds, then execute:

```json
{
  "component": "main",
  "capability": "samsungce.airConditionerLighting",
  "command": "setLightingLevel",
  "arguments": [{ "string": "off" }]
}
```

The default delay is five seconds. Only positive whole seconds from 0 through 60 are accepted, with zero representing immediate execution.

## Safety and failure handling

Installation is idempotent. Existing managed Rules for the selected device are presented before any mutation, and the user can keep, replace, or remove them. Replacement updates the existing Rule rather than creating a duplicate.

Child processes use argument arrays with `shell: false`. Temporary Rule files are created with restrictive permissions and deleted after use. CLI failures are sanitized for common token and authorization fields before display.

The installer stops without mutation when authentication fails, no compatible device exists, required capabilities or states are missing, `on`/`off` are unsupported, the API response is invalid, or the user cancels. A failed optional test does not remove a successfully created Rule.

## Verification

Unit and flow tests use a fake gateway and fake terminal. They cover discovery, validation, exact Rule generation, idempotency, replacement, removal, cancellation, sanitized CLI errors, and optional test success/timeout. CI runs type checking, tests, and build on macOS, Windows, and Linux with Node.js 24.

A documented manual test covers turning the appliance on from SmartThings, a physical remote, and an existing Alexa integration, then confirms the lighting status becomes `off` and the Rule continues working after the installer exits.

## Scope

Version 1 only turns the display off after the appliance turns on. It does not expose voice commands, turn the appliance on or off, add other air-conditioner controls, host a website, or deploy cloud infrastructure.
