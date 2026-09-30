import type { ComponentType, ReactNode } from 'react'
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'
import {
  BackHandler,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'

import {
  Icons,
  ScrollView,
  Sheet,
  SheetFrame,
  SheetHandle,
  SheetOverlay,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { radius } from '~/config/tokens'
import { useFullscreenOverlayInsets } from '~/hooks/useFullscreenOverlayInsets'
import { useFullscreenOverlaySize } from '~/hooks/useFullscreenOverlaySize'
import { useKeyboardBottomInset } from '~/hooks/useKeyboardVisible'
import { useAppUi } from '~/lib/theme/useAppUi'

// Approximate non-scrolling chrome heights so the scroll body can extend as
// close to full screen as possible while still leaving room for these.
const HANDLE_CHROME = 28
const HEADER_CHROME = 52
const FOOTER_CHROME = 72

/** Native sheets use the shortest timing preset — spring/slow anims felt laggy on iPad. */
const SHEET_ANIMATION = Platform.OS === 'web' ? 'quick' : '100ms'

const isWeb = Platform.OS === 'web'

// ---------------------------------------------------------------------------
// Nested sheets
//
// A modal Tamagui sheet teleports its content to the single root portal host.
// On iOS/Android a second sheet opened from inside an already-open sheet lands
// in that same host behind the full-screen frame of the first one, so it never
// becomes visible — the press looks dead even though state flipped. Web has no
// such limit (real DOM portals stack fine).
//
// So on native an `AppBottomSheet` rendered inside another one registers itself
// as a *layer* on the parent sheet, which stacks it inside its own frame. Same
// component, same props, same look — no platform-specific call sites.
// ---------------------------------------------------------------------------

type SheetLayer = { id: string; node: ReactNode }

type SheetLayerStore = {
  subscribe: (listener: () => void) => () => void
  getLayers: () => SheetLayer[]
  mount: (id: string, node: ReactNode) => void
  unmount: (id: string) => void
}

function createSheetLayerStore(): SheetLayerStore {
  let layers: SheetLayer[] = []
  const listeners = new Set<() => void>()

  function emit() {
    for (const listener of listeners) listener()
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getLayers: () => layers,
    // Updates in place so a re-render of the layer's owner never remounts the
    // layer subtree (which would drop text inputs / scroll position).
    mount(id, node) {
      const index = layers.findIndex((layer) => layer.id === id)
      if (index === -1) {
        layers = [...layers, { id, node }]
      } else {
        if (layers[index].node === node) return
        layers = layers.slice()
        layers[index] = { id, node }
      }
      emit()
    },
    unmount(id) {
      if (!layers.some((layer) => layer.id === id)) return
      layers = layers.filter((layer) => layer.id !== id)
      emit()
    },
  }
}

const SheetLayerContext = createContext<SheetLayerStore | null>(null)

/** Renders the stacked layers inside the host sheet's frame. */
function SheetLayerOutlet({ store }: { store: SheetLayerStore }) {
  const layers = useSyncExternalStore(store.subscribe, store.getLayers, store.getLayers)

  if (layers.length === 0) return null

  return (
    <>
      {layers.map((layer, index) => (
        <YStack
          key={layer.id}
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={100 + index}
        >
          {layer.node}
        </YStack>
      ))}
    </>
  )
}

/**
 * Keeps `node` mounted as a layer of the parent sheet while `open` is true.
 * The element is still built by the caller on every render, so caller state
 * flows through; context, though, resolves where the layer renders — inside
 * the parent sheet's frame, same place the parent's own body sits.
 */
function useSheetLayer(store: SheetLayerStore | null, open: boolean, node: ReactNode) {
  const id = useId()
  const nodeRef = useRef(node)
  nodeRef.current = node

  // No dep array on purpose: every render pushes the fresh element across.
  useEffect(() => {
    if (!store) return
    if (open) store.mount(id, nodeRef.current)
    else store.unmount(id)
  })

  useEffect(() => {
    return () => store?.unmount(id)
  }, [store, id])
}

type BottomSheetHeaderProps = {
  title?: string
  onClose: () => void
}

/** Sheet title row with always-visible close control. */
export function BottomSheetHeader({ title, onClose }: BottomSheetHeaderProps) {
  const ui = useAppUi()

  return (
    <XStack
      paddingHorizontal="$4"
      paddingVertical="$2.5"
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      borderBottomWidth={1}
      borderBottomColor={ui.borderSubtle}
      minHeight={52}
    >
      <Text flex={1} fontSize={18} fontWeight="700" color={ui.text} letterSpacing={-0.2} numberOfLines={2}>
        {title ?? ''}
      </Text>
      <XStack
        width={40}
        height={40}
        alignItems="center"
        justifyContent="center"
        borderRadius={radius.pill}
        cursor="pointer"
        aria-label="Close"
        accessibilityLabel="Close"
        accessibilityRole="button"
        hitSlop={8}
        hoverStyle={{ backgroundColor: ui.surfaceHover }}
        pressStyle={{ opacity: 0.75, scale: 0.96 }}
        onPress={onClose}
      >
        <Icons.X size={22} color={ui.text} />
      </XStack>
    </XStack>
  )
}

type SheetSurfaceProps = {
  title?: string
  onClose: () => void
  showHandle: boolean
  scrollable: boolean
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  footer?: ReactNode
  children: ReactNode
  overlayInsets: { top: number; bottom: number }
  keyboardHeight?: number
  maxHeight: number
  /** `Sheet.ScrollView` for a real sheet, a plain one for a stacked layer. */
  scrollComponent: ComponentType<any>
  /** Web-only cap so the body never pushes the footer off screen. */
  scrollMaxHeight?: number
  /** Layers can't be dragged, so they get a static grabber bar. */
  staticHandle?: boolean
  /**
   * Hug content height instead of stretching to the viewport.
   * Used for short sheets (share picker, confirm, end meeting).
   */
  fitContent?: boolean
  /** Stretch a non-scrolling body to the sheet height (see `AppBottomSheet`). */
  fillBody?: boolean
  /** Zoom More-style: grab handle only (no title / close row). */
  hideHeader?: boolean
  /** Override sheet fill (e.g. Sheconomy meeting plum). */
  surfaceColor?: string
  /** Override grabber / handle color. */
  handleColor?: string
}

/** Handle + header + (scrollable) body + sticky footer — shared by both modes. */
function SheetSurface({
  title,
  onClose,
  showHandle,
  scrollable,
  onScroll,
  footer,
  children,
  overlayInsets,
  keyboardHeight = 0,
  maxHeight,
  scrollComponent: ScrollComponent,
  scrollMaxHeight,
  staticHandle,
  fitContent = false,
  fillBody = false,
  hideHeader = false,
  surfaceColor,
  handleColor,
}: SheetSurfaceProps) {
  const ui = useAppUi()
  const isKeyboardOpen = keyboardHeight > 0
  const sheetBg = surfaceColor ?? ui.surface
  const grabber = handleColor ?? ui.border
  const stretchBody = fillBody && !scrollable && !fitContent

  const body = (
    <YStack
      paddingHorizontal="$4"
      paddingTop="$3"
      paddingBottom="$3"
      gap="$3"
      width="100%"
      {...(stretchBody ? { flex: 1, minHeight: 0 } : {})}
    >
      {children}
    </YStack>
  )

  return (
    <YStack
      width="100%"
      {...(fitContent
        ? { maxHeight }
        : { height: '100%' as const, maxHeight, flex: 1 })}
      backgroundColor={sheetBg}
      borderTopLeftRadius={fitContent ? 16 : 0}
      borderTopRightRadius={fitContent ? 16 : 0}
      borderBottomLeftRadius={0}
      borderBottomRightRadius={0}
      overflow="hidden"
    >
      {showHandle ? (
        <YStack paddingTop="$2.5" paddingBottom="$1" alignItems="center" width="100%">
          {staticHandle ? (
            <YStack width={40} height={5} borderRadius={radius.pill} backgroundColor={grabber} />
          ) : (
            <SheetHandle backgroundColor={grabber} />
          )}
        </YStack>
      ) : null}

      {!hideHeader ? <BottomSheetHeader title={title} onClose={onClose} /> : null}

      {scrollable ? (
        <ScrollComponent
          width="100%"
          {...(fitContent ? {} : { flex: 1 })}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
          // Without a footer the body itself has to clear the nav bar.
          contentContainerStyle={{
            paddingBottom: footer ? 0 : (isKeyboardOpen ? 16 : overlayInsets.bottom),
            // Full-screen sheets stretch the body; fit sheets hug content.
            ...(fitContent ? {} : { flexGrow: 1 }),
          }}
          {...(scrollMaxHeight != null
            ? { maxHeight: scrollMaxHeight as unknown as number }
            : {})}
        >
          {body}
        </ScrollComponent>
      ) : (
        <YStack
          {...(fitContent ? {} : { flex: 1 })}
          {...(stretchBody ? { minHeight: 0 } : {})}
          width="100%"
          paddingBottom={footer ? 0 : (isKeyboardOpen ? 16 : overlayInsets.bottom)}
        >
          {body}
        </YStack>
      )}

      {footer ? (
        <YStack
          width="100%"
          paddingHorizontal="$4"
          paddingTop="$3"
          // When keyboard is open, drop the nav bar inset so footer sits right above keyboard.
          paddingBottom={isKeyboardOpen ? 10 : 13 + overlayInsets.bottom}
          marginBottom={0}
          borderTopWidth={1}
          borderTopColor={ui.borderSubtle}
          backgroundColor={sheetBg}
        >
          {footer}
        </YStack>
      ) : null}
    </YStack>
  )
}

type AppBottomSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: ReactNode
  /** Sticky footer below scrollable body (e.g. filter actions). */
  footer?: ReactNode
  /** Show drag handle above the header. */
  showHandle?: boolean
  /** Wrap body in Sheet.ScrollView (disable for short static content). */
  scrollable?: boolean
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  /**
   * Size the sheet to its content instead of filling the viewport.
   * Use for short pickers / confirms (share, end meeting, apps).
   */
  fitContent?: boolean
  /**
   * With `scrollable={false}`, give the body the full sheet height so children
   * can run their own scroll area with a sticky footer (`flex: 1` children).
   */
  fillBody?: boolean
  /** Grab handle only — skip title / close row (Zoom More style). */
  hideHeader?: boolean
  /** Override sheet fill (Sheconomy meeting plum, etc.). */
  surfaceColor?: string
  /** Override grabber color. */
  handleColor?: string
  /**
   * @deprecated Sheets always cover the full viewport width. Kept for call-site compatibility.
   */
  maxWidth?: number
}

/**
 * Bottom sheet across web, iOS, and Android.
 *
 * Default is full-viewport. Pass `fitContent` for short sheets that should hug
 * their content height (share picker, confirm, end meeting).
 *
 * When an `AppBottomSheet` is opened *inside* another one, native automatically
 * detects the parent sheet context via `SheetLayerContext` and renders as a
 * layer over the parent frame instead of a second (invisible) modal.
 */
export function AppBottomSheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
  showHandle = true,
  scrollable = true,
  onScroll,
  fitContent = false,
  fillBody = false,
  hideHeader = false,
  surfaceColor,
  handleColor,
}: AppBottomSheetProps) {
  const ui = useAppUi()
  const overlayInsets = useFullscreenOverlayInsets()
  const screen = useFullscreenOverlaySize()
  const keyboardHeight = useKeyboardBottomInset()
  const nativeKeyboardOffset = !isWeb ? keyboardHeight : 0
  const sheetBg = surfaceColor ?? ui.surface

  const parentLayers = useContext(SheetLayerContext)
  const asLayer = !isWeb && parentLayers != null

  const layerStore = useMemo(() => (isWeb ? null : createSheetLayerStore()), [])

  // Web fit sheets only measure their frame if it already has content while
  // closed; mounting it on open leaves it parked at Tamagui's 10000px offset.
  const keepSurfaceMounted = isWeb && fitContent

  // Space taken by the handle/header/footer that sits outside the scroll body.
  const chromeHeight =
    (showHandle ? HANDLE_CHROME : 0) +
    (hideHeader ? 0 : HEADER_CHROME) +
    (footer ? FOOTER_CHROME : 0) +
    overlayInsets.top +
    overlayInsets.bottom

  function close() {
    onOpenChange(false)
  }

  const surfaceMaxHeight = screen.height - nativeKeyboardOffset

  const surface = open || keepSurfaceMounted ? (
    <SheetSurface
      title={title}
      onClose={close}
      showHandle={showHandle}
      scrollable={scrollable}
      onScroll={onScroll}
      footer={footer}
      overlayInsets={overlayInsets}
      keyboardHeight={keyboardHeight}
      maxHeight={surfaceMaxHeight}
      staticHandle={asLayer}
      fitContent={fitContent}
      fillBody={fillBody}
      hideHeader={hideHeader}
      surfaceColor={surfaceColor}
      handleColor={handleColor}
      scrollComponent={asLayer ? ScrollView : Sheet.ScrollView}
      scrollMaxHeight={
        isWeb
          ? (`calc(100vh - ${chromeHeight}px)` as unknown as number)
          : fitContent
            ? surfaceMaxHeight - chromeHeight
            : undefined
      }
    >
      {children}
    </SheetSurface>
  ) : null

  // --- nested: stack inside the parent sheet's frame -----------------------
  const layerNode = asLayer && open ? <SheetLayerPanel onClose={close}>{surface}</SheetLayerPanel> : null
  useSheetLayer(asLayer ? parentLayers : null, open, layerNode)

  if (asLayer) return null

  // --- top level: a real modal sheet ---------------------------------------
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      modal
      dismissOnSnapToBottom
      snapPoints={fitContent ? ['fit', 0] : [100]}
      snapPointsMode={fitContent ? 'fit' : 'percent'}
      zIndex={100_000}
      animation={SHEET_ANIMATION}
      // Keep focused inputs above the software keyboard on iOS and Android.
      // This also covers native nested-sheet layers because they render inside
      // this top-level sheet frame.
      moveOnKeyboardChange={!isWeb}
    >
      <SheetOverlay animation={SHEET_ANIMATION} />
      <SheetFrame
        padding={0}
        margin={0}
        backgroundColor={sheetBg}
        borderTopLeftRadius={fitContent ? 16 : 0}
        borderTopRightRadius={fitContent ? 16 : 0}
        borderBottomLeftRadius={0}
        borderBottomRightRadius={0}
        overflow="hidden"
        {...(fitContent
          ? {
              width: '100%' as const,
              maxWidth: screen.width,
              maxHeight: surfaceMaxHeight,
            }
          : {
              height: surfaceMaxHeight,
              maxHeight: surfaceMaxHeight,
              minHeight: surfaceMaxHeight,
              width: screen.width,
              maxWidth: screen.width,
              minWidth: screen.width,
              flex: 1,
              position: 'absolute' as const,
              top: 0,
              left: 0,
              right: 0,
              bottom: nativeKeyboardOffset,
            })}
      >
        {layerStore ? (
          <SheetLayerContext.Provider value={layerStore}>
            {surface}
            <SheetLayerOutlet store={layerStore} />
          </SheetLayerContext.Provider>
        ) : (
          surface
        )}
      </SheetFrame>
    </Sheet>
  )
}

/** Opaque full-frame panel used for a sheet stacked on top of another sheet. */
function SheetLayerPanel({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ui = useAppUi()

  // Android back closes the top-most layer first: handlers fire in reverse
  // registration order and layers mount in the order they were opened.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => subscription.remove()
  }, [onClose])

  return (
    <YStack
      flex={1}
      width="100%"
      height="100%"
      backgroundColor={ui.surface}
      animation={SHEET_ANIMATION}
      enterStyle={{ opacity: 0, y: 24 }}
      opacity={1}
      y={0}
    >
      {children}
    </YStack>
  )
}
