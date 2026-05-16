import type { Message } from "@/lib/types"

/**
 * Check if a chat has a successful merge message after the last user message.
 * Used to show a checkmark in the sidebar for merged chats.
 */
export function hasMergedSuccessfully(messages: Message[]): boolean {
  // Find index of the last user message
  let lastUserMessageIndex = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserMessageIndex = i
      break
    }
  }

  // Look for a successful merge message after the last user message
  const startIndex = lastUserMessageIndex + 1
  for (let i = startIndex; i < messages.length; i++) {
    const msg = messages[i]
    if (
      msg.messageType === "git-operation" &&
      !msg.isError &&
      /^(Squash )?[Mm]erged .+ into .+\.$/.test(msg.content)
    ) {
      return true
    }
  }

  return false
}
