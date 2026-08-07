import { createElement, forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'

import {
  clampCropTransform,
  type CropStageHandle,
  type CropStageProps,
  type CropTransform,
} from '~/lib/media/crop-stage'

const WHEEL_FACTOR = 1.12

/** Pan/zoom crop stage for web — plain DOM transforms, no reanimated. */
export const CropStage = forwardRef<CropStageHandle, CropStageProps>(function CropStage(
  {
    uri,
    imageWidth,
    imageHeight,
    frameWidth,
    frameHeight,
    minZoom,
    maxZoom,
    onTransformChange,
  },
  ref,
) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const transformRef = useRef<CropTransform>({ x: 0, y: 0, scale: 1 })

  const boundsRef = useRef({
    imageWidth,
    imageHeight,
    frameWidth,
    frameHeight,
    minZoom,
    maxZoom,
  })
  boundsRef.current = { imageWidth, imageHeight, frameWidth, frameHeight, minZoom, maxZoom }

  const onTransformChangeRef = useRef(onTransformChange)
  onTransformChangeRef.current = onTransformChange

  const commit = useCallback((next: CropTransform) => {
    const clamped = clampCropTransform(next, boundsRef.current)
    transformRef.current = clamped
    const node = imageRef.current
    if (node) {
      node.style.transform = `translate3d(${clamped.x}px, ${clamped.y}px, 0) scale(${clamped.scale})`
    }
    onTransformChangeRef.current?.(clamped)
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      getTransform: () => transformRef.current,
      setTransform: commit,
    }),
    [commit],
  )

  useEffect(() => {
    commit({ x: 0, y: 0, scale: 1 })
  }, [uri, commit])

  // Re-clamp when the frame or fitted image size changes (resize, aspect switch).
  useEffect(() => {
    commit(transformRef.current)
  }, [commit, frameHeight, frameWidth, imageHeight, imageWidth])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const pointers = new Map<number, { x: number; y: number }>()
    let dragOrigin: { x: number; y: number; tx: number; ty: number } | null = null
    let pinchStartDistance = 0
    let pinchStartScale = 1

    const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y)

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const current = transformRef.current
      commit({
        ...current,
        scale: current.scale * (event.deltaY < 0 ? WHEEL_FACTOR : 1 / WHEEL_FACTOR),
      })
    }

    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault()
      root.setPointerCapture?.(event.pointerId)
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

      if (pointers.size === 2) {
        const [a, b] = Array.from(pointers.values())
        pinchStartDistance = Math.max(1, distance(a, b))
        pinchStartScale = transformRef.current.scale
        dragOrigin = null
        return
      }

      dragOrigin = {
        x: event.clientX,
        y: event.clientY,
        tx: transformRef.current.x,
        ty: transformRef.current.y,
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

      if (pointers.size === 2) {
        const [a, b] = Array.from(pointers.values())
        commit({
          ...transformRef.current,
          scale: pinchStartScale * (distance(a, b) / pinchStartDistance),
        })
        return
      }

      if (!dragOrigin) return
      commit({
        ...transformRef.current,
        x: dragOrigin.tx + (event.clientX - dragOrigin.x),
        y: dragOrigin.ty + (event.clientY - dragOrigin.y),
      })
    }

    const finishPointer = (event: PointerEvent) => {
      pointers.delete(event.pointerId)
      try {
        root.releasePointerCapture?.(event.pointerId)
      } catch {
        /* ignore */
      }
      if (pointers.size === 0) dragOrigin = null
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
  }, [commit])

  return createElement(
    'div',
    {
      ref: rootRef,
      style: {
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        touchAction: 'none',
        cursor: 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      },
    },
    createElement('img', {
      ref: imageRef,
      src: uri,
      alt: '',
      draggable: false,
      style: {
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: imageWidth,
        height: imageHeight,
        marginLeft: -imageWidth / 2,
        marginTop: -imageHeight / 2,
        objectFit: 'cover',
        transformOrigin: 'center center',
        willChange: 'transform',
        pointerEvents: 'none',
        userSelect: 'none',
      },
    }),
  )
})
