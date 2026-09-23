import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Platform,
  TextInput,
  View,
  useWindowDimensions,
  type GestureResponderEvent
} from 'react-native'
import { RnPressable as Pressable } from '~/co-work/components/RnPressable'
import Svg, { Ellipse, Path, Rect as SvgRect, Text as SvgText } from 'react-native-svg'

import { AppBottomSheet, Button, Icons, Text, XStack, YStack } from '~/components/ui'
import {
  appendWhiteboardPoint,
  createWhiteboardStrokeId,
  lastLocalWhiteboardStrokeId,
  WHITEBOARD_VIEW,
  whiteboardPointsToPath,
  whiteboardShapeBox,
  type WhiteboardStroke,
  type WhiteboardTool,
} from '~/co-work/lib/meeting-whiteboard'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingWhiteboardModalProps = {
  open: boolean
  userId: string
  startedByName?: string | null
  canStopForEveryone?: boolean
  strokes: WhiteboardStroke[]
  onClose: () => void
  onStopSharing?: () => void
  onStroke: (stroke: WhiteboardStroke) => void
  onUndo: (strokeId: string) => void
  onClear: () => void
}

const PALETTE = ['#111827', '#D81B60', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#FFFFFF']

const TOOLS: { id: WhiteboardTool; label: string; icon: typeof Icons.PenTool }[] = [
  { id: 'pen', label: 'Pen', icon: Icons.PenTool },
  { id: 'highlighter', label: 'Highlighter', icon: Icons.Highlighter },
  { id: 'eraser', label: 'Eraser', icon: Icons.Eraser },
  { id: 'rect', label: 'Rectangle', icon: Icons.Square },
  { id: 'circle', label: 'Ellipse', icon: Icons.Circle },
  { id: 'line', label: 'Line', icon: Icons.Minus },
  { id: 'text', label: 'Text', icon: Icons.PenLine },
  { id: 'sticky', label: 'Sticky note', icon: Icons.StickyNote },
]

export function MeetingWhiteboardModal({
  open,
  userId,
  startedByName,
  canStopForEveryone,
  strokes,
  onClose,
  onStopSharing,
  onStroke,
  onUndo,
  onClear,
}: MeetingWhiteboardModalProps) {
  const { ui } = useCoWorkTheme()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const [tool, setTool] = useState<WhiteboardTool>('pen')
  const [color, setColor] = useState('#111827')
  const [lineWidth, setLineWidth] = useState(4)
  const [liveStroke, setLiveStroke] = useState<WhiteboardStroke | null>(null)
  const [composer, setComposer] = useState<{ x: number; y: number; text: string } | null>(null)
  const [redoStack, setRedoStack] = useState<WhiteboardStroke[]>([])
  const [surfaceSize, setSurfaceSize] = useState({ w: WHITEBOARD_VIEW.width, h: WHITEBOARD_VIEW.height })
  const surfaceRef = useRef<View>(null)
  const layoutRef = useRef({ x: 0, y: 0, w: 1, h: 1 })
  const liveRef = useRef<WhiteboardStroke | null>(null)

  useEffect(() => {
    if (!open) {
      setLiveStroke(null)
      liveRef.current = null
      setComposer(null)
    }
  }, [open])

  const measureSurface = useCallback(() => {
    const node = surfaceRef.current as unknown as {
      measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void
    } | null
    node?.measureInWindow?.((x, y, w, h) => {
      if (w > 0 && h > 0) layoutRef.current = { x, y, w, h }
    })
  }, [])

  const toNorm = useCallback((pageX: number, pageY: number) => {
    const { x, y, w, h } = layoutRef.current
    return {
      x: (pageX - x) / Math.max(w, 1),
      y: (pageY - y) / Math.max(h, 1),
    }
  }, [])

  const beginStroke = useCallback(
    (pageX: number, pageY: number) => {
      measureSurface()
      const point = toNorm(pageX, pageY)
      if (tool === 'text' || tool === 'sticky') {
        setComposer({ x: point.x, y: point.y, text: '' })
        return
      }
      const next: WhiteboardStroke = {
        id: createWhiteboardStrokeId(userId),
        from: userId,
        tool,
        color: tool === 'eraser' ? '#FFFFFF' : color,
        width: lineWidth,
        points: [point],
      }
      liveRef.current = next
      setLiveStroke(next)
    },
    [color, lineWidth, measureSurface, toNorm, tool, userId],
  )

  const moveStroke = useCallback(
    (pageX: number, pageY: number) => {
      const current = liveRef.current
      if (!current) return
      const point = toNorm(pageX, pageY)
      const isShape = current.tool === 'rect' || current.tool === 'circle' || current.tool === 'line'
      const points = isShape
        ? [current.points[0] ?? point, point]
        : appendWhiteboardPoint(current.points, point)
      const next = { ...current, points }
      liveRef.current = next
      setLiveStroke(next)
    },
    [toNorm],
  )

  const endStroke = useCallback(() => {
    const current = liveRef.current
    liveRef.current = null
    setLiveStroke(null)
    if (!current || current.points.length === 0) return
    if (
      (current.tool === 'pen' || current.tool === 'highlighter' || current.tool === 'eraser') &&
      current.points.length < 2
    ) {
      current.points = [...current.points, current.points[0]!]
    }
    setRedoStack([])
    onStroke(current)
  }, [onStroke])

  const handleGrant = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent
    beginStroke(pageX, pageY)
  }
  const handleMove = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent
    moveStroke(pageX, pageY)
  }

  const commitComposer = useCallback(() => {
    if (!composer) return
    const text = composer.text.trim()
    const placed = composer
    setComposer(null)
    if (!text) return
    onStroke({
      id: createWhiteboardStrokeId(userId),
      from: userId,
      tool,
      color: tool === 'sticky' ? '#FDE68A' : color,
      width: lineWidth,
      points: [{ x: placed.x, y: placed.y }],
      text,
    })
    setRedoStack([])
  }, [color, composer, lineWidth, onStroke, tool, userId])

  const handleUndo = () => {
    const id = lastLocalWhiteboardStrokeId(strokes, userId)
    if (!id) return
    const row = strokes.find((item) => item.id === id)
    if (row) setRedoStack((prev) => [...prev, row])
    onUndo(id)
  }

  const handleRedo = () => {
    const next = redoStack[redoStack.length - 1]
    if (!next) return
    setRedoStack((prev) => prev.slice(0, -1))
    onStroke({ ...next, id: createWhiteboardStrokeId(userId) })
  }

  const handleExport = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return
    const canvas = document.createElement('canvas')
    canvas.width = WHITEBOARD_VIEW.width
    canvas.height = WHITEBOARD_VIEW.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    for (const action of strokes) {
      paintCanvasStroke(ctx, action)
    }
    const link = document.createElement('a')
    link.download = `meeting-whiteboard-${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const allStrokes = useMemo(
    () => (liveStroke ? [...strokes, liveStroke] : strokes),
    [liveStroke, strokes],
  )

  if (!open) return null

  const board = (
    <YStack
      flex={1}
      width="100%"
      height="100%"
      backgroundColor="#0c080a"
      pointerEvents="auto"
    >
      <XStack
        paddingHorizontal="$4"
        paddingVertical="$2.5"
        alignItems="center"
        justifyContent="space-between"
        backgroundColor="#161016"
        borderBottomWidth={1}
        borderBottomColor="rgba(255,255,255,0.08)"
        gap="$3"
      >
        <XStack alignItems="center" gap="$3" minWidth={0} flex={1}>
          <Icons.PenTool size={18} color={ui.brand} />
          <YStack minWidth={0} flexShrink={1}>
            <Text fontSize={15} fontWeight="800" color="#FFFFFF" numberOfLines={1}>
              Whiteboard
            </Text>
            <Text fontSize={12} color="rgba(255,255,255,0.55)" numberOfLines={1}>
              {startedByName
                ? `Shared by ${startedByName} · everyone can draw`
                : 'Shared with everyone in this meeting'}
            </Text>
          </YStack>
        </XStack>
        <XStack alignItems="center" gap="$2" flexShrink={0}>
          <Button
            tone="ghost"
            size="$2"
            disabled={!lastLocalWhiteboardStrokeId(strokes, userId)}
            icon={<Icons.RotateCcw size={15} color="#FFFFFF" />}
            onPress={handleUndo}
            accessibilityLabel="Undo"
          />
          <Button
            tone="ghost"
            size="$2"
            disabled={redoStack.length === 0}
            icon={<Icons.RotateCw size={15} color="#FFFFFF" />}
            onPress={handleRedo}
            accessibilityLabel="Redo"
          />
          <Button tone="ghost" size="$2" onPress={onClear}>
            <Text fontSize={12} color="rgba(255,255,255,0.72)">
              Clear
            </Text>
          </Button>
          {Platform.OS === 'web' ? (
            <Button
              tone="ghost"
              size="$2"
              icon={<Icons.Download size={14} color="#FFFFFF" />}
              onPress={handleExport}
            >
              Save
            </Button>
          ) : null}
          {canStopForEveryone && onStopSharing ? (
            <Button tone="primary" size="$2" backgroundColor={ui.brand} borderRadius={8} onPress={onStopSharing}>
              Stop sharing
            </Button>
          ) : (
            <Button tone="ghost" size="$2" onPress={onClose}>
              Hide
            </Button>
          )}
          <Button
            tone="ghost"
            size="$2"
            circular
            icon={<Icons.X size={16} color="#FFFFFF" />}
            onPress={canStopForEveryone && onStopSharing ? onStopSharing : onClose}
            accessibilityLabel="Close whiteboard"
          />
        </XStack>
      </XStack>

      <XStack flex={1} minHeight={0} minWidth={0}>
        <YStack
          width={72}
          backgroundColor="#161016"
          borderRightWidth={1}
          borderRightColor="rgba(255,255,255,0.08)"
          paddingVertical="$2"
          alignItems="center"
          gap="$1.5"
        >
          {TOOLS.map((item) => {
            const Icon = item.icon
            const active = tool === item.id
            return (
              <Pressable
                key={item.id}
                onPress={() => setTool(item.id)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? 'rgba(216,27,96,0.22)' : 'transparent',
                }}
              >
                {Icon ? <Icon size={18} color={active ? ui.brandLight : '#FFFFFF'} /> : null}
              </Pressable>
            )
          })}
          <YStack width={36} height={1} backgroundColor="rgba(255,255,255,0.12)" marginVertical="$1" />
          {PALETTE.map((swatch) => (
            <Pressable
              key={swatch}
              onPress={() => setColor(swatch)}
              accessibilityLabel={`Color ${swatch}`}
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: swatch,
                borderWidth: color === swatch ? 2 : 1,
                borderColor: color === swatch ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
              }}
            />
          ))}
          <XStack gap="$1" marginTop="$2">
            {[3, 6, 10].map((size) => (
              <Pressable
                key={size}
                onPress={() => setLineWidth(size)}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: lineWidth === size ? 2 : 1,
                  borderColor: lineWidth === size ? ui.brandLight : 'rgba(255,255,255,0.3)',
                }}
              >
                <YStack
                  width={Math.max(4, size / 2)}
                  height={Math.max(4, size / 2)}
                  borderRadius={99}
                  backgroundColor="#FFFFFF"
                />
              </Pressable>
            ))}
          </XStack>
        </YStack>

        <YStack flex={1} minWidth={0} minHeight={0} backgroundColor="#F4F4F5" padding="$3">
          <View
            ref={surfaceRef}
            collapsable={false}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout
              if (width > 1 && height > 1) setSurfaceSize({ w: width, h: height })
              measureSurface()
            }}
            {...(Platform.OS === 'web'
              ? {
                  onPointerDown: (event: {
                    nativeEvent?: { pageX: number; pageY: number }
                    preventDefault?: () => void
                  }) => {
                    event.preventDefault?.()
                    const pageX = event.nativeEvent?.pageX
                    const pageY = event.nativeEvent?.pageY
                    if (typeof pageX === 'number' && typeof pageY === 'number') beginStroke(pageX, pageY)
                  },
                  onPointerMove: (event: { nativeEvent?: { pageX: number; pageY: number } }) => {
                    const pageX = event.nativeEvent?.pageX
                    const pageY = event.nativeEvent?.pageY
                    if (typeof pageX === 'number' && typeof pageY === 'number') moveStroke(pageX, pageY)
                  },
                  onPointerUp: endStroke,
                  onPointerLeave: endStroke,
                }
              : {
                  onStartShouldSetResponder: () => !composer,
                  onMoveShouldSetResponder: () => !composer,
                  onResponderGrant: handleGrant,
                  onResponderMove: handleMove,
                  onResponderRelease: endStroke,
                  onResponderTerminate: endStroke,
                })}
            style={{
              flex: 1,
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: 'rgba(15,23,42,0.08)',
              cursor: tool === 'eraser' ? 'cell' : 'crosshair',
            }}
          >
            <Svg
              width={surfaceSize.w}
              height={surfaceSize.h}
              viewBox={`0 0 ${WHITEBOARD_VIEW.width} ${WHITEBOARD_VIEW.height}`}
              preserveAspectRatio="none"
            >
              {allStrokes.map((stroke) => (
                <WhiteboardSvgStroke key={stroke.id} stroke={stroke} />
              ))}
            </Svg>
            {composer ? (
              <YStack
                position="absolute"
                left={`${Math.min(88, Math.max(2, composer.x * 100))}%`}
                top={`${Math.min(88, Math.max(2, composer.y * 100))}%`}
                width={tool === 'sticky' ? 180 : 240}
                backgroundColor={tool === 'sticky' ? '#FDE68A' : '#FFFFFF'}
                borderRadius={8}
                padding="$2"
                borderWidth={1}
                borderColor="rgba(15,23,42,0.16)"
              >
                <TextInput
                  autoFocus
                  value={composer.text}
                  onChangeText={(text) => setComposer((current) => (current ? { ...current, text } : current))}
                  onSubmitEditing={commitComposer}
                  onBlur={commitComposer}
                  placeholder={tool === 'sticky' ? 'Sticky note' : 'Type here'}
                  multiline
                  style={{ color: '#111827', fontSize: 16, minHeight: 48 }}
                />
              </YStack>
            ) : null}
          </View>
        </YStack>
      </XStack>
    </YStack>
  )

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title="Whiteboard"
      showHandle
      scrollable={false}
    >
      <YStack flex={1} minHeight={Math.max(windowHeight - 160, 320)} backgroundColor="#0c080a">
        {board}
      </YStack>
    </AppBottomSheet>
  )
}

function WhiteboardSvgStroke({ stroke }: { stroke: WhiteboardStroke }) {
  const { width, height } = WHITEBOARD_VIEW
  if (stroke.tool === 'text' || stroke.tool === 'sticky') {
    const origin = stroke.points[0]
    if (!origin) return null
    const x = origin.x * width
    const y = origin.y * height
    if (stroke.tool === 'sticky') {
      return (
        <>
          <SvgRect x={x} y={y} width={220} height={140} rx={10} fill={stroke.color || '#FDE68A'} />
          <SvgText
            x={x + 14}
            y={y + 32}
            fill="#111827"
            fontSize={22}
            fontWeight="600"
          >
            {stroke.text || ''}
          </SvgText>
        </>
      )
    }
    return (
      <SvgText x={x} y={y} fill={stroke.color} fontSize={28} fontWeight="600">
        {stroke.text || ''}
      </SvgText>
    )
  }

  if (stroke.tool === 'rect') {
    const box = whiteboardShapeBox(stroke.points)
    if (!box) return null
    return (
      <SvgRect
        x={box.x * width}
        y={box.y * height}
        width={Math.max(1, box.width * width)}
        height={Math.max(1, box.height * height)}
        stroke={stroke.color}
        strokeWidth={stroke.width}
        fill="none"
      />
    )
  }

  if (stroke.tool === 'circle') {
    const box = whiteboardShapeBox(stroke.points)
    if (!box) return null
    return (
      <Ellipse
        cx={(box.x + box.width / 2) * width}
        cy={(box.y + box.height / 2) * height}
        rx={Math.max(1, (box.width / 2) * width)}
        ry={Math.max(1, (box.height / 2) * height)}
        stroke={stroke.color}
        strokeWidth={stroke.width}
        fill="none"
      />
    )
  }

  if (stroke.tool === 'line') {
    const start = stroke.points[0]
    const end = stroke.points[stroke.points.length - 1]
    if (!start || !end) return null
    return (
      <Path
        d={`M ${start.x * width} ${start.y * height} L ${end.x * width} ${end.y * height}`}
        stroke={stroke.color}
        strokeWidth={stroke.width}
        strokeLinecap="round"
        fill="none"
      />
    )
  }

  return (
    <Path
      d={whiteboardPointsToPath(stroke.points, width, height)}
      stroke={stroke.color}
      strokeWidth={stroke.tool === 'eraser' ? stroke.width * 4 : stroke.tool === 'highlighter' ? stroke.width * 2.4 : stroke.width}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeOpacity={stroke.tool === 'highlighter' ? 0.35 : 1}
      fill="none"
    />
  )
}

function paintCanvasStroke(ctx: CanvasRenderingContext2D, stroke: WhiteboardStroke) {
  const { width, height } = WHITEBOARD_VIEW
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = stroke.color
  ctx.fillStyle = stroke.color
  ctx.globalAlpha = stroke.tool === 'highlighter' ? 0.35 : 1
  ctx.lineWidth =
    stroke.tool === 'eraser' ? stroke.width * 4 : stroke.tool === 'highlighter' ? stroke.width * 2.4 : stroke.width
  if (stroke.tool === 'text') {
    const origin = stroke.points[0]
    if (origin) {
      ctx.globalAlpha = 1
      ctx.font = '600 28px sans-serif'
      ctx.fillText(stroke.text || '', origin.x * width, origin.y * height)
    }
    ctx.restore()
    return
  }
  if (stroke.tool === 'sticky') {
    const origin = stroke.points[0]
    if (origin) {
      ctx.globalAlpha = 1
      ctx.fillStyle = stroke.color || '#FDE68A'
      ctx.fillRect(origin.x * width, origin.y * height, 220, 140)
      ctx.fillStyle = '#111827'
      ctx.font = '600 22px sans-serif'
      ctx.fillText(stroke.text || '', origin.x * width + 14, origin.y * height + 32)
    }
    ctx.restore()
    return
  }
  const box = whiteboardShapeBox(stroke.points)
  if (stroke.tool === 'rect' && box) {
    ctx.strokeRect(box.x * width, box.y * height, box.width * width, box.height * height)
  } else if (stroke.tool === 'circle' && box) {
    ctx.beginPath()
    ctx.ellipse(
      (box.x + box.width / 2) * width,
      (box.y + box.height / 2) * height,
      Math.max(1, (box.width / 2) * width),
      Math.max(1, (box.height / 2) * height),
      0,
      0,
      Math.PI * 2,
    )
    ctx.stroke()
  } else if (stroke.tool === 'line') {
    const start = stroke.points[0]
    const end = stroke.points[stroke.points.length - 1]
    if (start && end) {
      ctx.beginPath()
      ctx.moveTo(start.x * width, start.y * height)
      ctx.lineTo(end.x * width, end.y * height)
      ctx.stroke()
    }
  } else if (stroke.points.length >= 2) {
    ctx.beginPath()
    const first = stroke.points[0]
    if (first) ctx.moveTo(first.x * width, first.y * height)
    for (let i = 1; i < stroke.points.length; i++) {
      const pt = stroke.points[i]
      if (pt) ctx.lineTo(pt.x * width, pt.y * height)
    }
    ctx.stroke()
  }
  ctx.restore()
}
