#!/bin/bash
# Hook to prevent dangerous git operations that rewrite history, push, or manipulate branches
# This hook is triggered before any Bash command executes

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Helper: Check if command matches a git pattern (handles &&, ;, |, and start of line)
matches_git_command() {
  echo "$COMMAND" | grep -qE "(^|&&|;|\|)\s*git\s+$1"
}

# 1. Block git commit --amend
if echo "$COMMAND" | grep -qE '(^|&&|;|\|)\s*git\s+commit\s+(--amend|[^|;&]*\s--amend)'; then
  echo "Blocked: git commit --amend is not allowed. Please create a new commit instead." >&2
  exit 2
fi

# 2. Block git rebase (but allow --continue, --abort, --skip for conflict resolution)
if matches_git_command 'rebase'; then
  # Allow rebase conflict resolution commands
  if echo "$COMMAND" | grep -qE 'git\s+rebase\s+--(continue|abort|skip)'; then
    : # Allow these through
  else
    echo "Blocked: git rebase is not allowed. It rewrites history." >&2
    exit 2
  fi
fi

# 3. Block git reset --hard
if echo "$COMMAND" | grep -qE '(^|&&|;|\|)\s*git\s+reset\s+[^|;&]*--hard'; then
  echo "Blocked: git reset --hard is not allowed. It rewrites history." >&2
  exit 2
fi

# 4. Block git push (all forms - pushing is handled automatically)
if matches_git_command 'push'; then
  echo "Blocked: git push is not allowed. Pushing is handled automatically." >&2
  exit 2
fi

# 5. Block git branch -d/-D (delete branch)
if echo "$COMMAND" | grep -qE '(^|&&|;|\|)\s*git\s+branch\s+[^|;&]*-[dD]'; then
  echo "Blocked: git branch -d/-D is not allowed. Do not delete branches." >&2
  exit 2
fi

# 6. Block git branch -m/-M (rename branch)
if echo "$COMMAND" | grep -qE '(^|&&|;|\|)\s*git\s+branch\s+[^|;&]*-[mM]'; then
  echo "Blocked: git branch -m/-M is not allowed. Do not rename branches." >&2
  exit 2
fi

# 7. Block git checkout -b (create new branch)
if echo "$COMMAND" | grep -qE '(^|&&|;|\|)\s*git\s+checkout\s+[^|;&]*-b'; then
  echo "Blocked: git checkout -b is not allowed. Do not create new branches." >&2
  exit 2
fi

# 8. Block git switch -c (create new branch)
if echo "$COMMAND" | grep -qE '(^|&&|;|\|)\s*git\s+switch\s+[^|;&]*-c'; then
  echo "Blocked: git switch -c is not allowed. Do not create new branches." >&2
  exit 2
fi

# 9. Block git switch <branch> (switching branches, but allow git switch -)
if echo "$COMMAND" | grep -qE '(^|&&|;|\|)\s*git\s+switch\s+[a-zA-Z0-9_/.-]+'; then
  echo "Blocked: git switch <branch> is not allowed. Stay on the current branch." >&2
  exit 2
fi

# 10. Block git checkout <branch> (switching branches)
# Allow: git checkout . | git checkout -- <file> | git checkout -p | git checkout HEAD
# Block: git checkout main | git checkout feature/xyz
if echo "$COMMAND" | grep -qE '(^|&&|;|\|)\s*git\s+checkout\s+[a-zA-Z][a-zA-Z0-9_/.-]*\s*($|&&|;|\|)'; then
  # Exclude common file-related patterns
  if ! echo "$COMMAND" | grep -qE '(^|&&|;|\|)\s*git\s+checkout\s+(HEAD|HEAD~|--|\.)'; then
    echo "Blocked: git checkout <branch> is not allowed. Stay on the current branch." >&2
    exit 2
  fi
fi

exit 0
