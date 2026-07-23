import { useEffect, useState } from 'react'

import { Button, Field, Input, Spinner, Switch, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { supabase } from '~/lib/supabase/client'
import { useAppUi } from '~/lib/theme/useAppUi'

type VendorReturnsSettingsPanelProps = {
  shopId: string
}

/** Shop-level default return policy editor (Vendor Settings → Returns). */
export function VendorReturnsSettingsPanel({ shopId }: VendorReturnsSettingsPanelProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [policyId, setPolicyId] = useState<string | null>(null)
  const [policyName, setPolicyName] = useState('Standard returns')
  const [acceptsReturns, setAcceptsReturns] = useState(true)
  const [acceptsExchanges, setAcceptsExchanges] = useState(true)
  const [acceptsRefunds, setAcceptsRefunds] = useState(true)
  const [windowDays, setWindowDays] = useState('7')
  const [details, setDetails] = useState('')

  useEffect(() => {
    let active = true
    setIsLoading(true)
    void supabase
      .from('return_policies')
      .select(
        'id, policy_name, accepts_returns, accepts_exchanges, accepts_refunds, return_window_days, policy_details',
      )
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        if (data) {
          setPolicyId(data.id)
          setPolicyName(data.policy_name || 'Standard returns')
          setAcceptsReturns(!!data.accepts_returns)
          setAcceptsExchanges(!!data.accepts_exchanges)
          setAcceptsRefunds(!!data.accepts_refunds)
          setWindowDays(String(data.return_window_days ?? 7))
          setDetails(data.policy_details ?? '')
        }
        setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [shopId])

  async function handleSave() {
    setIsSaving(true)
    const payload = {
      shop_id: shopId,
      policy_name: policyName.trim() || 'Standard returns',
      accepts_returns: acceptsReturns,
      accepts_exchanges: acceptsExchanges,
      accepts_refunds: acceptsRefunds,
      return_window_days: Number(windowDays) || 7,
      policy_details: details.trim() || null,
      is_active: true,
      is_default: true,
      updated_at: new Date().toISOString(),
    }

    const { error } = policyId
      ? await supabase.from('return_policies').update(payload).eq('id', policyId)
      : await supabase.from('return_policies').insert(payload).select('id').single()

    setIsSaving(false)
    if (error) {
      toast.show('Could not save returns policy', { tone: 'danger', message: error.message })
      return
    }
    toast.show('Returns policy saved', { tone: 'success' })
  }

  if (isLoading) {
    return (
      <XStack paddingVertical="$4" gap="$2" alignItems="center">
        <Spinner size="small" />
        <Text color={ui.textMuted}>Loading returns policy…</Text>
      </XStack>
    )
  }

  return (
    <YStack gap="$4" maxWidth={560}>
      <Field label="Policy name">
        <Input value={policyName} onChangeText={setPolicyName} />
      </Field>
      <XStack alignItems="center" justifyContent="space-between">
        <Text color={ui.text}>Accept returns</Text>
        <Switch checked={acceptsReturns} onCheckedChange={setAcceptsReturns} />
      </XStack>
      <XStack alignItems="center" justifyContent="space-between">
        <Text color={ui.text}>Accept exchanges</Text>
        <Switch checked={acceptsExchanges} onCheckedChange={setAcceptsExchanges} />
      </XStack>
      <XStack alignItems="center" justifyContent="space-between">
        <Text color={ui.text}>Accept refunds</Text>
        <Switch checked={acceptsRefunds} onCheckedChange={setAcceptsRefunds} />
      </XStack>
      <Field label="Return window (days)">
        <Input value={windowDays} onChangeText={setWindowDays} keyboardType="number-pad" />
      </Field>
      <Field label="Policy details">
        <Input value={details} onChangeText={setDetails} multiline numberOfLines={4} />
      </Field>
      <Button
        tone="primary"
        size="$4"
        borderRadius={999}
        disabled={isSaving}
        onPress={() => void handleSave()}
        icon={isSaving ? <Spinner size="small" color="white" /> : undefined}
      >
        {isSaving ? 'Saving…' : 'Save returns policy'}
      </Button>
    </YStack>
  )
}
