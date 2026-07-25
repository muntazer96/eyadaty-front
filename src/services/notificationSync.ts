export const NOTIFICATION_READ_STATE_EVENT = 'notification-read-state-changed'

const CHANNEL_NAME = 'eyadaty-notification-read-state'
const STORAGE_KEY = 'eyadaty:notification-read-state'

export type NotificationReadState =
  | { action: 'read'; notificationId: number; readAt: string }
  | { action: 'read-all'; readAt: string }

let channel: BroadcastChannel | undefined

function dispatchReadState(state: NotificationReadState) {
  window.dispatchEvent(new CustomEvent<NotificationReadState>(
    NOTIFICATION_READ_STATE_EVENT,
    { detail: state },
  ))
}

function getChannel() {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.addEventListener('message', (event: MessageEvent<NotificationReadState>) => {
      dispatchReadState(event.data)
    })
  }
  return channel
}

if (typeof window !== 'undefined') {
  getChannel()

  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return
    try {
      dispatchReadState(JSON.parse(event.newValue) as NotificationReadState)
    } catch {
      // Ignore malformed values written by anything other than this application.
    }
  })
}

export function publishNotificationReadState(state: NotificationReadState) {
  if (typeof window === 'undefined') return

  // Keep all notification components in the current tab in sync too.
  dispatchReadState(state)

  const broadcastChannel = getChannel()
  if (broadcastChannel) {
    broadcastChannel.postMessage(state)
    return
  }

  // The storage event is a fallback for browsers without BroadcastChannel.
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, sentAt: Date.now() }))
}
