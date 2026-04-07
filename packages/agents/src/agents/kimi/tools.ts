/**
 * Kimi Code CLI tool name mappings
 *
 * Maps Kimi CLI tool names to canonical tool names.
 * Kimi uses tool names like Shell, Read, Write, Edit, Glob, Grep.
 */

export const KIMI_TOOL_MAPPINGS: Record<string, string> = {
  // Shell/command execution
  Shell: "shell",
  shell: "shell",

  // File operations
  Read: "read",
  read: "read",
  Write: "write",
  write: "write",
  Edit: "edit",
  edit: "edit",

  // Search operations
  Glob: "glob",
  glob: "glob",
  Grep: "grep",
  grep: "grep",

  // Web search (if supported)
  WebSearch: "web_search",
  web_search: "web_search",
}
