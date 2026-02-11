Create PR, make sure CI passes, then merge it.

This uses Conductor's prompts for creating a PR and merging a PR, as well as our own prompt for getting the agent to resolve all CI issues as they come until they successfully merge.

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

---Step 2: Review pass---

- Review the changes for quality/clarity
- Make sure that any changes in this PR are documented: specs updated, plans updated, etc.
- The priority should always be to make sure anything we did: our intents, lessons learned, are documented such that the chats that lead to the work don't need to be read to understand it.
- Make sure that any changes in this PR are reflected in the description.

---Step 3: Final Pass

- Make sure everything that should be is commited/pushed (PR description updated)
- ---Step 4: Get CI passing

- Make sure CI is green
- Fix any obvious issues without asking for help
- If you catch anything serious that requires help, just ask

---Step 5: Merge

- Merge automatically once CI passes.

# User Supplied Instructions

$ARGUMENTS
