# Enhanced Human Review UI

## Problem Statement

Current code review tools (GitHub, GitLab, etc.) present changes in ways that make human comprehension difficult:

1. **Alphabetical file ordering** - Files sorted by name, not by logical dependency or comprehension order
2. **Flat diff view** - All changes presented at the same level, no hierarchy or narrative
3. **No context scaffolding** - Reviewer must reconstruct the mental model themselves
4. **Optimized for gatekeeping, not understanding** - Built for approval workflows, not knowledge transfer

With AI-generated code, this problem is amplified:
- Larger changes happen faster
- The human didn't write it, so has no starting context
- Validation of correctness requires rapid comprehension
- Human review is the bottleneck we need to optimize

## Vision

A review interface that:
- Presents code changes in a **literate programming** style
- Orders changes for **optimal human comprehension**
- Provides **multiple viewing modes** (top-down, bottom-up, by concern)
- Enables **rapid validation** using human taste and expertise
- Works for **solo developers** and **teams**

## Inspiration

- **review.fast** / **Vibe Band** - Generated literate programming style PRs with logical ordering
- **Literate programming** (Knuth) - Code as narrative, organized for reading
- **Jupyter notebooks** - Interleaved explanation and code
- **Architectural decision records** - Documenting the "why"

## Key Concepts

### Comprehension-Optimized Ordering

Instead of alphabetical, order files by:

**Bottom-up (for new features):**
1. New types/interfaces/models first
2. Utility functions and helpers
3. Core logic that uses those types
4. Integration/glue code
5. Entry points and UI

**Top-down (for understanding flow):**
1. Entry points and high-level orchestration
2. Core business logic
3. Implementation details
4. Types and utilities

**By concern (for focused review):**
- Group by feature area
- Group by layer (UI, logic, data)
- Group by risk level

### Narrative Structure

Wrap code changes in explanatory narrative:

```markdown
## Adding User Authentication

We're adding OAuth2 authentication. Here's how it works:

### 1. User Model Extensions

First, we add fields to track OAuth tokens:

[CODE: models/user.ts lines 15-30]

### 2. OAuth Flow Handler

The main authentication flow:

[CODE: auth/oauth.ts - full file]

This calls the provider API and exchanges codes for tokens.

### 3. Session Management

Once authenticated, we create a session:

[CODE: auth/session.ts lines 50-80]

...
```

### Annotation Layers

Different overlays on the same code:
- **What changed** - Traditional diff view
- **Why it changed** - Intent and motivation
- **How it works** - Explanation of logic
- **What to verify** - Suggested review focus areas
- **Risk areas** - Security, performance, correctness concerns

### Interactive Exploration

- Expand/collapse sections
- Jump to definition (within the change set)
- See usages (within the change set)
- Toggle between "changes only" and "full context"
- Mark sections as "understood" to track progress

## Proposed UI Components

### 1. Overview Panel

High-level summary:
- What this change does (1-2 sentences)
- Key files affected
- Risk assessment
- Suggested review order
- Estimated review time

### 2. Narrative View

The main review interface:
- Markdown narrative with embedded code blocks
- Code blocks show relevant portions of diffs
- Expand to see full file context
- Inline comments and questions

### 3. Dependency Graph

Visual representation:
- Which files depend on which
- Suggested reading order
- Highlight the "core" changes vs "ripple effects"

### 4. Diff Sidebar

Traditional diff view, but:
- Sorted by comprehension order (not alphabetical)
- Grouped by logical concern
- Color-coded by change type (new, modified, deleted)
- Filterable by file type, directory, risk level

### 5. Progress Tracker

For larger reviews:
- Which sections you've seen
- Time spent per section
- Notes and questions
- "Review complete" state per section

## Generation Pipeline

How to create these views from raw diffs:

### 1. Analysis Phase
- Parse all changed files
- Build dependency graph
- Identify new types, functions, exports
- Detect patterns (new feature, refactor, bugfix, etc.)

### 2. Ordering Phase
- Apply comprehension heuristics
- Group related changes
- Determine optimal reading order

### 3. Narrative Generation
- AI generates explanatory text
- Links code sections to narrative
- Highlights key decisions and trade-offs

### 4. Rendering Phase
- Generate interactive UI
- Support multiple output formats (web, CLI, markdown)

## Output Formats

### Web UI
- Full interactive experience
- Real-time collaboration features
- Integration with GitHub/GitLab

### Static Markdown
- Shareable, archivable
- Works in any markdown viewer
- Good for documentation

### CLI View
- For terminal-based workflows
- Navigable with keyboard
- Integrates with editors

## Multi-User Review

### Collaborative Features
- See where others are in the review
- Share annotations and comments
- Divide sections among reviewers
- Aggregate "understood" state across team

### Review Handoff
- "I reviewed X, here's what I found"
- Pass context to next reviewer
- Track collective team understanding

## Implementation Considerations

### As a Standalone Tool
- CLI tool that generates review artifacts
- Could be open sourced
- Works with any git repo

### As a GitHub App
- Integrates with PR workflow
- Generates narrative view automatically
- Posts as PR comment or separate view

### As a Product
- Hosted service
- Team collaboration features
- Analytics and insights

## Technical Requirements

### Input
- Git diff (or PR reference)
- Repository context
- Optional: previous review state

### Processing
- AST parsing for major languages
- Dependency analysis
- AI model for narrative generation
- Template system for output

### Output
- Rendered review view
- Exportable artifacts
- API for integration

## Open Questions

1. How much AI generation vs human curation for the narrative?
2. How to handle very large changes (hundreds of files)?
3. How to learn from user preferences over time?
4. What's the right balance of automation vs control?
5. How to handle binary files, images, configs?

## Success Metrics

- Time to complete review
- Comprehension accuracy (can reviewer explain the changes?)
- Reviewer satisfaction
- Issues caught per review
- Adoption rate

## Implementation Phases

### Phase 1: CLI Prototype
- Basic ordering algorithm
- Markdown output
- Single-user, single-repo

### Phase 2: Narrative Generation
- AI-generated explanations
- Multiple output formats
- Better ordering heuristics

### Phase 3: Interactive UI
- Web-based viewer
- Progress tracking
- Annotation support

### Phase 4: Collaboration
- Multi-user features
- Team analytics
- Integration with existing tools

### Phase 5: Product
- Hosted service
- Polish and scale
- Monetization if applicable
