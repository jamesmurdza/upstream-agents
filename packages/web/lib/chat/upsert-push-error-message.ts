import type { Message, PushErrorInfo } from "@/lib/shared/types"
import { ASSISTANT_SOURCE } from "@/lib/shared/constants"

/**
 * Ensures at most one push-error retry block in the thread: updates the latest
 * message that already has pushError, or adds a new system message.
 * Older push-error messages are cleared so duplicate retry UI does not stack.
 */
export async function upsertPushErrorSystemMessage(
  branchId: string,
  messages: Message[],
  content: string,
  pushError: PushErrorInfo,
  opts: {
    onUpdateMessage: (branchId: string, messageId: string, updates: Partial<Message>) => void | Promise<void>
    onAddMessage: (branchId: string, message: Message) => Promise<string>
    generateId: () => string
  }
): Promise<void> {
  const withPush = messages.filter((m) => m.pushError != null)
  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  if (withPush.length === 0) {
    await opts.onAddMessage(branchId, {
      id: opts.generateId(),
      role: "assistant",
      assistantSource: ASSISTANT_SOURCE.SYSTEM,
      content,
      timestamp,
      pushError,
    })
    return
  }

  const last = withPush[withPush.length - 1]!
  for (const m of withPush.slice(0, -1)) {
    await Promise.resolve(opts.onUpdateMessage(branchId, m.id, { content: "", pushError: undefined }))
  }
  await Promise.resolve(
    opts.onUpdateMessage(branchId, last.id, { content, pushError, timestamp })
  )
}
