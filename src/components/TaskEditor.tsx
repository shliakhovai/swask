import { useState, type FormEvent } from 'react'
import { taskStore } from '../hooks/use-tasks'
import { formatDate } from '../lib/date'
import {
  isTaskLink,
  type Task,
  type TaskDraft,
  type TaskPatch,
} from '../lib/tasks'
import { Icon } from './Icon'
import { Modal } from './Modal'

export function TaskEditor({
  task,
  onClose,
  onSaved,
}: {
  task: Task | null
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [error, setError] = useState('')
  const [deadline, setDeadline] = useState(task?.deadline ?? '')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const draft: TaskDraft = {
      title: String(data.get('title')).trim(),
      description: String(data.get('description')).trim(),
      deadline: deadline || null,
      link: String(data.get('link')).trim(),
    }
    if (!draft.title) {
      setError('Додай назву задачі.')
      return
    }
    if (!isTaskLink(draft.link)) {
      setError('Додай коректне посилання з https:// або http://.')
      return
    }
    const changes: TaskPatch = {}
    if (task)
      for (const key of ['title', 'description', 'deadline', 'link'] as const) {
        if (draft[key] !== task[key])
          Object.assign(changes, { [key]: draft[key] })
      }
    const saved = task
      ? taskStore.update(task.id, changes)
      : taskStore.create(draft)
    if (!saved) {
      setError(taskStore.getSnapshot().error ?? 'Не вдалося зберегти задачу.')
      return
    }
    onSaved(task ? 'Зміни збережено' : 'Задачу додано')
    onClose()
  }
  return (
    <Modal title={task ? 'Твоя задача' : 'Що хочеш зробити?'} onClose={onClose}>
      <form className="task-form" onSubmit={submit}>
        <label>
          Назва
          <input
            name="title"
            placeholder="Наприклад, підготувати презентацію"
            maxLength={160}
            required
            defaultValue={task?.title ?? ''}
            autoFocus
          />
        </label>
        <label>
          Опис <span className="optional">необов’язково</span>
          <textarea
            name="description"
            placeholder="Деталі, які допоможуть почати…"
            maxLength={4000}
            rows={4}
            defaultValue={task?.description ?? ''}
          />
        </label>
        <label>
          Дедлайн <span className="optional">необов’язково</span>
          <input
            name="deadline"
            type="date"
            min="1900-01-01"
            max="9999-12-24"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
          />
          <span className="field-hint">
            {deadline
              ? formatDate(deadline, {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })
              : 'Можна залишити без дедлайну'}
          </span>
        </label>
        <label>
          Посилання <span className="optional">необов’язково</span>
          <input
            name="link"
            type="url"
            placeholder="https://…"
            maxLength={2000}
            defaultValue={task?.link ?? ''}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {task?.link && (
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
        <div className="form-actions">
          {task && (
            <button
              className="icon-button danger"
              type="button"
              aria-label="Видалити задачу"
              onClick={() => {
                if (
                  window.confirm('Видалити цю задачу?') &&
                  taskStore.delete(task.id)
                ) {
                  onSaved('Задачу видалено')
                  onClose()
                }
              }}
            >
              <Icon name="trash" />
            </button>
          )}
          <button className="button secondary" type="button" onClick={onClose}>
            Скасувати
          </button>
          <button className="button primary" type="submit">
            {task ? 'Зберегти' : 'Додати задачу'}
            <Icon name="arrow-right" size={18} />
          </button>
        </div>
      </form>
    </Modal>
  )
}
