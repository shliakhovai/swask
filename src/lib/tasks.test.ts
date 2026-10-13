import { describe, expect, it } from 'vitest'
import {
  applyOperation,
  groupTasks,
  isTaskLink,
  parseDocument,
  type Task,
} from './tasks'

export const sample: Task = {
  id: '00000000-0000-4000-8000-000000000001',
  title: 'Read',
  description: '',
  deadline: '2026-10-14',
  link: '',
  completed: false,
  deleted: false,
  createdAt: '2026-10-13T09:00:00.000Z',
  updatedAt: '2026-10-13T09:00:00.000Z',
}
describe('tasks', () => {
  it('groups overdue, empty today, upcoming and undated in order', () => {
    const groups = groupTasks(
      [
        sample,
        { ...sample, id: 'two', deadline: null },
        { ...sample, id: 'three', deadline: '2026-10-10' },
      ],
      '2026-10-13',
    )
    expect(groups.map((group) => group.key)).toEqual([
      'overdue',
      '2026-10-13',
      '2026-10-14',
      'undated',
    ])
    expect(groups[1]?.tasks).toEqual([])
  })
  it('allows safe task links and rejects executable or credential URLs', () => {
    expect(isTaskLink('https://example.com/task')).toBe(true)
    expect(isTaskLink('javascript:alert(1)')).toBe(false)
    expect(isTaskLink('https://user:secret@example.com')).toBe(false)
  })
  it('does not resurrect deleted tasks through stale updates or creates', () => {
    const deleted = { ...sample, deleted: true }
    expect(
      applyOperation([deleted], {
        id: 'op',
        taskId: sample.id,
        at: sample.updatedAt,
        kind: 'update',
        changes: { title: 'Stale' },
      }),
    ).toEqual([deleted])
    expect(
      applyOperation([deleted], {
        id: 'op',
        taskId: sample.id,
        at: sample.updatedAt,
        kind: 'create',
        task: sample,
      }),
    ).toEqual([deleted])
  })
  it('rejects unknown storage versions, invalid fields and duplicates', () => {
    expect(() =>
      parseDocument({ version: 2, tasks: [], pending: [] }),
    ).toThrow()
    expect(() =>
      parseDocument({
        version: 1,
        tasks: [{ ...sample, deadline: '2026-02-30' }],
        pending: [],
      }),
    ).toThrow()
    expect(() =>
      parseDocument({ version: 1, tasks: [sample, sample], pending: [] }),
    ).toThrow()
  })
})
