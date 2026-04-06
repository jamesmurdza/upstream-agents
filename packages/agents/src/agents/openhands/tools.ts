/**
 * OpenHands tool name mappings
 *
 * Maps OpenHands CLI tool names to canonical tool names.
 */

export const OPENHANDS_TOOL_MAPPINGS: Record<string, string> = {
  // File operations
  write: "write",
  read: "read",
  edit: "edit",
  str_replace_editor: "edit",
  // Shell/command execution
  run: "shell",
  bash: "shell",
  execute_bash: "shell",
  // Search operations
  find_file: "glob",
  search_dir: "grep",
  search_file: "grep",
  // Web operations
  browse: "web_search",
  web_browse: "web_search",
}
