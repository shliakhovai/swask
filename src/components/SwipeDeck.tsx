import { useRef, useState, type PointerEvent } from 'react'
import { taskStore } from '../hooks/use-tasks'
import { formatDate, postponeDate } from '../lib/date'
import {
  remainingDeck,
  swipeDirection,
  type SwipeDirection,
} from '../lib/swipe'
import type { Task } from '../lib/tasks'
import { Icon } from './Icon'
import { Modal } from './Modal'

export function SwipeDeck({
  tasks,
  current,
  disabled,
  onEdit,
  onAdd,
  onFeedback,
}: {
  tasks: Task[]
  current: string
  disabled: boolean
  onEdit: (task: Task) => void
  onAdd: () => void
  onFeedback: (message: string, undo?: () => void) => void
}) {
  const [seen, setSeen] = useState<string[]>([])
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [postponing, setPostponing] = useState<Task | null>(null)
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null)
  const remaining = remainingDeck(tasks, seen)
  const task = remaining[0]
  const direction = swipeDirection(drag.x, drag.y, 35)
  function visit(id: string) {
    setSeen((values) => [...values, id])
  }
  function revisit(id: string) {
    setSeen((values) => values.filter((value) => value !== id))
  }
  function act(action: SwipeDirection) {
    if (!task || disabled || postponing) return
    if (action === 'up') {
      setPostponing(task)
      return
    }
    if (action === 'right') {
      visit(task.id)
      return
    }
    if (taskStore.update(task.id, { completed: true })) {
      visit(task.id)
      onFeedback('Ще одна маленька перемога!', () => {
        if (taskStore.update(task.id, { completed: false })) revisit(task.id)
      })
    }
  }
  function move(event: PointerEvent<HTMLElement>) {
    if (pointer.current?.id !== event.pointerId) return
    setDrag({
      x: event.clientX - pointer.current.x,
      y: Math.min(event.clientY - pointer.current.y, 30),
    })
  }
  function finish(event: PointerEvent<HTMLElement>) {
    if (pointer.current?.id !== event.pointerId) return
    const action = swipeDirection(
      event.clientX - pointer.current.x,
      event.clientY - pointer.current.y,
    )
    pointer.current = null
    setDragging(false)
    setDrag({ x: 0, y: 0 })
    if (action) act(action)
  }
  return (
    <section className="swipe-mode" aria-label="Режим свайпів">
      <div className="deck-caption">
        <span>ОДНА ЗАДАЧА ЗА РАЗ</span>
        <span>{remaining.length} у цьому колі</span>
      </div>
      {task ? (
        <>
          <div className="deck-stack">
            <div className="deck-back back-two" />
            <div className="deck-back back-one" />
            <article
              key={task.id}
              className={`swipe-card ${dragging ? 'dragging' : ''} direction-${direction ?? 'none'}`}
              tabIndex={0}
              aria-label={`Картка задачі: ${task.title}`}
              aria-describedby="swipe-help"
              style={{
                transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 24}deg)`,
              }}
              onPointerDown={(event) => {
                if (
                  !event.isPrimary ||
                  event.button !== 0 ||
                  disabled ||
                  (event.target as HTMLElement).closest('button,a')
                )
                  return
                pointer.current = {
                  id: event.pointerId,
                  x: event.clientX,
                  y: event.clientY,
                }
                event.currentTarget.setPointerCapture(event.pointerId)
                setDragging(true)
              }}
              onPointerMove={move}
              onPointerUp={finish}
              onPointerCancel={() => {
                pointer.current = null
                setDragging(false)
                setDrag({ x: 0, y: 0 })
              }}
              onLostPointerCapture={() => {
                pointer.current = null
                setDragging(false)
                setDrag({ x: 0, y: 0 })
              }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return
                const action = {
                  ArrowLeft: 'left',
                  ArrowRight: 'right',
                  ArrowUp: 'up',
                }[event.key] as SwipeDirection | undefined
                if (action) {
                  event.preventDefault()
                  act(action)
                }
              }}
            >
              <div className="swipe-card-top">
                <span
                  className={`deadline-tag ${task.deadline && task.deadline < current ? 'late' : ''}`}
                >
                  <Icon name="calendar" size={14} />
                  {task.deadline
                    ? task.deadline === current
                      ? 'На сьогодні'
                      : formatDate(task.deadline)
                    : 'Без дедлайну'}
                </span>
                <span className="card-spark" aria-hidden="true">
                  ✳
                </span>
              </div>
              <div className="swipe-card-body">
                <span className="card-overline">ТВІЙ НАСТУПНИЙ КРОК</span>
                <h2>{task.title}</h2>
                <p>
                  {task.description ||
                    'Не потрібно зробити все одразу. Почни з цієї задачі.'}
                </p>
                {task.link && (
                  <a
                    className="text-link"
                    href={task.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="link" size={16} />
                    Відкрити посилання
                  </a>
                )}
              </div>
              <div className="swipe-card-bottom">
                <button className="text-button" onClick={() => onEdit(task)}>
                  Деталі та редагування ↗
                </button>
                <span>swask</span>
              </div>
              {direction && (
                <span className={`swipe-stamp stamp-${direction}`}>
                  {direction === 'left'
                    ? 'ЗРОБЛЕНО'
                    : direction === 'right'
                      ? 'НАСТУПНЕ КОЛО'
                      : 'ПЕРЕНЕСТИ'}
                </span>
              )}
            </article>
          </div>
          <div className="swipe-actions">
            <div>
              <button
                className="swipe-action action-complete"
                disabled={disabled}
                aria-label="Свайп вліво — зроблено"
                onClick={() => act('left')}
              >
                <Icon name="check" size={25} />
              </button>
              <span>Зроблено</span>
            </div>
            <div>
              <button
                className="swipe-action action-postpone"
                disabled={disabled}
                aria-label="Свайп вгору — перенести"
                onClick={() => act('up')}
              >
                <Icon name="arrow-up" size={24} />
              </button>
              <span>Перенести</span>
            </div>
            <div>
              <button
                className="swipe-action action-skip"
                disabled={disabled}
                aria-label="Свайп вправо — наступне коло"
                onClick={() => act('right')}
              >
                <Icon name="arrow-right" size={25} />
              </button>
              <span>Ще не зараз</span>
            </div>
          </div>
          <p id="swipe-help" className="swipe-help">
            Свайпай картку, натискай кнопки або використовуй ← ↑ →
          </p>
        </>
      ) : (
        <div className="deck-finished">
          <span className="finish-spark" aria-hidden="true">
            ✳
          </span>
          <h2>{tasks.length ? 'Коло завершено.' : 'Усе в твоїх руках.'}</h2>
          <p>
            {tasks.length
              ? 'Незавершені задачі залишилися в плані. Можеш повернутися до них у новому колі.'
              : 'Додай задачу — і зроби свій перший крок.'}
          </p>
          <button
            className="button primary"
            disabled={disabled}
            onClick={() => (tasks.length ? setSeen([]) : onAdd())}
          >
            {tasks.length ? 'Почати нове коло' : 'Додати задачу'}
            <Icon name={tasks.length ? 'refresh' : 'plus'} size={18} />
          </button>
        </div>
      )}
      {postponing && (
        <Modal title="Дай собі трохи часу" onClose={() => setPostponing(null)}>
          <p className="postpone-intro">{postponing.title}</p>
          <div className="postpone-options">
            {([1, 3, 7] as const).map((days) => (
              <button
                key={days}
                onClick={() => {
                  const deadline = postponeDate(
                    postponing.deadline,
                    days,
                    current,
                  )
                  if (taskStore.update(postponing.id, { deadline })) {
                    const previous = postponing
                    visit(previous.id)
                    setPostponing(null)
                    onFeedback(`Дедлайн: ${formatDate(deadline)}`, () => {
                      if (
                        taskStore.update(previous.id, {
                          deadline: previous.deadline,
                        })
                      )
                        revisit(previous.id)
                    })
                  }
                }}
              >
                <span>
                  {days === 1
                    ? 'На добу'
                    : days === 3
                      ? 'На 3 дні'
                      : 'На тиждень'}
                </span>
                <strong>
                  {formatDate(postponeDate(postponing.deadline, days, current))}
                </strong>
                <Icon name="arrow-right" size={18} />
              </button>
            ))}
          </div>
          <p className="field-hint">
            Додаємо дні до поточного дедлайну або сьогодні, якщо дедлайн уже
            минув.
          </p>
        </Modal>
      )}
    </section>
  )
}
