import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { adminSetFileExpiry, type AdminFile } from '@/api/files'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { formatDateTime } from '@/lib/utils'

interface Props {
  file: AdminFile | null
  onClose: () => void
  onSaved: () => void
}

export function FileExpiryDialog({ file, onClose, onSaved }: Props) {
  const [days, setDays] = useState('7')
  const [never, setNever] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (file) {
      setNever(file.expiresAt === null)
      setDays('7')
      setError(null)
    }
  }, [file])

  const n = /^\d{1,4}$/.test(days) ? Number(days) : null
  const valid = never || (n !== null && n >= 1 && n <= 3650)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !valid) return
    setBusy(true)
    setError(null)
    try {
      await adminSetFileExpiry(file.id, never ? null : n)
      toast.success(never ? `${file.name} will never expire` : `${file.name} expires in ${n} day${n === 1 ? '' : 's'}`)
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update expiry.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <form onSubmit={submit} className="space-y-4 p-5">
          <div className="pr-8">
            <DialogTitle>Set file expiry</DialogTitle>
            <DialogDescription className="mt-1 break-words">
              {file?.name}
              <br />
              Currently: {file?.expiresAt ? `expires ${formatDateTime(file.expiresAt)}` : 'never expires'}
            </DialogDescription>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl bg-fill px-3.5 py-3">
            <label htmlFor="never-expires" className="text-sm font-medium">Never expires</label>
            <Switch id="never-expires" checked={never} onCheckedChange={setNever} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="file-days" className="text-xs text-mute">Expires in (days from now)</Label>
            <Input
              id="file-days"
              inputMode="numeric"
              className="font-mono"
              value={days}
              disabled={never}
              onChange={(e) => setDays(e.target.value.trim())}
              aria-invalid={!never && !valid}
            />
            {!never && !valid && <p className="text-xs text-danger">Enter a whole number from 1 to 3650.</p>}
          </div>

          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || !valid}>
            {busy && <Loader2 className="animate-spin" />}
            Save expiry
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
