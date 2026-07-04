import api from './api'
import type { ApiResponse, ConversationItem, ConversationResult, MessageItem } from '../types/api'

export interface SendMessagePayload {
  receiverId: string
  content: string
  type?: string
}

export async function getConversations() {
  const response = await api.get<ApiResponse<ConversationItem[]>>('/Message/conversations')
  return response.data.data ?? []
}

export async function getConversation(otherUserId: string, page = 1, pageSize = 50) {
  const response = await api.get<ApiResponse<ConversationResult>>(`/Message/conversation/${otherUserId}`, {
    params: { page, pageSize },
  })
  return response.data.data
}

export async function sendMessage(payload: SendMessagePayload) {
  const response = await api.post<ApiResponse<MessageItem>>('/Message/send', {
    receiverId: payload.receiverId,
    content: payload.content,
    type: payload.type ?? 'General',
  })
  return response.data.data
}

export async function sendImageMessage(receiverId: string, file: File, content = '') {
  const form = new FormData()
  form.append('receiverId', receiverId)
  form.append('content', content)
  form.append('file', file)

  const response = await api.post<ApiResponse<MessageItem>>('/Message/send-image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data.data
}

export async function markConversationRead(otherUserId: string) {
  await api.put(`/Message/read/${otherUserId}`)
}

export async function getUnreadMessageCount() {
  const response = await api.get<ApiResponse<{ unreadCount?: number; UnreadCount?: number }>>('/Message/unread-count')
  return response.data.data.unreadCount ?? response.data.data.UnreadCount ?? 0
}

export async function canSendMessage(userId: string) {
  const response = await api.get<{ canSend?: boolean; data?: { canSend?: boolean } }>(`/Message/can-send/${userId}`)
  return response.data.canSend ?? response.data.data?.canSend ?? false
}

export function buildMessageHubUrl() {
  const apiBase = String(api.defaults.baseURL ?? '')
  return apiBase.replace(/\/api\/?$/i, '').replace(/\/$/, '') + '/hubs/message'
}

export function loadProtectedImage(route: 'message-image' | 'user-profile-image' | 'doctor-image', fileName: string) {
  const normalized = fileName.split('/').filter(Boolean).pop()
  if (!normalized) return Promise.resolve('')

  return api
    .get(`/Files/${route}/${encodeURIComponent(normalized)}`, { responseType: 'blob' })
    .then((response) => URL.createObjectURL(response.data))
    .catch(() => '')
}
