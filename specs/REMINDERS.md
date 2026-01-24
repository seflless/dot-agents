# Research Reminders

## Review After Merge Startup

**Status:** Need to find

**Context:** There's a new startup (possibly a GitHub competitor) whose core thesis is "why do you review before you merge?" They're building version control with post-merge review as a first-class concept.

**Why it matters:**
- Their approach aligns with the AI-assisted code review spec
- With agents coding quickly, pre-merge review is a bottleneck
- Ship fast, validate with tests, review asynchronously
- Review becomes about learning and improvement, not gatekeeping

**Search leads:**
- Git/GitHub competitor startups (2024-2025)
- "Review after merge" or "post-merge review" concepts
- Version control for AI-assisted development
- Fast-shipping development workflows

**When found, update:**
- `specs/ai-assisted-code-review.md` - Prior Art section
- Consider how their approach could integrate with the proposed system

---

## Other Tools to Research

### review.fast
- Literate programming style PR generation
- How do they order changes for comprehension?
- What narrative generation do they use?

### Vibe Band
- Similar to review.fast
- Compare approaches

### Reptile
- Automatic code review
- How do they define rules/invariants?
- Integration model

### Conductor
- Review button for agent work
- How do they present agent changes?
- Multi-turn conversation review
