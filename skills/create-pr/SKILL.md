---
name: create-pr
description: 'Creates a pull request or merge request with auto-generated title, description, and affected-area summary. Auto-detects GitHub vs GitLab. Use when the user says "create a PR," "open a pull request," "submit for review," or "push and create PR." Manual via /create-pr.'
argument-hint: '[target-branch]'
effort: low
---

# /create-pr — Create Pull/Merge Request with Change Summary

Creates a pull request (GitHub) or merge request (GitLab) from the current branch with:
1. Auto-generated semantic title and description based on commit history
2. Summary of changes grouped by affected area
3. Pre-merge checklist with context-aware items

## Arguments

```
/create-pr [target-branch]
```

- `target-branch`: Branch to merge into. If omitted, auto-detected (see Step 1).

If `$ARGUMENTS` is provided, treat it as the target branch.

## Steps

### Step 1: Gather branch context and detect platform

1. Get the current branch name: `git branch --show-current`
2. **Detect platform** from `.git/config` remote URL:
   - If remote URL contains `github.com` → **GitHub**
   - If remote URL contains `gitlab` → **GitLab**
   - Otherwise → ask user or default to GitHub conventions
3. **Detect default target branch** (if no target argument given):
   - Try: `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||'`
   - If that fails, check which of `main` or `master` exists: `git rev-parse --verify origin/main 2>/dev/null || git rev-parse --verify origin/master 2>/dev/null`
   - If argument was provided, use that instead
4. Fetch latest: `git fetch origin`
5. Verify current branch is ahead of target: `git log --oneline origin/<target>..HEAD`
6. If no commits ahead, abort with message: "No commits ahead of `<target>`. Nothing to merge."
7. Ensure the branch is pushed: `git log --oneline HEAD --not --remotes` — if there are local-only commits, push with `git push -u origin <current-branch>`

### Step 2: Analyze changes

1. Get the full diff stats: `git diff origin/<target>...HEAD --stat`
2. Get changed files: `git diff origin/<target>...HEAD --name-only`
3. Get commit log: `git log --oneline origin/<target>..HEAD`
4. Read the full diff for understanding: `git diff origin/<target>...HEAD`

From the commits and diff, determine:
- **What was done**: Group changes by feature/fix/refactor area
- **Which areas were touched**: Map changed files to top-level directories and logical modules
- **Which components are affected**: Identify deployable units, packages, or services impacted

### Step 3: Detect affected areas

**Goal:** Determine which parts of the codebase are affected by the changes.

**Direct changes:**
- Group changed files by their top-level directory or logical module
- Identify entry points, services, packages, or apps that were directly modified

**Dependency tracing (one level deep):**
For each changed module/package:
1. Check if other parts of the codebase import or depend on the changed files
2. Use grep to find import references: `grep -rl "<changed-module>" <source-dirs>`
3. Map those references back to their parent component/service/package

**Shared code changes:**
- If files in common/shared/utils/lib directories were changed, note which consumers actually import the affected files rather than flagging everything

**Migration/schema changes:**
- If new migration files exist (any framework), note that migrations need to be run before/during deployment

### Step 4: Generate PR title

- Use semantic format: `<type>(<scope>): <description>`
- If single-purpose (all commits relate to one feature/fix): derive from commits
- If multi-purpose: use the most significant change as the title
- Keep under 72 characters
- Examples:
  - `feat(auth): add OAuth2 login flow with PKCE`
  - `fix(api): handle null response from payment provider`
  - `refactor(db): extract query builder helpers`

### Step 5: Generate PR description

Use this template:

```markdown
## Summary
<2-5 bullet points describing what the PR does at a high level>

## Changes
<Group changes by area/module, using sub-headers if needed>

### <Area 1>
- Change description
- Change description

### <Area 2>
- Change description

## Affected Areas
<List of components/services/packages affected by this change>

| Area | Reason |
|------|--------|
| `<component>` | <what changed and why it's affected> |
| ... | ... |

<If shared code was changed:>
> **Note:** Shared code was modified. Review whether dependent components need testing or redeployment.

## Pre-merge Checklist
- [ ] Build passes
- [ ] Lint/format passes
<If migrations exist:>
- [ ] Migration reviewed: `<MigrationName>`
- [ ] Run migrations before deploying
<If new env vars detected:>
- [ ] New env var `VAR_NAME` configured in deployment environments
<If new services/entry points:>
- [ ] New service `<name>` added to deployment pipeline
<If schema changes (GraphQL, Protobuf, OpenAPI):>
- [ ] Schema changes reviewed for backward compatibility
```

### Step 6: Present for review

**IMPORTANT:** Present the generated title and full description to the user for review BEFORE creating the PR/MR. Wait for confirmation or edits.

### Step 7: Create the pull/merge request

**GitHub (detected in Step 1):**

Check if `gh` CLI is available:
```bash
command -v gh >/dev/null 2>&1
```

If `gh` is available:
```bash
gh pr create \
  --base "<target>" \
  --title "<title>" \
  --body "<description>"
```

If `gh` is not available, provide manual instructions:
> The `gh` CLI is not installed. You can create the PR manually:
> 1. Go to: `<repo-url>/compare/<target>...<current-branch>`
> 2. Use the title and description generated above
>
> To install `gh`: https://cli.github.com/

**GitLab (detected in Step 1):**

Primary method — GitLab API via curl (requires `$GITLAB_TOKEN`):
```bash
# Extract GitLab host and project path from remote URL
GITLAB_HOST=<detected-host>
PROJECT_PATH=<url-encoded-project-path>

curl --silent --request POST "https://${GITLAB_HOST}/api/v4/projects/${PROJECT_PATH}/merge_requests" \
  --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{
    "source_branch": "<current-branch>",
    "target_branch": "<target>",
    "title": "<title>",
    "description": "<description>"
  }'
```

Parse the JSON response to extract the `web_url`. Handle errors:
- `"has already been taken"` — MR already exists, inform the user
- `"401 Unauthorized"` — `GITLAB_TOKEN` env var is missing or invalid

Fallback method — git push with MR options:
```bash
git push -u origin <current-branch> \
  -o merge_request.create \
  -o merge_request.target=<target> \
  -o merge_request.title="<title>"
```
Note: `git push -o` does not support multiline descriptions. Direct the user to edit the description in the GitLab UI.

If all methods fail, present the title and description to the user with the web URL for manual creation.

### Step 8: Report

Output:
- PR/MR URL (or manual link if automated creation failed)
- Title
- Target branch
- Number of commits
- Affected areas (quick summary list)

## Rules

- NEVER force push or modify commit history
- ALWAYS present the PR description to the user for review BEFORE creating the PR/MR
- If the branch is already pushed and up-to-date, skip the push step
- If a PR/MR already exists for this branch, inform the user instead of creating a duplicate
- When tracing dependencies, go only one level deep (don't trace the full transitive graph)
- For shared/utils code changes, use grep to find which components actually import the changed files rather than flagging everything
- If a build command is detected in the project (package.json scripts, Makefile, etc.), run the build before creating the PR to verify the code compiles
- Respect any project-specific commit conventions found in CLAUDE.md or CONTRIBUTING.md
