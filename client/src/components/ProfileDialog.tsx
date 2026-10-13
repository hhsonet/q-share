import { useState } from 'react'
import { Loader2, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { changePassword, type User } from '@/api/files'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate } from '@/lib/utils'

interface Props {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProfileDialog({ user, open, onOpenChange }: Props) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setCurrent('')
    setNext('')
    setConfirm('')
    setError(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (next !== confirm) return setError('The new passwords do not match.')
    setBusy(true)
    setError(null)
    try {
      await changePassword(current, next)
      toast.success('Password changed')
      reset()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password.')
    } finally {
      setBusy(false)
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="max-w-md">
        <div className="space-y-5 p-5">
          <div className="flex items-center gap-3.5 pr-8">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-blue-tint text-lg font-semibold text-blue-ink" aria-hidden="true">
              {user.name[0]?.toUpperCase()}
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate" title={user.name}>{user.name}</DialogTitle>
              <DialogDescription className="mt-0.5 flex flex-wrap items-center gap-2">
                {user.isAdmin && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-white">
                    <Shield className="size-3" aria-hidden="true" /> Admin
                  </span>
                )}
                {user.createdAt && <span>Member since {formatDate(user.createdAt)}</span>}
              </DialogDescription>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-3.5 border-t border-line-soft pt-4">
            <h3 className="text-sm font-semibold">Change password</h3>
            <div className="space-y-1.5">
              <Label htmlFor="pw-current" className="text-xs text-mute">Current password</Label>
              <Input id="pw-current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-new" className="text-xs text-mute">New password</Label>
              <Input id="pw-new" type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
              <p className="text-xs text-mute">At least 8 characters.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-confirm" className="text-xs text-mute">Confirm new password</Label>
              <Input id="pw-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy || !current || next.length < 8 || !confirm}>
              {busy && <Loader2 className="animate-spin" />}
              Update password
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
