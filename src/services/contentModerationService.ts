import api from './api'
import type { ApiResponse } from '../types/api'

export type ContentReportReason = 'OffensiveContent' | 'FalseInformation' | 'Spam' | 'Other'

export const contentReportReasons: Array<{ value: ContentReportReason; label: string }> = [
  { value: 'OffensiveContent', label: 'محتوى مسيء' },
  { value: 'FalseInformation', label: 'معلومات خاطئة' },
  { value: 'Spam', label: 'بريد مزعج' },
  { value: 'Other', label: 'أخرى' },
]

export async function reportReview(reviewId: number, reason: ContentReportReason, details?: string) {
  const response = await api.post<ApiResponse<unknown>>(`/ContentReport/reviews/${reviewId}`, {
    reason,
    details: details?.trim() || undefined,
  })
  return response.data
}

export async function reportMessage(messageId: number, reason: ContentReportReason, details?: string) {
  const response = await api.post<ApiResponse<unknown>>(`/ContentReport/messages/${messageId}`, {
    reason,
    details: details?.trim() || undefined,
  })
  return response.data
}

export async function blockUser(userId: string) {
  const response = await api.post<ApiResponse<unknown>>(`/UserBlock/${userId}`)
  return response.data
}
