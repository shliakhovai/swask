import { sortTasks, type Task } from './tasks'

export type SwipeDirection = 'left' | 'right' | 'up'
export function swipeDirection(
  x: number,
  y: number,
  threshold = 80,
): SwipeDirection | null {
  if (Math.max(Math.abs(x), Math.abs(y)) < threshold) return null
  if (Math.abs(x) > Math.abs(y)) return x < 0 ? 'left' : 'right'
  return y < 0 ? 'up' : null
}
export function remainingDeck(tasks: Task[], seen: string[]): Task[] {
  const visited = new Set(seen)
  return sortTasks(tasks).filter(
    (task) => !task.completed && !task.deleted && !visited.has(task.id),
  )
}
