import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Files } from 'lucide-react'
import { ApiError, getBundle, type BundleDto, type FileDto } from '@/api/files'
import { BundleActions } from '@/components/BundleActions'
import { ExtTile } from '@/components/ExtTile'
import { FileActions } from '@/components/FileActions'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatBytes, formatDateTime } from '@/lib/utils'

export function BundlePage({ id, publicUrl }: { id: string; publicUrl: string | null }) {
  const [data, setData] = useState<{ bundle: BundleDto; files: FileDto[] } | null>(null)
  const [error, setError] = useState<{ status: number; message: string } | null>(null)
  const [deleted, setDeleted] = useState(false)

  const load = useCallback(() => {
    getBundle(id)
      .then((d) => { setData(d); setError(null) })
      .catch((e) => setError({ status: e instanceof ApiError ? e.status : 0, message: e instanceof Error ? e.message : 'Could not load bundle.' }))
  }, [id])

  useEffect(load, [load])

  if (deleted) {
    return (
      <div className="flex max-w-[480px] flex-col gap-3 rounded-2xl border border-line bg-white p-6">
        <h1 className="text-xl font-semibold tracking-[-0.02em]">Bundle deleted</h1>
        <Button asChild><a href="/">Back to QuickShare</a></Button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex max-w-[480px] flex-col gap-3 rounded-2xl border border-line bg-white p-6">
        <h1 className="text-xl font-semibold tracking-[-0.02em]">
          {error.status === 410 ? 'This link has expired' : error.status === 404 ? 'Bundle not found' : 'Something went wrong'}
        </h1>
        <p className="text-mute">
          {error.status === 404 ? 'The link may be wrong, or the bundle was deleted.' : error.message}
        </p>
        <Button variant="outline" asChild><a href="/">Back to QuickShare</a></Button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading bundle">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-48 w-full rounded-[20px]" />
      </div>
    )
  }

  const { bundle, files } = data

  return (
    <div className="flex flex-col gap-6">
      <a href="/" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium !text-mute-2 hover:!text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to QuickShare
      </a>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-blue-tint text-blue-ink" aria-hidden="true">
            <Files className="size-6" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[clamp(22px,3vw,30px)] font-semibold tracking-[-0.025em]" title={bundle.name}>{bundle.name}</h1>
            <p className="font-mono text-xs text-mute">
              {bundle.fileCount} file{bundle.fileCount === 1 ? '' : 's'} · {formatBytes(bundle.size)} · Uploaded {formatDateTime(bundle.createdAt)}
              {bundle.expiresAt && ` · Expires ${formatDateTime(bundle.expiresAt)}`}
            </p>
          </div>
        </div>
        <BundleActions bundle={bundle} publicUrl={publicUrl} onDeleted={() => setDeleted(true)} labels />
      </div>

      <section className="overflow-hidden rounded-[20px] border border-line bg-white shadow-[0_1px_2px_oklch(0.2_0.01_260/0.04)]" aria-label="Files in this bundle">
        <ul>
          {files.map((f) => (
            <li key={f.id} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-line-soft px-5 py-3 last:border-b-0 hover:bg-paper">
              <ExtTile extension={f.extension} />
              <div className="flex min-w-0 flex-col gap-[3px]">
                <div className="truncate text-sm font-medium" title={f.name}>{f.name}</div>
                <div className="font-mono text-[11.5px] text-mute">{formatBytes(f.size)}</div>
              </div>
              <FileActions file={f} publicUrl={publicUrl} onDeleted={() => load()} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
