# Kagi Semantic Sidebar Evaluation

**Date**: 2026-07-06
**Status**: In Progress
**Owner**: Project maintainer
**Supersedes**: `specs/kagi-html-css-optimization-lab.md` as the active execution slice

## One Sentence

Keep the fixture lab active by narrowing it to two claims: additive semantic
hooks should preserve existing Custom CSS, and future semantic sidebar CSS
should target an optimized component structure that actually owns filter
behavior.

## Overview

The broader fixture lab spec remains useful background, but the sidebar
experiment showed that its first proof matrix mixed incompatible jobs. The
narrowed lab should prove compatibility on today's DOM and use optimized,
breaking markup for semantic component experiments.

## Relation To The Broad Lab Spec

`specs/kagi-html-css-optimization-lab.md` described the original three-bundle
fixture system: `original`, `backwards-compatible`, and `optimized`. That model
is still useful, but its semantic-sidebar expectations were too broad.

This spec is the active slice for the next branch. Read the broad spec for
project structure, tooling, and generated artifact conventions. Use this spec
for current acceptance criteria and proposal wording.

## Finding

The sidebar CSS did not become simple just because `data-kagi-*` hooks existed.
It still had to:

- Move controls from Kagi's horizontal toolbar into a vertical layout.
- Reverse native dropdown hiding based on positioning, visibility, height,
  overflow, and checkbox state.
- Promote Matching and Time options into the closed sidebar.
- Preserve native Region, Sort, Lens, Advanced, and Clear behavior.
- Create Region previews from rows that were designed for an open dropdown.
- Size popovers and lists after moving them into a new layout context.

That is not a selector-name problem. It is a component-ownership problem.
Additive hooks improve selector clarity and migration safety, but they do not
turn current dropdown internals into a clean sidebar component.

## Vocabulary

Use these terms consistently across proposal and lab docs:

| Term | Meaning | Fixture implication |
| --- | --- | --- |
| Semantic hooks | Stable `data-kagi-*` attributes added to existing markup. | Belongs in `backwards-compatible`; old CSS should keep working. |
| Semantic component structure | Markup and Kagi-authored CSS organized around component anatomy such as trigger, preview, popover, list, option, search, section, and action. | Belongs in `optimized`; old private selectors may break. |
| Native layout modes | Kagi-owned placement options, such as horizontal toolbar or sidebar, exposed through variables, attributes, or settings. | Custom CSS becomes preference styling instead of behavior reconstruction. |

## Active Scope

Keep the fixture lab for:

- Testing `sidebar/kagi-sidebar.css` against captured Kagi pages.
- Proving `backwards-compatible + sidebar.original.css` has no selector
  regressions from additive hooks.
- Auditing real public Custom CSS samples against `original` and
  `backwards-compatible` markup.
- Demonstrating one optimized semantic filter component, starting with Region,
  where the DOM owns preview, popover, option, search, and list structure.
- Keeping byte and selector metrics separate for standard Kagi output,
  Kagi-authored optimized CSS, and user Custom CSS.

Do not keep `backwards-compatible + sidebar.semantic.css` as a headline proof.
If that combination exists, label it as a diagnostic bridge. It should not drive
the proposal because it asks one stylesheet to support both current dropdown
internals and future component anatomy.

## Target Matrix

Primary proof matrix:

| Combination | Purpose |
| --- | --- |
| `original + sidebar.original.css` | Shows the current distributable sidebar CSS against captured Kagi DOM. |
| `backwards-compatible + sidebar.original.css` | Proves additive hooks did not break existing functional Custom CSS. |
| `optimized + region.semantic.css` or `optimized + sidebar.semantic.css` | Demonstrates the future component contract once markup owns sidebar behavior. |

Diagnostic only:

| Combination | Purpose |
| --- | --- |
| `backwards-compatible + sidebar.semantic.css` | Tests whether a bridge stylesheet is possible, but it is not required for the proposal. |

## Source Access Limitation

The fixture lab works from generated Kagi output. That is enough to measure
selector compatibility and produce honest outside-in sketches, but it is a poor
way to optimize exact Kagi HTML/CSS while preserving visual parity.

Kagi's source files would likely make the optimized version easier to prove.
Source access would show component templates, build-time class ownership,
runtime popover assumptions, CSS module boundaries, shared variables, and the
actual no-JS/enhanced rendering split. Without that, the lab should avoid
claiming exact parity for optimized markup.

## Implementation Plan

- [x] Update proposal prose to separate semantic hooks, semantic component
  structure, and native layout modes.
- [x] Update fixture docs so `backwards-compatible` means additive hooks and
  compatibility only.
- [ ] Move semantic sidebar proof to optimized markup, preferably a focused
  Region component before a full sidebar.
- [x] Keep `sidebar/kagi-sidebar.css` as the real release artifact and use the
  lab to test it, not to replace it.
- [ ] Add public Custom CSS samples only when they improve selector
  compatibility evidence.

## Verification

The narrowed lab is working when:

- `backwards-compatible + sidebar.original.css` renders like the original
  sidebar and has no unwaived selector regressions.
- `backwards-compatible` pages expose semantic hooks without requiring semantic
  sidebar CSS.
- The optimized Region component can be styled through semantic component
  anatomy without reversing current Kagi dropdown internals.
- Proposal claims distinguish maintainability and Custom CSS safety from byte
  savings.
- Generated reports do not merge user Custom CSS bytes into standard Kagi
  output savings.

## Decisions

| Decision | Class | Choice | Rationale |
| --- | --- | --- | --- |
| Active lab shape | 2 coherence | Narrow rather than delete the fixture lab | The lab still helps test sidebar CSS and compatibility, but the broad semantic bridge proof was misleading. |
| Backwards-compatible role | 1 evidence | Additive hooks only | This is the cleanest way to measure whether old Custom CSS still works. |
| Semantic sidebar role | 2 coherence | Optimized/breaking DOM only | Semantic component CSS needs a DOM that owns component behavior. |
| Main proposal claim | 2 coherence | Maintainability and safer functional Custom CSS | The experiment supports this more strongly than dramatic byte savings. |

## Open Questions

1. Should the optimized proof start with a standalone Region component or the
   full filter panel?

   Recommendation: start with Region. It has enough complexity to prove the
   component contract without reopening the whole sidebar layout problem.

2. Should the lab keep the current `sidebar.semantic.css` file?

   Recommendation: keep it only if it is relabeled as optimized/experimental or
   replaced with a smaller Region-first semantic sample.

3. Should optimized fixtures aim for exact visual parity?

   Recommendation: no, not from generated output alone. Use them to demonstrate
   the contract and rough visual equivalence. Exact parity is a source-level
   refactor problem.
