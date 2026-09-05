// Eyadaty Care licensing (central authority) — admin DTO mirrors

export interface CarePlan {
  id: number
  name: string
  code: string
  description?: string | null
  maxInstallations: number
  offlineValidityDays: number
  gracePeriodDays: number
  features: string
  isActive: boolean
}

export interface UpsertCarePlanPayload {
  name: string
  code: string
  description?: string
  maxInstallations: number
  offlineValidityDays: number
  gracePeriodDays: number
  features: string
  isActive: boolean
}

export interface CareSubscriptionListItem {
  id: number
  doctorId: number
  doctorName: string
  planId: number
  planName: string
  planCode: string
  startDate: string
  endDate: string
  status: string
  maxInstallations: number
  activeInstallations: number
  activeLicenses: number
  subscriptionVersion: number
  createdAt: string
}

export interface CareLicense {
  id: number
  maskedKey: string
  status: string
  createdAt: string
  activatedAt?: string | null
  revokedAt?: string | null
  revokedReason?: string | null
  installationsCount: number
}

export interface CareInstallation {
  id: number
  installationId: string
  shortInstallationId: string
  deviceName: string
  platform: string
  applicationVersion: string
  activatedAt: string
  lastSeenAt?: string | null
  lastValidationAt?: string | null
  revokedAt?: string | null
  status: string
  subscriptionId: number
  licenseId: number
  maskedLicense?: string
}

export interface CareSubscriptionDetail {
  id: number
  doctorId: number
  doctorName: string
  doctorPhoneNumber?: string | null
  planId: number
  planName: string
  planCode: string
  startDate: string
  endDate: string
  status: string
  maxInstallations: number
  subscriptionVersion: number
  createdAt: string
  suspendedAt?: string | null
  cancelledAt?: string | null
  licenses: CareLicense[]
  installations: CareInstallation[]
}

export interface CreateCareSubscriptionResult {
  subscription: CareSubscriptionDetail
  fullLicenseKey: string
}

export interface CareEvent {
  id: number
  subscriptionId?: number | null
  licenseId?: number | null
  installationId?: string | null
  doctorId?: number | null
  eventType: string
  result: string
  ipAddress?: string | null
  userAgent?: string | null
  applicationVersion?: string | null
  metadata?: string | null
  occurredAt: string
}

export function careSubscriptionStatusLabel(status: string): { label: string; color: string } {
  switch (status) {
    case 'Active': return { label: 'نشط', color: 'success' }
    case 'ExpiredSoon': return { label: 'قارب الانتهاء', color: 'warning' }
    case 'Expired': return { label: 'منتهي', color: 'default' }
    case 'Suspended': return { label: 'موقوف', color: 'warning' }
    case 'Cancelled': return { label: 'ملغي', color: 'error' }
    case 'Pending': return { label: 'لم يُنشّط بعد', color: 'info' }
    default: return { label: status, color: 'default' }
  }
}

export function careLicenseStatusLabel(status: string): { label: string; color: string } {
  switch (status) {
    case 'Active': return { label: 'نشط', color: 'success' }
    case 'Revoked': return { label: 'ملغى', color: 'error' }
    case 'Replaced': return { label: 'مستبدل', color: 'default' }
    default: return { label: status, color: 'default' }
  }
}

export function careInstallationStatusLabel(status: string): { label: string; color: string } {
  switch (status) {
    case 'Active': return { label: 'نشط', color: 'success' }
    case 'Revoked': return { label: 'مُلغى', color: 'error' }
    default: return { label: status, color: 'default' }
  }
}
