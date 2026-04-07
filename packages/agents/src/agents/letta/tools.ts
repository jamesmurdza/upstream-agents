/**
 * Letta Code tool name mappings
 *
 * Maps Letta Code CLI tool names to canonical tool names.
 *
 * Letta Code uses tool calling with approval request messages
 * that contain tool_call objects with name and arguments.
 */

export const LETTA_TOOL_MAPPINGS: Record<string, string> = {
  // File operations
  read_file: "read",
  Read: "read",
  read: "read",
  write_file: "write",
  Write: "write",
  write: "write",
  edit_file: "edit",
  Edit: "edit",
  edit: "edit",
  str_replace_editor: "edit",

  // Search operations
  list_files: "glob",
  Glob: "glob",
  glob: "glob",
  search_files: "grep",
  Grep: "grep",
  grep: "grep",
  search: "grep",

  // Shell/command execution
  run_command: "shell",
  execute_command: "shell",
  shell: "shell",
  Bash: "shell",
  bash: "shell",
  terminal: "shell",

  // Web operations
  web_search: "web_search",
  WebSearch: "web_search",
  browse_web: "web_search",
}
