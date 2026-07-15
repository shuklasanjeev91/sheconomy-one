import { Slot } from 'one'

import { ChatActionsHost } from '~/chat/components/ChatActionsHost'

export default function ChatLayout() {
  return (
    <>
      <Slot />
      <ChatActionsHost />
    </>
  )
}