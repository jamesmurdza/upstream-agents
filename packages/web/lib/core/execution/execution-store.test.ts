/**
 * Tests for execution store and polling manager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock AudioContext
global.AudioContext = vi.fn().mockImplementation(() => ({
  createOscillator: () => ({
    connect: vi.fn(),
    frequency: { value: 0 },
    type: '',
    start: vi.fn(),
    stop: vi.fn(),
  }),
  createGain: () => ({
    connect: vi.fn(),
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
  }),
  destination: {},
  currentTime: 0,
})) as unknown as typeof AudioContext

// Import after mocking
import {
  useExecutionStore,
  startPollingManager,
  stopPollingManager,
} from '@/lib/stores/execution-store'

describe('execution-store', () => {
  beforeEach(() => {
    // Reset store state
    useExecutionStore.setState({
      activeExecutions: new Map(),
      activeBranchId: null,
      callbacks: {
        onUpdateMessage: null,
        onUpdateBranch: null,
        onAddMessage: null,
        onForceSave: null,
        onCommitsDetected: null,
        onRefreshGitConflictState: null,
      },
    })
    mockFetch.mockReset()
    stopPollingManager()
  })

  afterEach(() => {
    stopPollingManager()
  })

  describe('startExecution', () => {
    it('should add execution to activeExecutions map', () => {
      const store = useExecutionStore.getState()

      store.startExecution({
        messageId: 'msg-1',
        executionId: 'exec-1',
        branchId: 'branch-1',
        sandboxId: 'sandbox-1',
        repoName: 'test-repo',
        repoOwner: 'owner',
        repoApiName: 'test-repo',
        branchName: 'main',
        lastShownCommitHash: null,
        messages: [],
      })

      const state = useExecutionStore.getState()
      expect(state.activeExecutions.has('msg-1')).toBe(true)

      const execution = state.activeExecutions.get('msg-1')
      expect(execution?.branchId).toBe('branch-1')
      expect(execution?.notFoundRetries).toBe(0)
      expect(execution?.completionHandled).toBe(false)
    })
  })

  describe('setCallbacks', () => {
    it('should store callbacks that can be retrieved later', () => {
      const store = useExecutionStore.getState()
      const mockUpdateMessage = vi.fn()

      store.setCallbacks({
        onUpdateMessage: mockUpdateMessage,
      })

      const state = useExecutionStore.getState()
      expect(state.callbacks.onUpdateMessage).toBe(mockUpdateMessage)
    })
  })

  describe('callbacks are called with fresh state', () => {
    it('should use latest callbacks even when set after execution starts', async () => {
      const store = useExecutionStore.getState()

      // Start execution BEFORE setting callbacks (simulates race condition)
      store.startExecution({
        messageId: 'msg-1',
        executionId: 'exec-1',
        branchId: 'branch-1',
        sandboxId: 'sandbox-1',
        repoName: 'test-repo',
        repoOwner: 'owner',
        repoApiName: 'test-repo',
        branchName: 'main',
        lastShownCommitHash: null,
        messages: [],
      })

      // Mock successful poll response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'running',
          snapshotVersion: 1,
          content: 'Hello world',
          toolCalls: [],
          contentBlocks: [],
        }),
      })

      // Set callbacks AFTER execution started (this is what happens in React)
      const mockUpdateMessage = vi.fn()
      store.setCallbacks({
        onUpdateMessage: mockUpdateMessage,
      })

      // Start polling and wait for one cycle
      startPollingManager()

      // Wait for poll to complete
      await new Promise(resolve => setTimeout(resolve, 600))

      // Callback should have been called with the content
      expect(mockUpdateMessage).toHaveBeenCalledWith(
        'branch-1',
        'msg-1',
        expect.objectContaining({
          content: 'Hello world',
        })
      )
    })
  })

  describe('isStreaming', () => {
    it('should return true for active executions', () => {
      const store = useExecutionStore.getState()

      store.startExecution({
        messageId: 'msg-1',
        executionId: 'exec-1',
        branchId: 'branch-1',
        sandboxId: 'sandbox-1',
        repoName: 'test-repo',
        repoOwner: 'owner',
        repoApiName: 'test-repo',
        branchName: 'main',
        lastShownCommitHash: null,
        messages: [],
      })

      expect(store.isStreaming('msg-1')).toBe(true)
      expect(store.isStreaming('msg-2')).toBe(false)
    })
  })

  describe('clearExecution', () => {
    it('should remove execution from map', () => {
      const store = useExecutionStore.getState()

      store.startExecution({
        messageId: 'msg-1',
        executionId: 'exec-1',
        branchId: 'branch-1',
        sandboxId: 'sandbox-1',
        repoName: 'test-repo',
        repoOwner: 'owner',
        repoApiName: 'test-repo',
        branchName: 'main',
        lastShownCommitHash: null,
        messages: [],
      })

      expect(store.isStreaming('msg-1')).toBe(true)

      store.clearExecution('msg-1')

      expect(store.isStreaming('msg-1')).toBe(false)
    })
  })
})
