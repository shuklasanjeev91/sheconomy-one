import { useEffect, useState } from 'react'
import { useRouter } from 'one'

import {
  isStockAlertSubscribed,
  subscribeStockAlert,
  unsubscribeStockAlert,
} from '~/commerce/lib/stock-alerts'
import { Button, Icons, Spinner, useAppToast } from '~/components/ui'
import { appRoutes } from '~/lib/routes'
import { useSupabase } from '~/providers/SupabaseProvider'

type StockNotifyButtonProps = {
  listingId: string
  outOfStock: boolean
}

/** marketplace “Notify me when back in stock” control. */
export function StockNotifyButton({ listingId, outOfStock }: StockNotifyButtonProps) {
  const { user } = useSupabase()
  const toast = useAppToast()
  const router = useRouter()
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user?.id || !outOfStock) {
      setSubscribed(false)
      return
    }
    let active = true
    void isStockAlertSubscribed(listingId, user.id).then((value) => {
      if (active) setSubscribed(value)
    })
    return () => {
      active = false
    }
  }, [listingId, user?.id, outOfStock])

  if (!outOfStock) return null

  return (
    <Button
      tone={subscribed ? 'outline' : 'primary'}
      size="$3"
      borderRadius={999}
      icon={
        loading ? (
          <Spinner size="small" />
        ) : (
          <Icons.Bell size={15} />
        )
      }
      disabled={loading}
      onPress={async () => {
        if (!user?.id) {
          toast.show('Sign in to get alerts', {
            tone: 'default',
            message: 'We will notify you when this item is back.',
          })
          router.push(appRoutes.signIn)
          return
        }
        setLoading(true)
        if (subscribed) {
          const { error } = await unsubscribeStockAlert(listingId, user.id)
          setLoading(false)
          if (error) {
            toast.show('Could not update alert', { tone: 'danger', message: error })
            return
          }
          setSubscribed(false)
          toast.show('Alert removed', { tone: 'default' })
          return
        }
        const { error } = await subscribeStockAlert(listingId, user.id)
        setLoading(false)
        if (error) {
          toast.show('Could not set alert', { tone: 'danger', message: error })
          return
        }
        setSubscribed(true)
        toast.show('We will notify you', {
          tone: 'success',
          message: 'You will get an alert when this item is back in stock.',
        })
      }}
    >
      {subscribed ? 'Subscribed for restock' : 'Notify me when available'}
    </Button>
  )
}
