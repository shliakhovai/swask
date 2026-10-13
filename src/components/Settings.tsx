import { taskStore, useTasks } from '../hooks/use-tasks'
import { Modal } from './Modal'

export function Settings({ onClose }: { onClose: () => void }) {
  const { blocked } = useTasks()
  return (
    <Modal title="Налаштування" onClose={onClose}>
      <div className="settings-content">
        <p>
          Твої задачі зберігаються в цьому браузері й доступні без інтернету.
        </p>
        {blocked && (
          <>
            <p>Перед очищенням завантаж копію пошкоджених даних.</p>
            <button
              className="button secondary"
              onClick={() => {
                const raw = taskStore.rawData()
                if (raw === null) return
                const url = URL.createObjectURL(
                  new Blob([raw], { type: 'application/json' }),
                )
                const a = document.createElement('a')
                a.href = url
                a.download = 'swask-recovery.json'
                a.click()
                setTimeout(() => URL.revokeObjectURL(url), 1000)
              }}
            >
              Завантажити дані
            </button>
            <button
              className="button danger"
              onClick={() => {
                if (
                  confirm(
                    'Очистити локальне сховище? Дані в цьому браузері буде видалено.',
                  )
                )
                  taskStore.reset()
              }}
            >
              Очистити пошкоджене сховище
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
