Create PR, make sure CI passes, then merge it.

This is uses Conductor's prompts for creating a PR and merging a PR, as well as our own prompt for getting the agent to resolve all CI issues as they come until they successfully merge.

---Step 1: Create a PR---
The user likes the state of the code.

There may be uncommitted changes.
Check the current name and use it as the remote name too
The target branch is origin/<local-branch-name>.

There is may be no upstream branch yet.
The user requested a PR.

Follow these **exact steps** to create a PR:

- Run `git diff` to review uncommitted changes
- Commit them. Follow any instructions the user gave you about writing commit messages.
- Push to origin.
- Use the `mcp__conductor__GetWorkspaceDiff` tool to review the PR diff
- Use `gh pr create --base <branch-name>` to create a PR onto the target branch. Keep the title under 80 characters and the description under five sentences (unless the user has given you other instructions).

If any of these steps fail, ask the user for help.

# User Supplied Instructions

$ARGUMENTS
