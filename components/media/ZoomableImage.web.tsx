import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'

import {
  IMAGE_ZOOM_MAX,
  IMAGE_ZOOM_MIN,
  IMAGE_ZOOM_STEP,
  clampZoom,
  formatZoomPercent,
  nextZoomIn,
  nextZoomOut,
} from '~/lib/zoom/zoom-levels'

const DOUBLE_TAP_MS = 300

export type ZoomableImageHandle = {
  zoomIn: () => void
  zoomOut: () => void
  reset: () => void
  getScale: () => number
}

export type ZoomableImageProps = {
  uri: string
  alt?: string
  onZoomChange?: (zoomed: boolean) => void
  /** Fires on every scale change (for % label). */
  onScaleChange?: (scale: number) => void
  onTap?: () => void
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}

/** LinkedIn-style zoom for web: multi-step +/−, wheel, pinch, double-click. */
export const ZoomableImage = forwardRef<ZoomableImageHandle, ZoomableImageProps>(
  function ZoomableImage(
    { uri, alt = '', onZoomChange, onScaleChange, onTap, onSwipeLeft, onSwipeRight },
    ref,
  ) {
    const rootRef = useRef<HTMLDivElement | null>(null)
    const imgRef = useRef<HTMLImageElement | null>(null)
    const scale = useRef(1)
    const tx = useRef(0)
    const ty = useRef(0)
    const zoomedRef = useRef(false)
    const onZoomChangeRef = useRef(onZoomChange)
    const onScaleChangeRef = useRef(onScaleChange)
    const onTapRef = useRef(onTap)
    const onSwipeLeftRef = useRef(onSwipeLeft)
    const onSwipeRightRef = useRef(onSwipeRight)
    onZoomChangeRef.current = onZoomChange
    onScaleChangeRef.current = onScaleChange
    onTapRef.current = onTap
    onSwipeLeftRef.current = onSwipeLeft
    onSwipeRightRef.current = onSwipeRight

    const apply = useCallback(() => {
      const img = imgRef.current
      if (!img) return
      const s = scale.current
      img.style.transform = `translate3d(${tx.current}px, ${ty.current}px, 0) scale(${s})`
      const zoomed = s > 1.02
      if (zoomed !== zoomedRef.current) {
        zoomedRef.current = zoomed
        onZoomChangeRef.current?.(zoomed)
      }
      onScaleChangeRef.current?.(s)
      const root = rootRef.current
      if (root) root.style.cursor = zoomed ? 'grab' : 'zoom-in'
    }, [])

    const setTransform = useCallback(
      (nextScale: number, nextTx: number, nextTy: number, animate = false) => {
        const s = clampZoom(nextScale, IMAGE_ZOOM_MIN, IMAGE_ZOOM_MAX)
        scale.current = s
        if (s <= 1.01) {
          tx.current = 0
          ty.current = 0
        } else {
          tx.current = nextTx
          ty.current = nextTy
        }
        const img = imgRef.current
        if (img) {
          img.style.transition = animate ? 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none'
        }
        apply()
      },
      [apply],
    )

    const zoomIn = useCallback(() => {
      const next = nextZoomIn(scale.current, IMAGE_ZOOM_STEP, IMAGE_ZOOM_MAX)
      setTransform(next, tx.current, ty.current, true)
    }, [setTransform])

    const zoomOut = useCallback(() => {
      const next = nextZoomOut(scale.current, IMAGE_ZOOM_STEP, IMAGE_ZOOM_MIN)
      setTransform(next, next <= 1.01 ? 0 : tx.current, next <= 1.01 ? 0 : ty.current, true)
    }, [setTransform])

    const reset = useCallback(() => {
      setTransform(1, 0, 0, true)
    }, [setTransform])

    useImperativeHandle(
      ref,
      () => ({
        zoomIn,
        zoomOut,
        reset,
        getScale: () => scale.current,
      }),
      [zoomIn, zoomOut, reset],
    )

    useEffect(() => {
      scale.current = 1
      tx.current = 0
      ty.current = 0
      zoomedRef.current = false
      apply()
      onZoomChangeRef.current?.(false)
      onScaleChangeRef.current?.(1)
    }, [uri, apply])

    useEffect(() => {
      const root = rootRef.current
      if (!root) return

      const pointers = new Map<number, { x: number; y: number }>()
      let pinchBaseScale = 1
      let pinchStartDistance = 0
      let dragging = false
      let dragOrigin = { x: 0, y: 0, tx: 0, ty: 0 }
      let lastTapAt = 0
      let lastTapX = 0
      let lastTapY = 0
      let movedDuringPointer = false
      let panStartX = 0
      let panStartY = 0

      const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
        Math.hypot(a.x - b.x, a.y - b.y)

      const onWheel = (event: WheelEvent) => {
        event.preventDefault()
        event.stopPropagation()
        const rect = root.getBoundingClientRect()
        const mx = event.clientX - rect.left - rect.width / 2
        const my = event.clientY - rect.top - rect.height / 2
        const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12
        const prev = scale.current
        const next = clampZoom(prev * factor, IMAGE_ZOOM_MIN, IMAGE_ZOOM_MAX)
        if (next === prev) return
        const ratio = next / prev
        setTransform(next, mx - (mx - tx.current) * ratio, my - (my - ty.current) * ratio)
      }

      const onPointerDown = (event: PointerEvent) => {
        event.preventDefault()
        root.setPointerCapture?.(event.pointerId)
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
        movedDuringPointer = false
        panStartX = event.clientX
        panStartY = event.clientY

        if (pointers.size === 2) {
          const [a, b] = Array.from(pointers.values())
          pinchStartDistance = Math.max(1, dist(a, b))
          pinchBaseScale = scale.current
          dragging = false
          return
        }

        if (scale.current > 1.02) {
          dragging = true
          dragOrigin = {
            x: event.clientX,
            y: event.clientY,
            tx: tx.current,
            ty: ty.current,
          }
        }
      }

      const onPointerMove = (event: PointerEvent) => {
        if (!pointers.has(event.pointerId)) return
        const prevPt = pointers.get(event.pointerId)!
        if (Math.hypot(event.clientX - prevPt.x, event.clientY - prevPt.y) > 4) {
          movedDuringPointer = true
        }
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

        if (pointers.size === 2) {
          const [a, b] = Array.from(pointers.values())
          setTransform(pinchBaseScale * (dist(a, b) / pinchStartDistance), tx.current, ty.current)
          return
        }

        if (dragging && scale.current > 1.02) {
          setTransform(
            scale.current,
            dragOrigin.tx + (event.clientX - dragOrigin.x),
            dragOrigin.ty + (event.clientY - dragOrigin.y),
          )
        }
      }

      const finishPointer = (event: PointerEvent) => {
        pointers.delete(event.pointerId)
        try {
          root.releasePointerCapture?.(event.pointerId)
        } catch {
          /* ignore */
        }
        if (pointers.size > 0) return

        const wasDragging = dragging
        dragging = false
        const dx = event.clientX - panStartX
        const dy = event.clientY - panStartY

        if (scale.current <= 1.02 && Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.35) {
          if (dx < 0) onSwipeLeftRef.current?.()
          else onSwipeRightRef.current?.()
          return
        }

        if (wasDragging || movedDuringPointer) {
          if (scale.current < 1.05) setTransform(1, 0, 0, true)
          return
        }

        const now = Date.now()
        const isDouble =
          now - lastTapAt < DOUBLE_TAP_MS &&
          Math.hypot(event.clientX - lastTapX, event.clientY - lastTapY) < 36

        if (isDouble) {
          lastTapAt = 0
          // Each double-tap steps UP (many levels), or resets at max
          if (scale.current >= IMAGE_ZOOM_MAX - 0.05) {
            setTransform(1, 0, 0, true)
          } else {
            const next = nextZoomIn(scale.current, IMAGE_ZOOM_STEP, IMAGE_ZOOM_MAX)
            const rect = root.getBoundingClientRect()
            const mx = event.clientX - rect.left - rect.width / 2
            const my = event.clientY - rect.top - rect.height / 2
            const ratio = next / Math.max(scale.current, 0.01)
            setTransform(next, mx - (mx - tx.current) * ratio, my - (my - ty.current) * ratio, true)
          }
          return
        }

        lastTapAt = now
        lastTapX = event.clientX
        lastTapY = event.clientY
        window.setTimeout(() => {
          if (lastTapAt === now && scale.current <= 1.05) onTapRef.current?.()
        }, DOUBLE_TAP_MS)
      }

      root.addEventListener('wheel', onWheel, { passive: false })
      root.addEventListener('pointerdown', onPointerDown)
      root.addEventListener('pointermove', onPointerMove)
      root.addEventListener('pointerup', finishPointer)
      root.addEventListener('pointercancel', finishPointer)
      return () => {
        root.removeEventListener('wheel', onWheel)
        root.removeEventListener('pointerdown', onPointerDown)
        root.removeEventListener('pointermove', onPointerMove)
        root.removeEventListener('pointerup', finishPointer)
        root.removeEventListener('pointercancel', finishPointer)
      }
    }, [setTransform])

    return createElement(
      'div',
      {
        ref: rootRef,
        'data-zoom-label': formatZoomPercent(scale.current),
        style: {
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000',
          touchAction: 'none',
          cursor: 'zoom-in',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          position: 'relative',
        },
      },
      createElement('img', {
        ref: imgRef,
        src: uri,
        alt,
        draggable: false,
        style: {
          maxWidth: '100%',
          maxHeight: '100%',
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          transform: 'translate3d(0,0,0) scale(1)',
          transformOrigin: 'center center',
          willChange: 'transform',
          pointerEvents: 'none',
          userSelect: 'none',
        },
      }),
    )
  },
)
