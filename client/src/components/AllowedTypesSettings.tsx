import { useEffect, useState } from 'react'
import { FileType2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { adminGetAllowedTypes, adminSetAllowedTypes, type FileTypeCategory } from '@/api/files'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

export function AllowedTypesSettings() {
  const [categories, setCategories] = useState<FileTypeCategory[]>([])
  const [saved, setSaved] = useState<string[]>([])
  const [enabled, setEnabled] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminGetAllowedTypes()
      .then((d) => { setCategories(d.categories); setSaved(d.enabled); setEnabled(d.enabled) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load file types.'))
  }, [])

  const toggle = (key: string, on: boolean) =>
    setEnabled((cur) => (on ? [...cur, key] : cur.filter((k) => k !== key)))

  const dirty = enabled.length !== saved.length || enabled.some((k) => !saved.includes(k))

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await adminSetAllowedTypes(enabled)
      setSaved(r.enabled)
      setEnabled(r.enabled)
      toast.success('Allowed file types updated')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-[20px] border border-line bg-white p-5 shadow-[0_1px_2px_oklch(0.2_0.01_260/0.04)]" aria-label="Allowed file types">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-blue-tint text-blue-ink" aria-hidden="true">
          <FileType2 className="size-[18px]" />
        </span>
        <div>
          <h2 className="text-base font-semibold tracking-[-0.01em]">Allowed file types</h2>
          <p className="text-sm text-mute">Choose which kinds of files visitors can upload. Files already uploaded are not affected.</p>
        </div>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <li key={c.key} className="flex items-center justify-between gap-3 rounded-xl bg-fill px-3.5 py-3">
            <div className="min-w-0">
              <label htmlFor={`type-${c.key}`} className="text-sm font-medium">{c.label}</label>
              <p className="truncate font-mono text-[11px] text-mute" title={c.extensions.join(', ')}>
                {c.extensions.map((e) => `.${e}`).join(' ')}
              </p>
            </div>
            <Switch id={`type-${c.key}`} checked={enabled.includes(c.key)} onCheckedChange={(v) => toggle(c.key, v)} disabled={busy} />
          </li>
        ))}
      </ul>

      {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
      {enabled.length === 0 && categories.length > 0 && (
        <p className="mt-3 text-sm text-danger" role="alert">Allow at least one file type.</p>
      )}
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} disabled={busy || !dirty || enabled.length === 0}>
          {busy && <Loader2 className="animate-spin" />}
          Save file types
        </Button>
        {dirty && !busy && <span className="text-sm text-mute">Unsaved changes</span>}
      </div>
    </section>
  )
}
