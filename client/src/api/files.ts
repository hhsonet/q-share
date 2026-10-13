export interface FileDto {
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

export interface User {
  id: number
  email: string
}

export type Scope = 'mine' | 'public'

export interface AppConfig {
  maxFileSize: number
  maxFiles: number
  allowedExtensions: string[]
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
  request<{ files: FileDto[] }>(`/api/files?${new URLSearchParams({ q, sort, scope })}`, { signal }).then((r) => r.files)

export const getFile = (id: string) => request<{ file: FileDto }>(`/api/files/${encodeURIComponent(id)}`).then((r) => r.file)

export const deleteFile = (id: string) => request<void>(`/api/files/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const downloadPath = (id: string) => `/api/files/${encodeURIComponent(id)}/download`

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
): Promise<FileDto> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const form = new FormData()
    form.append('public', isPublic ? '1' : '0') // must precede the file part
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
export const login = (email: string, password: string) =>
  request<{ user: User }>('/api/auth/login', json({ email, password })).then((r) => r.user)
export const logout = () => request<void>('/api/auth/logout', { method: 'POST' })
