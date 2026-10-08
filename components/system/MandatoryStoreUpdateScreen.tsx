import { useState } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { getBundleInfo } from '~/lib/updates/bundle-info'
import { openAppStore, storeUrlCandidates } from '~/lib/updates/open-store'
import { useAppUi } from '~/lib/theme/useAppUi'

type MandatoryStoreUpdateScreenProps = {
  minimumSupportedVersion: string
  currentVersion: string
}

/**
 * Full-screen blocker when the installed native binary is below the remote
 * minimum. Rendered in place of the app (not in a Modal) and built from core
 * react-native views so the store button never depends on gesture-handler.
 */
export function MandatoryStoreUpdateScreen({
  minimumSupportedVersion,
  currentVersion,
}: MandatoryStoreUpdateScreenProps) {
  const ui = useAppUi()
  const [opening, setOpening] = useState(false)
  const [openFailed, setOpenFailed] = useState(false)

  const storeName = Platform.OS === 'ios' ? 'App Store' : 'Play Store'
  const candidates = storeUrlCandidates()
  const listingUrl = candidates[candidates.length - 1] ?? null
  const bundle = getBundleInfo()
  const buildLabel = [currentVersion, bundle.runtimeVersion, bundle.updateId?.slice(0, 8)]
    .filter(Boolean)
    .join(' · ')

  async function handleUpdate() {
    if (opening) return
    setOpening(true)
    const opened = await openAppStore({ fallbackOnCancel: true })
    setOpenFailed(!opened)
    setOpening(false)
  }

  return (
    <View style={[styles.root, { backgroundColor: ui.surface }]}>
      <Text style={[styles.title, { color: ui.text }]}>Update required</Text>
      <Text style={[styles.body, { color: ui.textMuted }]}>
        This version of SHEconomy ({currentVersion}) is no longer supported. Please update to
        version {minimumSupportedVersion} or newer to continue.
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Update on the ${storeName}`}
        onPress={() => void handleUpdate()}
        hitSlop={12}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: ui.brand, opacity: pressed || opening ? 0.8 : 1 },
        ]}
      >
        {opening ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.buttonLabel}>Update now</Text>
        )}
      </Pressable>

      {openFailed && listingUrl ? (
        <Text selectable style={[styles.hint, { color: ui.textMuted }]}>
          Couldn't open the {storeName}. Open it and search for SHEconomy, or visit {listingUrl}
        </Text>
      ) : null}

      <Text style={[styles.build, { color: ui.textMuted }]}>{buildLabel}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 420,
  },
  button: {
    minWidth: 220,
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 420,
  },
  build: {
    position: 'absolute',
    bottom: 32,
    fontSize: 11,
    opacity: 0.7,
  },
})
