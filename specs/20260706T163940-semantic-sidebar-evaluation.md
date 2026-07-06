# Kagi Semantic Sidebar Evaluation

**Date**: 2026-07-06
**Status**: Concluded
**Owner**: Project maintainer
**Supersedes**: `specs/kagi-html-css-optimization-lab.md` as the active execution slice

## One Sentence

Conclude the semantic-sidebar fixture experiment and return the repo to the
current Custom CSS sidebar, using local captures only as a preview surface.

## Overview

The broader fixture lab spec remains useful background, but the sidebar
experiment showed that its first proof matrix mixed incompatible jobs. The
semantic matrix is no longer active. The maintained path is now
`src/kagi-sidebar.css` plus the `previewer/` capture viewer.

## Outcome

The experiment answered the main question: semantic hooks alone do not make the
sidebar CSS meaningfully simpler because the hard work is component ownership,
not selector spelling. The repo should focus on the current CSS-only sidebar and
use captured Kagi pages to check that release artifact against JS-enhanced and
basic/no-JS search.

## Relation To The Broad Lab Spec

`specs/kagi-html-css-optimization-lab.md` described the original three-bundle
fixture system: `original`, `backwards-compatible`, and `optimized`. That model
is still useful, but its semantic-sidebar expectations were too broad.

This spec is now historical. Read `specs/kagi-sidebar.md` for the current
sidebar behavior and `previewer/README.md` for local preview workflow.

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

| Term                         | Meaning                                                                                                                                       | Fixture implication                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Semantic hooks               | Stable `data-kagi-*` attributes added to existing markup.                                                                                     | Belongs in `backwards-compatible`; old CSS should keep working.           |
| Semantic component structure | Markup and Kagi-authored CSS organized around component anatomy such as trigger, preview, popover, list, option, search, section, and action. | Belongs in `optimized`; old private selectors may break.                  |
| Native layout modes          | Kagi-owned placement options, such as horizontal toolbar or sidebar, exposed through variables, attributes, or settings.                      | Custom CSS becomes preference styling instead of behavior reconstruction. |

## Current Workflow

Keep the local previewer for:

- Testing `src/kagi-sidebar.css` against captured Kagi pages.
- Comparing JS-enhanced `/search` and basic/no-JS `/html/search` captures.
- Trying optional extra `.css` files from `previewer/custom-css/`.
- Reporting the Custom CSS character count against Kagi's 40,000 character
  limit.

Do not keep `backwards-compatible`, `optimized`, semantic CSS, selector audits,
or byte-saving reports in the active workflow. Those belonged to the proposal
experiment and are no longer needed for maintaining the current sidebar CSS.

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
- [x] Drop semantic CSS and optimized bundle fixtures from the active workflow.
- [x] Keep `src/kagi-sidebar.css` as the real release artifact and use the
      lab to test it, not to replace it.
- [x] Replace the fixture lab with a smaller previewer for captured Kagi pages
      and local Custom CSS files.

## Verification

The refactor is working when:

- `pnpm generate` can produce one page for each captured renderer and Custom CSS
  file.
- The picker offers only Capture and Custom CSS choices.
- The generated pages load `src/kagi-sidebar.css` directly.
- The picker shows the Custom CSS character count against Kagi's 40,000
  character limit.

## Decisions

| Decision                  | Class       | Choice                                          | Rationale                                                                                    |
| ------------------------- | ----------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Active preview shape      | 2 coherence | Use captures plus Custom CSS files only         | This directly supports maintaining the current sidebar release.                              |
| Backwards-compatible role | 1 evidence  | Remove from active workflow                     | The additive-hook proof concluded and is not needed for sidebar CSS maintenance.             |
| Semantic sidebar role     | 2 coherence | Remove from active workflow                     | Semantic component CSS needs Kagi-owned component changes, not a local compatibility bridge. |
| Main proposal claim       | 2 coherence | Maintainability and safer functional Custom CSS | The experiment supports this more strongly than dramatic byte savings.                       |

## Open Questions

No open questions remain for this experiment. Future Kagi proposal work should
start from a fresh spec if source-level component changes become realistic.
