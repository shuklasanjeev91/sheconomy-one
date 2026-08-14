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
  useWindowDimensions,
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
  maxHeight: number
  /** `Sheet.ScrollView` for a real sheet, a plain one for a stacked layer. */
  scrollComponent: ComponentType<any>
  /** Web-only cap so the body never pushes the footer off screen. */
  scrollMaxHeight?: number
  /** Layers can't be dragged, so they get a static grabber bar. */
  staticHandle?: boolean
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
  maxHeight,
  scrollComponent: ScrollComponent,
  scrollMaxHeight,
  staticHandle,
}: SheetSurfaceProps) {
  const ui = useAppUi()

  const body = (
    <YStack paddingHorizontal="$4" paddingTop="$3" paddingBottom="$3" gap="$3" width="100%">
      {children}
    </YStack>
  )

  return (
    <YStack
      width="100%"
      flex={1}
      height="100%"
      maxHeight={maxHeight}
      paddingTop={overlayInsets.top}
      paddingBottom={0}
      marginBottom={0}
    >
      {showHandle ? (
        <YStack paddingTop="$2.5" paddingBottom="$1" alignItems="center" width="100%">
          {staticHandle ? (
            <YStack width={40} height={5} borderRadius={radius.pill} backgroundColor={ui.border} />
          ) : (
            <SheetHandle />
          )}
        </YStack>
      ) : null}

      <BottomSheetHeader title={title} onClose={onClose} />

      {scrollable ? (
        <ScrollComponent
          width="100%"
          flex={1}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
          // Without a footer the body itself has to clear the nav bar.
          contentContainerStyle={{
            paddingBottom: footer ? 0 : overlayInsets.bottom,
            flexGrow: 1,
          }}
          {...(scrollMaxHeight != null
            ? { maxHeight: scrollMaxHeight as unknown as number }
            : {})}
        >
          {body}
        </ScrollComponent>
      ) : (
        <YStack flex={1} width="100%" paddingBottom={footer ? 0 : overlayInsets.bottom}>
          {body}
        </YStack>
      )}

      {footer ? (
        <YStack
          width="100%"
          paddingHorizontal="$4"
          paddingTop="$3"
          // 13 matches the `$3` space token, so no-inset platforms are unchanged.
          paddingBottom={13 + overlayInsets.bottom}
          marginBottom={0}
          borderTopWidth={1}
          borderTopColor={ui.borderSubtle}
          backgroundColor={ui.surface}
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
   * @deprecated Sheets always cover the full viewport. Kept for call-site compatibility.
   */
  maxHeightRatio?: number
}

/**
 * Cross-platform bottom sheet — always covers the full device / viewport
 * (web, iOS, Android) with no bottom padding or margin gap.
 *
 * Nesting is supported: open one from inside another and native stacks it as a
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
}: AppBottomSheetProps) {
  const ui = useAppUi()
  const overlayInsets = useFullscreenOverlayInsets()
  const { height: windowHeight } = useWindowDimensions()

  const parentLayers = useContext(SheetLayerContext)
  const asLayer = !isWeb && parentLayers != null

  const layerStore = useMemo(() => (isWeb ? null : createSheetLayerStore()), [])

  const maxSheetHeight = useMemo(() => windowHeight, [windowHeight])

  // Space taken by the handle/header/footer that sits outside the scroll body.
  const chromeHeight =
    (showHandle ? HANDLE_CHROME : 0) +
    HEADER_CHROME +
    (footer ? FOOTER_CHROME : 0) +
    overlayInsets.top +
    overlayInsets.bottom

  function close() {
    onOpenChange(false)
  }

  const surface = open ? (
    <SheetSurface
      title={title}
      onClose={close}
      showHandle={showHandle}
      scrollable={scrollable}
      onScroll={onScroll}
      footer={footer}
      overlayInsets={overlayInsets}
      maxHeight={maxSheetHeight}
      staticHandle={asLayer}
      scrollComponent={asLayer ? ScrollView : Sheet.ScrollView}
      scrollMaxHeight={
        isWeb ? (`calc(100vh - ${chromeHeight}px)` as unknown as number) : undefined
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
      snapPoints={[100]}
      snapPointsMode="percent"
      zIndex={100_000}
      animation={SHEET_ANIMATION}
      moveOnKeyboardChange={false}
    >
      <SheetOverlay animation={SHEET_ANIMATION} />
      <SheetFrame
        padding={0}
        margin={0}
        backgroundColor={ui.surface}
        borderTopLeftRadius={0}
        borderTopRightRadius={0}
        borderBottomLeftRadius={0}
        borderBottomRightRadius={0}
        overflow="hidden"
        height={windowHeight}
        maxHeight={windowHeight}
        minHeight={windowHeight}
        width="100%"
        flex={1}
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
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
