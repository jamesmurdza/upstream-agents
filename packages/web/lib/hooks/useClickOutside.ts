"use client"

import { useEffect, useRef, RefObject } from "react"

interface UseClickOutsideOptions<T extends HTMLElement> {
  /** Callback when clicking outside the element */
  onClickOutside: () => void
  /** Whether the click-outside detection is active. Default: true */
  enabled?: boolean
  /** Optional existing ref to use instead of creating a new one */
  ref?: RefObject<T | null>
}

interface UseClickOutsideResult<T extends HTMLElement> {
  /** Ref to attach to the element you want to detect clicks outside of */
  ref: RefObject<T | null>
}

/**
 * Hook for detecting clicks outside of an element.
 * Commonly used for closing dropdown menus, modals, and popovers.
 *
 * Usage:
 * ```tsx
 * const [menuOpen, setMenuOpen] = useState(false)
 * const { ref } = useClickOutside<HTMLDivElement>({
 *   onClickOutside: () => setMenuOpen(false),
 *   enabled: menuOpen,
 * })
 *
 * return (
 *   <div ref={ref}>
 *     <button onClick={() => setMenuOpen(true)}>Open Menu</button>
 *     {menuOpen && <div>Menu content</div>}
 *   </div>
 * )
 * ```
 */
export function useClickOutside<T extends HTMLElement = HTMLDivElement>({
  onClickOutside,
  enabled = true,
  ref: externalRef,
}: UseClickOutsideOptions<T>): UseClickOutsideResult<T> {
  const internalRef = useRef<T>(null)
  const ref = externalRef ?? internalRef

  useEffect(() => {
    if (!enabled) return

    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClickOutside()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [enabled, onClickOutside, ref])

  return { ref }
}
