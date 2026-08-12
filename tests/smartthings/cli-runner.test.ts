import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  CliCommandError,
  CliRunner,
  sanitizeCliError,
  smartThingsInvocation,
} from '../../src/smartthings/cli-runner.js'

describe('smartThingsInvocation', () => {
  test('runs the CLI JavaScript through Node instead of a platform shell shim', () => {
    assert.deepEqual(smartThingsInvocation('/node', '/cli/run.js'), {
      executable: '/node',
      arguments_: ['/cli/run.js'],
    })
  })
})

describe('sanitizeCliError', () => {
  test('redacts bearer tokens and OAuth secret fields without hiding HTTP status codes', () => {
    const raw = [
      'Authorization: Bearer bearer-secret',
      '"access_token":"access-secret"',
      'refresh_token=refresh-secret',
      'client_secret: client-secret',
      'authorization_code=one-time-code',
      'HTTP code: 401',
    ].join('\n')

    const sanitized = sanitizeCliError(raw)

    for (const secret of [
      'bearer-secret',
      'access-secret',
      'refresh-secret',
      'client-secret',
      'one-time-code',
    ]) {
      assert.doesNotMatch(sanitized, new RegExp(secret))
    }
    assert.match(sanitized, /HTTP code: 401/)
  })
})

describe('CliRunner', () => {
  test('parses JSON returned by a successful shell-free process execution', async () => {
    const calls: Array<{ executable: string; arguments_: string[] }> = []
    const runner = new CliRunner({
      nodeExecutable: '/node',
      cliEntryPath: '/cli/run.js',
      execute: async (executable, arguments_) => {
        calls.push({ executable, arguments_ })
        return { exitCode: 0, stdout: '[{"locationId":"location-1"}]', stderr: '' }
      },
    })

    assert.deepEqual(await runner.runJson(['locations', '--json']), [
      { locationId: 'location-1' },
    ])
    assert.deepEqual(calls, [
      {
        executable: '/node',
        arguments_: ['/cli/run.js', 'locations', '--json'],
      },
    ])
  })

  test('throws a sanitized error when the CLI exits unsuccessfully', async () => {
    const runner = new CliRunner({
      execute: async () => ({
        exitCode: 1,
        stdout: '',
        stderr: 'Authorization: Bearer do-not-leak\nLogin recusado',
      }),
    })

    await assert.rejects(
      runner.runJson(['locations', '--json']),
      (error: unknown) =>
        error instanceof CliCommandError &&
        /Login recusado/.test(error.message) &&
        !/do-not-leak/.test(error.message),
    )
  })

  test('rejects malformed JSON with a safe diagnostic', async () => {
    const runner = new CliRunner({
      execute: async () => ({ exitCode: 0, stdout: 'not-json', stderr: '' }),
    })

    await assert.rejects(runner.runJson(['locations', '--json']), /JSON inválido/i)
  })
})
