import { usePwa } from '../hooks/use-pwa'
import { pwa } from '../lib/pwa'
import { Icon } from './Icon'

export function PwaNotice({ busy }: { busy: boolean }) {
  const { needRefresh, error } = usePwa()
  if (error)
    return (
      <div className="error-banner" role="status">
        {error}
      </div>
    )
  if (!needRefresh) return null
  return (
    <div className="update-banner" role="status">
      <span>Нова версія swask готова.</span>
      <button
        className="text-button"
        disabled={busy}
        title={busy ? 'Спочатку закрий вікно редагування або налаштувань' : ''}
        onClick={() => void pwa.update()}
      >
        Оновити
      </button>
      <button
        className="icon-button"
        aria-label="Оновити пізніше"
        onClick={pwa.dismissUpdate}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  )
}
