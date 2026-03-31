#!/bin/bash

# Run background method tests for different providers
# Usage: ./run-all.sh <provider> [test-number]
# Examples:
#   ./run-all.sh codex        # Run all Codex tests
#   ./run-all.sh claude 1     # Run only SSH test for Claude
#   ./run-all.sh all          # Run all providers, all tests

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check for required env vars
check_env() {
  if [ -z "$DAYTONA_API_KEY" ]; then
    echo "Error: DAYTONA_API_KEY is not set"
    exit 1
  fi
}

check_codex_env() {
  if [ -z "$OPENAI_API_KEY" ]; then
    echo "Error: OPENAI_API_KEY is not set (required for Codex)"
    exit 1
  fi
}

check_claude_env() {
  if [ -z "$TEST_ANTHROPIC_API_KEY" ]; then
    echo "Error: TEST_ANTHROPIC_API_KEY is not set (required for Claude)"
    exit 1
  fi
}

check_opencode_env() {
  if [ -z "$TEST_ANTHROPIC_API_KEY" ]; then
    echo "Error: TEST_ANTHROPIC_API_KEY is not set (required for OpenCode)"
    exit 1
  fi
}

run_test() {
  local provider=$1
  local num=$2
  local name=$3
  echo ""
  echo "========================================"
  echo "[$provider] Test $num: $name"
  echo "========================================"
  echo ""
  npx tsx "$SCRIPT_DIR/$provider/0${num}-${name}.ts"
  echo ""
}

run_provider_tests() {
  local provider=$1
  local test_num=$2

  echo ""
  echo "########################################"
  echo "# Running $provider tests"
  echo "########################################"

  if [ -n "$test_num" ]; then
    case $test_num in
      1) run_test "$provider" 1 "ssh" ;;
      2) run_test "$provider" 2 "execute-command" ;;
      3) run_test "$provider" 3 "session-command" ;;
      4) run_test "$provider" 4 "pty" ;;
      *) echo "Unknown test number: $test_num"; exit 1 ;;
    esac
  else
    run_test "$provider" 1 "ssh"
    run_test "$provider" 2 "execute-command"
    run_test "$provider" 3 "session-command"
    run_test "$provider" 4 "pty"
  fi
}

# Main
check_env

case "${1:-help}" in
  codex)
    check_codex_env
    run_provider_tests "codex" "$2"
    ;;
  claude)
    check_claude_env
    run_provider_tests "claude" "$2"
    ;;
  opencode)
    check_opencode_env
    run_provider_tests "opencode" "$2"
    ;;
  all)
    echo "========================================"
    echo "Background Execution Methods Test Suite"
    echo "========================================"

    if [ -n "$OPENAI_API_KEY" ]; then
      run_provider_tests "codex"
    else
      echo "Skipping Codex tests (OPENAI_API_KEY not set)"
    fi

    if [ -n "$TEST_ANTHROPIC_API_KEY" ]; then
      run_provider_tests "claude"
      run_provider_tests "opencode"
    else
      echo "Skipping Claude/OpenCode tests (TEST_ANTHROPIC_API_KEY not set)"
    fi
    ;;
  help|*)
    echo "Usage: $0 <provider> [test-number]"
    echo ""
    echo "Providers:"
    echo "  codex     - OpenAI Codex (requires OPENAI_API_KEY)"
    echo "  claude    - Anthropic Claude Code (requires TEST_ANTHROPIC_API_KEY)"
    echo "  opencode  - OpenCode (requires TEST_ANTHROPIC_API_KEY)"
    echo "  all       - Run all providers with available API keys"
    echo ""
    echo "Test numbers:"
    echo "  1 - SSH method"
    echo "  2 - executeCommand method"
    echo "  3 - executeSessionCommand method"
    echo "  4 - PTY method"
    echo ""
    echo "Examples:"
    echo "  $0 codex        # Run all Codex tests"
    echo "  $0 claude 1     # Run SSH test for Claude"
    echo "  $0 all          # Run all available tests"
    exit 0
    ;;
esac

echo ""
echo "========================================"
echo "Tests complete!"
echo "========================================"
