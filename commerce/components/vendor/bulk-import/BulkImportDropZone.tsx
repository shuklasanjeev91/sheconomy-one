import { useCallback, useRef, useState } from 'react'

import { Icons, Text, YStack } from '~/components/ui'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type BulkImportDropZoneProps = {
  ui: AppUiTokens
  onFile: (file: File) => void
  disabled?: boolean
}

export function BulkImportDropZone({ ui, onFile, disabled }: BulkImportDropZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setDragOver(false)
      if (disabled) return
      const file = event.dataTransfer.files[0]
      if (file) onFile(file)
    },
    [disabled, onFile],
  )

  return (
    <YStack
      borderWidth={2}
      borderStyle="dashed"
      borderColor={dragOver ? ui.brand : ui.borderSubtle}
      borderRadius={16}
      padding="$8"
      alignItems="center"
      gap="$2"
      backgroundColor={dragOver ? ui.roseSurface : ui.surfaceMuted}
      cursor={disabled ? 'not-allowed' : 'pointer'}
      opacity={disabled ? 0.5 : 1}
      onPress={disabled ? undefined : () => inputRef.current?.click()}
      // @ts-expect-error web drag events
      onDragOver={(event: React.DragEvent) => {
        event.preventDefault()
        if (!disabled) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <Icons.Upload size={36} color={ui.textMuted} />
      <Text fontSize={14} fontWeight="600" color={ui.text}>
        {dragOver ? 'Drop it here' : 'Drag & drop your CSV or Excel file'}
      </Text>
      <Text fontSize={12} color={ui.textMuted} textAlign="center">
        or click to browse · .csv or .xlsx · max 10 MB
      </Text>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
          event.target.value = ''
        }}
      />
    </YStack>
  )
}
