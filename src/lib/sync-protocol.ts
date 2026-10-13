import {
  isId,
  isOperation,
  isRecord,
  isTask,
  type Task,
  type TaskOperation,
} from './tasks.ts'

export interface PublicConfig {
  syncEnabled: boolean
  spaceId: string | null
  pushEnabled: boolean
  pushPublicKey: string | null
}
export interface SyncResponse {
  tasks: Task[]
  acknowledged: string[]
  spaceId: string
}
export function isPublicConfig(value: unknown): value is PublicConfig {
  return (
    isRecord(value) &&
    typeof value.syncEnabled === 'boolean' &&
    (value.spaceId === null || typeof value.spaceId === 'string') &&
    typeof value.pushEnabled === 'boolean' &&
    (value.pushPublicKey === null || typeof value.pushPublicKey === 'string')
  )
}
export function isSyncResponse(value: unknown): value is SyncResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.tasks) &&
    value.tasks.every(isTask) &&
    Array.isArray(value.acknowledged) &&
    value.acknowledged.every(isId) &&
    typeof value.spaceId === 'string'
  )
}
export function parseOperations(value: unknown): TaskOperation[] {
  if (
    !isRecord(value) ||
    !Array.isArray(value.operations) ||
    value.operations.length > 100 ||
    !value.operations.every(isOperation)
  )
    throw new Error('Invalid synchronization batch')
  if (
    new Set(value.operations.map((operation) => operation.id)).size !==
    value.operations.length
  )
    throw new Error('Duplicate operations in batch')
  return value.operations
}
