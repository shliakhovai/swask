import { describe, expect, it } from 'vitest'
import { remainingDeck, swipeDirection } from './swipe'
import { sample } from '../../tests/fixtures/task'

describe('swipes and rounds', () => {
  it('requires an intentional gesture and uses the dominant direction', () => {
    expect(swipeDirection(-120, 20)).toBe('left')
    expect(swipeDirection(110, -30)).toBe('right')
    expect(swipeDirection(20, -100)).toBe('up')
    expect(swipeDirection(35, -50)).toBeNull()
    expect(swipeDirection(0, 110)).toBeNull()
  })
  it('leaves skipped tasks pending until the next round', () => {
    const tasks = [sample, { ...sample, id: 'second', deadline: '2026-10-15' }]
    expect(remainingDeck(tasks, [sample.id]).map((task) => task.id)).toEqual([
      'second',
    ])
    expect(remainingDeck(tasks, [sample.id, 'second'])).toEqual([])
    expect(remainingDeck(tasks, [])).toHaveLength(2)
    expect(tasks[0]?.completed).toBe(false)
  })
})
