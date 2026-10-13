import { useState } from 'react'
import { Check, Copy, KeyRound, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { adminResetPassword, type AdminUser } from '@/api/files'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { copyText } from '@/lib/clipboard'

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(14))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

interface Props {
  user: AdminUser | null
  isSelf: boolean
  onClose: (changed: boolean) => void
}

export function ResetPasswordDialog({ user, isSelf, onClose }: Props) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)

  const close = () => {
    const changed = done
    setPassword('')
    setError(null)
    setDone(false)
    setCopied(false)
    onClose(changed)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    setError(null)
    try {
      await adminResetPassword(user.id, password)
      setDone(true)
      toast.success(`Password reset for ${user.name}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the password.')
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (await copyText(password)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } else {
      toast.error('Could not copy. Select the password and copy it manually.')
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit} className="space-y-4 p-5">
          <div className="pr-8">
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription className="mt-1 break-words">
              {done
                ? `Password changed. ${user?.name} was signed out everywhere.`
                : `Set a new password for ${user?.name}. They are signed out everywhere.`}
            </DialogDescription>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reset-pw" className="text-xs text-mute">New password</Label>
            <div className="flex gap-2">
              <Input
                id="reset-pw"
                type="text"
                autoComplete="off"
                spellCheck={false}
                required
                minLength={8}
                value={password}
                readOnly={done}
                onChange={(e) => setPassword(e.target.value)}
                className="font-mono"
              />
              {!done && (
                <Button type="button" variant="outline" size="icon" className="size-[38px] shrink-0" onClick={() => setPassword(generatePassword())} aria-label="Generate password" title="Generate">
                  <RefreshCw />
                </Button>
              )}
              <Button type="button" variant="outline" size="icon" className="size-[38px] shrink-0" onClick={copy} disabled={!password} aria-label="Copy password" title="Copy">
                {copied ? <Check className="text-ok" /> : <Copy />}
              </Button>
            </div>
            <p className="text-xs text-mute">At least 8 characters. Share it with the user securely; it is not shown again.</p>
          </div>

          {isSelf && !done && <p className="text-xs text-danger">This is your own account. You will be signed out.</p>}
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}

          {done ? (
            <Button type="button" className="w-full" onClick={close}>Done</Button>
          ) : (
            <Button type="submit" className="w-full" disabled={busy || password.length < 8}>
              {busy ? <Loader2 className="animate-spin" /> : <KeyRound />}
              Reset password
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
