import { cn } from '@/lib/utils'

/** File-type tile showing the extension (e.g. "PDF"). */
export function ExtTile({ extension, className }: { extension: string; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-[10px] bg-blue-tint font-mono text-[10px] font-medium uppercase text-blue-ink',
        className,
      )}
    >
      {(extension || 'file').slice(0, 4)}
    </div>
  )
}
