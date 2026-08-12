import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { LIGHTING_CAPABILITY } from '../domain/devices.js'
import type {
  CapabilityDefinition,
  Device,
  DeviceStatus,
  Location,
  ManagedRule,
  RuleRequest,
} from '../domain/types.js'
import type { CliCommandRunner } from './cli-runner.js'
import type { SmartThingsGateway } from './gateway.js'

const asList = <T>(value: unknown, description: string): T[] => {
  if (Array.isArray(value)) return value as T[]
  if (
    typeof value === 'object' &&
    value !== null &&
    'items' in value &&
    Array.isArray(value.items)
  ) {
    return value.items as T[]
  }
  throw new Error(`Resposta inválida da SmartThings CLI ao consultar ${description}.`)
}

const asObject = <T>(value: unknown, description: string): T => {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as T
  }
  throw new Error(`Resposta inválida da SmartThings CLI ao consultar ${description}.`)
}

export interface CliSmartThingsGatewayOptions {
  runner: CliCommandRunner
  temporaryRoot?: string
}

export class CliSmartThingsGateway implements SmartThingsGateway {
  readonly #runner: CliCommandRunner
  readonly #temporaryRoot: string

  constructor(options: CliSmartThingsGatewayOptions) {
    this.#runner = options.runner
    this.#temporaryRoot = options.temporaryRoot ?? tmpdir()
  }

  async listLocations(): Promise<Location[]> {
    return asList<Location>(
      await this.#runner.runJson(['locations', '--json']),
      'as localizações',
    )
  }

  async listDevices(locationId: string): Promise<Device[]> {
    return asList<Device>(
      await this.#runner.runJson([
        'devices',
        '--location',
        locationId,
        '--capability',
        LIGHTING_CAPABILITY,
        '--json',
      ]),
      'os dispositivos',
    )
  }

  async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    return asObject<DeviceStatus>(
      await this.#runner.runJson(['devices:status', deviceId, '--json']),
      'o estado do dispositivo',
    )
  }

  async getLightingCapabilityDefinition(): Promise<CapabilityDefinition> {
    return asObject<CapabilityDefinition>(
      await this.#runner.runJson(['capabilities', LIGHTING_CAPABILITY, '--json']),
      'a capability de iluminação',
    )
  }

  async listRules(locationId: string): Promise<ManagedRule[]> {
    const rules = asList<ManagedRule>(
      await this.#runner.runJson(['rules', '--location', locationId, '--json']),
      'as Rules',
    )
    return rules.map(rule => ({ ...rule, locationId }))
  }

  async createRule(locationId: string, rule: RuleRequest): Promise<ManagedRule> {
    return this.#withRuleInput(rule, async path => {
      const created = asObject<ManagedRule>(
        await this.#runner.runJson([
          'rules:create',
          '--location',
          locationId,
          '--input',
          path,
          '--json',
        ]),
        'a Rule criada',
      )
      return { ...created, locationId }
    })
  }

  async updateRule(
    locationId: string,
    ruleId: string,
    rule: RuleRequest,
  ): Promise<ManagedRule> {
    return this.#withRuleInput(rule, async path => {
      const updated = asObject<ManagedRule>(
        await this.#runner.runJson([
          'rules:update',
          ruleId,
          '--location',
          locationId,
          '--input',
          path,
          '--json',
        ]),
        'a Rule atualizada',
      )
      return { ...updated, locationId }
    })
  }

  async deleteRule(locationId: string, ruleId: string): Promise<void> {
    await this.#runner.run(['rules:delete', ruleId, '--location', locationId])
  }

  async #withRuleInput<T>(
    rule: RuleRequest,
    operation: (path: string) => Promise<T>,
  ): Promise<T> {
    const directory = await mkdtemp(join(this.#temporaryRoot, 'smartthings-display-rule-'))
    const path = join(directory, 'rule.json')
    try {
      await chmod(directory, 0o700)
      await writeFile(path, `${JSON.stringify(rule, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
      })
      return await operation(path)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }
}
