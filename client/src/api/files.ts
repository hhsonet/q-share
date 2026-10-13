export interface FileDto {
  kind: 'file'
  id: string
  name: string
  extension: string
  mimeType: string
  size: number
  createdAt: string
  expiresAt: string | null
  downloadCount: number
  isPublic: boolean
  isOwner: boolean
}

export interface BundleDto {
  kind: 'bundle'
  id: string
  name: string
  fileCount: number
  size: number
  createdAt: string
  expiresAt: string | null
  isPublic: boolean
  isOwner: boolean
}

export type ListItem = FileDto | BundleDto

export interface User {
  id: number
  email: string | null
  username: string | null
  name: string
  isAdmin: boolean
  createdAt: string | null
}

export type Scope = 'mine' | 'public' | 'all'

export interface AppConfig {
  maxFileSize: number
  maxFiles: number
  allowedExtensions: string[]
  allowedTypes: string[]
  expiryHours: number
  publicUrl: string | null
}

export type SortKey = 'newest' | 'oldest' | 'name' | 'size'

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

// --- anonymous owner token (identifies this browser; contains no file data) ---
let memoryToken: string | null = null

export function getOwnerToken(): string {
  const KEY = 'quickshare.ownerToken'
  try {
    const existing = localStorage.getItem(KEY)
    if (existing && /^[a-f0-9]{64}$/.test(existing)) return existing
  } catch {
    /* storage unavailable */
  }
  if (!memoryToken) {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    memoryToken = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  try {
    localStorage.setItem(KEY, memoryToken)
  } catch {
    /* ignore */
  }
  return memoryToken
}

const headers = () => ({ 'X-Owner-Token': getOwnerToken() })

async function toError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json()
    return new ApiError(res.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? 'Request failed.')
  } catch {
    return new ApiError(res.status, 'ERROR', 'Unexpected server response.')
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { ...init, headers: { ...headers(), ...init?.headers } })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network error. Check your connection and try again.')
  }
  if (!res.ok) throw await toError(res)
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

export const getConfig = () => request<AppConfig>('/api/config')

export const listFiles = (q: string, sort: SortKey, scope: Scope, signal?: AbortSignal) =>
  request<{ files: ListItem[] }>(`/api/files?${new URLSearchParams({ q, sort, scope })}`, { signal }).then((r) => r.files)

export const getFile = (id: string) => request<{ file: FileDto }>(`/api/files/${encodeURIComponent(id)}`).then((r) => r.file)

export const deleteFile = (id: string) => request<void>(`/api/files/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const downloadPath = (id: string) => `/api/files/${encodeURIComponent(id)}/download`

export const bundlePath = (id: string) => `/b/${encodeURIComponent(id)}`
export const bundleDownloadPath = (id: string) => `/api/bundles/${encodeURIComponent(id)}/download`
export const bundleShareUrl = (id: string, publicUrl?: string | null) => `${publicUrl || window.location.origin}${bundlePath(id)}`

/** Absolute, shareable download URL. */
export function shareUrl(id: string, publicUrl?: string | null): string {
  return `${publicUrl || window.location.origin}${downloadPath(id)}`
}

/** Uploads one file with progress. Rejects with ApiError; abort via signal. */
export function uploadFile(
  file: File,
  onProgress: (pct: number) => void,
  signal: AbortSignal,
  isPublic = false,
  bundleId?: string,
): Promise<FileDto> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const form = new FormData()
    form.append('public', isPublic ? '1' : '0') // must precede the file part
    if (bundleId) form.append('bundle', bundleId) // before the file part
    form.append('files', file, file.name)

    xhr.open('POST', '/api/files')
    xhr.setRequestHeader('X-Owner-Token', getOwnerToken())
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)))
    }
    xhr.onload = () => {
      let body: { files?: FileDto[]; error?: { code?: string; message?: string } } = {}
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        /* non-JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.files?.[0]) {
        onProgress(100)
        resolve(body.files[0])
      } else {
        const msg = xhr.status === 429 ? 'Too many uploads. Please wait and try again.' : body.error?.message
        reject(new ApiError(xhr.status, body.error?.code ?? 'ERROR', msg ?? 'Upload failed.'))
      }
    }
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK', 'Network error. Upload failed.'))
    xhr.ontimeout = () => reject(new ApiError(0, 'NETWORK', 'Upload timed out.'))
    xhr.onabort = () => reject(new ApiError(0, 'ABORTED', 'Upload cancelled.'))
    signal.addEventListener('abort', () => xhr.abort(), { once: true })
    if (signal.aborted) return xhr.onabort?.(new ProgressEvent('abort'))
    xhr.send(form)
  })
}

// --- auth (session cookie is httpOnly; the server tells us who we are) ---
const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const getMe = () => request<{ user: User | null }>('/api/auth/me').then((r) => r.user)
export const register = (email: string, password: string) =>
  request<{ user: User }>('/api/auth/register', json({ email, password })).then((r) => r.user)
export const login = (identifier: string, password: string) =>
  request<{ user: User }>('/api/auth/login', json({ identifier, password })).then((r) => r.user)
export const logout = () => request<void>('/api/auth/logout', { method: 'POST' })

// --- admin ---
export interface AdminStats {
  users: number
  admins: number
  files: number
  bytes: number
  publicFiles: number
  anonymousFiles: number
}

export interface AdminUser {
  id: number
  email: string | null
  username: string | null
  name: string
  isAdmin: boolean
  createdAt: string
  fileCount: number
  bytes: number
  lastUpload: string | null
}

export interface AdminFile extends FileDto {
  uploader: { id: number; name: string } | null
}

export const adminStats = () => request<AdminStats>('/api/admin/stats')
export const adminUsers = (q: string) =>
  request<{ users: AdminUser[] }>(`/api/admin/users?${new URLSearchParams({ q })}`).then((r) => r.users)
export const adminFiles = (q: string, sort: SortKey, filter: string) =>
  request<{ files: AdminFile[] }>(`/api/admin/files?${new URLSearchParams({ q, sort, filter })}`).then((r) => r.files)
export const adminResetPassword = (id: number, password: string) =>
  request<void>(`/api/admin/users/${id}/reset-password`, json({ password }))
export const changePassword = (currentPassword: string, newPassword: string) =>
  request<void>('/api/auth/change-password', json({ currentPassword, newPassword }))
export const adminGetSettings = () => request<{ expiryDays: number }>('/api/admin/settings')
export const adminSetDefaultExpiry = (expiryDays: number) =>
  request<{ expiryDays: number }>('/api/admin/settings', { ...json({ expiryDays }), method: 'PUT' })
export const adminApplyExpiryToAll = (days: number) =>
  request<{ updated: number }>('/api/admin/files/apply-expiry', json({ days }))
export const adminSetFileExpiry = (id: string, days: number | null) =>
  request<{ expiresAt: string | null }>(`/api/admin/files/${encodeURIComponent(id)}/expiry`, { ...json({ days }), method: 'PATCH' })
export const adminSetVisibility = (id: string, isPublic: boolean) =>
  request<{ isPublic: boolean }>(`/api/admin/files/${encodeURIComponent(id)}/visibility`, { ...json({ isPublic }), method: 'PATCH' })

// --- bundles ---
export const createBundle = (name: string, isPublic: boolean) =>
  request<{ bundle: BundleDto }>('/api/bundles', json({ name: name || undefined, isPublic })).then((r) => r.bundle)
export const getBundle = (id: string) =>
  request<{ bundle: BundleDto; files: FileDto[] }>(`/api/bundles/${encodeURIComponent(id)}`)
export const deleteBundle = (id: string) => request<void>(`/api/bundles/${encodeURIComponent(id)}`, { method: 'DELETE' })

// --- allowed file types ---
export interface FileTypeCategory {
  key: string
  label: string
  extensions: string[]
}
export const adminGetAllowedTypes = () =>
  request<{ categories: FileTypeCategory[]; enabled: string[] }>('/api/admin/allowed-types')
export const adminSetAllowedTypes = (enabled: string[]) =>
  request<{ enabled: string[] }>('/api/admin/allowed-types', { ...json({ enabled }), method: 'PUT' })
