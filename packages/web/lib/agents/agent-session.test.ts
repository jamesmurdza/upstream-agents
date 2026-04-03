import { describe, it, expect, vi } from 'vitest'

// Mock the prisma client before importing agent-session
vi.mock('@/lib/db/prisma', () => ({
  prisma: {},
}))

import { buildContentBlocks, mapToolName } from './agent-session'

describe('mapToolName', () => {
  it('maps lowercase sdk tool names to display names', () => {
    expect(mapToolName('read')).toBe('Read')
    expect(mapToolName('write')).toBe('Write')
    expect(mapToolName('edit')).toBe('Edit')
    expect(mapToolName('shell')).toBe('Bash')
    expect(mapToolName('bash')).toBe('Bash')
    expect(mapToolName('glob')).toBe('Glob')
    expect(mapToolName('grep')).toBe('Grep')
  })

  it('returns original name for unknown tools', () => {
    expect(mapToolName('unknown_tool')).toBe('unknown_tool')
  })
})

describe('buildContentBlocks', () => {
  it('extracts filePath from Read tool events', () => {
    const events = [
      { type: 'tool_start', name: 'read', input: { file_path: '/home/user/repo/file.ts' } },
      { type: 'tool_end', output: 'file contents' },
    ]

    const result = buildContentBlocks(events)

    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls[0].tool).toBe('Read')
    expect(result.toolCalls[0].summary).toBe('Read: file.ts')
    expect(result.toolCalls[0].fullSummary).toBe('Read: /home/user/repo/file.ts')
    expect(result.toolCalls[0].filePath).toBe('/home/user/repo/file.ts')
  })

  it('extracts filePath from Edit tool events', () => {
    const events = [
      { type: 'tool_start', name: 'edit', input: { file_path: '/home/user/repo/src/component.tsx' } },
      { type: 'tool_end', output: 'edited' },
    ]

    const result = buildContentBlocks(events)

    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls[0].tool).toBe('Edit')
    expect(result.toolCalls[0].filePath).toBe('/home/user/repo/src/component.tsx')
  })

  it('extracts filePath from Write tool events', () => {
    const events = [
      { type: 'tool_start', name: 'write', input: { file_path: '/home/user/repo/new-file.js' } },
      { type: 'tool_end', output: 'written' },
    ]

    const result = buildContentBlocks(events)

    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls[0].tool).toBe('Write')
    expect(result.toolCalls[0].filePath).toBe('/home/user/repo/new-file.js')
  })

  it('does not set filePath for non-file tools like Bash', () => {
    const events = [
      { type: 'tool_start', name: 'shell', input: { command: 'npm install' } },
      { type: 'tool_end', output: 'success' },
    ]

    const result = buildContentBlocks(events)

    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls[0].tool).toBe('Bash')
    expect(result.toolCalls[0].filePath).toBeUndefined()
  })

  it('includes filePath in contentBlocks', () => {
    const events = [
      { type: 'token', text: 'Let me read the file.' },
      { type: 'tool_start', name: 'read', input: { file_path: '/home/user/repo/file.ts' } },
      { type: 'tool_end', output: 'file contents' },
    ]

    const result = buildContentBlocks(events)

    expect(result.contentBlocks).toHaveLength(2)
    expect(result.contentBlocks[0].type).toBe('text')
    expect(result.contentBlocks[1].type).toBe('tool_calls')

    const toolCallsBlock = result.contentBlocks[1]
    if (toolCallsBlock.type === 'tool_calls') {
      expect(toolCallsBlock.toolCalls[0].filePath).toBe('/home/user/repo/file.ts')
    }
  })

  it('handles file in root directory (no fullSummary needed)', () => {
    const events = [
      { type: 'tool_start', name: 'read', input: { file_path: 'file.ts' } },
      { type: 'tool_end', output: 'contents' },
    ]

    const result = buildContentBlocks(events)

    expect(result.toolCalls[0].summary).toBe('Read: file.ts')
    expect(result.toolCalls[0].fullSummary).toBeUndefined()
    expect(result.toolCalls[0].filePath).toBe('file.ts')
  })
})
