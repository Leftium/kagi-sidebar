# Kagi HTML/CSS Optimization Lab

**Date**: 2026-07-06
**Status**: Background
**Owner**: Project maintainer
**Branch**: local planning
**Supersedes**: Stashed generated fixture experiment from 2026-07-05
**Superseded by**: `specs/20260706T163940-semantic-sidebar-evaluation.md` for the concluded semantic-sidebar evaluation

## One Sentence

Build a fixture lab that compares original, backwards-compatible, and optimized
Kagi HTML/CSS bundles against original and semantic Kagi Custom CSS.

## Overview

This spec records the broad fixture-lab design as historical context. The
semantic-sidebar evaluation concluded that the proposal matrix was not the right
active workflow for this repo. Current sidebar work uses `src/kagi-sidebar.css`
and the smaller `previewer/` capture viewer.

## How To Read This Spec

Read first:

- Current Status
- Problems With The Previous Attempt
- Target Shape
- Project Structure
- Matrix Workflow
- Tooling Recommendation
- Implementation Plan
- Verification

Read when changing the architecture:

- HTML Variants
- CSS Corpus And Migration Matrix
- Compatibility Survey
- Design Decisions

Historical context:

- Rejected Alternatives

## Current Status

This fixture lab is historical. Its conclusions informed the smaller previewer,
but the original variant matrix is no longer active.

Historical takeaway:

- The `original`, `backwards-compatible`, and `optimized` matrix was useful for
  separating proposal ideas, but it was too heavy for ongoing sidebar work.
- `backwards-compatible + sidebar.semantic.css` was the wrong proof target
  because it tried to make a future component stylesheet support today's
  dropdown internals.
- Byte savings should stay supporting evidence for future Kagi proposal work;
  the stronger claim is maintainability and safer functional Custom CSS.

## Problems With The Previous Attempt

The stashed fixture experiment was useful, but its foundation mixed several
different claims in one set of pages.

1. The "simplified sidebar" fixture did not use simplified Region markup.

   The proposed sidebar fixture stripped private dropdown IDs and added
   semantic hooks, but it kept Kagi-shaped dropdown markup for Region. The
   submit-button Region component existed only as an isolated component sample.
   That meant the main before/after sidebar comparison did not exercise the
   HTML simplification it was supposed to prove.

2. Additive hooks and breaking simplification were mixed together.

   Some fixtures represented a compatibility phase: current HTML with
   `data-kagi-*` hooks added. Other fixtures were meant to represent a future
   simplified contract. Because those states shared similar names and paths, the
   examples blurred which CSS should keep working unchanged and which CSS
   should require migration.

3. The Custom CSS sample was too narrow.

   The synthetic fixture-sized sample was inspired by Kagi Plus selector
   patterns, but it was not enough to support a compatibility claim. It also
   introduced layout changes that were not central to the test, so visual
   problems in the sample looked like problems in the proposal.

4. Component fixtures were too small for whole-page claims.

   Isolated component comparisons are useful for explaining a specific HTML
   transformation, but they cannot prove that a full page remains compatible
   with existing Custom CSS. The proposal needs whole-page before/after pages
   and component-level extracts.

5. Visual failures were caused partly by tooling and partly by the fixture
   model.

   The generated pages were static, but there was no consistent dev command,
   no built-in CSS injection matrix, and no repeatable screenshot check. Manual
   file opening worked for some pages, but it made it too easy to miss viewport
   breakpoints and broken combinations.

6. Diffs were noisy even when side-by-side outlines helped.

   Raw captured HTML is useful evidence, but raw diffs of whole Kagi pages are
   too large to review directly. The next system needs normalized HTML and CSS
   plus focused semantic summaries.

7. The semantic sidebar bridge proved the wrong claim.

   A later pass tried to make `sidebar.semantic.css` work against additive hooks
   on the current dropdown DOM. The rendered fixtures broke around sidebar and
   popover layout. The useful finding was not the broken CSS itself; it was that
   semantic hooks and semantic component structure are different contracts.
   Additive hooks make selectors clearer, but they do not make Kagi's current
   dropdown internals own sidebar previews, promoted options, popover sizing,
   or open-state layout.

## Target Shape

The fixture lab should produce three Kagi bundle variants from the same captured
page, but each variant has a narrower job than the first plan implied.

```text
captured Kagi HTML
  -> original bundle
  -> backwards-compatible bundle
  -> optimized bundle

Kagi-authored CSS
  -> current captured remote CSS for original/backwards-compatible
  -> local lab-owned optimized CSS for optimized

real Custom CSS corpus
  -> original CSS for compatibility checks
  -> semantic CSS only for optimized component proofs

bundle variant x Custom CSS sample
  -> generated matrix pages
  -> picker/index page
  -> selector match reports
  -> byte and complexity measurements
```

The sidebar remains the first functional Custom CSS case. The current
distributable sidebar CSS should be tested against original and
backwards-compatible fixtures. Semantic sidebar CSS belongs in optimized,
breaking fixtures where the markup owns the component behavior being styled.
Other community CSS examples should be used to measure breakage risk and
selector compatibility, not to prove functional layout changes they were never
designed to make.

## Project Structure

The repo should stop treating every artifact as an `examples/` file. The project
now has three responsibilities: the usable sidebar CSS, the proposal writing,
and the fixture lab that tests the proposal.

Recommended structure:

```text
kagi-sidebar/
  package.json
  .gitignore

  sidebar/
    kagi-sidebar.css
    README.md

  proposal/
    making-kagi-simpler-smaller-easier-to-customize.md
    appendix-real-world-kagi-custom-css.md

  specs/
    kagi-sidebar.md
    kagi-html-css-optimization-lab.md

  fixture-lab/
    captures/
      original/
    css-corpus/
      original/
      semantic/
      manifest.json
    tools/
    site/

  generated/
    html/
    matrix/
    reports/
    screenshots/
```

Tracked source:

- `sidebar/`: the distributable Custom CSS and sidebar-specific docs.
- `proposal/`: the maintainer-facing Kagi proposal and appendices.
- `specs/`: planning and implementation specs.
- `fixture-lab/captures/original/`: redacted source captures.
- `fixture-lab/css-corpus/`: original public CSS samples and semantic rewrites.
- `fixture-lab/tools/`: generator, selector audit, and normalization scripts.
- `fixture-lab/site/`: the Vite index/picker source.

Ignored generated output:

- `generated/html/`
- `generated/matrix/`
- `generated/reports/`
- `generated/screenshots/`

The root `generated/` folder should be in `.gitignore`. Generated artifacts are
evidence products, not source. If an article needs stable numbers, copy a small
curated measurement table into the article or regenerate the reports during
verification.

## HTML Variants

### Original

The original variant is the captured Kagi page with only safety and local-viewing
changes.

Allowed:

- Credential redaction.
- Script removal or inerting for local inspection.
- Absolute URL rewriting when needed for assets.
- A generated wrapper note outside Kagi's captured DOM.
- A separate normalized copy for diffing.

Not allowed:

- Adding semantic hooks.
- Removing private IDs or classes.
- Replacing controls.
- Simplifying repeated URLs.

Rule: keep one exact-ish capture artifact and one normalized inspection artifact.
The capture is evidence. The normalized page is for review.

### Backwards-Compatible

The backwards-compatible variant adds stable semantic hooks while preserving
current selector compatibility as much as possible.

Allowed:

- Add `data-kagi-*` attributes for page surface, mode, filters, results,
  widgets, actions, and state.
- Add non-conflicting wrapper attributes where Kagi already has equivalent
  product concepts.
- Add layout variables that default to Kagi's current layout.
- Make tiny HTML simplifications only after the CSS corpus survey shows low
  breakage risk.

Not allowed by default:

- Removing private IDs such as `#dd_toggle_*`.
- Removing private result classes such as `.__sri-*`.
- Replacing anchors with buttons.
- Changing sibling order relied on by existing CSS.

Compatibility target: most existing Kagi Custom CSS should work unchanged. Any
selector that matched the original page and stops matching this variant is a
bug unless explicitly waived.

### Optimized

The optimized variant is the ideal breaking version.

Allowed:

- Remove as many private IDs and implementation classes as practical.
- Replace repeated option links with form-oriented controls where behavior stays
  correct.
- Simplify Region and other high-repetition filter controls.
- Normalize JS-enhanced and no-JS/basic search around the same semantic shell.
- Replace private layout hooks with semantic slots and layout variables.

Expected:

- Existing private-selector Custom CSS will break.
- Semantic CSS should be shorter and clearer.
- Kagi's own output should be smaller or easier to reason about before any
  Custom CSS is injected.

## CSS Corpus And Migration Matrix

The fixture system should use a real CSS corpus.

Initial corpus:

| Source                                | Role In Survey               | Notes                                                                     |
| ------------------------------------- | ---------------------------- | ------------------------------------------------------------------------- |
| `kagi-sidebar.css`                    | First functional layout case | Local project CSS; expected to need a semantic rewrite for optimized HTML |
| Kagi Condensed                        | Real density/theme case      | Public GitHub theme referenced in the existing appendix                   |
| Kagi Google-style theme               | Layout-heavy visual theme    | Useful for measuring private layout selector dependence                   |
| Kagi Plus                             | Broad component/theme case   | Public theme linked from Kagi's Custom CSS material                       |
| Kagi Darker                           | Large full theme             | Useful breakage-risk sample                                               |
| Gruber Custom CSS                     | Small targeted tweaks        | Good control case for low selector burden                                 |
| High Contrast Purple                  | Accessibility-oriented CSS   | Good for result/widget/action hook coverage                               |
| Faded Slop                            | AI-label result treatment    | Good test for replacing `:has(.ai-stain-icon)`                            |
| OpenKagi or `awesome-kagi-css` themes | Wider survey pool            | Use only public CSS with a stable source URL                              |

Each CSS sample gets metadata:

```json
{
  "id": "kagi-plus",
  "name": "Kagi Plus",
  "source_url": "https://github.com/cameronpcampbell/kagi-plus",
  "license": "unknown",
  "kind": "theme",
  "functional_layout": false,
  "local_original": "fixture-lab/css-corpus/original/kagi-plus.css",
  "local_semantic": "fixture-lab/css-corpus/semantic/kagi-plus.css"
}
```

Do not rewrite every theme immediately. The first semantic rewrite target is now
an optimized filter component, preferably Region, not a bridge stylesheet that
tries to make the full sidebar work on the current dropdown DOM. Other semantic
files should be added only when the survey shows a clear mechanical rewrite or
a representative optimized-HTML failure worth explaining.

The generated matrix should start with:

| HTML Variant         | Original CSS                               | Semantic CSS                      |
| -------------------- | ------------------------------------------ | --------------------------------- |
| Original             | Must render                                | Not required                      |
| Backwards-compatible | Must render                                | Diagnostic only                   |
| Optimized            | Expected to break for private-selector CSS | Must render for semantic examples |

CSS version names:

- `original`: CSS as authored for today's Kagi DOM.
- `semantic`: CSS rewritten to target the proposed semantic hooks and optimized
  HTML.

Avoid `migrated` as a persistent name. Migration is the process; semantic CSS is
the target artifact.

## Matrix Workflow

Generate all valid bundle and Custom CSS combinations, then expose them through
an index page with pickers.

```text
pnpm generate
  -> writes bundle HTML
  -> writes valid bundle x Custom CSS matrix pages, including no-CSS baselines
  -> writes selector and measurement reports

pnpm dev
  -> opens the Vite fixture-lab site at /
  -> picker: capture
  -> picker: bundle with HTML and Kagi-authored CSS metrics
  -> picker: Custom CSS option with selector and size metrics
  -> link: generated artifact
  -> link: selector report
```

The picker should navigate to generated artifacts. It should not be the only
place where CSS injection happens. Generated files are the source of truth for
reports, screenshots, and review links; the picker is the ergonomic way to find
them.

Valid first-pass sidebar combinations:

| Combination                                                             | Purpose                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| `original + sidebar.original.css`                                       | Shows today's project CSS against today's Kagi DOM            |
| `backwards-compatible + sidebar.original.css`                           | Proves old functional CSS still works after additive hooks    |
| `optimized + region.semantic.css` or `optimized + sidebar.semantic.css` | Shows the future contract once markup owns component behavior |

Diagnostic sidebar combinations:

| Combination                                   | Purpose                                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| `backwards-compatible + sidebar.semantic.css` | Tests whether a bridge stylesheet is possible; not required for the proposal |

`bundleVariant` is the primary generated unit. `htmlVariant` and
`kagiCssVariant` are bundle metadata. `kagiCssVariant` should not become a free
public matrix axis. Diagnostic hybrids can exist, but they should be labeled as
stress tests rather than primary output.

For public themes, generate `original` CSS against `original` and
`backwards-compatible` HTML first. Add semantic versions only when there is a
clear optimized-DOM rewrite worth maintaining.

## CSS Injection System

Generated outputs should be matrix pages, not hand-picked one-off fixtures.

Directory shape:

```text
fixture-lab/
  captures/
    original/
      search.html
      html-search.html
  css-corpus/
    original/
      sidebar.css
      kagi-plus.css
    semantic/
      sidebar.css
  kagi-authored-css/
    optimized/
      search-controls.css
    manifest.json
  tools/
    generate-fixtures.mjs
    audit-selectors.mjs
    normalize-html.mjs
  site/

generated/
  html/
    original/
    backwards-compatible/
    optimized/
  matrix/
    search__original__sidebar__original.html
    search__backwards-compatible__sidebar__original.html
    search__backwards-compatible__sidebar__semantic.html
    search__optimized__sidebar__semantic.html
    html-search__original__sidebar__original.html
  reports/
    selector-matches.json
    compatibility-summary.json
    generation-summary.json
  screenshots/
```

Custom CSS injection should be explicit and reversible:

```html
<link
  rel="stylesheet"
  href="../../fixture-lab/css-corpus/original/sidebar.css"
/>
```

or, when a standalone file is needed:

```html
<style data-fixture-custom-css="kagi-sidebar">
  /* injected CSS */
</style>
```

Prefer linked CSS during development so browser devtools can identify the source
file. Inline CSS is useful for archived artifacts.

Metrics should report bundle and user CSS separately:

```text
bundle metrics:
  HTML bytes
  Kagi-authored CSS source bytes
  Kagi-authored CSS minified bytes

Custom CSS metrics:
  CSS source bytes
  CSS minified bytes
  selector counts
  private hook counts
  structural selector counts

total measured surface:
  HTML bytes + Kagi-authored CSS minified bytes + Custom CSS minified bytes
```

Only Kagi CSS changes required by the bundle contract should count in the
headline optimized bundle. Generic CSS cleanup, such as source nesting,
deduplicating selectors, or unrelated size refactors, can be measured as a
separate diagnostic, but mixing it into the optimized bundle would make the DOM
contract proposal look better for reasons that are not caused by the proposal.

## Compatibility Survey

The survey should answer: "How much public Kagi Custom CSS would break if the
HTML changed?"

For each CSS sample and HTML variant, collect:

- CSS size in bytes.
- CSS line count.
- Total selectors.
- Selectors that match at least one element.
- Selectors that matched original but no longer match backwards-compatible.
- Selectors that matched original but no longer match optimized.
- Selectors containing private Kagi IDs/classes.
- Distinct private Kagi IDs/classes used by those selectors.
- Selectors containing structural dependencies such as `:nth-child`,
  `:nth-of-type`, sibling combinators, or deep SVG paths.
- Selectors using modern features such as `:has()`.
- Rules that target documented or likely-stable CSS variables.

Compatibility classifications:

| Classification           | Meaning                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- |
| Preserved                | Selector matched original and backwards-compatible                                 |
| Regression               | Selector matched original but not backwards-compatible                             |
| Expected optimized break | Selector matched original/backwards-compatible but not optimized                   |
| Mechanical migration     | Selector maps cleanly to a proposed semantic hook                                  |
| Manual migration         | Selector depends on structure, sibling order, text shape, or private SVG internals |
| Already token-based      | Rule mostly uses CSS variables or broad theme selectors                            |

The backwards-compatible variant should have zero unwaived regressions for the
survey corpus. The optimized variant should have a clear migration story for the
sidebar and at least a measured breakage report for the rest.

## Tooling Recommendation

Create a small pnpm/Vite project for the fixture lab.

Direct file opening is viable for static HTML, but it is the wrong primary
workflow for this project. The lab needs relative asset loading, CSS
injection, viewport checks, selector audits, screenshots, and a single command
that a maintainer can run without remembering paths.

Recommended tools:

- Vite for a local static dev server.
- Prettier for HTML and CSS normalization.
- A Node HTML parser such as `parse5` or `cheerio` for transformations.
- `postcss` plus `postcss-selector-parser` for selector audits.
- Playwright for screenshot and viewport smoke checks when visual regressions
  need automation.

Keep the app minimal. This does not need React, Svelte, Vue, or a design system.
The generated pages are static evidence artifacts; Vite is only the server and
developer workflow.

Suggested scripts:

```json
{
  "scripts": {
    "dev": "vite --host 127.0.0.1 --open /",
    "generate": "node fixture-lab/tools/generate-fixtures.mjs",
    "audit-css": "node fixture-lab/tools/audit-selectors.mjs",
    "format": "prettier --write README.md index.html package.json \"fixture-lab/README.md\" \"fixture-lab/captures/**/*.md\" \"fixture-lab/css-corpus/manifest.json\" \"fixture-lab/site/**/*.{html,css,js}\" \"fixture-lab/tools/**/*.mjs\"",
    "check": "pnpm generate && pnpm audit-css"
  }
}
```

The Vite site should provide:

- Picker for capture, HTML variant, and CSS option.
- Index of generated matrix pages.
- No-CSS baseline pages for each generated HTML variant.
- Matrix table of generated combinations and compatibility status.
- Links to selector reports.
- Screenshot gallery.
- Direct links to original, backwards-compatible, and optimized pages.

Do not make the fixture lab depend on a running Vite server for correctness.
Generated HTML should still be inspectable as static files when possible.

## Design Decisions

| Decision                     | Class                     | Choice                                                               | Rationale                                                                                                                             |
| ---------------------------- | ------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| HTML variant names           | 2 coherence               | Use `original`, `backwards-compatible`, and `optimized`              | The names describe compatibility expectations without abbreviations                                                                   |
| CSS version names            | 2 coherence               | Use `original` and `semantic`                                        | `Semantic` names the target contract; `migrated` only names the process                                                               |
| Project structure            | 2 coherence               | Split `sidebar/`, `proposal/`, `fixture-lab/`, and root `generated/` | The repo now contains a distributable CSS project, proposal prose, and a test lab                                                     |
| Generated output             | 3 taste under constraints | Ignore root `generated/` by default                                  | Generated matrix pages and screenshots are bulky and reproducible                                                                     |
| Matrix UI                    | 2 coherence               | Generate all valid combinations and use the picker as navigation     | Reports and screenshots need stable artifact paths; humans need a way to find them                                                    |
| Backwards-compatible default | 1 evidence                | Additive hooks only until the CSS survey proves safe simplifications | The purpose of this variant is to measure preservation, not ideal HTML                                                                |
| First semantic CSS           | 2 coherence               | Start with an optimized Region/filter component                      | The full sidebar bridge proved too coupled to current dropdown internals; Region is complex enough to test component anatomy honestly |
| CSS corpus                   | 1 evidence                | Use public Kagi themes and gists, stored with metadata               | Compatibility should be measured against real user CSS                                                                                |
| Tooling                      | 3 taste under constraints | Use pnpm/Vite with static generated artifacts                        | Vite improves repeatability without turning examples into an app framework                                                            |
| Diff strategy                | 2 coherence               | Normalize files and generate scoped summaries                        | Whole-page raw diffs are evidence, but not the main review surface                                                                    |

## Implementation Plan

### Phase 1: Spec And Clean Scaffold

- [x] Add this spec.
- [x] Move sidebar-specific files into `sidebar/`, keeping specs under `specs/`.
- [x] Move proposal prose into `proposal/`.
- [x] Create `fixture-lab/` with source directories and a README.
- [x] Add root `generated/` to `.gitignore`.
- [x] Add `package.json` with pnpm scripts after confirming the tooling shape.
- [x] Keep stashed generated artifacts as reference, not as source to restore.

### Phase 2: CSS Corpus Survey

- [x] Seed `fixture-lab/css-corpus/original/` with the sidebar CSS sample.
- [x] Record sidebar metadata in `fixture-lab/css-corpus/manifest.json`.
- [x] Run a selector audit against current captured Kagi pages.
- [x] Produce `compatibility-summary.json`.
- [x] Add an experimental semantic sidebar CSS rewrite.
- [ ] Reclassify or replace the semantic sidebar CSS as optimized-only
      evidence.
- [ ] Collect public CSS samples into `fixture-lab/css-corpus/original/`.
- [ ] Preserve source URLs and retrieval dates for public samples.

### Phase 3: HTML Variant Generator

- [x] Capture current Kagi `/search` and `/html/search` HTML as
      `original`.
- [x] Generate `original` inspection pages.
- [x] Generate `backwards-compatible` pages by adding semantic hooks only.
- [ ] Generate normalized diff-friendly copies.
- [x] Generate `optimized` pages with breaking simplifications, starting with the
      filter shell and Region selector.

### Phase 4: CSS Injection Matrix

- [x] Generate matrix pages for capture x HTML variant x CSS sample.
- [x] Start with sidebar original CSS across original and backwards-compatible
      variants.
- [x] Include no-CSS baseline pages for each generated HTML variant.
- [x] Build a Vite picker/index over the generated matrix pages.
- [ ] Add original public themes across original and backwards-compatible.
- [x] Add optimized semantic examples for the sidebar.
- [ ] Narrow the optimized example to one honest semantic filter component if
      the full sidebar remains too coupled to current Kagi dropdown internals.

### Phase 5: Visual And Selector Verification

- [x] Add selector-match reports.
- [x] Report backwards-compatible selector regressions.
- [ ] Decide whether screenshot automation is worth maintaining.
- [ ] Add Playwright smoke checks for desktop and narrow widths only if the
      screenshot path earns its cost.
- [ ] Add screenshots for the sidebar matrix only if they become review
      evidence, not just generated noise.
- [ ] Fail checks on backwards-compatible selector regressions unless waived.

### Phase 6: Proposal Rewrite

- Update `making-kagi-simpler-smaller-easier-to-customize.md` from the new
  measured results.
- Keep the article focused on the Kagi proposal, not the tooling.
- Move bulky survey details into an appendix or generated report.

### Phase 7: Narrowed Semantic Sidebar Follow-Up

- [x] Add `specs/20260706T163940-semantic-sidebar-evaluation.md` as the active
      narrowed execution slice.
- [x] Update proposal docs to separate semantic hooks, semantic component
      structure, and native layout modes.
- [x] Document that backwards-compatible fixtures should stay focused on
      additive hooks and original Custom CSS.
- [x] Document that semantic sidebar proof belongs in optimized/breaking DOM.
- [x] Update generator or corpus labels if needed so generated pages reflect
      the narrowed matrix.
- [ ] Decide whether the current semantic sidebar CSS file should stay as a
      diagnostic bridge or be replaced by a Region-first semantic sample.

## Verification

The new fixture system is working when:

- `pnpm dev` opens an index with HTML variant, CSS sample, and CSS
  version pickers.
- `pnpm generate` produces deterministic output.
- `pnpm audit-css` reports selector compatibility by CSS sample and HTML
  variant.
- Original CSS samples that match `original` do not regress on
  `backwards-compatible` unless explicitly waived.
- The sidebar has working pages for:
  - `original + current sidebar CSS`.
  - `backwards-compatible + current sidebar CSS`.
  - `optimized + semantic Region/filter component CSS`.
- Any `backwards-compatible + semantic sidebar CSS` page is labeled as
  diagnostic, not as primary proposal evidence.
- The optimized sidebar or filter page uses simplified Region markup in the
  full-page example, not only in an isolated component fixture.
- The fixture lab works through Vite and remains inspectable as static generated
  files.
- Root `generated/` artifacts are reproducible and ignored by git.
- Raw/normalized diffs, selector summaries, and screenshots all point to the
  same conclusion.

## Open Questions

1. How large should the first CSS corpus be?

   Recommendation: start with 8-12 samples. Add more only after the audit script
   is stable.

2. Should the backwards-compatible variant allow any simplification?

   Recommendation: no at first. Additive-only gives a clean baseline. Revisit
   after the survey can prove a change does not affect the corpus.

3. Should source captures be committed?

   Recommendation: yes, after redaction. The proposal needs reproducible
   evidence, and generated output should be rebuildable from committed captures.

4. Should Playwright be required for every contributor?

   Recommendation: no, not yet. Keep `pnpm check` browser-free while the lab is
   proving the capture, generation, and selector-report shape. Add a separate
   visual command only if screenshots catch issues that selector reports and
   manual review miss.

5. Should optimized HTML remove all private classes?

   Recommendation: remove private IDs and classes where semantic hooks replace
   the concept. Keep classes only when they are still useful implementation
   details and do not leak into the public Custom CSS contract.

## Rejected Alternatives

### Keep The Previous Fixture Layout

Rejected. The previous layout confused compatibility, hook coverage, and
breaking simplification. It produced pages, but not a reliable argument.

### Use Only Component Fixtures

Rejected. Component fixtures explain transformations, but they cannot answer
whether real Custom CSS still works on a whole page.

### Use A Single Toy Custom CSS Sample

Rejected. A toy sample is useful for demos, not compatibility evidence.

### Avoid npm Tooling

Rejected for the primary workflow. Direct file opening should remain possible,
but selector audits, matrix generation, and screenshot checks need a repeatable
command surface.

### Build A Full Frontend App

Rejected. The fixture lab needs a static index and generated artifacts, not a
stateful app. Vite is a server and workflow tool here.

## References

- Kagi Custom CSS post: https://blog.kagi.com/tips/custom-css
- Kagi Custom CSS docs: https://help.kagi.com/kagi/features/custom-css.html
- OpenKagi themes: https://openkagi.com/
- Awesome Kagi CSS: https://github.com/kawaiier/awesome-kagi-css
- Kagi Darker: https://github.com/realrogue/kagi-darker
- Current appendix: `proposal/appendix-real-world-kagi-custom-css.md`
- Current proposal draft: `proposal/making-kagi-simpler-smaller-easier-to-customize.md`
- Sidebar stylesheet: `sidebar/kagi-sidebar.css`
