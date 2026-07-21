import { Platform } from 'react-native'

import { Icons, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle } from '~/config/tokens'
import { BulkImportContent } from '~/commerce/components/vendor/bulk-import/BulkImportContent'
import { useLockBodyScroll } from '~/hooks/useLockBodyScroll'
import { overlayBackdropStyle } from '~/lib/layout/styles'
import { resetBulkImport } from '~/lib/listing/listing-bulk-import.store'
import { useAppDispatch } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'

const PANEL_WIDTH = 720

type VendorBulkImportDrawerProps = {
  ui: AppUiTokens
  open: boolean
  isDesktop: boolean
  shopId: string
  safeBottom: number
  onClose: () => void
  onImportComplete?: () => void
}

export function VendorBulkImportDrawer({
  ui,
  open,
  isDesktop,
  shopId,
  safeBottom,
  onClose,
  onImportComplete,
}: VendorBulkImportDrawerProps) {
  const dispatch = useAppDispatch()
  useLockBodyScroll(open)

  if (!open) return null

  const panelPositionStyle =
    Platform.OS === 'web'
      ? ({ position: 'fixed' as const, top: 0, right: 0, bottom: 0, boxShadow: '-4px 0 24px rgba(0,0,0,0.18)' } as const)
      : ({ position: 'absolute' as const, top: 0, right: 0, bottom: 0 } as const)

  function handleClose() {
    dispatch(resetBulkImport())
    onClose()
  }

  return (
    <>
      <YStack
        backgroundColor="rgba(0,0,0,0.5)"
        zIndex={100000}
        cursor="pointer"
        style={overlayBackdropStyle()}
        animation="quick"
        enterStyle={{ opacity: 0 }}
        onPress={handleClose}
      />
      <YStack
        width={isDesktop ? PANEL_WIDTH : '100%'}
        maxWidth="100%"
        backgroundColor={ui.background}
        borderLeftWidth={isDesktop ? 1 : 0}
        borderLeftColor={ui.borderSubtle}
        zIndex={100001}
        style={{ ...panelPositionStyle, ...getShadowStyle('lg') }}
        animation="quick"
        enterStyle={{ x: isDesktop ? PANEL_WIDTH : 400, opacity: 0.96 }}
      >
        <XStack
          alignItems="center"
          justifyContent="space-between"
          paddingHorizontal="$4"
          paddingVertical="$3"
          borderBottomWidth={1}
          borderBottomColor={ui.borderSubtle}
          backgroundColor={ui.surface}
        >
          <XStack alignItems="center" gap="$2">
            <Icons.Upload size={18} color={ui.brand} />
            <Text fontSize={16} fontWeight="800" color={ui.text}>
              Bulk Import
            </Text>
          </XStack>
          <YStack
            width={36}
            height={36}
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            hoverStyle={{ backgroundColor: ui.surfaceMuted }}
            onPress={handleClose}
          >
            <Icons.X size={20} color={ui.textSecondary} />
          </YStack>
        </XStack>

        <ScrollView
          flex={1}
          showsVerticalScrollIndicator={false}
          style={Platform.OS === 'web' ? ({ overflowY: 'auto', minHeight: 0 } as const) : undefined}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 24 + safeBottom,
          }}
        >
          <BulkImportContent
            ui={ui}
            shopId={shopId}
            isDesktop={isDesktop}
            onImportComplete={onImportComplete}
          />
        </ScrollView>
      </YStack>
    </>
  )
}
