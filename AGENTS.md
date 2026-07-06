# Kagi Sidebar Agent Notes

## Project Context

This repo contains a CSS-only Kagi Custom CSS customization that moves Kagi web
search options from the horizontal toolbar into a compact left sidebar, plus a
local previewer for checking captured Kagi pages with Custom CSS files.

Primary files:

- `specs/kagi-sidebar.md` - Sidebar product and implementation spec.
- `src/kagi-sidebar.css` - CSS-only Kagi Custom CSS stylesheet.
- `proposal/` - Maintainer-facing Kagi semantic hooks and components proposal.
- `previewer/` - Source captures, optional Custom CSS files, tools, and Vite site.
- `generated/` - Ignored reproducible preview output.

Keep the release scoped to Kagi web search (`/search`) on desktop. Images,
Videos, News, Podcasts, Maps, Assistant, settings pages, and mobile/narrow
viewports are out of scope unless the user explicitly expands the target.

The old fixture-lab optimization matrix is historical. Current previewer work
should stay focused on captured Kagi search pages plus Custom CSS files.

## Git Workflow

Before reasoning about modified files or ownership of changes, check all three:

```bash
git status --short
git diff --
git diff --staged
```

Staged files may be intentional user checkpoints. Do not unstage, revert, or
overwrite them unless explicitly asked.

## Kagi DOM Structure

The useful live Kagi web search hooks observed in July 2026:

- `#sidebarForm` wraps the search filter controls.
- `._0_filters-panel` wraps `#sidebarForm`.
- `#dd_toggle_r` is Region.
- `#dd_toggle_order` is Order By / Sort.
- `#dd_toggle_dr` is Time / Date Range.
- `#dd_toggle_options` is Options / Matching.
- `#dd_toggle_lens` is Lens. It includes Kagi's native mini toggle for the last
  used lens and a dropdown list of lenses.
- `#menu-advanced-search-toggle` is Advanced. It links to
  `#menu-advanced-search` and opens Kagi's native advanced search modal/form.
- `._0_sidebar-filter-clear` contains the Clear link and is hidden when no
  filters are active.
- Active options use `.inner-label[aria-current="true"]`.

Kagi dropdown contents are present in the DOM on initial page load. They are not
rendered into a separate portal. Closed dropdowns are hidden mostly through
positioning, visibility, and fixed heights, so sidebar CSS must override:

- `position`
- `visibility`
- `height`
- `max-height`
- `overflow`

Images mode also has `#sidebarForm`, but with different filter controls. Gate
web-search-only CSS with the web search Matching control so both `/search` and
`/html/search` activate:

```text
body:has(#sidebarForm #dd_toggle_options)
```

Use the release desktop breakpoint unless manual testing says otherwise:

```text
@media (min-width: 1100px)
```

## CSS Implementation Notes

The current CSS-only approach:

- Uses `:has()` and therefore targets modern browsers only.
- Applies only when the web search Matching control is present, which covers
  both JS-enhanced `/search` and basic/no-JS `/html/search`.
- Uses `position: absolute` for `._0_filters-panel` so the sidebar scrolls
  with the page.
- Offsets Kagi's header, top panel, and result content by changing left padding.
- Aligns the sidebar to Kagi's centered max-width content container on very wide
  screens instead of pinning it to the viewport edge.
- Aligns the first sidebar option vertically with Kagi's top navigation tabs and
  does not show a separate `Search Options` title.
- Sets the sidebar width to fit `United States (US)` comfortably. Longer Region
  preview rows and pill labels should clip with ellipses instead of wrapping.
- Uses Kagi theme variables such as `--app-bg`, `--app-text`, `--primary-*`,
  `--link`, `--hover-bg`, and `--input-bg`.
- Hides generated group labels such as Lens, Sort, Time, and Matching to keep
  the sidebar compact.
- Orders the main sidebar controls as Matching, Time, Region, Sort, then Lens.
- Keeps the sidebar muted with low opacity until hover or keyboard focus.
- Keeps Lens as a native pill trigger in the sidebar. Lens options stay in
  Kagi's native dropdown and are not promoted into the closed sidebar.
- Keeps Sort as a native pill trigger only. Sort options stay in Kagi's native
  dropdown because they are less frequently used.
- Promotes Time's preset links above Kagi's native divider (`All` through
  `Past Year`) into the sidebar. Time also keeps a pill trigger; when opened,
  the full popup includes the custom date controls.
- Promotes both Matching options (`Verbatim` and `Personalized`) into the
  sidebar without a pill trigger.
- Moves Region's native pill trigger into the sidebar, preserving Kagi's current
  region label/caret, then previews the first four recent/pinned
  `li[data-recent]` items beneath it. Closed-state preview CSS is scoped with
  `#dd_toggle_r:not(:checked)` so opening the pill can use Kagi's native Region
  popup styling. Kagi may leave recent rows with the `hidden` attribute after
  filtering the open popup; closed-state CSS forces the first four recent rows
  visible again.
- Styles Advanced and active Clear as centered pill buttons matching the other
  controls. Advanced still opens Kagi's native advanced search modal/form.

The CSS should stay pasteable into Kagi Settings > Appearance > Custom CSS. Keep
it below Kagi's Custom CSS character limit. The last measured size of
`src/kagi-sidebar.css` was about 20 KB.

Kagi Custom CSS settings:

```text
https://kagi.com/settings/custom_css
```

Recovery path for bad Custom CSS:

```text
https://kagi.com/search?q=test&no_css=1
```

## Verification Workflow

Prefer user visual verification over agent-driven screenshot and browser checks
unless the user explicitly asks for automated validation. For CSS and preview
layout work, the highest-value default is:

1. Make the focused code or CSS change.
2. Share the exact generated/local URL or file path the user should inspect.
3. Describe the specific visual state to check.

Do not spend time running broad browser probes, screenshot sweeps, Playwright
measurements, or full previewer commands just to prove visual correctness. Ask
first before running expensive verification such as `pnpm generate` or browser
automation loops. Cheap static checks are fine when they directly catch edit
mistakes, such as syntax checks for touched scripts, CSS parsing, formatting
checks, and `git diff --check`.

If an automated check is still useful, keep it narrow and explain why it is
worth running before doing it. Stop once the check answers the specific
question; do not keep adding alternative tools after the user can verify faster
by looking at the page.

## Browser And Tooling Notes

The T3 Code collaborative browser worked for live Kagi DOM inspection:

- Start with `preview_status`.
- Use `preview_open` if no automation-capable preview is attached.
- Use `preview_navigate`, `preview_snapshot`, `preview_evaluate`, and
  `preview_resize` for inspection and responsive checks.

The shared Kagi session link worked for read-only DOM inspection. Treat any
tokenized Kagi URL as a credential:

- Do not print it back in final answers.
- Avoid storing it in files.
- Use neutral search queries.
- Avoid account/settings areas and state-changing actions.

Useful live test states:

- Plain web search: `/search?q=kagi+css+selectors`
- Filtered web search:
  `/search?q=kagi+css+selectors&r=us&dr=2&verbatim=1&personalized=0&order=2&dir=desc`
- Plain no-JS web search: `/html/search?q=kagi+css+selectors`
- Filtered no-JS web search:
  `/html/search?q=kagi+css+selectors&r=us&dr=2&verbatim=1&personalized=0&order=2&dir=desc`
- Unsupported mode fallback: `/images?q=kagi+css+selectors`
- Narrow viewport fallback: resize to about `900x900`.

Append `no_css=1` to Kagi test URLs during development to bypass any saved
Custom CSS before inspecting native markup or injecting the local CSS file. This
helps avoid confusing persisted account CSS with the current repo version.

Browser injection notes:

- Injecting a `<style>` tag with CSS text works for quick checks.
- Injected styles are lost on Kagi page reloads.
- Fetching `http://127.0.0.1` CSS from the HTTPS Kagi page failed.
- Loading a localhost stylesheet with `<link rel="stylesheet">` also failed.
- For exact-file checks, base64-encode the local CSS and inject it with
  `atob(...)`, or paste the file into Kagi Custom CSS for the real test.

Manual user verification is still required because Kagi Custom CSS persistence
cannot be fully simulated by browser-side injection.

When browser or tooling attempts fail repeatedly, update this section in the
same turn with the working method and the failed methods to avoid rediscovering
the same dead ends. Keep the note concrete: command, URL shape, browser tool,
and why the failed path did not work.

Local Playwright notes from July 2026:

- Importing bare `playwright` failed in this checkout because only
  `@playwright/test` was linked in `node_modules`.
- The Playwright-managed Chromium binary was not installed. Do not run
  `playwright install` without approval.
- If a narrow local browser measurement is explicitly approved, using
  `@playwright/test` with the system Chrome executable worked:

```js
import { chromium } from "@playwright/test";

const browser = await chromium.launch({
  headless: true,
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
```

## Verification Checklist

For CSS changes, check:

- Web search at desktop width shows the sidebar.
- No-JS web search at desktop width shows the sidebar.
- Very wide desktop widths keep the sidebar close to the result column.
- Images or another unsupported mode keeps Kagi's native horizontal toolbar.
- Width below `1100px` keeps Kagi's native horizontal toolbar.
- Active options are visibly highlighted via `[aria-current="true"]`.
- Lens appears as a pill and opens its native dropdown.
- Generated group labels such as Lens, Sort, Time, and Matching are hidden.
- Sort appears as a pill and opens its native dropdown.
- Time presets are visible without opening the dropdown, and the Time pill opens
  the custom date controls.
- Matching shows both options without a pill trigger.
- Region pill shows the current region, and the first four recent/pinned items
  are visible without opening the dropdown. Long Region labels clip with
  ellipses rather than wrapping or overlapping active indicators.
- Sidebar controls are muted until hover or focus.
- Region opens Kagi's native popup with the filter input, close control, full
  list, and internal scrolling.
- Region scrolls internally when open.
- Advanced opens the native advanced search modal/form.
- Clear appears only when filters are active and uses pill styling.
- Light and dark Kagi themes remain legible.
- `git diff --check` or an equivalent no-index check passes for new files.
- Files stay ASCII unless there is a clear reason to add non-ASCII.
