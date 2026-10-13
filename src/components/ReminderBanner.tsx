import { reminderStore, useMinute, useReminders } from '../hooks/use-reminders'
import { dueReminders } from '../lib/reminders'
import { type Task } from '../lib/tasks'
import { Icon } from './Icon'

export function ReminderBanner({
  tasks,
  onReview,
}: {
  tasks: Task[]
  onReview: () => void
}) {
  const { preferences } = useReminders()
  const moment = useMinute()
  const date = moment.slice(0, 10)
  const tasksDue = dueReminders(tasks, date, moment.slice(11), preferences.time)
  if (
    !preferences.inApp ||
    preferences.dismissedDate === date ||
    tasksDue.length === 0
  )
    return null
  return (
    <section
      className="reminder-banner"
      role="status"
      aria-label="Нагадування про дедлайни"
    >
      <Icon name="bell" size={20} />
      <div>
        <strong>Задачі з дедлайном: {tasksDue.length}</strong>
        <span>
          {tasksDue[0]?.title}
          {tasksDue.length > 1
            ? ' та інші — по одному кроку.'
            : ' — можна почати з малого.'}
        </span>
      </div>
      <button className="text-button" onClick={onReview}>
        Переглянути
      </button>
      <button
        className="icon-button"
        aria-label="Приховати нагадування сьогодні"
        onClick={() => reminderStore.update({ dismissedDate: date })}
      >
        <Icon name="close" size={16} />
      </button>
    </section>
  )
}
