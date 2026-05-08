import { useState, useCallback } from "react"

/**
 * Hook to manage paired dropdown/sheet state for desktop/mobile UI patterns.
 * Consolidates the common pattern of having separate state for:
 * - Desktop dropdown visibility
 * - Mobile bottom sheet visibility
 *
 * This replaces the duplicated pattern:
 * ```
 * const [showDropdown, setShowDropdown] = useState(false)
 * const [showSheet, setShowSheet] = useState(false)
 * ```
 *
 * @returns Object with state and handlers for both desktop and mobile views
 */
export function useDropdownPair() {
  const [showDropdown, setShowDropdown] = useState(false)
  const [showSheet, setShowSheet] = useState(false)

  /**
   * Toggle the desktop dropdown, optionally closing another dropdown
   */
  const toggleDropdown = useCallback((closeOther?: () => void) => {
    setShowDropdown((prev) => !prev)
    closeOther?.()
  }, [])

  /**
   * Close both dropdown and sheet
   */
  const close = useCallback(() => {
    setShowDropdown(false)
    setShowSheet(false)
  }, [])

  /**
   * Open the mobile sheet
   */
  const openSheet = useCallback(() => {
    setShowSheet(true)
  }, [])

  /**
   * Close just the dropdown (for click-outside handlers)
   */
  const closeDropdown = useCallback(() => {
    setShowDropdown(false)
  }, [])

  /**
   * Close just the sheet
   */
  const closeSheet = useCallback(() => {
    setShowSheet(false)
  }, [])

  return {
    // State
    showDropdown,
    showSheet,
    // Setters (for advanced use cases)
    setShowDropdown,
    setShowSheet,
    // Convenience methods
    toggleDropdown,
    openSheet,
    close,
    closeDropdown,
    closeSheet,
  }
}

/**
 * Hook to manage multiple dropdown pairs with mutual exclusion.
 * When one dropdown opens, others are closed.
 *
 * @param count Number of dropdown pairs to manage
 * @returns Array of dropdown pair state/handlers
 */
export function useDropdownPairGroup<K extends string>(keys: K[]) {
  const [state, setState] = useState<Record<K, { dropdown: boolean; sheet: boolean }>>(() => {
    const initial = {} as Record<K, { dropdown: boolean; sheet: boolean }>
    for (const key of keys) {
      initial[key] = { dropdown: false, sheet: false }
    }
    return initial
  })

  const toggleDropdown = useCallback((key: K) => {
    setState((prev) => {
      const next = { ...prev }
      // Close all dropdowns
      for (const k of keys) {
        next[k] = { ...next[k], dropdown: false }
      }
      // Toggle the requested one
      next[key] = { ...next[key], dropdown: !prev[key].dropdown }
      return next
    })
  }, [keys])

  const openSheet = useCallback((key: K) => {
    setState((prev) => ({
      ...prev,
      [key]: { ...prev[key], sheet: true },
    }))
  }, [])

  const closeSheet = useCallback((key: K) => {
    setState((prev) => ({
      ...prev,
      [key]: { ...prev[key], sheet: false },
    }))
  }, [])

  const close = useCallback((key: K) => {
    setState((prev) => ({
      ...prev,
      [key]: { dropdown: false, sheet: false },
    }))
  }, [])

  const closeAllDropdowns = useCallback(() => {
    setState((prev) => {
      const next = { ...prev }
      for (const k of keys) {
        next[k] = { ...next[k], dropdown: false }
      }
      return next
    })
  }, [keys])

  return {
    state,
    toggleDropdown,
    openSheet,
    closeSheet,
    close,
    closeAllDropdowns,
  }
}
