/**
 * Unified file preview library
 *
 * This module provides shared components and utilities for previewing files
 * across different contexts (uploaded files in chat, sidebar file viewer, etc.)
 */

// Types
export type { FileType } from './types'
export { EXT_TO_LANG, CODE_EXTENSIONS, TEXT_EXTENSIONS } from './types'

// Detection utilities
export {
  getFileExtension,
  getFilename,
  detectLang,
  getFileType,
  getFileTypeFromPath,
  isTextBasedFile,
  isTextBasedPath,
} from './detect'

// Code/text preview components
export { HighlightedCode, SimpleCodeView } from './HighlightedCode'

// Image preview components
export { ImageThumbnail, ImageFullPreview } from './ImagePreview'

// PDF preview components
export { PdfThumbnail, PdfFullPreview } from './PdfPreview'

// Text thumbnail component
export { TextThumbnail } from './TextThumbnail'
