import { useCallback, useEffect, useState } from 'react'
import { listFiles, type FileDto, type SortKey } from '@/api/files'

export function useFiles() {
  const [files, setFiles] = useState<FileDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const rows = await listFiles(query.trim(), sort, ctrl.signal)
        setFiles(rows)
        setError(null)
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        setError(e instanceof Error ? e.message : 'Could not load files.')
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, query ? 250 : 0)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query, sort, reloadTick])

  const reload = useCallback(() => setReloadTick((n) => n + 1), [])
  const removeLocal = useCallback((id: string) => setFiles((f) => f.filter((x) => x.id !== id)), [])

  return { files, loading, error, query, setQuery, sort, setSort, reload, removeLocal }
}
