import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { resolveOnline } from '~/lib/connectivity/resolve-online'

type ConnectivityContextValue = {
  isOnline: boolean
  isInternetReachable: boolean | null
  /** True briefly after reconnecting so screens can retry stale work. */
  justReconnected: boolean
  subscribeReconnect: (listener: () => void) => () => void
}

const ConnectivityContext = createContext<ConnectivityContextValue>({
  isOnline: true,
  isInternetReachable: true,
  justReconnected: false,
  subscribeReconnect: () => () => {},
})

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true)
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(true)
  const [justReconnected, setJustReconnected] = useState(false)
  const wasOfflineRef = useRef(false)
  const listenersRef = useRef(new Set<() => void>())
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const notifyReconnect = useCallback(() => {
    listenersRef.current.forEach((listener) => {
      try {
        listener()
      } catch {
        // Ignore listener failures so one bad subscriber cannot block others.
      }
    })
  }, [])

  const subscribeReconnect = useCallback((listener: () => void) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  useEffect(() => {
    const applyState = (state: NetInfoState) => {
      const online = resolveOnline(state)
      setIsOnline(online)
      setIsInternetReachable(state.isInternetReachable)

      if (!online) {
        wasOfflineRef.current = true
        setJustReconnected(false)
        return
      }

      if (wasOfflineRef.current) {
        wasOfflineRef.current = false
        setJustReconnected(true)
        notifyReconnect()

        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = setTimeout(() => setJustReconnected(false), 2500)
      }
    }

    const unsubscribe = NetInfo.addEventListener(applyState)
    void NetInfo.fetch().then(applyState)

    return () => {
      unsubscribe()
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    }
  }, [notifyReconnect])

  const value = useMemo(
    () => ({
      isOnline,
      isInternetReachable,
      justReconnected,
      subscribeReconnect,
    }),
    [isInternetReachable, isOnline, justReconnected, subscribeReconnect],
  )

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>
}

export function useConnectivity() {
  return useContext(ConnectivityContext)
}

/** Subscribe a callback that runs whenever connectivity returns. */
export function useOnReconnect(callback: () => void) {
  const { subscribeReconnect } = useConnectivity()
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    return subscribeReconnect(() => callbackRef.current())
  }, [subscribeReconnect])
}
