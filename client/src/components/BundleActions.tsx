import { useState } from 'react'
import { Check, Download, Link2, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { bundleDownloadPath, bundleShareUrl, deleteBundle, type BundleDto } from '@/api/files'
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { copyText } from '@/lib/clipboard'

interface Props {
  bundle: BundleDto
  publicUrl: string | null
  onDeleted: (id: string) => void
  labels?: boolean
}

export function BundleActions({ bundle, publicUrl, onDeleted, labels = false }: Props) {
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [open, setOpen] = useState(false)

  const copy = async () => {
    if (await copyText(bundleShareUrl(bundle.id, publicUrl))) {
      setCopied(true)
      toast.success('Bundle link copied to clipboard')
      setTimeout(() => setCopied(false), 1600)
    } else {
      toast.error('Could not copy the link')
    }
  }

  const remove = async () => {
    setDeleting(true)
    try {
      await deleteBundle(bundle.id)
      toast.success('Bundle deleted')
      setOpen(false)
      onDeleted(bundle.id)
    } catch (e) {
      toast.error('Could not delete bundle', { description: e instanceof Error ? e.message : undefined })
    } finally {
      setDeleting(false)
    }
  }

  const iconBtn = labels ? 'sm' : 'icon'

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button variant="outline" size="sm" onClick={copy} aria-label={`Copy link for bundle ${bundle.name}`}>
        {copied ? <Check className="size-3.5 text-ok" /> : <Link2 className="size-3.5" />}
        {copied ? 'Copied' : 'Copy link'}
      </Button>
      <Button variant="ghost" size={iconBtn} asChild>
        <a href={bundleDownloadPath(bundle.id)} download aria-label={`Download ${bundle.name} as zip`} title="Download all (zip)" className="!text-mute-2">
          <Download />
          {labels && <span>Download all (zip)</span>}
        </a>
      </Button>
      {bundle.isOwner && (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size={iconBtn}
              className="hover:bg-danger-wash hover:text-danger"
              aria-label={`Delete bundle ${bundle.name}`}
              title="Delete bundle"
            >
              <Trash2 />
              {labels && <span>Delete</span>}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this bundle?</AlertDialogTitle>
              <AlertDialogDescription>
                “{bundle.name}” and all {bundle.fileCount} file{bundle.fileCount === 1 ? '' : 's'} in it will be permanently removed.
                Their links will stop working. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <Button variant="destructive" onClick={remove} disabled={deleting}>
                {deleting && <Loader2 className="animate-spin" />}
                Delete bundle
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
