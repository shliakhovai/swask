import { taskStore, useTasks } from '../hooks/use-tasks'
import { usePwa } from '../hooks/use-pwa'
import { pwa } from '../lib/pwa'
import { Modal } from './Modal'
import { SyncSettings } from './SyncSettings'
import { ReminderSettings } from './ReminderSettings'

export function Settings({ onClose }: { onClose: () => void }) {
  const { blocked } = useTasks()
  const { installable, installed, offlineReady } = usePwa()
  return (
    <Modal title="Налаштування" onClose={onClose}>
      <div className="settings-content">
        <SyncSettings />
        <ReminderSettings />
        <section className="setting-section">
          <h3>На твоєму пристрої</h3>
          <p>
            {offlineReady
              ? 'swask готовий до запуску без інтернету.'
              : 'Офлайн-запуск стане доступним після першого відкриття готової версії застосунку.'}
          </p>
          {installed ? (
            <p>Застосунок установлено.</p>
          ) : installable ? (
            <button
              className="button secondary"
              onClick={() => void pwa.install()}
            >
              Встановити swask
            </button>
          ) : (
            <p className="field-hint">
              На iPhone/iPad: Поділитися → На початковий екран. На інших
              пристроях — «Встановити застосунок» у меню браузера.
            </p>
          )}
        </section>
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
