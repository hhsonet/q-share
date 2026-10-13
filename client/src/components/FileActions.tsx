import { useState } from 'react'
import { Check, Download, Link2, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteFile, downloadPath, shareUrl, type FileDto } from '@/api/files'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { copyText } from '@/lib/clipboard'

interface Props {
  file: FileDto
  publicUrl: string | null
  onDeleted: (id: string) => void
  /** larger buttons with text labels */
  labels?: boolean
}

export function FileActions({ file, publicUrl, onDeleted, labels = false }: Props) {
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [open, setOpen] = useState(false)

  const copy = async () => {
    const ok = await copyText(shareUrl(file.id, publicUrl))
    if (ok) {
      setCopied(true)
      toast.success('Link copied to clipboard')
      setTimeout(() => setCopied(false), 1600)
    } else {
      toast.error('Could not copy the link', { description: 'Copy it manually from the field.' })
    }
  }

  const remove = async () => {
    setDeleting(true)
    try {
      await deleteFile(file.id)
      toast.success('File deleted')
      setOpen(false)
      onDeleted(file.id)
    } catch (e) {
      toast.error('Could not delete file', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setDeleting(false)
    }
  }

  const iconBtn = labels ? 'sm' : 'icon'

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button variant="outline" size="sm" onClick={copy} aria-label={`Copy link for ${file.name}`}>
        {copied ? <Check className="size-3.5 text-ok" /> : <Link2 className="size-3.5" />}
        {copied ? 'Copied' : 'Copy link'}
      </Button>
      <Button variant="ghost" size={iconBtn} asChild>
        <a href={downloadPath(file.id)} download aria-label={`Download ${file.name}`} title="Download" className="!text-mute-2">
          <Download />
          {labels && <span>Download</span>}
        </a>
      </Button>
      {file.isOwner && (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size={iconBtn}
              className="hover:bg-danger-wash hover:text-danger"
              aria-label={`Delete ${file.name}`}
              title="Delete"
            >
              <Trash2 />
              {labels && <span>Delete</span>}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this file?</AlertDialogTitle>
              <AlertDialogDescription>
                “{file.name}” will be permanently removed and its download link will stop working. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <Button variant="destructive" onClick={remove} disabled={deleting}>
                {deleting && <Loader2 className="animate-spin" />}
                Delete file
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
