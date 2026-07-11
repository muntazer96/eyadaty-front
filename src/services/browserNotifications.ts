const SERVICE_WORKER_URL = '/notification-sw.js'
const DEFAULT_TITLE = 'Eyadaty'
const DEFAULT_MESSAGE = 'New notification'

export interface BrowserNotificationPayload {
  title?: string
  body?: string
  message?: string
  data?: Record<string, string>
}

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null

function supportsBrowserNotifications() {
  return typeof window !== 'undefined' && window.isSecureContext && 'Notification' in window
}

function getNotificationUrl(data?: Record<string, string>) {
  const rawUrl = data?.url ?? data?.Url ?? data?.link ?? data?.Link ?? data?.route ?? data?.Route
  if (!rawUrl) return '/'

  try {
    return new URL(rawUrl, window.location.origin).href
  } catch {
    return '/'
  }
}

async function getServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return null

  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register(SERVICE_WORKER_URL)
      .then((registration) => navigator.serviceWorker.ready.catch(() => registration))
      .catch(() => null)
  }

  return registrationPromise
}

export function getBrowserNotificationPermission() {
  if (!supportsBrowserNotifications()) return 'unsupported'
  return Notification.permission
}

export async function prepareBrowserNotifications() {
  if (!supportsBrowserNotifications()) return false
  await getServiceWorkerRegistration()
  return Notification.permission === 'granted'
}

export async function requestBrowserNotificationPermission() {
  if (!supportsBrowserNotifications()) return 'unsupported'

  if (Notification.permission !== 'default') {
    await getServiceWorkerRegistration()
    return Notification.permission
  }

  const permission = await Notification.requestPermission()
  await getServiceWorkerRegistration()
  return permission
}

export async function showBrowserNotification(payload: BrowserNotificationPayload) {
  if (!supportsBrowserNotifications() || Notification.permission !== 'granted') return false

  const title = payload.title || DEFAULT_TITLE
  const body = payload.body || payload.message || DEFAULT_MESSAGE
  const url = getNotificationUrl(payload.data)
  const options: NotificationOptions = {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: `eyadaty-${Date.now()}`,
    data: { url },
  }

  const registration = await getServiceWorkerRegistration()
  if (registration?.showNotification) {
    await registration.showNotification(title, options)
    return true
  }

  const notification = new Notification(title, options)
  notification.onclick = () => {
    window.focus()
    window.location.assign(url)
    notification.close()
  }

  return true
}
