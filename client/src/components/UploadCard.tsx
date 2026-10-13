import { useCallback, useRef, useState } from 'react'
import { AlertCircle, ArrowUp, CheckCircle2, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError, uploadFile, type AppConfig, type FileDto, type User } from '@/api/files'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn, formatBytes, getExtension } from '@/lib/utils'

type Status = 'ready' | 'uploading' | 'done' | 'error'

interface QueueItem {
  key: string
  file: File
  status: Status
  progress: number
  error?: string
}

interface Props {
  config: AppConfig | null
  user: User | null
  onUploaded: (files: FileDto[]) => void
  onSignIn: () => void
}

let counter = 0

function expiryLabel(hours: number): string {
  if (!hours) return 'No expiry'
  if (hours < 48) return `${hours}-hour expiry`
  return `${Math.round(hours / 24)}-day expiry`
}

export function UploadCard({ config, user, onUploaded, onSignIn }: Props) {
  const [makePublic, setMakePublic] = useState(true)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const controllers = useRef(new Map<string, AbortController>())
  const cancelAll = useRef(false)

  const patch = useCallback((key: string, p: Partial<QueueItem>) => {
    setQueue((q) => q.map((i) => (i.key === key ? { ...i, ...p } : i)))
  }, [])

  const validate = (file: File): string | null => {
    if (!config) return null
    if (file.size === 0) return 'File is empty.'
    if (file.size > config.maxFileSize) return `Larger than the ${formatBytes(config.maxFileSize)} limit.`
    const ext = getExtension(file.name)
    if (!ext || !config.allowedExtensions.includes(ext)) return `“.${ext || '?'}” files are not allowed.`
    return null
  }

  const addFiles = (list: FileList | File[]) => {
    const incoming = Array.from(list)
    if (!incoming.length) return
    const rejected: string[] = []
    const items: QueueItem[] = []
    for (const file of incoming) {
      const err = validate(file)
      if (err) rejected.push(`${file.name}: ${err}`)
      else items.push({ key: `f${++counter}`, file, status: 'ready', progress: 0 })
    }
    if (rejected.length) {
      toast.error(`${rejected.length} file${rejected.length > 1 ? 's' : ''} rejected`, {
        description: rejected.slice(0, 3).join('\n') + (rejected.length > 3 ? `\n…and ${rejected.length - 3} more` : ''),
      })
    }
    if (items.length) setQueue((q) => [...q.filter((i) => i.status !== 'error'), ...items])
  }

  const remove = (key: string) => {
    controllers.current.get(key)?.abort()
    setQueue((q) => q.filter((i) => i.key !== key))
  }

  const startUpload = async () => {
    const pending = queue.filter((i) => i.status === 'ready' || i.status === 'error')
    if (!pending.length || busy) return
    setBusy(true)
    cancelAll.current = false
    const done: FileDto[] = []
    let failed = 0

    for (const item of pending) {
      if (cancelAll.current) break
      const ctrl = new AbortController()
      controllers.current.set(item.key, ctrl)
      patch(item.key, { status: 'uploading', progress: 0, error: undefined })
      try {
        const dto = await uploadFile(item.file, (progress) => patch(item.key, { progress }), ctrl.signal, user ? makePublic : true)
        done.push(dto)
        patch(item.key, { status: 'done', progress: 100 })
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError(0, 'ERROR', 'Upload failed.')
        if (err.code === 'ABORTED') continue // already removed from the queue by the user
        failed++
        patch(item.key, { status: 'error', error: err.message, progress: 0 })
      } finally {
        controllers.current.delete(item.key)
      }
    }

    setBusy(false)
    setQueue((q) => q.filter((i) => i.status !== 'done')) // closes the modal; share popup takes over
    if (done.length) {
      onUploaded(done)
    }
    if (failed) toast.error(`${failed} upload${failed > 1 ? 's' : ''} failed`, { description: 'See the errors in the list and retry.' })
  }

  const cancelUploads = () => {
    cancelAll.current = true
    controllers.current.forEach((c) => c.abort())
    setQueue((q) => q.map((i) => (i.status === 'uploading' ? { ...i, status: 'ready', progress: 0 } : i)))
    toast('Upload cancelled')
  }

  const pendingCount = queue.filter((i) => i.status === 'ready' || i.status === 'error').length
  const batch = queue.filter((i) => i.status !== 'error')
  const batchTotal = batch.reduce((s, i) => s + i.file.size, 0)
  const overall = batchTotal ? Math.round((batch.reduce((s, i) => s + (i.file.size * i.progress) / 100, 0) / batchTotal) * 100) : 0
  const batchDone = batch.filter((i) => i.status === 'done').length
  const queueBytes = queue.reduce((s, i) => s + i.file.size, 0)

  const browse = () => !busy && inputRef.current?.click()

  return (
    <section className="flex flex-col gap-3.5" aria-labelledby="upload-title">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload files: drop files here or press Enter to browse"
        onClick={browse}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            browse()
          }
        }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
        className={cn(
          'flex min-h-[340px] cursor-pointer flex-col items-center justify-center gap-[18px] rounded-[20px] border-[1.5px] border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          dragging ? 'border-blue bg-blue-wash' : 'border-line-strong bg-bar hover:border-blue/60',
        )}
      >
        <div className="grid size-14 place-items-center rounded-2xl bg-ink shadow-[0_8px_24px_-8px_oklch(0.21_0.01_260/0.5)]">
          <ArrowUp className="size-[22px] text-white" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 id="upload-title" className="text-[22px] font-semibold tracking-[-0.02em]">
            {dragging ? 'Release to add' : 'Drop files here'}
          </h2>
          <p className="text-[15px] text-mute">
            or <span className="font-medium text-blue-link underline underline-offset-[3px]">browse from your device</span>
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5 font-mono text-[11.5px] text-mute-2">
          <span className="rounded-full bg-fill-2 px-2.5 py-[5px]">{config ? `${formatBytes(config.maxFileSize)} max` : '…'}</span>
          <span className="rounded-full bg-fill-2 px-2.5 py-[5px]">{config ? expiryLabel(config.expiryHours) : '…'}</span>
          <span className="rounded-full bg-fill-2 px-2.5 py-[5px]">Unique link</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }}
        />
      </div>

      <Dialog open={queue.length > 0} onOpenChange={(o) => { if (!o && !busy) setQueue([]) }}>
        <DialogContent onInteractOutside={(e) => busy && e.preventDefault()} onEscapeKeyDown={(e) => busy && e.preventDefault()}>
          <div className="border-b border-line-soft px-5 py-4 pr-14">
            <DialogTitle>Upload {queue.length === 1 ? 'file' : `${queue.length} files`}</DialogTitle>
            <DialogDescription className="mt-1">Review the selection, then upload.</DialogDescription>
          </div>
          <div className="border-b border-line-soft px-5 py-3.5">
            {user ? (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <label htmlFor="make-public" className="text-sm font-medium">Make public</label>
                  <p className="text-xs text-mute">
                    {makePublic ? 'Listed in Public files. Anyone can find and download it.' : 'Private. Only people with the link can download it.'}
                  </p>
                </div>
                <Switch id="make-public" checked={makePublic} onCheckedChange={setMakePublic} disabled={busy} />
              </div>
            ) : (
              <p className="text-xs text-mute">
                Anonymous uploads are public and listed in Public files.{' '}
                <button type="button" onClick={onSignIn} disabled={busy} className="font-medium text-blue-link underline underline-offset-2">
                  Sign in
                </button>{' '}
                to keep files private.
              </p>
            )}
          </div>
          <ul aria-label="Files selected for upload" className="overflow-y-auto">
            {queue.map((item) => (
              <li key={item.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-b border-line-soft px-4 py-3.5">
                <div className="truncate text-sm font-medium" title={item.file.name}>{item.file.name}</div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs text-mute">
                    {item.status === 'uploading' ? `${item.progress}%` : item.status === 'done' ? 'Done' : formatBytes(item.file.size)}
                  </span>
                  {item.status === 'done' ? (
                    <CheckCircle2 className="size-5 text-ok" aria-label="Uploaded" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => remove(item.key)}
                      aria-label={`Remove ${item.file.name}`}
                      className="grid size-6 place-items-center rounded-md text-mute-2 hover:bg-fill-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                {item.status === 'error' ? (
                  <p className="col-span-2 flex items-center gap-1 text-xs text-danger" role="alert">
                    <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" /> {item.error}
                  </p>
                ) : (
                  <div
                    className="col-span-2 h-[3px] overflow-hidden rounded-sm bg-line-soft"
                    role="progressbar"
                    aria-label={`Uploading ${item.file.name}`}
                    aria-valuenow={item.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className="h-full bg-blue transition-[width] duration-200" style={{ width: `${item.progress}%` }} />
                  </div>
                )}
              </li>
            ))}
          </ul>

          {busy && (
            <div className="space-y-1.5 border-b border-line-soft bg-blue-wash px-4 py-3" role="status" aria-live="polite">
              <div className="flex items-center justify-between text-[13px] font-medium">
                <span>Uploading {Math.min(batchDone + 1, batch.length)} of {batch.length}</span>
                <span className="font-mono tabular-nums">{overall}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white" role="progressbar" aria-label="Overall upload progress" aria-valuenow={overall} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-blue transition-[width] duration-200" style={{ width: `${overall}%` }} />
              </div>
              <p className="font-mono text-xs text-mute">
                {formatBytes((batchTotal * overall) / 100)} of {formatBytes(batchTotal)}
                {overall >= 99 && ' · Finishing…'}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 bg-paper py-3 pl-4 pr-3">
            <span className="font-mono text-xs text-mute">
              {queue.length} {queue.length === 1 ? 'file' : 'files'} · {formatBytes(queueBytes)}
            </span>
            <div className="flex items-center gap-2">
              {busy && (
                <Button variant="outline" onClick={cancelUploads}>
                  Cancel upload
                </Button>
              )}
              <Button onClick={startUpload} disabled={busy || pendingCount === 0}>
                {busy && <Loader2 className="animate-spin" />}
                {busy ? 'Uploading…' : pendingCount === 1 ? 'Upload file' : `Upload ${pendingCount} files`}
              </Button>
            </div>
          </div>
      </DialogContent>
    </Dialog>
    </section>
  )
}
