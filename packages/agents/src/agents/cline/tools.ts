/**
 * Cline tool name mappings
 *
 * Maps Cline tool names to canonical tool names.
 * Cline uses similar tool names to Claude Code since it's based on Claude.
 */

export const CLINE_TOOL_MAPPINGS: Record<string, string> = {
  // File operations
  read_file: "read",
  read: "read",
  write_to_file: "write",
  write_file: "write",
  write: "write",
  replace_in_file: "edit",
  edit: "edit",
  apply_diff: "edit",
  insert_code_block: "edit",

  // Search operations
  list_files: "glob",
  list_files_top_level: "glob",
  list_dir: "glob",
  search_files: "grep",
  search: "grep",
  grep: "grep",

  // Shell operations
  execute_command: "shell",
  run_command: "shell",
  bash: "shell",
  shell: "shell",
  terminal: "shell",

  // Browser/web operations
  browser_action: "web_search",
  web_search: "web_search",

  // MCP tool names (common across agents)
  mcp_read: "read",
  mcp_write: "write",
  mcp_edit: "edit",
  mcp_glob: "glob",
  mcp_grep: "grep",
  mcp_shell: "shell",
}

/**
 * Normalize Cline tool name to canonical form.
 */
export function normalizeClineToolName(toolName: string): string {
  const lower = toolName.toLowerCase()
  return CLINE_TOOL_MAPPINGS[lower] ?? lower
}
