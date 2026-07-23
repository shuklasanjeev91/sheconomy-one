import { useCallback, useState } from 'react'

/** Track byte-level upload progress (0–100) for storage uploads. */
export function useUploadProgress() {
  const [progress, setProgress] = useState<number | null>(null)

  const reset = useCallback(() => setProgress(null), [])

  const track = useCallback((percent: number) => {
    setProgress(percent)
  }, [])

  const isUploading = progress != null && progress > 0

  return { progress, track, reset, isUploading, setProgress }
}
