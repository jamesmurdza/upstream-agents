# Codex rules to prevent dangerous git operations
# These rules block commands that rewrite history, push, or manipulate branches

# Block git commit --amend (history rewriting)
prefix_rule(
    pattern=["git", "commit", "--amend"],
    decision="forbidden",
    justification="git commit --amend rewrites history. Create a new commit instead.",
)

prefix_rule(
    pattern=["git", "commit", "-a", "--amend"],
    decision="forbidden",
    justification="git commit --amend rewrites history. Create a new commit instead.",
)

# Block git rebase (history rewriting)
prefix_rule(
    pattern=["git", "rebase"],
    decision="forbidden",
    justification="git rebase rewrites history and is not allowed.",
)

# Block git reset --hard (history rewriting)
prefix_rule(
    pattern=["git", "reset", "--hard"],
    decision="forbidden",
    justification="git reset --hard rewrites history and is not allowed.",
)

# Block git push (handled automatically)
prefix_rule(
    pattern=["git", "push"],
    decision="forbidden",
    justification="git push is not allowed. Pushing is handled automatically.",
)

# Block git branch -d/-D (branch deletion)
prefix_rule(
    pattern=["git", "branch", "-d"],
    decision="forbidden",
    justification="Deleting branches is not allowed.",
)

prefix_rule(
    pattern=["git", "branch", "-D"],
    decision="forbidden",
    justification="Deleting branches is not allowed.",
)

# Block git branch -m/-M (branch renaming)
prefix_rule(
    pattern=["git", "branch", "-m"],
    decision="forbidden",
    justification="Renaming branches is not allowed.",
)

prefix_rule(
    pattern=["git", "branch", "-M"],
    decision="forbidden",
    justification="Renaming branches is not allowed.",
)

# Block git checkout -b (branch creation)
prefix_rule(
    pattern=["git", "checkout", "-b"],
    decision="forbidden",
    justification="Creating new branches is not allowed.",
)

# Block git switch -c (branch creation)
prefix_rule(
    pattern=["git", "switch", "-c"],
    decision="forbidden",
    justification="Creating new branches is not allowed.",
)

# Block git switch (branch switching) - but this is tricky since git switch - is ok
# We'll block common branch switching patterns
prefix_rule(
    pattern=["git", "switch", "main"],
    decision="forbidden",
    justification="Switching branches is not allowed. Stay on the current branch.",
)

prefix_rule(
    pattern=["git", "switch", "master"],
    decision="forbidden",
    justification="Switching branches is not allowed. Stay on the current branch.",
)

prefix_rule(
    pattern=["git", "switch", "develop"],
    decision="forbidden",
    justification="Switching branches is not allowed. Stay on the current branch.",
)

prefix_rule(
    pattern=["git", "switch", "dev"],
    decision="forbidden",
    justification="Switching branches is not allowed. Stay on the current branch.",
)

# Block git checkout <common-branch> (branch switching)
prefix_rule(
    pattern=["git", "checkout", "main"],
    decision="forbidden",
    justification="Switching branches is not allowed. Stay on the current branch.",
)

prefix_rule(
    pattern=["git", "checkout", "master"],
    decision="forbidden",
    justification="Switching branches is not allowed. Stay on the current branch.",
)

prefix_rule(
    pattern=["git", "checkout", "develop"],
    decision="forbidden",
    justification="Switching branches is not allowed. Stay on the current branch.",
)

prefix_rule(
    pattern=["git", "checkout", "dev"],
    decision="forbidden",
    justification="Switching branches is not allowed. Stay on the current branch.",
)
