export interface CareApiCredentialListItem {
  id: number
  name: string
  maskedSecret: string
  status: 'Active' | 'Revoked' | 'Replaced'
  createdAt: string
  expiresAt: string | null
  lastUsedAt: string | null
  revokedAt: string | null
  scopes: string[]
  credentialVersion: number
}

export interface CareApiCredentialDetail extends CareApiCredentialListItem {
  deviceName: string | null
  platform: string | null
  connectedInstallationId: string | null
  connectedAt: string | null
  connectedCareVersion: string | null
}

export interface CreateCredentialRequest {
  name: string
  scopes: string[]
  expiryDays: number | null
}

export interface CreateCredentialResponse {
  credentialId: number
  fullSecret: string
  maskedSecret: string
  name: string
  createdAt: string
  expiresAt: string | null
  scopes: string[]
}
