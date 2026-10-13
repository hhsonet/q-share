import { CheckCircle2 } from 'lucide-react'
import { shareUrl, type FileDto } from '@/api/files'
import { ExtTile } from '@/components/ExtTile'
import { FileActions } from '@/components/FileActions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatBytes, formatDateTime } from '@/lib/utils'

interface Props {
  files: FileDto[]
  publicUrl: string | null
  onDeleted: (id: string) => void
  onDismiss: () => void
}

/** Popup shown after a successful upload with the share link and actions. */
export function SharePanel({ files, publicUrl, onDeleted, onDismiss }: Props) {
  return (
    <Dialog open={files.length > 0} onOpenChange={(o) => !o && onDismiss()}>
      <DialogContent>
        <div className="border-b border-line-soft px-5 py-4 pr-14">
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-ok" aria-hidden="true" />
            {files.length === 1 ? 'Uploaded — link ready' : `${files.length} files uploaded`}
          </DialogTitle>
          <DialogDescription className="mt-1">Anyone with the link can download. Copy it and share.</DialogDescription>
        </div>
        <div className="divide-y divide-line-soft overflow-y-auto">
          {files.map((f) => (
            <div key={f.id} className="space-y-3 p-5">
              <div className="flex items-center gap-3.5">
                <ExtTile extension={f.extension} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" title={f.name}>{f.name}</p>
                  <p className="font-mono text-[11.5px] text-mute">
                    {formatBytes(f.size)} · Uploaded {formatDateTime(f.createdAt)}
                    {f.expiresAt && ` · Expires ${formatDateTime(f.expiresAt)}`}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
                <div className="space-y-1.5">
                  <Label htmlFor={`id-${f.id}`} className="text-xs text-mute">File ID</Label>
                  <Input id={`id-${f.id}`} readOnly value={f.id} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`link-${f.id}`} className="text-xs text-mute">Download link</Label>
                  <Input id={`link-${f.id}`} readOnly value={shareUrl(f.id, publicUrl)} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                </div>
              </div>
              <FileActions file={f} publicUrl={publicUrl} onDeleted={onDeleted} labels />
            </div>
          ))}
        </div>
        <div className="flex justify-end border-t border-line-soft bg-paper px-5 py-3">
          <Button onClick={onDismiss}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
