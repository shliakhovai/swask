import { useEffect, useState } from 'react'
import { Icon } from './components/Icon'
import { PwaNotice } from './components/PwaNotice'
import { Settings } from './components/Settings'
import { SwipeDeck } from './components/SwipeDeck'
import { TaskEditor } from './components/TaskEditor'
import { TaskList } from './components/TaskList'
import { taskStore, useTasks } from './hooks/use-tasks'
import { useToday } from './hooks/use-today'
import { usePwa } from './hooks/use-pwa'
import { useSync, useSyncLifecycle } from './hooks/use-sync'
import { addDays, formatDate, today } from './lib/date'
import { type Task } from './lib/tasks'

interface Toast {
  message: string
  undo?: () => void
}
export function App() {
  const { document: data, error, blocked } = useTasks()
  const current = useToday()
  const { offlineReady } = usePwa()
  const { status: syncStatus } = useSync()
  useSyncLifecycle()
  const [editor, setEditor] = useState<{ task: Task | null } | null>(null)
  const [settings, setSettings] = useState(false)
  const [mode, setMode] = useState<'list' | 'swipe'>('list')
  const [completed, setCompleted] = useState(false)
  const [dateFilter, setDateFilter] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 6500)
    return () => clearTimeout(timer)
  }, [toast])
  const visible = data.tasks.filter((task) => !task.deleted)
  const active = visible.filter((task) => !task.completed)
  const done = visible.filter((task) => task.completed)
  const doneToday = done.filter(
    (task) => today(new Date(task.updatedAt)) === current,
  ).length
  const filtered = (completed ? done : active).filter(
    (task) => !dateFilter || task.deadline === dateFilter,
  )
  function toggle(task: Task) {
    if (taskStore.update(task.id, { completed: !task.completed }))
      setToast({
        message: task.completed
          ? 'Задача знову в плані'
          : 'Ще одна маленька перемога!',
        undo: () => {
          if (taskStore.update(task.id, { completed: task.completed }))
            setToast(null)
        },
      })
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#tasks">
        До задач
      </a>
      <header className="topbar">
        <a className="brand" href="/" aria-label="swask — головна">
          swask<span>↗</span>
        </a>
        <div className="header-actions">
          <span className={`connection-status ${online ? '' : 'offline'}`}>
            <i />
            {online
              ? offlineReady
                ? syncStatus === 'synced'
                  ? 'Усе синхронізовано'
                  : syncStatus === 'syncing'
                    ? 'Синхронізація…'
                    : 'Готовий до офлайн'
                : 'Твій особистий простір'
              : 'Працюємо офлайн'}
          </span>
          <button
            className="icon-button settings-button"
            aria-label="Налаштування"
            onClick={() => setSettings(true)}
          >
            <Icon name="settings" />
          </button>
        </div>
      </header>
      <section className="welcome">
        <div>
          <p className="eyebrow">МЕНШЕ ШУМУ. БІЛЬШЕ РУХУ.</p>
          <h1>
            Звільни місце
            <br />
            для важливого<span className="heading-dot">.</span>
          </h1>
          <p className="welcome-copy">
            Трохи плану. Один свайп. Ближче до зроблено.
          </p>
        </div>
        <div className="today-label">
          <span>{formatDate(current, { weekday: 'long' })}</span>
          <strong>
            {formatDate(current, { day: 'numeric', month: 'long' })}
          </strong>
          <span>{formatDate(current, { year: 'numeric' })}</span>
        </div>
      </section>
      <PwaNotice busy={editor !== null || settings} />
      {error && (
        <div className="error-banner" role="alert">
          {error}
          {blocked && (
            <button className="text-button" onClick={() => setSettings(true)}>
              Відновлення даних
            </button>
          )}
        </div>
      )}
      <div className="workspace-grid">
        <main id="tasks" className="task-area">
          <div className="workspace-toolbar">
            <div className="mode-switch">
              <button
                className={mode === 'list' ? 'selected' : ''}
                aria-pressed={mode === 'list'}
                onClick={() => setMode('list')}
              >
                <Icon name="list" size={18} />
                За днями
              </button>
              <button
                className={mode === 'swipe' ? 'selected' : ''}
                aria-pressed={mode === 'swipe'}
                onClick={() => setMode('swipe')}
              >
                <Icon name="swipe" size={18} />
                Свайпи
              </button>
            </div>
            <button
              className="button primary"
              aria-label="Нова задача"
              disabled={blocked}
              onClick={() => setEditor({ task: null })}
            >
              <Icon name="plus" size={18} />
              <span className="new-task-label">Нова задача</span>
            </button>
          </div>
          {mode === 'list' ? (
            <>
              <div className="week-strip" aria-label="Найближчі сім днів">
                {Array.from({ length: 7 }, (_, index) =>
                  addDays(current, index),
                ).map((date, index) => (
                  <button
                    className={`date-chip ${date === current ? 'is-today' : ''} ${dateFilter === date ? 'date-selected' : ''}`}
                    key={date}
                    aria-pressed={dateFilter === date}
                    aria-label={`Показати ${formatDate(date)}`}
                    onClick={() => {
                      setDateFilter(dateFilter === date ? null : date)
                      setCompleted(false)
                    }}
                  >
                    <span>
                      {index === 0
                        ? 'Сьогодні'
                        : formatDate(date, { weekday: 'short' })}
                    </span>
                    <strong>{formatDate(date, { day: 'numeric' })}</strong>
                    <i
                      className={
                        active.some((task) => task.deadline === date)
                          ? 'has-tasks'
                          : ''
                      }
                    />
                  </button>
                ))}
              </div>
              <div className="list-toolbar">
                <div className="filter-tabs">
                  <button
                    className={!completed ? 'active' : ''}
                    aria-pressed={!completed}
                    onClick={() => {
                      setCompleted(false)
                      setDateFilter(null)
                    }}
                  >
                    У плані <span>{active.length}</span>
                  </button>
                  <button
                    className={completed ? 'active' : ''}
                    aria-pressed={completed}
                    onClick={() => {
                      setCompleted(true)
                      setDateFilter(null)
                    }}
                  >
                    Зроблено <span>{done.length}</span>
                  </button>
                </div>
                {dateFilter && (
                  <button
                    className="text-button"
                    onClick={() => setDateFilter(null)}
                  >
                    Усі дні <Icon name="close" size={14} />
                  </button>
                )}
              </div>
              <TaskList
                tasks={filtered}
                current={current}
                selectedDate={dateFilter}
                completed={completed}
                onEdit={(task) => setEditor({ task })}
                onToggle={toggle}
                onAdd={() => setEditor({ task: null })}
              />
            </>
          ) : (
            <SwipeDeck
              tasks={active}
              current={current}
              disabled={blocked}
              onEdit={(task) => setEditor({ task })}
              onAdd={() => setEditor({ task: null })}
              onFeedback={(message, undo) =>
                setToast(undo ? { message, undo } : { message })
              }
            />
          )}
        </main>
        <aside className="sidebar">
          <section className="pace-card">
            <div className="pace-heading">
              <span className="eyebrow">ТВІЙ ТЕМП</span>
              <span className="sparkle" aria-hidden="true">
                ✳
              </span>
            </div>
            <h2>{doneToday > 0 ? 'Рухаєшся вперед.' : 'Почни з однієї.'}</h2>
            <p>
              Кожна зроблена задача —<br />
              трохи більше простору для себе.
            </p>
            <div className="pace-stats">
              <div>
                <strong>{active.length}</strong>
                <span>у плані</span>
              </div>
              <div>
                <strong>{doneToday}</strong>
                <span>зроблено сьогодні</span>
              </div>
            </div>
            <div className="pace-track">
              <span
                style={{
                  width: `${doneToday + active.length ? Math.round((doneToday / (doneToday + active.length)) * 100) : 0}%`,
                }}
              />
            </div>
            <span className="pace-footnote">
              Тут немає перегонів. Є твій ритм.
            </span>
          </section>
          <section className="quiet-card">
            <div className="mini-deck" aria-hidden="true">
              <div />
              <div />
              <div>↗</div>
            </div>
            <h3>Менше списків у голові.</h3>
            <p>
              Залиши задачі тут.
              <br />І зосередься на тому, що зараз.
            </p>
          </section>
          <div className="local-note">
            <Icon name="check" size={15} />
            <span>Зміни зберігаються на пристрої</span>
          </div>
        </aside>
      </div>
      <footer className="footer">
        <span>swask — маленькі кроки мають значення.</span>
        <span>Зроблено для твого ритму ↗</span>
      </footer>
      {editor && (
        <TaskEditor
          key={editor.task?.id ?? 'new'}
          task={editor.task}
          onClose={() => setEditor(null)}
          onSaved={(message) => setToast({ message })}
        />
      )}
      {settings && <Settings onClose={() => setSettings(false)} />}
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={18} />
          <span>{toast.message}</span>
          {toast.undo && <button onClick={toast.undo}>Скасувати</button>}
          <button
            className="toast-close"
            aria-label="Закрити повідомлення"
            onClick={() => setToast(null)}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
