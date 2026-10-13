import { useEffect, useState } from 'react'
import { ArrowLeft, User as UserIcon } from 'lucide-react'
import { toast } from 'sonner'
import { getConfig, getMe, logout, type AppConfig, type FileDto, type Scope, type User } from '@/api/files'
import { AdminPage } from '@/components/AdminPage'
import { AuthDialog } from '@/components/AuthDialog'
import { FileList } from '@/components/FileList'
import { ProfileDialog } from '@/components/ProfileDialog'
import { UploadCard } from '@/components/UploadCard'
import { UserMenu } from '@/components/UserMenu'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { useFiles } from '@/hooks/useFiles'
import { formatBytes } from '@/lib/utils'

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [scope, setScope] = useState<Scope>('public')
  const [hash, setHash] = useState(() => window.location.hash)
  const list = useFiles(scope, user?.id ?? null)

  useEffect(() => {
    getConfig().then(setConfig).catch(() => setConfig(null))
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setAuthReady(true))
  }, [])

  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const handleUploaded = (files: FileDto[]) => {
    toast.success(files.length === 1 ? `Uploaded ${files[0].name}` : `${files.length} files uploaded`)
    list.reload()
  }

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      setUser(null)
      if (scope === 'all') setScope('public')
      if (window.location.hash === '#admin') window.location.hash = ''
      toast.success('Signed out')
    }
  }

  const publicUrl = config?.publicUrl ?? null
  const wantsAdmin = hash === '#admin'
  const showAdmin = wantsAdmin && !!user?.isAdmin
  const total = list.files.reduce((n, f) => n + f.size, 0)
  const count = `${list.files.length} ${scope === 'public' ? 'public ' : ''}${list.files.length === 1 ? 'file' : 'files'}`
  const storageLabel = `${count} · ${formatBytes(total)}`

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-line bg-bar px-[clamp(20px,4vw,48px)] py-[18px]">
        <a href="#" className="flex items-center gap-2.5 !text-ink hover:!text-ink" aria-label="QuickShare home">
          <div className="grid size-7 place-items-center rounded-lg bg-ink" aria-hidden="true">
            <div className="size-2.5 rounded-full bg-[oklch(0.68_0.19_262)]" />
          </div>
          <span className="text-base font-semibold tracking-[-0.01em]">QuickShare</span>
        </a>
        <div className="flex items-center gap-2 font-mono text-xs text-mute">
          {!showAdmin && (
            <>
              <span className="size-1.5 rounded-full bg-ok" aria-hidden="true" />
              <span className="hidden sm:inline">{list.loading ? '…' : storageLabel}</span>
              <div className="mx-2 hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
            </>
          )}
          {user ? (
            <div className="flex items-center gap-3 font-sans">
              {showAdmin && (
                <a href="#" className="inline-flex items-center gap-1.5 text-sm font-medium !text-mute-2 hover:!text-ink">
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Back to site</span>
                </a>
              )}
              <UserMenu
                user={user}
                onProfile={() => setProfileOpen(true)}
                onAdmin={() => { window.location.hash = '#admin' }}
                onSignOut={handleLogout}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2.5 font-sans">
              <div className="hidden items-center gap-2 text-sm font-medium text-mute-2 sm:flex">
                <div className="grid size-7 place-items-center rounded-full border border-dashed border-line-strong bg-fill-2 text-mute" aria-hidden="true">
                  <UserIcon className="size-3.5" />
                </div>
                Anonymous
              </div>
              <Button size="sm" onClick={() => setAuthOpen(true)}>Sign in</Button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-9 px-[clamp(20px,4vw,48px)] py-[clamp(28px,5vw,56px)]">
        {showAdmin ? (
          <AdminPage
            publicUrl={publicUrl}
            currentUserId={user!.id}
            onSelfReset={() => { setUser(null); window.location.hash = ''; toast('Password changed. Please sign in again.') }}
          />
        ) : wantsAdmin && !authReady ? null : wantsAdmin ? (
          <div className="flex max-w-[480px] flex-col gap-3 rounded-2xl border border-line bg-white p-6">
            <h1 className="text-xl font-semibold tracking-[-0.02em]">Admin area</h1>
            <p className="text-mute">{user ? 'This account is not an admin.' : 'Sign in with an admin account to continue.'}</p>
            <div className="flex gap-2">
              {!user && <Button onClick={() => setAuthOpen(true)}>Sign in</Button>}
              <Button variant="outline" asChild><a href="#">Back to site</a></Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex max-w-[640px] flex-col gap-2.5">
              <h1 className="text-balance text-[clamp(32px,4.4vw,48px)] font-semibold leading-[1.05] tracking-[-0.035em]">
                Upload once.<span className="text-[oklch(0.5_0.01_260)]"> Download anytime.</span>
              </h1>
              <p className="text-pretty text-base leading-normal text-mute">
                Every file gets its own link. Nothing to sign up for — links expire automatically.
              </p>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] items-start gap-6">
              <div className="flex flex-col gap-6">
                <UploadCard config={config} user={user} onUploaded={handleUploaded} onSignIn={() => setAuthOpen(true)} />
              </div>
              <FileList
                files={list.files}
                loading={list.loading}
                error={list.error}
                query={list.query}
                sort={list.sort}
                scope={scope}
                isAdmin={!!user?.isAdmin}
                publicUrl={publicUrl}
                onQueryChange={list.setQuery}
                onSortChange={list.setSort}
                onScopeChange={setScope}
                onDeleted={list.removeLocal}
              />
            </div>
          </>
        )}
      </main>

      <ProfileDialog user={user} open={profileOpen} onOpenChange={setProfileOpen} />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} onAuthed={setUser} />
      <Toaster />
    </div>
  )
}
