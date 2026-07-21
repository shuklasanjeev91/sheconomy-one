import { useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'
import { WebView } from 'react-native-webview'

import { AppBottomSheet, Button, Spinner, Text, XStack, YStack } from '~/components/ui'
import {
  getCurrentPosition,
  reverseGeocode,
  useOptionalUserLocation,
  type LatLng,
  type ResolvedAddress,
} from '~/lib/location'
import { useAppUi } from '~/lib/theme/useAppUi'

type MapAddressPickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialCoords?: LatLng | null
  onConfirm: (address: ResolvedAddress) => void
}

function buildMapHtml(coords: LatLng) {
  // Interactive pin via Google Maps JS when key is injected by host page is ideal;
  // this lightweight fallback lets users nudge a pin and confirm without a client key.
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <style>
    html, body, #map { margin:0; height:100%; width:100%; background:#e8e4e6; }
    #pin {
      position:absolute; left:50%; top:50%; transform:translate(-50%,-100%);
      font-size:36px; z-index:2; pointer-events:none;
    }
    #hint {
      position:absolute; left:12px; right:12px; bottom:16px; z-index:2;
      background:rgba(255,255,255,.92); padding:10px 12px; border-radius:12px;
      font:14px/1.35 -apple-system,BlinkMacSystemFont,sans-serif; color:#1a0a12;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="pin">📍</div>
  <div id="hint">Drag the map to place the pin, then confirm below. Map tiles need network access.</div>
  <script>
    const start = { lat: ${coords.latitude}, lng: ${coords.longitude} };
    let lat = start.lat, lng = start.lng;
    const map = document.getElementById('map');
    let ox = 0, oy = 0, dragging = false;
    function paint() {
      const url = 'https://maps.googleapis.com/maps/api/staticmap?center='
        + lat + ',' + lng + '&zoom=16&size=640x640&scale=2&markers=color:0xD01060%7C'
        + lat + ',' + lng;
      map.style.backgroundImage = 'url(' + url + ')';
      map.style.backgroundSize = 'cover';
      map.style.backgroundPosition = 'center';
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ latitude: lat, longitude: lng }));
      window.parent && window.parent.postMessage({ type: 'sheconomy-map-pin', latitude: lat, longitude: lng }, '*');
    }
    paint();
    map.addEventListener('pointerdown', (e) => { dragging = true; ox = e.clientX; oy = e.clientY; });
    window.addEventListener('pointerup', () => { dragging = false; });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - ox;
      const dy = e.clientY - oy;
      ox = e.clientX; oy = e.clientY;
      // Approximate pan at zoom 16
      lng -= dx * 0.00004;
      lat += dy * 0.00004;
      paint();
    });
  </script>
</body>
</html>`
}

/** Cross-platform map pin sheet → reverse geocode → confirm. */
export function MapAddressPicker({
  open,
  onOpenChange,
  initialCoords,
  onConfirm,
}: MapAddressPickerProps) {
  const ui = useAppUi()
  const sharedLocation = useOptionalUserLocation()
  const [coords, setCoords] = useState<LatLng | null>(
    initialCoords ?? sharedLocation?.coords ?? null,
  )
  const [preview, setPreview] = useState<ResolvedAddress | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setPreview(null)

    void (async () => {
      if (initialCoords) {
        setCoords(initialCoords)
        return
      }
      if (sharedLocation?.coords) {
        setCoords(sharedLocation.coords)
        return
      }
      setLoading(true)
      const position = await getCurrentPosition({ accuracy: 'balanced' })
      setLoading(false)
      if (!position.coords) {
        setError(position.error ?? 'Could not get your location.')
        setCoords({ latitude: 19.076, longitude: 72.8777 })
        return
      }
      setCoords(position.coords)
    })()
  }, [open, initialCoords, sharedLocation?.coords])

  useEffect(() => {
    if (!open || !coords) return
    const handle = setTimeout(() => {
      void (async () => {
        setLoading(true)
        const result = await reverseGeocode(coords)
        setLoading(false)
        if (result.data) {
          setPreview({ ...result.data, source: 'map' })
          setError(null)
        } else if (!result.unavailable) {
          setError(result.error)
        } else {
          setPreview({
            address_line_1: '',
            address_line_2: '',
            city: '',
            state: '',
            postal_code: '',
            country: '',
            latitude: coords.latitude,
            longitude: coords.longitude,
            place_id: null,
            formatted: `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`,
            source: 'map',
          })
        }
      })()
    }, 350)
    return () => clearTimeout(handle)
  }, [coords, open])

  useEffect(() => {
    if (Platform.OS !== 'web' || !open) return
    function onMessage(event: MessageEvent) {
      const data = event.data
      if (!data || typeof data !== 'object' || data.type !== 'sheconomy-map-pin') return
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        setCoords({ latitude: data.latitude, longitude: data.longitude })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [open])

  const html = useMemo(() => (coords ? buildMapHtml(coords) : ''), [coords])

  function handleConfirm() {
    if (!preview) return
    onConfirm(preview)
    onOpenChange(false)
  }

  return (
    <AppBottomSheet open={open} onOpenChange={onOpenChange} title="Drop a pin">
      <YStack gap="$3" width="100%" minHeight={420}>
        <YStack height={280} borderRadius={16} overflow="hidden" backgroundColor={ui.surfaceMuted}>
          {coords && html ? (
            Platform.OS === 'web' ? (
              <iframe
                title="Map pin"
                srcDoc={html}
                style={{ border: 0, width: '100%', height: '100%' }}
              />
            ) : (
              <WebView
                originWhitelist={['*']}
                source={{ html }}
                onMessage={(event) => {
                  try {
                    const data = JSON.parse(event.nativeEvent.data) as LatLng
                    if (typeof data.latitude === 'number') setCoords(data)
                  } catch {
                    // ignore
                  }
                }}
                style={{ flex: 1, width: '100%', height: '100%' }}
              />
            )
          ) : (
            <YStack flex={1} alignItems="center" justifyContent="center">
              <Spinner size="large" />
            </YStack>
          )}
        </YStack>

        {error ? (
          <Text fontSize={13} color={ui.danger}>
            {error}
          </Text>
        ) : null}

        <YStack gap="$1">
          <Text fontSize={13} color={ui.textMuted}>
            Selected location
          </Text>
          <Text fontSize={14} color={ui.text} fontWeight="600">
            {loading
              ? 'Resolving address…'
              : preview?.formatted ||
                (coords
                  ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
                  : '—')}
          </Text>
        </YStack>

        <XStack gap="$2">
          <Button
            tone="outline"
            flex={1}
            borderRadius={999}
            onPress={() => onOpenChange(false)}
          >
            <Text fontWeight="600">Cancel</Text>
          </Button>
          <Button
            tone="primary"
            flex={1}
            borderRadius={999}
            disabled={!preview || loading}
            onPress={handleConfirm}
          >
            <Text fontWeight="600" color={ui.onBrand}>
              Use this pin
            </Text>
          </Button>
        </XStack>
      </YStack>
    </AppBottomSheet>
  )
}
