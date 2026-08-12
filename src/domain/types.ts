export interface Location {
  locationId: string
  name: string
}

export interface DeviceCapability {
  id: string
  version?: number
}

export interface DeviceComponent {
  id: string
  capabilities: DeviceCapability[]
}

export interface Device {
  deviceId: string
  label?: string
  name?: string
  locationId: string
  components: DeviceComponent[]
  manufacturerName?: string
}

export interface StatusValue<T = unknown> {
  value: T
  timestamp?: string
}

export type CapabilityStatus = Record<string, StatusValue | undefined>

export interface DeviceStatus {
  components: Record<string, Record<string, CapabilityStatus | undefined> | undefined>
}

export interface CapabilityCommandDefinition {
  name?: string
  arguments?: Array<{ name?: string; optional?: boolean }>
}

export interface CapabilityDefinition {
  id?: string
  version?: number
  commands?: Record<string, CapabilityCommandDefinition | undefined>
}

export interface DeviceOperand {
  devices: string[]
  component: string
  capability: string
  attribute: string
  trigger: 'Always'
}

export type RuleOperand =
  | { string: string }
  | { integer: number }
  | { device: DeviceOperand }

export interface RuleEqualsCondition {
  left: RuleOperand
  right: RuleOperand
}

export interface RuleChangesCondition {
  id: string
  equals: RuleEqualsCondition
}

export interface RuleCommand {
  component: string
  capability: string
  command: string
  arguments: RuleOperand[]
}

export type RuleAction =
  | {
      sleep: {
        duration: { value: { integer: number }; unit: 'Second' }
      }
    }
  | {
      command: { devices: string[]; commands: RuleCommand[] }
    }
  | {
      if: {
        changes: RuleChangesCondition
        then: RuleAction[]
      }
    }

export interface RuleRequest {
  name: string
  description: string
  actions: RuleAction[]
}

export interface ManagedRule extends Omit<RuleRequest, 'description'> {
  id: string
  locationId: string
  description?: string
  status?: string
}

export interface ValidatedDeviceState {
  switchState: 'on' | 'off'
  lightingState: 'on' | 'off'
  supportedLightingLevels: string[]
}
