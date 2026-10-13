interface SubscriptionHandle {
  endpoint: string
  unsubscribe(): Promise<boolean>
}
interface PushSetup {
  save(): Promise<void>
  remove(): Promise<void>
  persist(): boolean
}
export class PushSetupError extends Error {
  readonly keepSubscription: boolean
  constructor(message: string, keepSubscription: boolean, cause: unknown) {
    super(message, { cause })
    this.keepSubscription = keepSubscription
  }
}
export async function savePushOptIn(
  subscription: SubscriptionHandle,
  existing: boolean,
  setup: PushSetup,
): Promise<void> {
  let posted = false
  try {
    await setup.save()
    posted = true
    if (!setup.persist())
      throw new Error('Не вдалося зберегти налаштування на пристрої.')
  } catch (error) {
    let cleanupFailed = false
    if (posted) {
      try {
        await setup.remove()
      } catch {
        cleanupFailed = true
      }
    }
    if (posted || !existing) {
      try {
        await subscription.unsubscribe()
      } catch {
        cleanupFailed = true
      }
    }
    throw new PushSetupError(
      cleanupFailed
        ? 'Не вдалося завершити налаштування та скасувати підписку. Перевір зв’язок і натисни «Вимкнути push-нагадування», щоб повторити очищення.'
        : error instanceof TypeError || error instanceof DOMException
          ? 'Не вдалося ввімкнути сповіщення. Перевір дозвіл браузера та зв’язок із мережею.'
          : error instanceof Error
            ? error.message
            : 'Не вдалося ввімкнути сповіщення.',
      cleanupFailed || (existing && !posted),
      error,
    )
  }
}
