import { Search } from 'lucide-react'
import type { FileDto, SortKey } from '@/api/files'
import { ExtTile } from '@/components/ExtTile'
import { FileActions } from '@/components/FileActions'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatBytes } from '@/lib/utils'

interface Props {
  files: FileDto[]
  loading: boolean
  error: string | null
  query: string
  sort: SortKey
  publicUrl: string | null
  onQueryChange: (q: string) => void
  onSortChange: (s: SortKey) => void
  onDeleted: (id: string) => void
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'name', label: 'Name' },
  { key: 'size', label: 'Size' },
]

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso))

function expiryText(expiresAt: string | null): string | null {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - Date.now()
  const days = Math.ceil(ms / 864e5)
  if (ms < 36e5 * 24) return ms < 36e5 ? 'expires within 1h' : `${Math.ceil(ms / 36e5)}h left`
  return `${days}d left`
}

export function FileList({ files, loading, error, query, sort, publicUrl, onQueryChange, onSortChange, onDeleted }: Props) {
  return (
    <section className="flex flex-col overflow-hidden rounded-[20px] border border-line bg-white shadow-[0_1px_2px_oklch(0.2_0.01_260/0.04)]" aria-labelledby="files-title">
      <div className="flex flex-col gap-3.5 px-5 pb-4 pt-5">
        <div className="flex items-baseline gap-2.5">
          <h2 id="files-title" className="text-lg font-semibold tracking-[-0.015em]">Your files</h2>
          <span className="font-mono text-xs text-mute" aria-label={`${files.length} files`}>{loading ? '' : files.length}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex h-[38px] min-w-[200px] flex-1 items-center gap-2 rounded-[10px] bg-fill px-3 text-mute focus-within:ring-2 focus-within:ring-ring/40">
            <Search className="size-[15px]" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search files"
              aria-label="Search files by filename"
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-mute"
            />
          </label>
          <div role="group" aria-label="Sort files" className="flex gap-0.5 rounded-[10px] bg-fill p-[3px]">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => onSortChange(s.key)}
                aria-pressed={sort === s.key}
                className={cn(
                  'h-8 rounded-[7px] px-3 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  sort === s.key ? 'bg-white text-ink shadow-[0_1px_2px_oklch(0.2_0.01_260/0.12)]' : 'text-mute hover:text-ink',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-line-soft">
        {loading ? (
          <div aria-busy="true" aria-label="Loading files">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3.5 border-b border-line-soft px-5 py-3">
                <Skeleton className="size-10 rounded-[10px]" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-8 w-24 rounded-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="m-5 rounded-xl border border-danger/30 bg-danger-wash p-4 text-sm text-danger" role="alert">{error}</p>
        ) : files.length === 0 ? (
          <div className="flex flex-col gap-1 px-5 py-12 text-center">
            <p className="text-sm font-medium">{query ? 'No matches' : 'No files yet'}</p>
            <p className="text-[13px] text-mute">{query ? 'Try a different filename.' : 'Uploads from this browser show up here.'}</p>
          </div>
        ) : (
          <ul className="max-h-[75vh] overflow-y-auto">
            {files.map((f) => {
              const left = expiryText(f.expiresAt)
              return (
                <li key={f.id} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-line-soft px-5 py-3 last:border-b-0 hover:bg-paper">
                  <ExtTile extension={f.extension} />
                  <div className="flex min-w-0 flex-col gap-[3px]">
                    <div className="truncate text-sm font-medium" title={f.name}>{f.name}</div>
                    <div className="font-mono text-[11.5px] text-mute">
                      {formatBytes(f.size)} · {shortDate(f.createdAt)}{left && ` · ${left}`}
                    </div>
                  </div>
                  <FileActions file={f} publicUrl={publicUrl} onDeleted={onDeleted} />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
