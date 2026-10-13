import { useEffect, useState } from 'react'
import { User } from 'lucide-react'
import { toast } from 'sonner'
import { getConfig, type AppConfig, type FileDto } from '@/api/files'
import { FileList } from '@/components/FileList'
import { UploadCard } from '@/components/UploadCard'
import { Toaster } from '@/components/ui/sonner'
import { useFiles } from '@/hooks/useFiles'
import { formatBytes } from '@/lib/utils'

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const list = useFiles()

  useEffect(() => {
    getConfig().then(setConfig).catch(() => setConfig(null))
  }, [])

  const handleUploaded = (files: FileDto[]) => {
    toast.success(files.length === 1 ? `Uploaded ${files[0].name}` : `${files.length} files uploaded`)
    list.reload()
  }

  const handleDeleted = (id: string) => {
    list.removeLocal(id)
  }

  const publicUrl = config?.publicUrl ?? null
  const total = list.files.reduce((n, f) => n + f.size, 0)
  const storageLabel = `${list.files.length} ${list.files.length === 1 ? 'file' : 'files'} · ${formatBytes(total)}`

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-line bg-bar px-[clamp(20px,4vw,48px)] py-[18px]">
        <div className="flex items-center gap-2.5">
          <div className="grid size-7 place-items-center rounded-lg bg-ink" aria-hidden="true">
            <div className="size-2.5 rounded-full bg-[oklch(0.68_0.19_262)]" />
          </div>
          <span className="text-base font-semibold tracking-[-0.01em]">QuickShare</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-mute">
          <span className="size-1.5 rounded-full bg-ok" aria-hidden="true" />
          <span>{list.loading ? '…' : storageLabel}</span>
          <div className="mx-2 hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
          <div className="hidden items-center gap-2 font-sans text-sm font-medium text-mute-2 sm:flex">
            <div className="grid size-7 place-items-center rounded-full border border-dashed border-line-strong bg-fill-2 text-mute" aria-hidden="true">
              <User className="size-3.5" />
            </div>
            Anonymous
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-9 px-[clamp(20px,4vw,48px)] py-[clamp(28px,5vw,56px)]">
        <div className="flex max-w-[640px] flex-col gap-2.5">
          <h1 className="text-balance text-[clamp(32px,4.4vw,48px)] font-semibold leading-[1.05] tracking-[-0.035em]">
            Upload once.<span className="text-[oklch(0.5_0.01_260)]"> Download anytime.</span>
          </h1>
          <p className="text-pretty text-base leading-normal text-mute">
            Every file gets its own private link. Nothing to sign up for — links expire automatically.
          </p>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] items-start gap-6">
          <div className="flex flex-col gap-6">
            <UploadCard config={config} onUploaded={handleUploaded} />
          </div>
          <FileList
            files={list.files}
            loading={list.loading}
            error={list.error}
            query={list.query}
            sort={list.sort}
            publicUrl={publicUrl}
            onQueryChange={list.setQuery}
            onSortChange={list.setSort}
            onDeleted={handleDeleted}
          />
        </div>
      </main>

      <Toaster />
    </div>
  )
}
