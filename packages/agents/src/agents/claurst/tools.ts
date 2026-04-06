/**
 * ClauRST tool name mappings
 *
 * Maps ClauRST CLI tool names to canonical tool names.
 * ClauRST is a Rust reimplementation of Claude Code, so it uses similar tool names.
 */

export const CLAURST_TOOL_MAPPINGS: Record<string, string> = {
  // File operations - same as Claude Code
  Write: "write",
  FileWrite: "write",
  Read: "read",
  FileRead: "read",
  Edit: "edit",
  FileEdit: "edit",
  BatchEdit: "edit",
  ApplyPatch: "edit",

  // Search operations
  Glob: "glob",
  GlobTool: "glob",
  Grep: "grep",
  GrepTool: "grep",

  // Shell execution
  Bash: "shell",
  PtyBashTool: "shell",
  PowerShellTool: "shell",

  // Web operations
  WebSearch: "web_search",
  WebSearchTool: "web_search",
  WebFetch: "web_fetch",
  WebFetchTool: "web_fetch",
}
