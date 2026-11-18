import { useCallback, useEffect, useState } from 'react'

import { Badge, Button, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { radius } from '~/config/tokens'
import { supabase } from '~/lib/supabase'
import { readSupabaseFunctionError } from '~/lib/supabase/function-error'

type HubStatus = {
  ok?: boolean
  configured?: boolean
  gatewayConfigured?: boolean
  source?: 'env' | 'database' | null
  clientIdMasked?: string | null
  parentMid?: string | null
  lastVerifiedAt?: string | null
  hint?: string | null
}

export function AdminPayuHubSetup() {
  const toast = useAppToast()
  const [status, setStatus] = useState<HubStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [parentMid, setParentMid] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.functions.invoke<HubStatus>('shepay-hub-config', {
      body: { action: 'status' },
    })
    setLoading(false)
    if (error || data?.ok === false) {
      const message = await readSupabaseFunctionError(error, data, 'Could not load PayU connection.')
      toast.show('PayU connection', { tone: 'danger', message })
      return
    }
    setStatus(data)
    if (data?.parentMid) setParentMid(data.parentMid)
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    setBusy(true)
    const { data, error } = await supabase.functions.invoke<{
      ok?: boolean
      error?: string
      message?: string
      autoRegistered?: number
    }>('shepay-hub-config', {
      body: {
        action: 'save',
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        parentMid: parentMid.trim() || undefined,
      },
    })
    setBusy(false)
    if (error || data?.ok === false) {
      const message = await readSupabaseFunctionError(error, data, 'Could not save PayU Hub credentials.')
      toast.show('Save failed', { tone: 'danger', message })
      return
    }
    const registered = data?.autoRegistered ?? 0
    toast.show('PayU Hub connected', {
      tone: 'success',
      message:
        registered > 0
          ? `Saved. Auto-registered ${registered} seller${registered === 1 ? '' : 's'}.`
          : data?.message || 'Sellers will register automatically on submit.',
    })
    setClientSecret('')
    setShowForm(false)
    await load()
  }

  async function emailKam() {
    setBusy(true)
    const { data, error } = await supabase.functions.invoke<{
      ok?: boolean
      error?: string
      message?: string
    }>('shepay-hub-config', {
      body: { action: 'email_kam' },
    })
    setBusy(false)
    if (error || data?.ok === false) {
      const message = await readSupabaseFunctionError(error, data, 'Could not email PayU.')
      toast.show('Email failed', { tone: 'danger', message })
      return
    }
    toast.show('Emailed PayU', {
      tone: 'success',
      message: data?.message || 'Asked PayU to enable Hub credentials.',
    })
  }

  async function test() {
    setBusy(true)
    const { data, error } = await supabase.functions.invoke<{
      ok?: boolean
      error?: string
      message?: string
    }>('shepay-hub-config', {
      body: { action: 'test' },
    })
    setBusy(false)
    if (error || data?.ok === false) {
      const message = await readSupabaseFunctionError(error, data, 'Connection test failed.')
      toast.show('PayU test failed', { tone: 'danger', message })
      return
    }
    toast.show('PayU Hub OK', { tone: 'success', message: data?.message || 'Ready.' })
    await load()
  }

  if (!loading && status?.configured && !showForm) {
    return (
      <XStack
        alignItems="center"
        gap="$2"
        flexWrap="wrap"
        padding="$3"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor="$borderColor"
        justifyContent="space-between"
      >
        <XStack alignItems="center" gap="$2" flexWrap="wrap" flex={1}>
          <Badge tone="success">PayU Hub connected</Badge>
          <Text fontSize={13} color="$color10">
            {status.clientIdMasked || '••••'} · MID {status.parentMid || '—'}
          </Text>
        </XStack>
        <XStack gap="$2">
          <Button size="$2" tone="outline" disabled={busy} onPress={() => void test()}>
            Test
          </Button>
          <Button size="$2" tone="outline" disabled={busy} onPress={() => setShowForm(true)}>
            Update
          </Button>
        </XStack>
      </XStack>
    )
  }

  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor="$borderColor"
      backgroundColor="$background"
    >
      <XStack alignItems="center" gap="$2" flexWrap="wrap" justifyContent="space-between">
        <XStack alignItems="center" gap="$2" flexWrap="wrap" flex={1}>
          <Text fontWeight="800">PayU seller registration</Text>
          {loading ? (
            <Spinner size="small" />
          ) : (
            <>
              {status?.gatewayConfigured ? (
                <Badge tone="success">Gateway live</Badge>
              ) : (
                <Badge tone="warning">Gateway missing</Badge>
              )}
              <Badge tone="danger">Hub pending</Badge>
            </>
          )}
        </XStack>
        <Button size="$2" tone="outline" disabled={busy || loading} onPress={() => void load()}>
          Refresh
        </Button>
      </XStack>

      <Text fontSize={13} color="$color10" lineHeight={18}>
        {status?.hint ||
          'Checkout already uses your PayU merchant key/salt. Auto-registering sellers as child merchants needs a separate Hub client id/secret from PayU.'}
      </Text>

      <XStack gap="$2" flexWrap="wrap">
        <Button size="$3" tone="primary" disabled={busy} onPress={() => void emailKam()}>
          {busy ? 'Sending…' : 'Email PayU for Hub credentials'}
        </Button>
        <Button size="$3" tone="outline" disabled={busy} onPress={() => setShowForm((v) => !v)}>
          {showForm ? 'Hide paste form' : 'I already have client id/secret'}
        </Button>
      </XStack>

      {showForm ? (
        <YStack gap="$2">
          <Input
            placeholder="Hub client id"
            value={clientId}
            onChangeText={setClientId}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input
            placeholder="Hub client secret"
            value={clientSecret}
            onChangeText={setClientSecret}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Input
            placeholder="Parent MID (optional)"
            value={parentMid}
            onChangeText={setParentMid}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            tone="primary"
            disabled={busy || !clientId.trim() || !clientSecret.trim()}
            onPress={() => void save()}
          >
            {busy ? 'Saving…' : 'Save & auto-register pending sellers'}
          </Button>
        </YStack>
      ) : null}
    </YStack>
  )
}
