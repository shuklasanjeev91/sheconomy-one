import { useEffect, useRef, useState } from 'react'

import { Icons, Input, XStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'

export function BlogSearch({
  value = '',
  onSearch,
  placeholder = 'Search articles…',
}: {
  value?: string
  onSearch: (value: string) => void
  placeholder?: string
}) {
  const ui = useAppUi()
  const [local, setLocal] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocal(value)
  }, [value])

  function schedule(next: string) {
    setLocal(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onSearch(next), 400)
  }

  return (
    <XStack
      flex={1}
      minWidth={200}
      maxWidth={420}
      alignItems="center"
      gap="$2"
      paddingHorizontal="$3"
      height={44}
      borderRadius={radius.pill}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
    >
      <Icons.Search size={16} color={ui.textMuted} />
      <Input
        flex={1}
        value={local}
        onChangeText={schedule}
        placeholder={placeholder}
        borderWidth={0}
        backgroundColor="transparent"
        onSubmitEditing={() => {
          if (timer.current) clearTimeout(timer.current)
          onSearch(local)
        }}
      />
      {local ? (
        <XStack
          cursor="pointer"
          onPress={() => {
            setLocal('')
            onSearch('')
          }}
          pressStyle={{ opacity: 0.7 }}
        >
          <Icons.X size={16} color={ui.textMuted} />
        </XStack>
      ) : null}
    </XStack>
  )
}
