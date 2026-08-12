import type {
  CapabilityDefinition,
  Device,
  DeviceStatus,
  Location,
  ManagedRule,
  RuleRequest,
} from '../../src/domain/types.js'
import type { SmartThingsGateway } from '../../src/smartthings/gateway.js'
import type { Terminal, TerminalOption } from '../../src/ui/terminal.js'

export const location: Location = { locationId: 'location-1', name: 'Casa' }

export const device: Device = {
  deviceId: 'device-1',
  locationId: location.locationId,
  label: 'Ar do quarto',
  manufacturerName: 'Samsung Electronics',
  components: [
    {
      id: 'main',
      capabilities: [
        { id: 'switch', version: 1 },
        { id: 'samsungce.airConditionerLighting', version: 1 },
      ],
    },
  ],
}

export const status = (
  switchState: 'on' | 'off' = 'off',
  lightingState: 'on' | 'off' = 'on',
): DeviceStatus => ({
  components: {
    main: {
      switch: { switch: { value: switchState } },
      'samsungce.airConditionerLighting': {
        supportedLightingLevels: { value: ['on', 'off'] },
        lighting: { value: lightingState },
      },
    },
  },
})

export const capability: CapabilityDefinition = {
  id: 'samsungce.airConditionerLighting',
  commands: { setLightingLevel: { name: 'setLightingLevel' } },
}

export class FakeGateway implements SmartThingsGateway {
  locations: Location[] = [location]
  devices: Device[] = [device]
  statuses: DeviceStatus[] = [status()]
  rules: ManagedRule[] = []
  definition = capability
  created: Array<{ locationId: string; rule: RuleRequest }> = []
  updated: Array<{ locationId: string; ruleId: string; rule: RuleRequest }> = []
  deleted: Array<{ locationId: string; ruleId: string }> = []
  statusCalls = 0

  async listLocations(): Promise<Location[]> {
    return this.locations
  }

  async listDevices(locationId: string): Promise<Device[]> {
    return this.devices.filter(candidate => candidate.locationId === locationId)
  }

  async getDeviceStatus(): Promise<DeviceStatus> {
    const next = this.statuses[Math.min(this.statusCalls, this.statuses.length - 1)]
    this.statusCalls += 1
    if (!next) throw new Error('Status de teste ausente.')
    return next
  }

  async getLightingCapabilityDefinition(): Promise<CapabilityDefinition> {
    return this.definition
  }

  async listRules(locationId: string): Promise<ManagedRule[]> {
    return this.rules.filter(rule => rule.locationId === locationId)
  }

  async createRule(locationId: string, rule: RuleRequest): Promise<ManagedRule> {
    this.created.push({ locationId, rule })
    return { id: 'created-rule', locationId, ...rule }
  }

  async updateRule(
    locationId: string,
    ruleId: string,
    rule: RuleRequest,
  ): Promise<ManagedRule> {
    this.updated.push({ locationId, ruleId, rule })
    return { id: ruleId, locationId, ...rule }
  }

  async deleteRule(locationId: string, ruleId: string): Promise<void> {
    this.deleted.push({ locationId, ruleId })
  }
}

export class FakeTerminal implements Terminal {
  readonly messages: Array<{ level: 'info' | 'warning' | 'error'; message: string }> = []
  readonly selections: Array<{ message: string; labels: string[] }> = []
  confirmAnswers: boolean[] = []
  inputAnswers: string[] = []
  selectAnswers: unknown[] = []

  info(message: string): void {
    this.messages.push({ level: 'info', message })
  }

  warning(message: string): void {
    this.messages.push({ level: 'warning', message })
  }

  error(message: string): void {
    this.messages.push({ level: 'error', message })
  }

  async confirm(_message: string, defaultValue = false): Promise<boolean> {
    return this.confirmAnswers.shift() ?? defaultValue
  }

  async input(_message: string, defaultValue = ''): Promise<string> {
    return this.inputAnswers.shift() ?? defaultValue
  }

  async select<T>(message: string, options: readonly TerminalOption<T>[]): Promise<T> {
    this.selections.push({ message, labels: options.map(option => option.label) })
    const answer = this.selectAnswers.shift()
    if (answer !== undefined) return answer as T
    const first = options[0]
    if (!first) throw new Error('Seleção sem opções.')
    return first.value
  }
}

export const managedRule = (id = 'rule-1', delaySeconds = 5): ManagedRule => ({
  id,
  locationId: location.locationId,
  name: `[Visor AC SmartThings] ${device.label}`,
  description: `[Visor AC SmartThings];version=1;deviceId=${device.deviceId};delaySeconds=${delaySeconds}`,
  actions: [],
})
