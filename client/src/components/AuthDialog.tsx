import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { login, register, type User } from '@/api/files'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAuthed: (user: User) => void
}

export function AuthDialog({ open, onOpenChange, onAuthed }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const user = await (mode === 'login' ? login : register)(email.trim(), password)
      setPassword('')
      onAuthed(user)
      onOpenChange(false)
      toast.success(mode === 'login' ? 'Signed in' : 'Account created')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const isLogin = mode === 'login'

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setError(null) }}>
      <DialogContent className="max-w-sm">
        <form onSubmit={submit} className="space-y-4 p-5">
          <div className="pr-8">
            <DialogTitle>{isLogin ? 'Sign in' : 'Create account'}</DialogTitle>
            <DialogDescription className="mt-1">
              {isLogin ? 'Signed-in uploads can be kept private.' : 'Free. Choose per upload whether a file is public.'}
            </DialogDescription>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auth-email" className="text-xs text-mute">Email</Label>
            <Input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auth-password" className="text-xs text-mute">Password</Label>
            <Input
              id="auth-password"
              type="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
              minLength={isLogin ? undefined : 8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {!isLogin && <p className="text-xs text-mute">At least 8 characters.</p>}
          </div>
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {isLogin ? 'Sign in' : 'Create account'}
          </Button>
          <p className="text-center text-sm text-mute">
            {isLogin ? 'No account? ' : 'Already have an account? '}
            <button type="button" className="font-medium text-blue-link underline underline-offset-2" onClick={() => { setMode(isLogin ? 'register' : 'login'); setError(null) }}>
              {isLogin ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </form>
      </DialogContent>
    </Dialog>
  )
}
