import {
  useDebugValue,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'

const objectIs = typeof Object.is === 'function' ? Object.is : is

function is(x: unknown, y: unknown) {
  return (x === y && (x !== 0 || 1 / (x as number) === 1 / (y as number))) || (x !== x && y !== y)
}

export function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: undefined | null | (() => Snapshot),
  selector: (snapshot: Snapshot) => Selection,
  isEqual?: (a: Selection, b: Selection) => boolean,
) {
  const instRef = useRef<{ hasValue: boolean; value: Selection | null } | null>(null)
  let inst = instRef.current

  if (inst === null) {
    inst = { hasValue: false, value: null }
    instRef.current = inst
  }
  const storeInst = inst

  const [getSelection, getServerSelection] = useMemo(() => {
    let hasMemo = false
    let memoizedSnapshot: Snapshot
    let memoizedSelection: Selection

    function memoizedSelector(nextSnapshot: Snapshot) {
      if (!hasMemo) {
        hasMemo = true
        memoizedSnapshot = nextSnapshot
        const nextSelection = selector(nextSnapshot)

        if (isEqual !== undefined && storeInst.hasValue && isEqual(storeInst.value as Selection, nextSelection)) {
          memoizedSelection = storeInst.value as Selection
          return memoizedSelection
        }

        memoizedSelection = nextSelection
        return memoizedSelection
      }

      if (objectIs(memoizedSnapshot, nextSnapshot)) {
        return memoizedSelection
      }

      const nextSelection = selector(nextSnapshot)
      if (isEqual !== undefined && isEqual(memoizedSelection, nextSelection)) {
        memoizedSnapshot = nextSnapshot
        return memoizedSelection
      }

      memoizedSnapshot = nextSnapshot
      memoizedSelection = nextSelection
      return nextSelection
    }

    const getSnapshotWithSelector = () => memoizedSelector(getSnapshot())
    const getServerSnapshotWithSelector =
      getServerSnapshot == null ? undefined : () => memoizedSelector(getServerSnapshot())

    return [getSnapshotWithSelector, getServerSnapshotWithSelector] as const
  }, [getSnapshot, getServerSnapshot, selector, isEqual, storeInst])

  const value = useSyncExternalStore(subscribe, getSelection, getServerSelection)

  useEffect(() => {
    storeInst.hasValue = true
    storeInst.value = value
  }, [storeInst, value])

  useDebugValue(value)
  return value
}
