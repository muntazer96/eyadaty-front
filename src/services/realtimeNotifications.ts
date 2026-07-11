import * as signalR from '@microsoft/signalr'
import api, { ACCESS_TOKEN_KEY } from './api'
import { prepareBrowserNotifications, showBrowserNotification } from './browserNotifications'
import { useNotificationsStore } from '../stores/notifications'

export const REALTIME_NOTIFICATION_EVENT = 'clinic-realtime-notification'

export interface RealtimeNotificationPayload {
  type?: string
  Type?: string
  title?: string
  Title?: string
  body?: string
  Body?: string
  message?: string
  Message?: string
  data?: Record<string, string>
  Data?: Record<string, string>
}

let connection: signalR.HubConnection | null = null
let startPromise: Promise<void> | null = null

function getHubUrl() {
  const apiBase = String(api.defaults.baseURL ?? '')
  return apiBase.replace(/\/api\/?$/i, '').replace(/\/$/, '') + '/hubs/message'
}

function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) ?? ''
}

function normalizePayload(payload: RealtimeNotificationPayload) {
  const title = payload.title ?? payload.Title
  const body = payload.body ?? payload.Body ?? payload.message ?? payload.Message ?? ''
  const type = payload.type ?? payload.Type ?? 'notification'
  const data = payload.data ?? payload.Data ?? {}
  const message = title && body ? `${title}: ${body}` : body || title || 'وصل إشعار جديد'

  return { title, body, type, data, message }
}

function emitRealtimeNotification(payload: RealtimeNotificationPayload) {
  window.dispatchEvent(new CustomEvent(REALTIME_NOTIFICATION_EVENT, { detail: payload }))
}

function buildConnection() {
  const hub = new signalR.HubConnectionBuilder()
    .withUrl(getHubUrl(), {
      accessTokenFactory: getAccessToken,
      withCredentials: false,
    })
    .withAutomaticReconnect([0, 2000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build()

  hub.on('AppNotification', (payload: RealtimeNotificationPayload) => {
    const normalized = normalizePayload(payload)
    useNotificationsStore().info(normalized.message, { duration: 7000 })
    showBrowserNotification({
      title: normalized.title,
      body: normalized.body || normalized.message,
      message: normalized.message,
      data: normalized.data,
    })
    emitRealtimeNotification(payload)
  })

  hub.onreconnected(() => {
    emitRealtimeNotification({ message: 'reconnected' })
  })

  hub.onclose(() => {
    startPromise = null
  })

  return hub
}

export async function startRealtimeNotifications() {
  if (!getAccessToken()) return
  if (connection?.state === signalR.HubConnectionState.Connected) return
  if (startPromise) return startPromise

  prepareBrowserNotifications()
  if (!connection) connection = buildConnection()

  startPromise = connection
    .start()
    .catch(() => {
      connection = null
    })
    .finally(() => {
      startPromise = null
    })

  return startPromise
}

export async function stopRealtimeNotifications() {
  const activeConnection = connection
  connection = null
  startPromise = null

  if (activeConnection && activeConnection.state !== signalR.HubConnectionState.Disconnected) {
    await activeConnection.stop().catch(() => {})
  }
}
