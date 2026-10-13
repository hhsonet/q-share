import { useEffect, useState } from 'react'
import { CalendarClock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { adminApplyExpiryToAll, adminGetSettings, adminSetDefaultExpiry } from '@/api/files'
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const label = (d: number) => (d === 0 ? 'never expire' : `expire ${d} day${d === 1 ? '' : 's'} after upload`)

export function ExpirySettings({ onApplied }: { onApplied: () => void }) {
  const [saved, setSaved] = useState<number | null>(null)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminGetSettings()
      .then((s) => { setSaved(s.expiryDays); setValue(String(s.expiryDays)) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load settings.'))
  }, [])

  const days = /^\d{1,4}$/.test(value) ? Number(value) : null
  const valid = days !== null && days <= 3650
  const dirty = valid && days !== saved

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      const r = await adminSetDefaultExpiry(days)
      setSaved(r.expiryDays)
      toast.success(`New uploads will ${label(r.expiryDays)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  const apply = async () => {
    if (!valid) return
    setBusy(true)
    try {
      const r = await adminApplyExpiryToAll(days)
      toast.success(`Updated ${r.updated} file${r.updated === 1 ? '' : 's'}`)
      setConfirmOpen(false)
      onApplied()
    } catch (err) {
      toast.error('Could not update files', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-[20px] border border-line bg-white p-5 shadow-[0_1px_2px_oklch(0.2_0.01_260/0.04)]" aria-label="Expiry settings">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-blue-tint text-blue-ink" aria-hidden="true">
          <CalendarClock className="size-[18px]" />
        </span>
        <div>
          <h2 className="text-base font-semibold tracking-[-0.01em]">File expiry</h2>
          <p className="text-sm text-mute">
            Currently, new uploads {saved === null ? '…' : label(saved)}. Set a single file&apos;s expiry from the Files table.
          </p>
        </div>
      </div>

      <form onSubmit={save} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="default-expiry" className="text-xs text-mute">Default expiry (days, 0 = never)</Label>
          <Input
            id="default-expiry"
            inputMode="numeric"
            className="w-44 font-mono"
            value={value}
            onChange={(e) => setValue(e.target.value.trim())}
            aria-invalid={value !== '' && !valid}
          />
        </div>
        <Button type="submit" disabled={busy || !dirty}>
          {busy && <Loader2 className="animate-spin" />}
          Save for new uploads
        </Button>
        <Button type="button" variant="outline" disabled={busy || !valid} onClick={() => setConfirmOpen(true)}>
          Apply to all existing files
        </Button>
      </form>
      {value !== '' && !valid && <p className="mt-2 text-sm text-danger" role="alert">Enter a whole number from 0 to 3650.</p>}
      {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply to all existing files?</AlertDialogTitle>
            <AlertDialogDescription>
              {days === 0
                ? 'Every existing file will be set to never expire.'
                : `Every existing file will expire ${days} day${days === 1 ? '' : 's'} after its upload date, replacing any expiry set per file. Files already older than that will expire immediately and be deleted by the next cleanup.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button variant={days === 0 ? 'default' : 'destructive'} onClick={apply} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Apply to all files
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
