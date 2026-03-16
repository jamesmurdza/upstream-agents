"use client"

import { useState, useCallback } from "react"
import type { Settings } from "./types"
import { defaultSettings } from "./types"

const SETTINGS_KEY = "agenthub:settings"
const REPO_ORDER_KEY = "agenthub:repo-order"

function loadFromLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function saveToLocalStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage errors
  }
}

export function useSettings() {
  const [settings, setSettingsRaw] = useState<Settings>(() => {
    return { ...defaultSettings, ...loadFromLocalStorage(SETTINGS_KEY, defaultSettings) }
  })

  const setSettings = useCallback((newSettings: Settings) => {
    setSettingsRaw(newSettings)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings))
  }, [])

  return { settings, setSettings }
}

/**
 * Loads the saved repo order from localStorage
 * Returns an array of repo IDs in the saved order, or empty array if none saved
 */
export function loadRepoOrder(): string[] {
  return loadFromLocalStorage<string[]>(REPO_ORDER_KEY, [])
}

/**
 * Saves the repo order to localStorage
 * @param repoIds - Array of repo IDs in the desired order
 */
export function saveRepoOrder(repoIds: string[]): void {
  saveToLocalStorage(REPO_ORDER_KEY, repoIds)
}

/**
 * Applies saved repo order to an array of repos
 * Repos not in the saved order are appended at the end (preserving their relative order)
 * @param repos - Array of repos with id property
 * @returns Repos sorted according to saved order
 */
export function applyRepoOrder<T extends { id: string }>(repos: T[]): T[] {
  const savedOrder = loadRepoOrder()
  if (savedOrder.length === 0) return repos

  // Create a map of id -> position in saved order
  const orderMap = new Map(savedOrder.map((id, index) => [id, index]))

  // Separate repos into those with saved order and those without
  const withOrder: T[] = []
  const withoutOrder: T[] = []

  for (const repo of repos) {
    if (orderMap.has(repo.id)) {
      withOrder.push(repo)
    } else {
      withoutOrder.push(repo)
    }
  }

  // Sort repos with saved order by their position
  withOrder.sort((a, b) => {
    const posA = orderMap.get(a.id) ?? 0
    const posB = orderMap.get(b.id) ?? 0
    return posA - posB
  })

  // Append repos without saved order at the end
  return [...withOrder, ...withoutOrder]
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
