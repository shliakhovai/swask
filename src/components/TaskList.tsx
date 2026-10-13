import { addDays, formatDate } from '../lib/date'
import { groupTasks, type Task } from '../lib/tasks'
import { Icon } from './Icon'

export function TaskList({
  tasks,
  current,
  completed,
  selectedDate,
  disabled,
  onEdit,
  onToggle,
  onAdd,
}: {
  tasks: Task[]
  current: string
  completed: boolean
  selectedDate: string | null
  disabled: boolean
  onEdit: (task: Task) => void
  onToggle: (task: Task) => void
  onAdd: () => void
}) {
  const groups = completed
    ? [{ key: 'completed', tasks }]
    : selectedDate
      ? [{ key: selectedDate, tasks }]
      : groupTasks(tasks, current)
  return (
    <div className="task-groups">
      {groups.map((group) => (
        <section
          className={`day-group ${group.key === 'overdue' ? 'overdue-group' : ''}`}
          key={group.key}
        >
          <div className="day-heading">
            <h2>
              {group.key === 'overdue'
                ? 'Прострочено'
                : group.key === 'undated'
                  ? 'Без дедлайну'
                  : group.key === 'completed'
                    ? 'Зроблено'
                    : group.key === current
                      ? 'Сьогодні'
                      : group.key === addDays(current, 1)
                        ? 'Завтра'
                        : formatDate(group.key)}
            </h2>
            <span>
              {!['overdue', 'undated', 'completed'].includes(group.key) &&
                formatDate(group.key, { day: 'numeric', month: 'long' })}
              <span className="count-badge">{group.tasks.length}</span>
            </span>
          </div>
          {group.tasks.length === 0 ? (
            <div className="day-empty">
              <span className="empty-spark">✳</span>
              <p>
                {completed
                  ? 'Тут з’являться твої маленькі перемоги.'
                  : selectedDate && selectedDate !== current
                    ? 'На цей день задач немає.'
                    : 'На сьогодні все вільно. Можна видихнути.'}
              </p>
            </div>
          ) : (
            <div className="day-tasks">
              {group.tasks.map((task) => (
                <article
                  className={`task-row ${task.completed ? 'is-complete' : ''}`}
                  key={task.id}
                >
                  <button
                    className="complete-button"
                    aria-label={
                      task.completed
                        ? `Повернути: ${task.title}`
                        : `Завершити: ${task.title}`
                    }
                    onClick={() => onToggle(task)}
                  >
                    {task.completed && <Icon name="check" size={17} />}
                  </button>
                  <button className="task-open" onClick={() => onEdit(task)}>
                    <span className="task-title">{task.title}</span>
                    {task.description && (
                      <span className="task-description">
                        {task.description}
                      </span>
                    )}
                    {group.key === 'overdue' && (
                      <span className="overdue-date">
                        {formatDate(task.deadline!)}
                      </span>
                    )}
                  </button>
                  {task.link && (
                    <a
                      className="icon-button task-link"
                      aria-label={`Посилання: ${task.title}`}
                      href={task.link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon name="link" size={18} />
                    </a>
                  )}
                  <span className="row-arrow" aria-hidden="true">
                    ↗
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>
      ))}
      {tasks.length === 0 && !completed && !selectedDate && (
        <button className="add-empty" disabled={disabled} onClick={onAdd}>
          <Icon name="plus" />
          Додай першу задачу<span>З чогось маленького починається велике.</span>
        </button>
      )}
    </div>
  )
}
