import * as signalR from '@microsoft/signalr'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ACCESS_TOKEN_KEY } from '../services/api'
import { buildMessageHubUrl, getUnreadMessageCount } from '../services/messageService'
import type { MessageItem } from '../types/api'

export const useMessagesStore = defineStore('messages', () => {
  const connection = ref<signalR.HubConnection | null>(null)
  const connecting = ref(false)
  const unreadCount = ref(0)
  const lastMessage = ref<MessageItem | null>(null)
  const sentMessage = ref<MessageItem | null>(null)
  const typingUserId = ref('')
  const readByUserId = ref('')
  const conversationsVersion = ref(0)

  const isConnected = computed(() => connection.value?.state === signalR.HubConnectionState.Connected)

  function bumpConversations() {
    conversationsVersion.value += 1
  }

  async function connect() {
    if (isConnected.value || connecting.value) return
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!token) return

    connecting.value = true

    const hub = new signalR.HubConnectionBuilder()
      .withUrl(buildMessageHubUrl(), {
        accessTokenFactory: () => localStorage.getItem(ACCESS_TOKEN_KEY) ?? '',
        withCredentials: false,
      })
      .withAutomaticReconnect([0, 2000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    hub.on('ReceiveMessage', (message: MessageItem) => {
      lastMessage.value = message
      bumpConversations()
    })

    hub.on('MessageSent', (message: MessageItem) => {
      sentMessage.value = message
      bumpConversations()
    })

    hub.on('UnreadCount', (count: number) => {
      unreadCount.value = Number(count) || 0
    })

    hub.on('MessagesRead', (userId: string) => {
      readByUserId.value = userId
      bumpConversations()
    })

    hub.on('UserTyping', (userId: string) => {
      typingUserId.value = userId
    })

    hub.on('UserStopTyping', (userId: string) => {
      if (typingUserId.value === userId) typingUserId.value = ''
    })

    hub.onreconnected(() => {
      refreshUnreadCount()
      bumpConversations()
    })

    hub.onclose(() => {
      connection.value = null
      connecting.value = false
    })

    connection.value = hub

    try {
      await hub.start()
      await refreshUnreadCount()
    } catch {
      connection.value = null
    } finally {
      connecting.value = false
    }
  }

  async function disconnect() {
    const active = connection.value
    connection.value = null
    connecting.value = false
    unreadCount.value = 0
    if (active && active.state !== signalR.HubConnectionState.Disconnected) {
      await active.stop().catch(() => {})
    }
  }

  async function refreshUnreadCount() {
    unreadCount.value = await getUnreadMessageCount()
  }

  async function sendViaHub(receiverId: string, content: string, type = 'General') {
    if (!isConnected.value) return false
    await connection.value?.invoke('SendMessage', { receiverId, content, type })
    return true
  }

  async function markReadViaHub(otherUserId: string) {
    if (!isConnected.value) return
    await connection.value?.invoke('MarkRead', otherUserId).catch(() => {})
  }

  async function sendTyping(otherUserId: string) {
    if (!isConnected.value) return
    await connection.value?.invoke('Typing', otherUserId).catch(() => {})
  }

  async function sendStopTyping(otherUserId: string) {
    if (!isConnected.value) return
    await connection.value?.invoke('StopTyping', otherUserId).catch(() => {})
  }

  return {
    connecting,
    unreadCount,
    lastMessage,
    sentMessage,
    typingUserId,
    readByUserId,
    conversationsVersion,
    isConnected,
    connect,
    disconnect,
    refreshUnreadCount,
    sendViaHub,
    markReadViaHub,
    sendTyping,
    sendStopTyping,
  }
})
