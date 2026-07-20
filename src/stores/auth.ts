import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import api, {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  clearAuthStorage,
  refreshAccessToken,
} from '../services/api'

const TOKEN_KEY = ACCESS_TOKEN_KEY
const DEVICE_ID_KEY = 'clinic_admin_device_id'
const TRUSTED_DEVICE_TOKEN_KEY = 'clinic_admin_trusted_2fa_device_token'
const TRUSTED_DEVICE_TOKEN_EXPIRES_KEY = 'clinic_admin_trusted_2fa_device_token_expires_at'

interface LoginResponse {
  data?: {
    token?: string
    refreshToken?: string
    requiresTwoFactor?: boolean
    requiresLoginApproval?: boolean
    canUseTwoFactor?: boolean
    challengeId?: string
    trustedDeviceToken?: string
    trustedDeviceTokenExpiresAt?: string
    status?: string
  }
}

interface LoginResult {
  requiresTwoFactor: boolean
  requiresLoginApproval?: boolean
  canUseTwoFactor?: boolean
  challengeId?: string
}

interface JwtPayload {
  exp?: number
  role?: string | string[]
  Role?: string | string[]
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'?: string | string[]
}

function decodePayload(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(normalized)
    const utf8Bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(utf8Bytes)) as JwtPayload
  } catch {
    return null
  }
}

function asArray(value?: string | string[]) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function normalizeRole(role: string) {
  return role.trim().toLowerCase()
}

function getWebDeviceId() {
  let value = localStorage.getItem(DEVICE_ID_KEY)
  if (!value) {
    value = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
    localStorage.setItem(DEVICE_ID_KEY, value)
  }
  return value
}

function getWebDeviceInfo() {
  return {
    deviceId: getWebDeviceId(),
    deviceName: 'Web browser',
    platform: navigator.platform || 'Web',
    trustedDeviceToken: localStorage.getItem(TRUSTED_DEVICE_TOKEN_KEY) || undefined,
  }
}

function normalizeSecurityCodeInput(value: string) {
  return value
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06F0))
    .replace(/[\uFF10-\uFF19]/g, (digit) => String(digit.charCodeAt(0) - 0xFF10))
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .trim()
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) ?? '')
  const refreshToken = ref(localStorage.getItem(REFRESH_TOKEN_KEY) ?? '')
  const loading = ref(false)
  const error = ref('')

  const payload = computed(() => decodePayload(token.value))
  const roles = computed(() => {
    const claims = payload.value
    const result = Array.from(new Set([
      ...asArray(claims?.role),
      ...asArray(claims?.Role),
      ...asArray(claims?.['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']),
    ]))
    console.log('[Auth] JWT payload:', claims, 'roles:', result)
    return result
  })
  const isAuthenticated = computed(() => {
    if (!token.value || !payload.value) return false
    return !payload.value.exp || payload.value.exp * 1000 > Date.now()
  })
  const hasRefreshToken = computed(() => Boolean(refreshToken.value || localStorage.getItem(REFRESH_TOKEN_KEY)))
  const primaryRole = computed(() => roles.value[0] ?? '')

  function hasAnyRole(allowedRoles: string[]) {
    if (allowedRoles.length === 0) return true
    const normalizedRoles = roles.value.map(normalizeRole)
    return allowedRoles.some((role) => normalizedRoles.includes(normalizeRole(role)))
  }

  function storeTokens(newToken: string, newRefreshToken?: string, trustedDeviceToken?: string, trustedDeviceTokenExpiresAt?: string) {
    token.value = newToken
    refreshToken.value = newRefreshToken ?? ''
    localStorage.setItem(TOKEN_KEY, newToken)
    if (newRefreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken)
    if (trustedDeviceToken) {
      localStorage.setItem(TRUSTED_DEVICE_TOKEN_KEY, trustedDeviceToken)
      if (trustedDeviceTokenExpiresAt) localStorage.setItem(TRUSTED_DEVICE_TOKEN_EXPIRES_KEY, trustedDeviceTokenExpiresAt)
    }
    window.dispatchEvent(new CustomEvent('clinic-auth-refreshed', { detail: { token: newToken, refreshToken: newRefreshToken } }))
  }

  function applyTokens(newToken: string, newRefreshToken?: string, trustedDeviceToken?: string, trustedDeviceTokenExpiresAt?: string) {
    storeTokens(newToken, newRefreshToken, trustedDeviceToken, trustedDeviceTokenExpiresAt)
  }

  async function login(phoneNumber: string, password: string): Promise<LoginResult> {
    loading.value = true
    error.value = ''
    try {
      const response = await api.post<LoginResponse>('/User/signin', {
        phoneNumber,
        password,
        ...getWebDeviceInfo(),
      })
      const data = response.data.data
      if (data?.requiresLoginApproval) {
        if (!data.challengeId) throw new Error('لم يرجع الخادم تحدي موافقة تسجيل الدخول.')
        return {
          requiresTwoFactor: false,
          requiresLoginApproval: true,
          canUseTwoFactor: data.canUseTwoFactor,
          challengeId: data.challengeId,
        }
      }
      if (data?.requiresTwoFactor) {
        if (!data.challengeId) throw new Error('لم يرجع الخادم تحدي المصادقة الثنائية.')
        return { requiresTwoFactor: true, challengeId: data.challengeId }
      }

      const newToken = data?.token
      const newRefreshToken = data?.refreshToken
      if (!newToken) throw new Error('لم يرجع الخادم رمز دخول صالحا.')
      storeTokens(newToken, newRefreshToken, data?.trustedDeviceToken, data?.trustedDeviceTokenExpiresAt)
      return { requiresTwoFactor: false }
    } catch (requestError: any) {
      error.value = requestError.response?.data?.message ?? requestError.message ?? 'تعذر تسجيل الدخول.'
      throw requestError
    } finally {
      loading.value = false
    }
  }

  async function completeTwoFactorLogin(challengeId: string, code: string) {
    loading.value = true
    error.value = ''
    try {
      const response = await api.post<LoginResponse>('/User/signin/2fa', {
        challengeId,
        code: normalizeSecurityCodeInput(code),
      })
      const newToken = response.data.data?.token
      const newRefreshToken = response.data.data?.refreshToken
      if (!newToken) throw new Error('لم يرجع الخادم رمز دخول صالحا بعد المصادقة الثنائية.')
      storeTokens(newToken, newRefreshToken, response.data.data?.trustedDeviceToken, response.data.data?.trustedDeviceTokenExpiresAt)
    } catch (requestError: any) {
      error.value = requestError.response?.data?.message ?? requestError.message ?? 'تعذر التحقق من رمز المصادقة الثنائية.'
      throw requestError
    } finally {
      loading.value = false
    }
  }

  async function getLoginApprovalStatus(challengeId: string) {
    const response = await api.post<LoginResponse>('/User/signin/approval/status', { challengeId })
    const data = response.data.data
    if (data?.status === 'Approved') {
      const newToken = data.token
      const newRefreshToken = data.refreshToken
      if (!newToken) throw new Error('لم يرجع الخادم رمز دخول صالحا بعد الموافقة.')
      storeTokens(newToken, newRefreshToken, data.trustedDeviceToken, data.trustedDeviceTokenExpiresAt)
    }
    return data?.status ?? 'Pending'
  }

  async function approveLogin(challengeId: string) {
    await api.post('/User/signin/approval/approve', { challengeId })
  }

  async function rejectLogin(challengeId: string) {
    await api.post('/User/signin/approval/reject', { challengeId })
  }

  async function ensureSession() {
    if (isAuthenticated.value) return true
    if (!hasRefreshToken.value) return false

    const newToken = await refreshAccessToken()
    if (!newToken) {
      token.value = ''
      refreshToken.value = ''
      return false
    }

    token.value = newToken
    refreshToken.value = localStorage.getItem(REFRESH_TOKEN_KEY) ?? ''
    return isAuthenticated.value
  }

  function logout() {
    const currentRefreshToken = refreshToken.value
    token.value = ''
    refreshToken.value = ''
    clearAuthStorage()
    if (currentRefreshToken) {
      api.post('/User/logout', { refreshToken: currentRefreshToken }).catch(() => {})
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('clinic-auth-refreshed', ((event: CustomEvent<{ token?: string; refreshToken?: string }>) => {
      if (event.detail?.token) token.value = event.detail.token
      if (event.detail?.refreshToken) refreshToken.value = event.detail.refreshToken
    }) as EventListener)
  }

  return {
    token,
    refreshToken,
    roles,
    primaryRole,
    isAuthenticated,
    loading,
    error,
    login,
    getLoginApprovalStatus,
    approveLogin,
    rejectLogin,
    completeTwoFactorLogin,
    applyTokens,
    logout,
    ensureSession,
    hasAnyRole,
  }
})
