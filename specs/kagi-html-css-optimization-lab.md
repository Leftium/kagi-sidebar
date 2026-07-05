# Kagi HTML/CSS Optimization Lab

**Date**: 2026-07-06
**Status**: Draft
**Owner**: Project maintainer
**Branch**: local planning
**Supersedes**: Stashed generated fixture experiment from 2026-07-05

## One Sentence

Build a fixture lab that compares original Kagi HTML, a backwards-compatible
hooked version, and an optimized breaking version against original and semantic
Kagi Custom CSS.

## Overview

This spec replaces the first generated-example attempt with a cleaner evidence
pipeline. The new pipeline should make compatibility claims measurable:
original Custom CSS should keep working on original and backwards-compatible
HTML, while semantic Custom CSS should work on optimized breaking HTML.

## How To Read This Spec

Read first:

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

## Target Shape

The fixture lab should produce three Kagi HTML variants from the same captured
page.

```text
captured Kagi HTML
  -> original
  -> backwards-compatible
  -> optimized

real Custom CSS corpus
  -> original CSS
  -> semantic CSS, only when needed

HTML variant x CSS sample
  -> generated matrix pages
  -> picker/index page
  -> selector match reports
  -> screenshots
  -> byte and complexity measurements
```

The sidebar remains the first functional Custom CSS case. Other community CSS
examples should be used to measure breakage risk and selector compatibility, not
to prove functional layout changes they were never designed to make.

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
    SPEC.md

  proposal/
    making-kagi-simpler-smaller-easier-to-customize.md
    appendix-real-world-kagi-custom-css.md

  specs/
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

| Source | Role In Survey | Notes |
| --- | --- | --- |
| `kagi-sidebar.css` | First functional layout case | Local project CSS; expected to need a semantic rewrite for optimized HTML |
| Kagi Condensed | Real density/theme case | Public GitHub theme referenced in the existing appendix |
| Kagi Google-style theme | Layout-heavy visual theme | Useful for measuring private layout selector dependence |
| Kagi Plus | Broad component/theme case | Public theme linked from Kagi's Custom CSS material |
| Kagi Darker | Large full theme | Useful breakage-risk sample |
| Gruber Custom CSS | Small targeted tweaks | Good control case for low selector burden |
| High Contrast Purple | Accessibility-oriented CSS | Good for result/widget/action hook coverage |
| Faded Slop | AI-label result treatment | Good test for replacing `:has(.ai-stain-icon)` |
| OpenKagi or `awesome-kagi-css` themes | Wider survey pool | Use only public CSS with a stable source URL |

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

Do not rewrite every theme immediately. The first semantic rewrite target is
the sidebar. Other semantic files should be added only when the survey shows a
clear mechanical rewrite or a representative optimized-HTML failure worth
explaining.

The generated matrix should start with:

| HTML Variant | Original CSS | Semantic CSS |
| --- | --- | --- |
| Original | Must render | Not required |
| Backwards-compatible | Must render | Optional |
| Optimized | Expected to break for private-selector CSS | Must render for semantic examples |

CSS version names:

- `original`: CSS as authored for today's Kagi DOM.
- `semantic`: CSS rewritten to target the proposed semantic hooks and optimized
  HTML.

Avoid `migrated` as a persistent name. Migration is the process; semantic CSS is
the target artifact.

## Matrix Workflow

Generate all valid combinations, then expose them through an index page with
pickers.

```text
npm run lab:generate
  -> writes HTML variants
  -> writes valid HTML x CSS matrix pages
  -> writes selector and measurement reports
  -> writes screenshots when browser verification runs

npm run lab:dev
  -> opens the Vite fixture-lab site
  -> picker: HTML variant
  -> picker: CSS sample
  -> picker: CSS version
  -> link: generated artifact
  -> link: selector report
```

The picker should navigate to generated artifacts. It should not be the only
place where CSS injection happens. Generated files are the source of truth for
reports, screenshots, and review links; the picker is the ergonomic way to find
them.

Valid first-pass sidebar combinations:

| Combination | Purpose |
| --- | --- |
| `original + sidebar.original.css` | Shows today's project CSS against today's Kagi DOM |
| `backwards-compatible + sidebar.original.css` | Proves old functional CSS still works after additive hooks |
| `backwards-compatible + sidebar.semantic.css` | Optional bridge: proves semantic hooks can be used before the breaking HTML |
| `optimized + sidebar.semantic.css` | Shows the ideal future contract and simplified markup |

For public themes, generate `original` CSS against `original` and
`backwards-compatible` HTML first. Add semantic versions only when there is a
clear rewrite worth maintaining.

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
    original__sidebar__original.html
    backwards-compatible__sidebar__original.html
    backwards-compatible__sidebar__semantic.html
    optimized__sidebar__semantic.html
  reports/
    selector-matches.json
    compatibility-summary.json
    byte-counts.json
  screenshots/
```

CSS injection should be explicit and reversible:

```html
<link rel="stylesheet" href="../../fixture-lab/css-corpus/original/sidebar.css">
```

or, when a standalone file is needed:

```html
<style data-fixture-custom-css="kagi-sidebar">
  /* injected CSS */
</style>
```

Prefer linked CSS during development so browser devtools can identify the source
file. Inline CSS is useful for archived artifacts.

## Compatibility Survey

The survey should answer: "How much public Kagi Custom CSS would break if the
HTML changed?"

For each CSS sample and HTML variant, collect:

- Total selectors.
- Selectors that match at least one element.
- Selectors that matched original but no longer match backwards-compatible.
- Selectors that matched original but no longer match optimized.
- Selectors containing private Kagi IDs/classes.
- Selectors containing structural dependencies such as `:nth-child`,
  `:nth-of-type`, sibling combinators, or deep SVG paths.
- Selectors using modern features such as `:has()`.
- Rules that target documented or likely-stable CSS variables.

Compatibility classifications:

| Classification | Meaning |
| --- | --- |
| Preserved | Selector matched original and backwards-compatible |
| Regression | Selector matched original but not backwards-compatible |
| Expected optimized break | Selector matched original/backwards-compatible but not optimized |
| Mechanical migration | Selector maps cleanly to a proposed semantic hook |
| Manual migration | Selector depends on structure, sibling order, text shape, or private SVG internals |
| Already token-based | Rule mostly uses CSS variables or broad theme selectors |

The backwards-compatible variant should have zero unwaived regressions for the
survey corpus. The optimized variant should have a clear migration story for the
sidebar and at least a measured breakage report for the rest.

## Tooling Recommendation

Create a small npm/Vite project for the fixture lab.

Direct file opening is viable for static HTML, but it is the wrong primary
workflow for this project. The lab needs relative asset loading, CSS
injection, viewport checks, selector audits, screenshots, and a single command
that a maintainer can run without remembering paths.

Recommended tools:

- Vite for a local static dev server.
- Prettier for HTML and CSS normalization.
- A Node HTML parser such as `parse5` or `cheerio` for transformations.
- `postcss` plus `postcss-selector-parser` for selector audits.
- Playwright for screenshot and viewport smoke checks.

Keep the app minimal. This does not need React, Svelte, Vue, or a design system.
The generated pages are static evidence artifacts; Vite is only the server and
developer workflow.

Suggested scripts:

```json
{
  "scripts": {
    "lab:dev": "vite --host 127.0.0.1 fixture-lab/site",
    "lab:generate": "node fixture-lab/tools/generate-fixtures.mjs",
    "lab:audit": "node fixture-lab/tools/audit-selectors.mjs",
    "lab:format": "prettier --write \"fixture-lab/**/*.{html,css,json,md}\" \"specs/**/*.md\"",
    "lab:check": "npm run lab:generate && npm run lab:audit && playwright test"
  }
}
```

The Vite site should provide:

- Picker for HTML variant, CSS sample, and CSS version.
- Index of generated matrix pages.
- CSS sample picker.
- Matrix table of generated combinations and compatibility status.
- Links to selector reports.
- Screenshot gallery.
- Direct links to original, backwards-compatible, and optimized pages.

Do not make the fixture lab depend on a running Vite server for correctness.
Generated HTML should still be inspectable as static files when possible.

## Design Decisions

| Decision | Class | Choice | Rationale |
| --- | --- | --- | --- |
| HTML variant names | 2 coherence | Use `original`, `backwards-compatible`, and `optimized` | The names describe compatibility expectations without abbreviations |
| CSS version names | 2 coherence | Use `original` and `semantic` | `Semantic` names the target contract; `migrated` only names the process |
| Project structure | 2 coherence | Split `sidebar/`, `proposal/`, `fixture-lab/`, and root `generated/` | The repo now contains a distributable CSS project, proposal prose, and a test lab |
| Generated output | 3 taste under constraints | Ignore root `generated/` by default | Generated matrix pages and screenshots are bulky and reproducible |
| Matrix UI | 2 coherence | Generate all valid combinations and use the picker as navigation | Reports and screenshots need stable artifact paths; humans need a way to find them |
| Backwards-compatible default | 1 evidence | Additive hooks only until the CSS survey proves safe simplifications | The purpose of this variant is to measure preservation, not ideal HTML |
| First semantic CSS | 2 coherence | Rewrite `kagi-sidebar.css` first | It is the known functional Custom CSS case and the project origin |
| CSS corpus | 1 evidence | Use public Kagi themes and gists, stored with metadata | Compatibility should be measured against real user CSS |
| Tooling | 3 taste under constraints | Use npm/Vite with static generated artifacts | Vite improves repeatability without turning examples into an app framework |
| Diff strategy | 2 coherence | Normalize files and generate scoped summaries | Whole-page raw diffs are evidence, but not the main review surface |

## Implementation Plan

### Phase 1: Spec And Clean Scaffold

- Add this spec.
- Move sidebar-specific files into `sidebar/`.
- Move proposal prose into `proposal/`.
- Create `fixture-lab/` with source directories and a README.
- Add root `generated/` to `.gitignore`.
- Add `package.json` with the `lab:*` scripts after confirming the tooling
  shape.
- Keep stashed generated artifacts as reference, not as source to restore.

### Phase 2: CSS Corpus Survey

- Collect public CSS samples into `fixture-lab/css-corpus/original/`.
- Record metadata in `fixture-lab/css-corpus/manifest.json`.
- Preserve source URLs and retrieval dates.
- Run a selector audit against current captured Kagi pages.
- Produce `compatibility-summary.json`.

### Phase 3: HTML Variant Generator

- Capture or restore current Kagi `/search` and `/html/search` HTML as
  `original`.
- Generate normalized `original` inspection pages.
- Generate `backwards-compatible` pages by adding semantic hooks only.
- Generate `optimized` pages with breaking simplifications, starting with the
  filter shell and Region selector.

### Phase 4: CSS Injection Matrix

- Generate matrix pages for HTML variant x CSS sample.
- Start with sidebar across all three variants.
- Add original public themes across original and backwards-compatible.
- Add optimized semantic examples only when useful.
- Build a Vite picker/index over the generated matrix pages.

### Phase 5: Visual And Selector Verification

- Add selector-match reports.
- Add Playwright smoke checks for desktop and narrow widths.
- Add screenshots for the sidebar matrix.
- Fail checks on backwards-compatible selector regressions unless waived.

### Phase 6: Proposal Rewrite

- Update `making-kagi-simpler-smaller-easier-to-customize.md` from the new
  measured results.
- Keep the article focused on the Kagi proposal, not the tooling.
- Move bulky survey details into an appendix or generated report.

## Verification

The new fixture system is working when:

- `npm run lab:dev` opens an index with HTML variant, CSS sample, and CSS
  version pickers.
- `npm run lab:generate` produces deterministic output.
- `npm run lab:audit` reports selector compatibility by CSS sample and HTML
  variant.
- Original CSS samples that match `original` do not regress on
  `backwards-compatible` unless explicitly waived.
- The sidebar has working pages for:
  - `original + current sidebar CSS`.
  - `backwards-compatible + current sidebar CSS`.
  - `backwards-compatible + semantic sidebar CSS`, if useful.
  - `optimized + semantic sidebar CSS`.
- The optimized sidebar page uses simplified Region markup in the full-page
  example, not only in an isolated component fixture.
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

   Recommendation: make screenshots part of `lab:check`, but keep
   `lab:generate` and `lab:audit` usable without a browser.

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
