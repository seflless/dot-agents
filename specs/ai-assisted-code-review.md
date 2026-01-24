# AI-Assisted Code Review

## Problem Statement

With AI coding agents, development velocity has increased dramatically. Code is written and shipped faster than ever. However, this creates several challenges:

1. **Understanding debt** - Code is merged without deep human comprehension
2. **Quality drift** - Codebase gradually deviates from intended architecture and philosophies
3. **Local vs holistic review** - Traditional PR review focuses on individual changes, missing emergent patterns across merged code
4. **Review timing mismatch** - Current tooling assumes review happens before merge, but with fast-moving agent-generated code, this bottleneck is counterproductive

## Vision

Create a system where:
- AI agents continuously maintain code quality invariants and architectural philosophies
- Humans can review at their own pace, after code is merged and validated by tests
- Review becomes a holistic, periodic activity rather than a blocking gate
- The codebase self-documents its own rules and enforces them automatically

## Key Concepts

### Review After Merge

The traditional flow is: Write -> Review -> Merge -> Deploy

The new paradigm: Write -> Test -> Merge -> Deploy -> Review (async)

Benefits:
- Ship validated ideas quickly
- Team members get changes immediately
- Review happens with full context of how code behaves in production
- Batch review of related changes provides holistic understanding
- Review becomes about learning and quality improvement, not gatekeeping

Challenges to solve:
- How to track what needs review
- How to prioritize review backlog
- How to handle issues found during post-merge review
- How to distinguish "reviewed" vs "unreviewed" code

### Code Invariants and Philosophies

Codebases should be able to declare:
- Architectural invariants (e.g., "all API calls go through the client layer")
- Code style philosophies (e.g., "prefer composition over inheritance")
- Domain rules (e.g., "user data must never be logged")
- Performance constraints (e.g., "no synchronous file I/O in request handlers")

These should be:
- Machine-readable and enforceable by AI agents
- Human-readable as documentation
- Versioned alongside the code
- Automatically validated on every change

### Multi-User Review Coordination

When multiple humans review agent work:
- How to divide review responsibility
- How to share context and findings
- How to track collective understanding of the codebase
- How to prevent duplicate effort

## Proposed Architecture

### 1. Invariant Definition Layer

```
/.invariants/
  architecture.yaml     # Structural rules
  security.yaml         # Security constraints
  performance.yaml      # Performance requirements
  style.yaml           # Code style philosophies
  domain.yaml          # Domain-specific rules
```

Each invariant file contains:
- Human-readable description
- Machine-checkable rules (regex, AST patterns, semantic rules)
- Examples of compliant and non-compliant code
- Severity level (error, warning, suggestion)

### 2. AI Review Agent

An agent that:
- Runs continuously or on-demand
- Validates all invariants against current codebase
- Reports violations with explanations and fix suggestions
- Can auto-fix certain categories of violations
- Learns from human feedback on its suggestions

Integration points:
- Pre-commit hook (optional, for critical invariants)
- CI pipeline (for all invariants)
- Background daemon (for continuous monitoring)
- Editor plugin (for real-time feedback)

### 3. Review Backlog System

Track what needs human review:
- Changes merged without review (flagged for later)
- AI-flagged concerns requiring human judgment
- Periodic "codebase health" reviews
- Architecture drift detection

Prioritization based on:
- Risk level (security, data handling, core logic)
- Change magnitude
- Author confidence level
- Time since last review of that area

### 4. Holistic Review Mode

Instead of reviewing individual PRs:
- Review by feature/domain area
- Review by time period ("what changed this week")
- Review by risk category
- Review by author (for onboarding/mentoring)

The system generates a narrative view of changes:
- Groups related changes across PRs
- Orders for comprehension (dependencies first)
- Highlights key decisions and trade-offs
- Shows before/after for significant refactors

## Prior Art and Inspiration

- **Reptile** - Automatic code review
- **Conductor** - Review button for agent work
- **[RESEARCH NEEDED]** - Git competitor startup with "review after merge" philosophy
- **Literate programming** - Code organized for human comprehension

## Open Questions

1. How do we handle rollback when post-merge review finds issues?
2. Should unreviewed code be flagged in some way (comments, metadata)?
3. How do we balance AI autonomy with human oversight for different risk levels?
4. What's the right granularity for invariant definitions?
5. How do we prevent "review fatigue" in the post-merge model?

## Success Metrics

- Time from code written to code understood by humans
- Number of architectural violations caught before vs after they cause problems
- Developer confidence in codebase quality
- Reduction in "understanding debt" over time
- Speed of onboarding new team members

## Implementation Phases

### Phase 1: Invariant Definition
- Define file format for invariants
- Build simple validator that AI agents can invoke
- Create initial set of invariants for common patterns

### Phase 2: Review Backlog
- Track what needs review
- Basic prioritization
- Simple dashboard

### Phase 3: AI Review Agent
- Continuous validation
- Violation reporting
- Integration with existing tools

### Phase 4: Holistic Review
- Narrative generation
- Cross-PR grouping
- Comprehension-optimized ordering
