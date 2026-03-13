import { prisma } from "@/lib/prisma"

/**
 * Agent Events Storage Service
 *
 * Stores streaming events in the database for SSE delivery.
 * Supports multiple clients reading the same execution stream.
 *
 * Features:
 * - Buffered writes for efficiency (flush every 500ms or 10 events)
 * - Sequential event indexing for resumption
 * - Automatic cleanup after execution completes
 */

// In-memory buffers for batching writes
const eventBuffers = new Map<string, Array<{ type: string; data: object }>>()
const flushIntervals = new Map<string, NodeJS.Timeout>()
const eventCounters = new Map<string, number>()

/**
 * Append an event to the execution's event stream.
 * Events are buffered and flushed periodically for efficiency.
 */
export async function appendEvent(
  executionId: string,
  type: string,
  data: object
): Promise<number> {
  // Get or create buffer
  let buffer = eventBuffers.get(executionId)
  if (!buffer) {
    buffer = []
    eventBuffers.set(executionId, buffer)

    // Initialize counter from DB
    const lastEvent = await prisma.agentEvent.findFirst({
      where: { executionId },
      orderBy: { eventIndex: "desc" },
      select: { eventIndex: true },
    })
    eventCounters.set(executionId, lastEvent?.eventIndex ?? 0)

    // Start flush interval (every 500ms)
    const interval = setInterval(() => {
      flushEvents(executionId).catch(console.error)
    }, 500)
    flushIntervals.set(executionId, interval)
  }

  buffer.push({ type, data })

  // Increment counter and get this event's index
  const currentCount = eventCounters.get(executionId) ?? 0
  const newIndex = currentCount + buffer.length

  // Flush immediately if buffer is large
  if (buffer.length >= 10) {
    await flushEvents(executionId)
  }

  return newIndex
}

/**
 * Flush buffered events to the database.
 * Called periodically and on completion.
 */
export async function flushEvents(executionId: string): Promise<void> {
  const buffer = eventBuffers.get(executionId)
  if (!buffer || buffer.length === 0) return

  // Get base index for this batch
  const baseIndex = (eventCounters.get(executionId) ?? 0) + 1

  // Batch insert
  try {
    await prisma.agentEvent.createMany({
      data: buffer.map((event, i) => ({
        executionId,
        eventIndex: baseIndex + i,
        type: event.type,
        data: event.data,
      })),
    })

    // Update counter
    eventCounters.set(executionId, baseIndex + buffer.length - 1)

    // Clear buffer
    buffer.length = 0
  } catch (error) {
    console.error(`Failed to flush events for execution ${executionId}:`, error)
    throw error
  }
}

/**
 * Get events after a given index.
 * Used for catchup and streaming.
 */
export async function getEvents(
  executionId: string,
  afterIndex: number = 0
): Promise<Array<{ eventIndex: number; type: string; data: unknown }>> {
  // First flush any pending events to ensure consistency
  await flushEvents(executionId)

  const events = await prisma.agentEvent.findMany({
    where: {
      executionId,
      eventIndex: { gt: afterIndex },
    },
    orderBy: { eventIndex: "asc" },
    select: {
      eventIndex: true,
      type: true,
      data: true,
    },
  })

  return events
}

/**
 * Get the latest event index for an execution.
 * Returns 0 if no events exist.
 */
export async function getLatestEventIndex(executionId: string): Promise<number> {
  // Check buffer first
  const bufferCount = eventBuffers.get(executionId)?.length ?? 0
  const counterValue = eventCounters.get(executionId) ?? 0

  if (bufferCount > 0 || counterValue > 0) {
    return counterValue + bufferCount
  }

  // Fall back to DB
  const lastEvent = await prisma.agentEvent.findFirst({
    where: { executionId },
    orderBy: { eventIndex: "desc" },
    select: { eventIndex: true },
  })

  return lastEvent?.eventIndex ?? 0
}

/**
 * Cleanup events for an execution.
 * Called after execution completes and clients have received the complete event.
 */
export async function cleanupEvents(executionId: string): Promise<void> {
  // Stop flush interval
  const interval = flushIntervals.get(executionId)
  if (interval) {
    clearInterval(interval)
    flushIntervals.delete(executionId)
  }

  // Clear buffer and counter
  eventBuffers.delete(executionId)
  eventCounters.delete(executionId)

  // Delete from DB (events are preserved in final message content)
  try {
    await prisma.agentEvent.deleteMany({
      where: { executionId },
    })
  } catch (error) {
    console.error(`Failed to cleanup events for execution ${executionId}:`, error)
  }
}

/**
 * Check if an execution has any events (buffered or in DB).
 */
export async function hasEvents(executionId: string): Promise<boolean> {
  const bufferCount = eventBuffers.get(executionId)?.length ?? 0
  if (bufferCount > 0) return true

  const count = await prisma.agentEvent.count({
    where: { executionId },
  })

  return count > 0
}
