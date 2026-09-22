import { useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, View } from 'react-native'

import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import {
  applyAnnotationEvent,
  emptyAnnotationSession,
  type MeetingAnnotationStroke,
} from '~/co-work/lib/meeting-annotation'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingAnnotationOverlayProps = {
  open: boolean
  localUserId: string
  remoteStrokes?: MeetingAnnotationStroke[]
  onClose: () => void
  onStroke?: (stroke: MeetingAnnotationStroke) => void
  onClear?: () => void
}

const COLORS = ['#EF4444', '#22C55E', '#3B82F6', '#F59E0B', '#FFFFFF']

/**
 * Lightweight screen-share annotation canvas (Zoom-style markup).
 * Local strokes publish via onStroke; remote strokes render from presence sync.
 */
export function MeetingAnnotationOverlay({
  open,
  localUserId,
  remoteStrokes = [],
  onClose,
  onStroke,
  onClear,
}: MeetingAnnotationOverlayProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const [session, setSession] = useState(() =>
    applyAnnotationEvent(emptyAnnotationSession(), { type: 'open' }),
  )
  const [color, setColor] = useState(COLORS[0])
  const drawingRef = useRef<MeetingAnnotationStroke | null>(null)

  useEffect(() => {
    if (open) {
      setSession(applyAnnotationEvent(emptyAnnotationSession(), { type: 'open' }))
    }
  }, [open])

  const strokes = useMemo(() => {
    const byId = new Map<string, MeetingAnnotationStroke>()
    for (const stroke of remoteStrokes) byId.set(stroke.id, stroke)
    for (const stroke of session.strokes) byId.set(stroke.id, stroke)
    return [...byId.values()]
  }, [remoteStrokes, session.strokes])

  if (!open) return null

  return (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      pointerEvents="box-none"
      zIndex={90}
    >
      <XStack
        position="absolute"
        top={12}
        alignSelf="center"
        gap="$2"
        paddingHorizontal="$3"
        paddingVertical="$2"
        borderRadius={999}
        backgroundColor="rgba(12,8,10,0.88)"
        borderWidth={1}
        borderColor={coworkUi.borderSoft}
        alignItems="center"
        zIndex={2}
      >
        {COLORS.map((swatch) => (
          <Pressable
            key={swatch}
            onPress={() => setColor(swatch)}
            style={{
              width: 18,
              height: 18,
              borderRadius: 99,
              backgroundColor: swatch,
              borderWidth: color === swatch ? 2 : 0,
              borderColor: '#fff',
            }}
          />
        ))}
        <Button
          tone="outline"
          size="$2"
          borderRadius={999}
          onPress={() => {
            setSession((current) => applyAnnotationEvent(current, { type: 'clear' }))
            onClear?.()
          }}
        >
          Clear
        </Button>
        <Button tone="outline" size="$2" borderRadius={999} icon={Icons.X} onPress={onClose}>
          Done
        </Button>
      </XStack>

      {Platform.OS === 'web' ? (
        <View
          // @ts-expect-error web div props
          onPointerDown={(event: any) => {
            const rect = event.currentTarget.getBoundingClientRect?.()
            if (!rect) return
            const stroke: MeetingAnnotationStroke = {
              id: `${localUserId}-${Date.now()}`,
              color,
              width: 3,
              points: [{ x: event.clientX - rect.left, y: event.clientY - rect.top }],
              from: localUserId,
              createdAt: Date.now(),
            }
            drawingRef.current = stroke
            setSession((current) => applyAnnotationEvent(current, { type: 'stroke', stroke }))
          }}
          onPointerMove={(event: any) => {
            const current = drawingRef.current
            const rect = event.currentTarget.getBoundingClientRect?.()
            if (!current || !rect) return
            current.points.push({ x: event.clientX - rect.left, y: event.clientY - rect.top })
            setSession((prev) => ({
              ...prev,
              strokes: prev.strokes.map((row) => (row.id === current.id ? { ...current } : row)),
            }))
          }}
          onPointerUp={() => {
            if (drawingRef.current) onStroke?.(drawingRef.current)
            drawingRef.current = null
          }}
          style={{ position: 'absolute', inset: 0, cursor: 'crosshair' }}
        >
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
            {strokes.map((stroke) => (
              <polyline
                key={stroke.id}
                fill="none"
                stroke={stroke.color}
                strokeWidth={stroke.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')}
              />
            ))}
          </svg>
        </View>
      ) : (
        <YStack flex={1} justifyContent="flex-end" padding="$4" pointerEvents="box-none">
          <Text color={coworkUi.textMuted} fontSize={13} textAlign="center">
            Annotation drawing is optimized for web screen share. Use Clear / Done above on mobile.
          </Text>
        </YStack>
      )}
    </YStack>
  )
}
