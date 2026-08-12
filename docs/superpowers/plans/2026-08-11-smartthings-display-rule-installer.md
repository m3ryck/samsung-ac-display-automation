# SmartThings Display Rule Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform guided installer that creates and manages a SmartThings cloud Rule to turn off a compatible Samsung air conditioner's display after power-on.

**Architecture:** A TypeScript CLI orchestrates an injected terminal UI and a `SmartThingsGateway`. Pure domain functions handle discovery, validation, managed-Rule identity, and JSON generation; a production adapter safely invokes the bundled official SmartThings CLI.

**Tech Stack:** Node.js 24.8+, TypeScript, tsx, Node test runner, official `@smartthings/cli` package, GitHub Actions.

## Global Constraints

- Do not request, read, store, or log SmartThings tokens.
- Do not hardcode a user device or location ID.
- Version 1 only runs `setLightingLevel("off")` after `main.switch.switch` changes to `on`.
- Default delay is five seconds and daily execution remains entirely in SmartThings cloud.
- Support macOS, Windows, and Linux.

---

### Task 1: Project foundation and domain model

**Files:** Create `package.json`, `tsconfig.json`, `src/domain/types.ts`, `src/domain/devices.ts`, `src/domain/rules.ts`, and matching tests under `tests/domain/`.

**Interfaces:** Produce typed `Location`, `Device`, `DeviceStatus`, `CapabilityDefinition`, `ManagedRule`, `RuleRequest`, `findCompatibleDevices`, `validateDevice`, `buildDisplayOffRule`, and `findManagedRules` APIs.

- [ ] Write failing tests for compatible-device filtering, validation failures, stable managed-Rule identity, and exact Rule JSON.
- [ ] Run targeted tests and confirm failures are caused by missing implementations.
- [ ] Implement the smallest domain functions that pass those tests.
- [ ] Run the complete domain test set and type checker.

### Task 2: Safe SmartThings CLI adapter

**Files:** Create `src/smartthings/gateway.ts`, `src/smartthings/cli-runner.ts`, `src/smartthings/cli-gateway.ts`, and tests under `tests/smartthings/`.

**Interfaces:** `SmartThingsGateway` lists locations/devices/rules, retrieves status/capability definitions, and creates/updates/deletes Rules. `CommandRunner` executes the local CLI with argument arrays and returns parsed JSON or sanitized errors.

- [ ] Write failing tests for command arguments, JSON normalization, temporary input cleanup, Windows executable selection, and secret redaction.
- [ ] Run adapter tests and verify expected failures.
- [ ] Implement the CLI runner and gateway with `shell: false`, restrictive temporary files, and cleanup in `finally`.
- [ ] Run adapter and domain tests plus type checking.

### Task 3: Guided setup and maintenance flows

**Files:** Create `src/ui/terminal.ts`, `src/app/setup.ts`, `src/app/status.ts`, `src/app/remove.ts`, `src/app/verify.ts`, `src/index.ts`, and tests under `tests/app/`.

**Interfaces:** The terminal abstraction supports messages, confirmation, text input, and indexed selection. Commands are `setup`, `status`, `update`, and `remove`; `setup` and `update` share the same installation flow.

- [ ] Write failing flow tests for zero/one/many selections, cancellation, duplicate keep/replace/remove, optional verification success, and timeout.
- [ ] Run flow tests and verify failures are behavioral.
- [ ] Implement orchestration, validation summaries, idempotent updates, and the non-invasive 60-second guided test.
- [ ] Run every automated test, type check, and build.

### Task 4: Open-source distribution and documentation

**Files:** Create `.gitignore`, `.nvmrc`, `LICENSE`, `.github/workflows/ci.yml`; replace `README.md`.

**Interfaces:** Document `npm run setup`, `status`, `update`, and `remove`, Node 24.8+, one-time installation behavior, supported systems, security guarantees, troubleshooting, and manual acceptance testing.

- [ ] Add package scripts and distribution metadata without secrets or personal IDs.
- [ ] Document installation and all guided/maintenance flows in Portuguese.
- [ ] Add a three-OS Node 24 CI matrix running typecheck, tests, and build.
- [ ] Run secret-pattern scan, full tests, type check, build, and inspect the final diff against the design.
