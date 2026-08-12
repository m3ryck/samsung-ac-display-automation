import type {
  CapabilityDefinition,
  Device,
  DeviceStatus,
  Location,
  ManagedRule,
  RuleRequest,
} from '../domain/types.js'

export interface SmartThingsGateway {
  listLocations(): Promise<Location[]>
  listDevices(locationId: string): Promise<Device[]>
  getDeviceStatus(deviceId: string): Promise<DeviceStatus>
  getLightingCapabilityDefinition(): Promise<CapabilityDefinition>
  listRules(locationId: string): Promise<ManagedRule[]>
  createRule(locationId: string, rule: RuleRequest): Promise<ManagedRule>
  updateRule(locationId: string, ruleId: string, rule: RuleRequest): Promise<ManagedRule>
  deleteRule(locationId: string, ruleId: string): Promise<void>
}
