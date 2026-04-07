/**
 * Amp Code tool name mappings
 *
 * Maps Amp Code CLI tool names to canonical tool names.
 *
 * Amp Code uses similar tool names to Claude Code since it's based on
 * the Anthropic tool calling convention.
 */

export const AMP_TOOL_MAPPINGS: Record<string, string> = {
  // File operations
  Read: "read",
  read: "read",
  read_file: "read",
  Write: "write",
  write: "write",
  write_file: "write",
  Edit: "edit",
  edit: "edit",
  str_replace_editor: "edit",

  // Search operations
  Glob: "glob",
  glob: "glob",
  list_files: "glob",
  Grep: "grep",
  grep: "grep",
  search: "grep",

  // Shell/command execution
  Bash: "shell",
  bash: "shell",
  shell: "shell",
  execute: "shell",
  run_command: "shell",

  // Web operations
  WebSearch: "web_search",
  web_search: "web_search",
}
