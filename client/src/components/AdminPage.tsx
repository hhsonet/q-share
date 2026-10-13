import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, KeyRound, Search } from 'lucide-react'
import {
  adminFiles, adminStats, adminUsers,
  type AdminFile, type AdminStats, type AdminUser, type SortKey,
} from '@/api/files'
import { ExpirySettings } from '@/components/ExpirySettings'
import { ExtTile } from '@/components/ExtTile'
import { FileExpiryDialog } from '@/components/FileExpiryDialog'
import { FileActions } from '@/components/FileActions'
import { ResetPasswordDialog } from '@/components/ResetPasswordDialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatBytes, formatDateTime } from '@/lib/utils'

type Tab = 'users' | 'files'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'name', label: 'Name' },
  { key: 'size', label: 'Size' },
]

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'public', label: 'Public' },
  { key: 'private', label: 'Private' },
  { key: 'anonymous', label: 'Anonymous' },
]

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3.5">
      <div className="font-mono text-xs text-mute">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-[-0.02em]">{value}</div>
    </div>
  )
}

function Segmented<T extends string>({
  items, value, onChange, label,
}: { items: { key: T; label: string }[]; value: T | ''; onChange: (k: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex gap-0.5 rounded-[10px] bg-fill p-[3px]">
      {items.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => onChange(s.key)}
          aria-pressed={value === s.key}
          className={cn(
            'h-8 rounded-[7px] px-3 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === s.key ? 'bg-white text-ink shadow-[0_1px_2px_oklch(0.2_0.01_260/0.12)]' : 'text-mute hover:text-ink',
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

const Rows = () => (
  <div aria-busy="true" aria-label="Loading">
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="flex items-center gap-3.5 border-b border-line-soft px-5 py-3.5">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/6" />
        <Skeleton className="ml-auto h-4 w-1/6" />
      </div>
    ))}
  </div>
)

export function AdminPage({ publicUrl, currentUserId, onSelfReset }: { publicUrl: string | null; currentUserId: number; onSelfReset: () => void }) {
  const [resetUser, setResetUser] = useState<AdminUser | null>(null)
  const [expiryFile, setExpiryFile] = useState<AdminFile | null>(null)
  const [tab, setTab] = useState<Tab>('files')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [files, setFiles] = useState<AdminFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')
  const [filter, setFilter] = useState('all')
  const [tick, setTick] = useState(0)
  const [filterName, setFilterName] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const s = await adminStats()
        const rows = tab === 'users' ? await adminUsers(q.trim()) : await adminFiles(q.trim(), sort, filter)
        if (!live) return
        setStats(s)
        if (tab === 'users') setUsers(rows as AdminUser[])
        else setFiles(rows as AdminFile[])
        setError(null)
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : 'Could not load admin data.')
      } finally {
        if (live) setLoading(false)
      }
    }, q ? 250 : 0)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [tab, q, sort, filter, tick])

  const refresh = useCallback(() => setTick((n) => n + 1), [])

  const viewUserFiles = (u: AdminUser) => {
    setFilter(`user:${u.id}`)
    setFilterName(u.name)
    setTab('files')
    setQ('')
  }

  const isUserFilter = filter.startsWith('user:')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[clamp(26px,3.4vw,36px)] font-semibold tracking-[-0.03em]">Admin</h1>
        <p className="mt-1 text-mute">Users and uploaded files across the whole site.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Users" value={stats ? stats.users : '…'} />
        <Stat label="Active files" value={stats ? stats.files : '…'} />
        <Stat label="Storage used" value={stats ? formatBytes(stats.bytes) : '…'} />
        <Stat label="Public files" value={stats ? stats.publicFiles : '…'} />
        <Stat label="Anonymous files" value={stats ? stats.anonymousFiles : '…'} />
      </div>

      <ExpirySettings onApplied={refresh} />

      <section
        className="overflow-hidden rounded-[20px] border border-line bg-white shadow-[0_1px_2px_oklch(0.2_0.01_260/0.04)]"
        aria-label="Admin data"
      >
        <div className="flex flex-col gap-3.5 px-5 pb-4 pt-5">
          <Segmented
            label="Section"
            value={tab}
            onChange={(t) => { setTab(t); setQ('') }}
            items={[{ key: 'files' as Tab, label: 'Files' }, { key: 'users' as Tab, label: 'Users' }]}
          />
          <div className="flex flex-wrap gap-2">
            <label className="flex h-[38px] min-w-[200px] flex-1 items-center gap-2 rounded-[10px] bg-fill px-3 text-mute focus-within:ring-2 focus-within:ring-ring/40">
              <Search className="size-[15px]" aria-hidden="true" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tab === 'users' ? 'Search by email or username' : 'Search by filename'}
                aria-label={tab === 'users' ? 'Search users' : 'Search files'}
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-mute"
              />
            </label>
            {tab === 'files' && (
              <>
                <Segmented label="Visibility" value={isUserFilter ? '' : filter} onChange={(k) => { setFilter(k); setFilterName(null) }} items={FILTERS} />
                <Segmented label="Sort files" value={sort} onChange={setSort} items={SORTS} />
              </>
            )}
          </div>
          {isUserFilter && tab === 'files' && (
            <p className="text-sm text-mute">
              Showing files uploaded by <span className="font-medium text-ink">{filterName ?? 'this user'}</span>.{' '}
              <button
                type="button"
                className="font-medium text-blue-link underline underline-offset-2"
                onClick={() => { setFilter('all'); setFilterName(null) }}
              >
                Clear
              </button>
            </p>
          )}
        </div>

        <div className="overflow-x-auto border-t border-line-soft">
          {loading && !(tab === 'users' ? users.length : files.length) ? (
            <Rows />
          ) : error ? (
            <p className="m-5 rounded-xl border border-danger/30 bg-danger-wash p-4 text-sm text-danger" role="alert">{error}</p>
          ) : tab === 'users' ? (
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-paper font-mono text-[11.5px] uppercase tracking-wide text-mute">
                <tr>
                  <th className="px-5 py-2.5 font-medium">User</th>
                  <th className="px-3 py-2.5 font-medium">Role</th>
                  <th className="px-3 py-2.5 font-medium">Files</th>
                  <th className="px-3 py-2.5 font-medium">Storage</th>
                  <th className="px-3 py-2.5 font-medium">Joined</th>
                  <th className="px-3 py-2.5 font-medium">Last upload</th>
                  <th className="px-5 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-line-soft hover:bg-paper">
                    <td className="px-5 py-3 font-medium">{u.name}</td>
                    <td className="px-3 py-3">
                      {u.isAdmin ? (
                        <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium text-white">Admin</span>
                      ) : (
                        <span className="text-mute">User</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {u.fileCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => viewUserFiles(u)}
                          className="font-medium text-blue-link underline underline-offset-2"
                          aria-label={`View ${u.fileCount} files uploaded by ${u.name}`}
                        >
                          {u.fileCount}
                        </button>
                      ) : (
                        0
                      )}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-mute-2">{formatBytes(u.bytes)}</td>
                    <td className="px-3 py-3 font-mono text-xs text-mute-2">{formatDateTime(u.createdAt)}</td>
                    <td className="px-3 py-3 font-mono text-xs text-mute-2">{u.lastUpload ? formatDateTime(u.lastUpload) : '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => setResetUser(u)} aria-label={`Reset password for ${u.name}`}>
                          <KeyRound className="size-3.5" />
                          Reset password
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!users.length && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-mute">No users found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-paper font-mono text-[11.5px] uppercase tracking-wide text-mute">
                <tr>
                  <th className="px-5 py-2.5 font-medium">File</th>
                  <th className="px-3 py-2.5 font-medium">Uploaded by</th>
                  <th className="px-3 py-2.5 font-medium">Size</th>
                  <th className="px-3 py-2.5 font-medium">Visibility</th>
                  <th className="px-3 py-2.5 font-medium">Uploaded</th>
                  <th className="px-3 py-2.5 font-medium">Expires</th>
                  <th className="px-3 py-2.5 font-medium">Downloads</th>
                  <th className="px-5 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id} className="border-t border-line-soft hover:bg-paper">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <ExtTile extension={f.extension} className="size-9 text-[9px]" />
                        <span className="max-w-[240px] truncate font-medium" title={f.name}>{f.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {f.uploader ? (
                        <span title={f.uploader.name} className="block max-w-[180px] truncate">{f.uploader.name}</span>
                      ) : (
                        <span className="text-mute">Anonymous</span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-mute-2">{formatBytes(f.size)}</td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-medium',
                          f.isPublic ? 'bg-blue-tint text-blue-ink' : 'bg-fill-2 text-mute-2',
                        )}
                      >
                        {f.isPublic ? 'Public' : 'Private'}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-mute-2">{formatDateTime(f.createdAt)}</td>
                    <td className="px-3 py-3 font-mono text-xs text-mute-2">{f.expiresAt ? formatDateTime(f.expiresAt) : 'Never'}</td>
                    <td className="px-3 py-3 font-mono text-xs text-mute-2">{f.downloadCount}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setExpiryFile(f)} aria-label={`Set expiry for ${f.name}`} title="Set expiry">
                          <CalendarClock />
                        </Button>
                        <FileActions file={f} publicUrl={publicUrl} onDeleted={refresh} />
                      </div>
                    </td>
                  </tr>
                ))}
                {!files.length && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-mute">No files found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <FileExpiryDialog file={expiryFile} onClose={() => setExpiryFile(null)} onSaved={refresh} />
      <ResetPasswordDialog
        user={resetUser}
        isSelf={resetUser?.id === currentUserId}
        onClose={(changed) => {
          const self = changed && resetUser?.id === currentUserId
          setResetUser(null)
          if (self) onSelfReset()
        }}
      />
    </div>
  )
}
