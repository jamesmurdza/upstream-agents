"use client"

import { useRef, useEffect } from "react"

interface TextThumbnailProps {
  /** The text content to render */
  content: string
  /** Filename (used to show extension badge) */
  filename: string
  /** Thumbnail size in pixels (default: 108) */
  size?: number
  /** Additional className */
  className?: string
}

/**
 * High-DPI text thumbnail that renders text to canvas.
 * Shows a preview of the first few lines with an extension badge.
 */
export function TextThumbnail({ content, filename, size = 108, className }: TextThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ext = filename.split('.').pop()?.toUpperCase() || 'TXT'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    const dpr = window.devicePixelRatio || 1
    const padding = 6
    const fontSize = 9
    const lineHeight = fontSize * 1.3
    const badgePadding = 4

    // Set canvas size accounting for device pixel ratio
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`

    // Scale context for high-DPI
    context.scale(dpr, dpr)

    // Fill background
    context.fillStyle = '#f5f5f5'
    context.fillRect(0, 0, size, size)

    // Set up text rendering
    context.fillStyle = '#666666'
    context.font = `${fontSize}px ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`
    context.textBaseline = 'top'

    // Calculate available space
    const maxWidth = size - padding * 2
    const maxLines = Math.floor((size - padding * 2 - 16) / lineHeight) // Leave space for badge

    // Split content into lines that fit
    const lines: string[] = []
    const contentLines = content.split('\n')

    for (const line of contentLines) {
      if (lines.length >= maxLines) break

      if (line.length === 0) {
        lines.push('')
        continue
      }

      // Word wrap long lines
      let remaining = line
      while (remaining.length > 0 && lines.length < maxLines) {
        let end = remaining.length
        while (context.measureText(remaining.slice(0, end)).width > maxWidth && end > 1) {
          end--
        }
        lines.push(remaining.slice(0, end))
        remaining = remaining.slice(end)
      }
    }

    // Draw text lines
    lines.forEach((line, i) => {
      context.fillText(line, padding, padding + i * lineHeight, maxWidth)
    })

    // Draw extension badge
    const badgeText = ext
    context.font = `bold ${fontSize}px system-ui, sans-serif`
    const badgeWidth = context.measureText(badgeText).width + badgePadding * 2
    const badgeHeight = fontSize + badgePadding
    const badgeX = size - badgeWidth - 4
    const badgeY = size - badgeHeight - 4

    context.fillStyle = 'rgba(255, 255, 255, 0.9)'
    context.beginPath()
    context.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 3)
    context.fill()

    context.fillStyle = '#666666'
    context.fillText(badgeText, badgeX + badgePadding, badgeY + badgePadding / 2)
  }, [content, filename, ext, size])

  return (
    <canvas
      ref={canvasRef}
      className={className || "w-full h-full"}
    />
  )
}
