import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import { auditCss } from "./css-metrics.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const generatedRoot = path.join(projectRoot, "generated");
const fixtureRoot = path.join(projectRoot, "fixture-lab");
const captureRoot = path.join(fixtureRoot, "captures", "original");

const plannedBundleVariants = ["original", "backwards-compatible", "optimized"];
const implementedBundleVariants = [
  "original",
  "backwards-compatible",
  "optimized",
];
const currentKagiCssPaths = [
  "fixture-lab/kagi-authored-css/current/search-layout.scss.css",
  "fixture-lab/kagi-authored-css/current/main-search-results.scss.css",
  "fixture-lab/kagi-authored-css/current/kagi_themes.scss.css",
  "fixture-lab/kagi-authored-css/current/framework__main.scss.css",
  "fixture-lab/kagi-authored-css/current/tooltip_new.scss.css",
];
const optimizedKagiCssPaths = [
  ...currentKagiCssPaths,
  "fixture-lab/kagi-authored-css/optimized/search-controls.css",
];
const bundleDefinitions = [
  {
    id: "original",
    htmlVariant: "original",
    kagiCssVariant: "current",
    kagiCssSource: "captured-vendored",
    kagiCssPaths: currentKagiCssPaths,
  },
  {
    id: "backwards-compatible",
    htmlVariant: "backwards-compatible",
    kagiCssVariant: "current",
    kagiCssSource: "captured-vendored",
    kagiCssPaths: currentKagiCssPaths,
  },
  {
    id: "optimized",
    htmlVariant: "optimized",
    kagiCssVariant: "optimized",
    kagiCssSource: "local-lab",
    kagiCssPaths: optimizedKagiCssPaths,
  },
].filter((bundle) => implementedBundleVariants.includes(bundle.id));
const preferredCaptureOrder = ["search", "html-search"];
const noCssOption = {
  sampleId: "none",
  sampleName: "No CSS",
  version: "none",
  path: null,
  builtIn: true,
};
const kagiOrigin = "https://kagi.com";
const transparentPixelDataUri =
  "data:image/gif;base64,R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==";

const semanticFilterHooks = new Map([
  ["#dd_toggle_options", "matching"],
  ["#dd_toggle_dr", "time"],
  ["#dd_toggle_r", "region"],
  ["#dd_toggle_order", "sort"],
  ["#dd_toggle_lens", "lens"],
]);

const optimizedFilterToggleIds = new Map(
  [...semanticFilterHooks.values()].map((filterName) => [
    filterName,
    `kagi-filter-${filterName}-toggle`,
  ]),
);

const semanticFilterKinds = new Map([
  ["matching", "multi-select"],
  ["time", "single-select"],
  ["region", "single-select"],
  ["sort", "single-select"],
  ["lens", "single-select"],
]);

const promotableFilters = new Set(["matching", "time", "region"]);

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function readJsonIfExists(filePath) {
  if (!(await pathExists(filePath))) {
    return null;
  }

  return readJson(filePath);
}

async function listHtmlCaptures() {
  const captureDir = captureRoot;

  if (!(await pathExists(captureDir))) {
    return [];
  }

  const entries = await fs.readdir(captureDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => ({
      id: path.basename(entry.name, ".html"),
      fileName: entry.name,
      sourcePath: path.join(captureDir, entry.name),
      domainInfoPath: path.join(
        captureDir,
        `${path.basename(entry.name, ".html")}.domain-info.json`,
      ),
    }))
    .sort(compareCaptures);
}

async function ensureGeneratedDirs() {
  await Promise.all([
    fs.rm(path.join(generatedRoot, "html"), { recursive: true, force: true }),
    fs.rm(path.join(generatedRoot, "matrix"), { recursive: true, force: true }),
    fs.rm(path.join(generatedRoot, "reports"), {
      recursive: true,
      force: true,
    }),
  ]);

  const dirs = [
    ...plannedBundleVariants.map((variant) =>
      path.join(generatedRoot, "html", variant),
    ),
    path.join(generatedRoot, "matrix"),
    path.join(generatedRoot, "reports"),
    path.join(generatedRoot, "screenshots"),
  ];

  await Promise.all(dirs.map((dir) => fs.mkdir(dir, { recursive: true })));
}

async function cssMetricsForLocalPath(relativePath) {
  const body = await fs.readFile(path.join(projectRoot, relativePath), "utf8");

  return auditCss(body, relativePath);
}

function emptyCssMetrics() {
  return {
    sourceBytes: 0,
    minifiedBytes: 0,
    bytes: 0,
    lineCount: 0,
    selectorCount: 0,
    privateSelectorCount: 0,
    privateSelectorTokenCount: 0,
    privateSelectorTokens: [],
    structuralSelectorCount: 0,
    modernSelectorCount: 0,
    declarationCount: 0,
    tokenDeclarationCount: 0,
  };
}

function combineCssMetrics(items) {
  const totals = emptyCssMetrics();
  const privateSelectorTokens = new Set();

  for (const item of items) {
    for (const key of [
      "sourceBytes",
      "minifiedBytes",
      "bytes",
      "lineCount",
      "selectorCount",
      "privateSelectorCount",
      "privateSelectorTokenCount",
      "structuralSelectorCount",
      "modernSelectorCount",
      "declarationCount",
      "tokenDeclarationCount",
    ]) {
      totals[key] += item[key] ?? 0;
    }

    for (const token of item.privateSelectorTokens ?? []) {
      privateSelectorTokens.add(token);
    }
  }

  totals.privateSelectorTokens = [...privateSelectorTokens].sort();
  totals.privateSelectorTokenCount = totals.privateSelectorTokens.length;
  totals.bytes = totals.minifiedBytes;

  return totals;
}

async function bundleOptions() {
  return Promise.all(
    bundleDefinitions.map(async (bundle) => {
      const kagiAuthoredCssMetrics = bundle.kagiCssPaths.length
        ? await Promise.all(
            bundle.kagiCssPaths.map((cssPath) =>
              cssMetricsForLocalPath(cssPath),
            ),
          )
        : null;

      return {
        ...bundle,
        kagiAuthoredCssMetrics: kagiAuthoredCssMetrics
          ? combineCssMetrics(kagiAuthoredCssMetrics)
          : null,
      };
    }),
  );
}

function cssVersionsForSample(sample) {
  const versions = [];

  if (sample.local_original) {
    versions.push("original");
  }

  if (sample.local_semantic) {
    versions.push("semantic");
  }

  return versions;
}

function cssOptionsForSamples(samples) {
  return [
    noCssOption,
    ...samples.flatMap((sample) =>
      cssVersionsForSample(sample).map((version) => ({
        sampleId: sample.id,
        sampleName: sample.name,
        version,
        path: cssPathForVersion(sample, version),
        builtIn: false,
      })),
    ),
  ];
}

function relativeProjectPath(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
}

function compareCaptures(a, b) {
  const aIndex = preferredCaptureOrder.indexOf(a.id);
  const bIndex = preferredCaptureOrder.indexOf(b.id);

  if (aIndex !== -1 || bIndex !== -1) {
    return (
      (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) -
      (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex)
    );
  }

  return a.id.localeCompare(b.id);
}

function toKagiAssetUrl(value) {
  if (!value || value.startsWith("http") || value.startsWith("data:")) {
    return value;
  }

  if (value.startsWith("about:blank#redacted-kagi-favicon-proxy")) {
    return transparentPixelDataUri;
  }

  if (value.startsWith("/")) {
    return `${kagiOrigin}${value}`;
  }

  return value;
}

function assetRevisionFromHref(value) {
  if (!value) {
    return null;
  }

  const url = new URL(value, kagiOrigin);
  const assetMatch = url.pathname.match(/^\/asset\/([^/]+)\//);

  if (!assetMatch) {
    return null;
  }

  return {
    assetId: assetMatch[1],
    version: url.searchParams.get("v"),
  };
}

function capturedAssetRevision($) {
  for (const element of $("link[href]").toArray()) {
    const revision = assetRevisionFromHref($(element).attr("href"));

    if (revision) {
      return revision;
    }
  }

  return null;
}

function kagiRuntimeScriptUrls($) {
  const revision = capturedAssetRevision($);

  if (!revision) {
    return [];
  }

  const suffix = revision.version
    ? `?v=${encodeURIComponent(revision.version)}`
    : "";

  return ["k_sea.js", "k_serp.js"].map(
    (fileName) =>
      `${kagiOrigin}/asset/${revision.assetId}/js/${fileName}${suffix}`,
  );
}

function runtimeState($, capture) {
  if (rendererForCapture(capture) !== "enhanced") {
    return "none";
  }

  if ($("script").length) {
    return "source";
  }

  return "none";
}

function ensureEnhancedRuntimeScripts($, capture) {
  if (runtimeState($, capture) !== "none") {
    return [];
  }

  if (rendererForCapture(capture) !== "enhanced") {
    return [];
  }

  const scriptUrls = kagiRuntimeScriptUrls($);

  for (const src of scriptUrls) {
    $("head").append(
      `\n    <script src="${src}" data-fixture-runtime="kagi"></script>`,
    );
  }

  return scriptUrls;
}

function jsonForInlineScript(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function domainInfoPayload(domainInfoCapture) {
  return domainInfoCapture?.payload ?? null;
}

function injectDomainInfoReplay($, capture, domainInfoCapture) {
  const payload = domainInfoPayload(domainInfoCapture);

  if (rendererForCapture(capture) !== "enhanced" || !payload) {
    return "none";
  }

  const script = `
    <script data-fixture-domain-info="captured">
      (() => {
        const payload = ${jsonForInlineScript(payload)};
        window.__kagiFixtureDomainInfoPayload = payload;

        const dispatch = () => {
          window.dispatchEvent(
            new CustomEvent("provider:domain_info", {
              detail: { payload },
            }),
          );
        };

        const replayWhenRuntimeIsReady = (attempt = 0) => {
          if (typeof window.openDomainInfo === "function") {
            dispatch();
            return;
          }

          if (attempt < 100) {
            window.setTimeout(() => replayWhenRuntimeIsReady(attempt + 1), 50);
          }
        };

        if (document.readyState === "loading") {
          document.addEventListener(
            "DOMContentLoaded",
            () => replayWhenRuntimeIsReady(),
            { once: true },
          );
        } else {
          replayWhenRuntimeIsReady();
        }
      })();
    </script>`;

  $("head").append(script);
  $("html").attr("data-fixture-domain-info", "captured");

  return "captured";
}

function prepareForLocalViewing(html, capture, domainInfoCapture) {
  const $ = cheerio.load(html, { decodeEntities: false });

  $("link[href]").each((_, element) => {
    const node = $(element);
    node.attr("href", toKagiAssetUrl(node.attr("href")));
  });

  $("script[src]").each((_, element) => {
    const node = $(element);
    node.attr("src", toKagiAssetUrl(node.attr("src")));
  });

  $("img[src], source[src], video[poster]").each((_, element) => {
    const node = $(element);

    for (const attr of ["src", "poster"]) {
      if (node.attr(attr) != null) {
        node.attr(attr, toKagiAssetUrl(node.attr(attr)));
      }
    }
  });

  $("img[srcset], source[srcset]").each((_, element) => {
    const node = $(element);
    const srcset = node.attr("srcset");

    if (!srcset) {
      return;
    }

    node.attr(
      "srcset",
      srcset
        .split(",")
        .map((candidate) => {
          const parts = candidate.trim().split(/\s+/);
          parts[0] = toKagiAssetUrl(parts[0]);
          return parts.join(" ");
        })
        .join(", "),
    );
  });

  const sourceRuntime = runtimeState($, capture);
  const inferredRuntimeScripts = ensureEnhancedRuntimeScripts($, capture);
  const runtime =
    sourceRuntime !== "none"
      ? sourceRuntime
      : inferredRuntimeScripts.length
        ? "inferred-kagi"
        : "none";
  const domainInfo = injectDomainInfoReplay($, capture, domainInfoCapture);

  $("html").attr("data-fixture-js-runtime", runtime);
  $("html").attr("data-fixture-domain-info", domainInfo);

  return $.html();
}

function rendererForCapture(capture) {
  return capture.id === "html-search" ? "basic" : "enhanced";
}

function resultModeFromPath(value) {
  if (!value) {
    return null;
  }

  const url = new URL(value, kagiOrigin);
  const pathname = url.pathname.replace(/^\/html(?=\/)/, "");
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "search";

  if (firstSegment === "search") {
    return "web";
  }

  return firstSegment || null;
}

function addResultNavigationHooks($) {
  $("#tonav")
    .attr("data-kagi-search-tabs", "")
    .attr("data-kagi-result-nav", "");

  $("#tonav")
    .find("a[href], button[formaction]")
    .each((_, element) => {
      const node = $(element);
      const mode = resultModeFromPath(
        node.attr("href") ?? node.attr("formaction"),
      );

      if (!mode) {
        return;
      }

      node.attr("data-kagi-result-mode-link", mode);

      if (/\b--active\b/.test(node.attr("class") ?? "")) {
        node.attr("aria-current", "page");
      }
    });
}

function addResultActionHooks($) {
  $(".__sri_more_menu")
    .attr("data-kagi-popover", "")
    .attr("data-kagi-action-menu", "");
  $(".__sri_more_menu ._0_k_ui_dropdown_first_item button").attr(
    "data-kagi-popover-trigger",
    "",
  );
  $(".__sri_more_menu ._0_k_ui_dropdown_data_list").attr(
    "data-kagi-popover-panel",
    "",
  );

  $("._0_rank-icons")
    .attr("data-kagi-result-rank-control", "")
    .attr("data-kagi-action", "domain-info");
  $("#domainInfoModal")
    .attr("data-kagi-popover", "domain-info")
    .attr("data-kagi-popover-panel", "")
    .attr("data-kagi-action-panel", "domain-info");
  $("#domainInfoModal .ranked-box-close").attr(
    "data-kagi-action",
    "close-domain-info",
  );
  $("#domainInfoModal ._0_d_info_rank_btns").attr(
    "data-kagi-rank-control-group",
    "",
  );
  $("#domainInfoModal input[name='domain_rank']").each((_, element) => {
    const input = $(element);
    const id = input.attr("id");
    const rankActionByKind = new Map([
      ["-2", "rank-block"],
      ["-1", "rank-lower"],
      ["0", "rank-normal"],
      ["1", "rank-raise"],
      ["2", "rank-pin"],
    ]);

    input.attr("data-kagi-rank-value", input.attr("data-kind") ?? "");

    if (id) {
      $(`#domainInfoModal label[for="${id}"]`)
        .attr(
          "data-kagi-action",
          rankActionByKind.get(input.attr("data-kind")) ?? "rank-adjust",
        )
        .attr("data-kagi-rank-option", "");
    }
  });
  $("._0_summarize_page").attr("data-kagi-action", "summarize");
  $("._0_discuss_document").attr("data-kagi-action", "discuss");
  $("#load_more_results").attr("data-kagi-action", "load-more");

  $("a, button").each((_, element) => {
    const node = $(element);
    const text = normalizeText(node.text());

    if (text === "More results from this site") {
      node.attr("data-kagi-action", "more-from-site");
    } else if (text === "Remove results from this site") {
      node.attr("data-kagi-action", "remove-site");
    } else if (text === "Open page in Web Archive") {
      node.attr("data-kagi-action", "web-archive");
    }
  });
}

function addWidgetHooks($) {
  $(".related-searches")
    .attr("data-kagi-widget", "related-searches")
    .find(".related-items")
    .attr("data-kagi-widget-body", "");
  $("#interesting_finds").attr("data-kagi-widget", "interesting-finds");
  $(".widget_holder").attr("data-kagi-widget", "dynamic-results");
}

function addSemanticPageHooks($, capture, variant) {
  $("html").attr("data-kagi-fixture-capture", capture.id);
  $("body")
    .attr("data-kagi-contract", "search-dom-v0")
    .attr("data-kagi-surface", "search")
    .attr("data-kagi-result-mode", "web")
    .attr("data-kagi-renderer", rendererForCapture(capture))
    .attr("data-kagi-page", "search")
    .attr("data-kagi-mode", "web")
    .attr("data-kagi-fixture-variant", variant);

  $("header.app-header")
    .attr("data-kagi-app-header", "")
    .attr("data-kagi-layout-slot", "app-header");
  $(".top-panel-box")
    .attr("data-kagi-top-panel", "")
    .attr("data-kagi-layout-slot", "search-header");
  $("#_0_app_content")
    .attr("data-kagi-result-page", "")
    .attr("data-kagi-layout-slot", "result-page");
  $("#searchForm").attr("data-kagi-search-form", "");
  $("#searchForm")
    .find('[name="q"]')
    .first()
    .attr("data-kagi-search-input", "");
  $("#searchForm")
    .find('button[type="submit"], input[type="submit"]')
    .first()
    .attr("data-kagi-search-submit", "");
  addResultNavigationHooks($);
  $("._0_filters-panel")
    .attr("data-kagi-filter-panel", "")
    .attr("data-kagi-layout-slot", "search-controls");
  $("#sidebarForm")
    .attr("data-kagi-search-filters", "")
    .attr("data-kagi-filter-form", "");

  for (const [selector, filterName] of semanticFilterHooks) {
    const toggle = $(selector);
    const filter = toggle.closest(".filter-item");

    toggle.attr("data-kagi-filter-toggle", filterName);
    filter.attr("data-kagi-filter", filterName);
    filter.attr(
      "data-kagi-filter-kind",
      semanticFilterKinds.get(filterName) ?? "single-select",
    );

    if (promotableFilters.has(filterName)) {
      filter.attr("data-kagi-promotable", "true");
    }

    filter
      .find(".dd-toggle-label")
      .first()
      .attr("data-kagi-filter-trigger", "")
      .attr("aria-expanded", toggle.is(":checked") ? "true" : "false");
    filter.find(".dd-list").first().attr("data-kagi-filter-options", "");
    filter.find(".inner-label").attr("data-kagi-filter-option", "");
    filter.find(".dd-section").each((_, section) => {
      const node = $(section);
      const sectionName = node.attr("data-name");

      if (sectionName) {
        node.attr("data-kagi-filter-section", sectionName);
      }
    });

    if (filterName === "region") {
      filter.find(".list_filter_wrpr").attr("data-kagi-filter-search", "");
      filter.find(".list_filter").attr("data-kagi-region-search", "");
      filter.find("._0_data_sort_list").attr("data-kagi-region-list", "");
      filter.find("li[data-recent]").attr("data-kagi-filter-recent", "");
    }
  }

  $("#menu-advanced-search-toggle")
    .attr("data-kagi-action", "advanced-search")
    .closest(".filter-item")
    .attr("data-kagi-filter-action", "advanced-search");
  $("._0_sidebar-filter-clear")
    .attr("data-kagi-filter-action", "clear-filters")
    .find("a, button")
    .attr("data-kagi-action", "clear-filters");

  $("._0_main-search-results")
    .attr("data-kagi-results", "")
    .attr("data-kagi-layout-slot", "result-list");
  $(".sri-group").attr("data-kagi-result-group", "");
  $("._0_SRI, .search-result")
    .attr("data-kagi-result", "")
    .attr("data-kagi-result-type", "organic");
  $(".sr-group").attr("data-kagi-result-group", "subresults");
  $(".sr-group .__srgi")
    .attr("data-kagi-result", "")
    .attr("data-kagi-result-type", "grouped");
  $(".__sri-title, ._0_TITLE").attr("data-kagi-result-title", "");
  $("a.__sri_title_link, .__sri-title-box > a, .__srgi-title > a").attr(
    "data-kagi-result-title",
    "",
  );
  $("a.__sri_title_link, .__sri-title-box > a, .__srgi-title > a").attr(
    "data-kagi-result-title-link",
    "",
  );
  $(".__sri-url, .__sri-url-box a").attr("data-kagi-result-url", "");
  $(".__sri-desc, ._0_DESC")
    .attr("data-kagi-result-description", "")
    .attr("data-kagi-result-snippet", "");
  $(".__sri_more_menu_box").attr("data-kagi-result-actions", "");
  addResultActionHooks($);
  addWidgetHooks($);
}

function addBackwardsCompatibleHooks(html, capture) {
  const $ = cheerio.load(html, { decodeEntities: false });

  addSemanticPageHooks($, capture, "backwards-compatible");

  return $.html();
}

function normalizeText(value) {
  return value.trim().replace(/\s+/g, " ");
}

function removeClasses(node, classNames) {
  const current = node.attr("class");

  if (!current) {
    return;
  }

  const removed = new Set(classNames);
  const next = current
    .split(/\s+/)
    .filter((className) => className && !removed.has(className));

  if (next.length) {
    node.attr("class", next.join(" "));
  } else {
    node.removeAttr("class");
  }
}

function addClasses(node, classNames) {
  const current = new Set(
    (node.attr("class") ?? "").split(/\s+/).filter(Boolean),
  );

  for (const className of classNames) {
    current.add(className);
  }

  node.attr("class", [...current].join(" "));
}

function renameOptimizedFilterToggles($) {
  for (const [filterName, nextId] of optimizedFilterToggleIds) {
    const toggle = $(`[data-kagi-filter-toggle="${filterName}"]`).first();

    if (!toggle.length) {
      continue;
    }

    const previousId = toggle.attr("id");
    toggle.attr("id", nextId);

    if (previousId) {
      $(`[for="${previousId}"]`).attr("for", nextId);
    }
  }
}

function optimizeFilterShell($) {
  const filterForm = $("[data-kagi-search-filters]").first();

  filterForm.removeAttr("id");
  renameOptimizedFilterToggles($);
}

function filterFormState(optionLinks, removedParams) {
  const activeHref =
    optionLinks.filter('[aria-current="true"]').first().attr("href") ??
    optionLinks.first().attr("href") ??
    "/search";
  const url = new URL(activeHref, kagiOrigin);

  for (const param of removedParams) {
    url.searchParams.delete(param);
  }

  return {
    action: url.pathname,
    params: [...url.searchParams.entries()],
  };
}

function regionFormState(regionLinks) {
  return filterFormState(regionLinks, ["r"]);
}

function appendHiddenInputs($, form, params) {
  for (const [name, value] of params) {
    form.append($("<input>").attr({ type: "hidden", name, value }));
  }
}

function buildGetForm($, state, attrs = {}) {
  const form = $("<form></form>").attr({
    method: "get",
    action: state.action,
    ...attrs,
  });

  appendHiddenInputs($, form, state.params);
  return form;
}

function buildFilterToggle($, filterName) {
  return $("<input>").attr({
    type: "checkbox",
    id: optimizedFilterToggleIds.get(filterName),
    class: "dd-toggle",
    "data-kagi-filter-toggle": filterName,
  });
}

function buildCaret($) {
  return $("<i></i>")
    .addClass("caret")
    .append($("<svg></svg>").append($("<use>").attr("href", "#caret_down")));
}

function buildFilterLabel($, filterName, labelText) {
  const label = $("<label></label>").attr({
    class: "dd-toggle-label",
    for: optimizedFilterToggleIds.get(filterName),
    "data-header": labelText,
    "aria-expanded": "false",
    "data-kagi-filter-trigger": "",
  });
  const text = $("<div></div>")
    .addClass("textContent")
    .attr("data-kagi-filter-label", "")
    .text(labelText);

  label.append(text, buildCaret($));
  return label;
}

function buildFilterOptionsPanel($, content, attrs = {}) {
  return $("<div></div>")
    .attr({
      "data-kagi-filter-options": "",
      ...attrs,
    })
    .addClass("dd-list")
    .append(content);
}

function rebuildFilterShell(
  $,
  filter,
  filterName,
  labelText,
  panel,
  extras = [],
) {
  addClasses(filter, ["dropdown", "filter-item"]);
  filter
    .empty()
    .append(
      buildFilterToggle($, filterName),
      buildFilterLabel($, filterName, labelText),
      panel,
      ...extras,
    );
}

function filterTriggerText(filter, fallback) {
  return (
    normalizeText(
      filter.find("[data-kagi-filter-trigger] .textContent").text(),
    ) ||
    normalizeText(filter.find("[data-kagi-filter-trigger]").text()) ||
    fallback
  );
}

function filterOptionButtonFromLink($, link, fallbackName) {
  const source = $(link);
  const name = source.attr("data-name") ?? fallbackName;

  if (!name) {
    return null;
  }

  const href = source.attr("href");
  const targetValue = href
    ? new URL(href, kagiOrigin).searchParams.get(name)
    : null;
  const value = targetValue ?? source.attr("data-value") ?? "";
  const button = $("<button></button>");

  button
    .attr("type", "submit")
    .attr("name", name)
    .attr("value", value)
    .attr("data-kagi-filter-option", "")
    .addClass("inner-label")
    .text(normalizeText(source.text()));

  if (source.hasClass("filter-checkbox")) {
    button.addClass("filter-checkbox");
  }

  if (source.attr("aria-current") != null) {
    button.attr("aria-current", source.attr("aria-current"));
  }

  return button;
}

function buildFilterOptionItem($, button, source) {
  const item = $("<li></li>");
  const sourceItem = source.closest("li");

  if (sourceItem.hasClass("ul")) {
    item.addClass("ul");
  }

  if (sourceItem.attr("data-recent") != null) {
    item.attr({
      "data-recent": "",
      "data-kagi-filter-recent": "",
    });
  }

  item.append(button);
  return item;
}

function appendFilterOptionItems($, parent, links, fallbackName, decorate) {
  links.each((_, link) => {
    const source = $(link);
    const button = filterOptionButtonFromLink($, link, fallbackName);

    if (!button) {
      return;
    }

    decorate?.(button, source);
    parent.append(buildFilterOptionItem($, button, source));
  });
}

function appendFilterOptionButtons($, parent, links, fallbackName, decorate) {
  links.each((_, link) => {
    const button = filterOptionButtonFromLink($, link, fallbackName);

    if (!button) {
      return;
    }

    decorate?.(button, $(link));
    parent.append(button);
  });
}

function buildSeparator($) {
  return $("<li></li>").addClass("no-hov-bg sep");
}

function buildTimeCustomDateForm($, state, timeFilter) {
  const sourceForm = timeFilter.find("#mm-image").first();

  if (!sourceForm.length) {
    return $();
  }

  const form = sourceForm.clone();

  form.attr({
    "data-kagi-time-form": "custom-range",
    "data-kagi-filter-section": "custom-range",
  });
  appendHiddenInputs($, form, state.params);
  form
    .find('button[type="submit"], button:not([type])')
    .attr("type", "submit")
    .attr("data-kagi-action", "date-range-search");

  return form;
}

function optimizeMatchingFilter($) {
  const matchingFilter = $('[data-kagi-filter="matching"]').first();
  const optionLinks = matchingFilter.find(
    "[data-kagi-filter-option][data-name]",
  );

  if (!matchingFilter.length || !optionLinks.length) {
    return;
  }

  const optionNames = [
    ...new Set(
      optionLinks
        .map((_, link) => $(link).attr("data-name"))
        .get()
        .filter(Boolean),
    ),
  ];
  const state = filterFormState(optionLinks, optionNames);
  const form = buildGetForm($, state, {
    "data-kagi-matching-form": "",
  });
  const list = $("<ul></ul>");

  optionLinks.each((index, link) => {
    if (index > 0) {
      list.append(buildSeparator($));
    }

    appendFilterOptionItems($, list, $(link));
  });

  form.append(list);
  rebuildFilterShell(
    $,
    matchingFilter,
    "matching",
    filterTriggerText(matchingFilter, "Options"),
    buildFilterOptionsPanel($, form, { "data-name": "options" }),
  );
}

function optimizeTimeFilter($) {
  const timeFilter = $('[data-kagi-filter="time"]').first();
  const optionLinks = timeFilter.find(
    '[data-kagi-filter-option][data-name="dr"]',
  );

  if (!timeFilter.length || !optionLinks.length) {
    return;
  }

  const state = filterFormState(optionLinks, ["dr", "from_date", "to_date"]);
  const presetForm = buildGetForm($, state, {
    "data-kagi-time-form": "",
  });
  const list = $("<ul></ul>");
  const presetSection = $("<div></div>")
    .attr({
      "data-kagi-filter-section": "presets",
      "data-name": "dr",
    })
    .addClass("dd-section");
  const customDateForm = buildTimeCustomDateForm($, state, timeFilter);
  const preview = buildGetForm($, state, {
    "data-kagi-filter-preview": "",
    "data-kagi-time-preview": "",
  });

  appendFilterOptionItems($, presetSection, optionLinks, "dr");
  presetForm.append(presetSection);
  list.append(presetForm);

  if (customDateForm.length) {
    const customSection = $("<li></li>").addClass("no-hov-bg");

    customSection.append(customDateForm);
    list.append(buildSeparator($), customSection);
  }

  appendFilterOptionButtons($, preview, optionLinks.slice(0, 5), "dr");
  rebuildFilterShell(
    $,
    timeFilter,
    "time",
    filterTriggerText(timeFilter, "Time"),
    buildFilterOptionsPanel($, list, { "data-name": "dr" }),
    [preview],
  );
}

function optimizeSortFilter($) {
  const sortFilter = $('[data-kagi-filter="sort"]').first();
  const optionLinks = sortFilter.find("[data-kagi-filter-option][data-name]");

  if (!sortFilter.length || !optionLinks.length) {
    return;
  }

  const state = filterFormState(optionLinks, ["order", "dir"]);
  const form = buildGetForm($, state, {
    "data-kagi-sort-form": "",
  });
  const list = $("<ul></ul>");
  let appendedSection = false;

  sortFilter.find("[data-kagi-filter-section]").each((_, section) => {
    const sourceSection = $(section);
    const sectionName = sourceSection.attr("data-kagi-filter-section");
    const nextSection = $("<div></div>")
      .addClass(sourceSection.attr("class") ?? "dd-section")
      .attr({
        "data-kagi-filter-section": sectionName ?? "",
        "data-name": sectionName ?? "",
      });

    appendFilterOptionItems(
      $,
      nextSection,
      sourceSection.find("[data-kagi-filter-option][data-name]"),
      sectionName,
    );

    if (nextSection.children().length) {
      if (appendedSection) {
        list.append(buildSeparator($));
      }

      list.append(nextSection);
      appendedSection = true;
    }
  });

  if (!list.find("[data-kagi-filter-option]").length) {
    appendFilterOptionItems($, list, optionLinks);
  }

  form.append(list);
  rebuildFilterShell(
    $,
    sortFilter,
    "sort",
    filterTriggerText(sortFilter, "Sort"),
    buildFilterOptionsPanel($, form),
  );
}

function regionButtonFromLink($, link) {
  const source = $(link);
  const button = $("<button></button>");
  const value = source.attr("data-value") ?? "";

  button
    .attr("type", "submit")
    .attr("name", "r")
    .attr("value", value)
    .attr("data-kagi-filter-option", "")
    .attr("data-kagi-region-option", "")
    .addClass("inner-label")
    .text(normalizeText(source.text()));

  if (source.attr("aria-current") != null) {
    button.attr("aria-current", source.attr("aria-current"));
  }

  if (source.closest("li").attr("data-recent") != null) {
    button.attr("data-kagi-recent", "");
  }

  return button;
}

function buildRegionSearchClear($) {
  return $("<i></i>")
    .addClass("_0_k_ui_dropdown_sort_list_filter_clear")
    .append(
      $("<svg></svg>")
        .attr({
          width: "24",
          height: "24",
          viewBox: "0 0 24 24",
          xmlns: "http://www.w3.org/2000/svg",
        })
        .append(
          $("<path>").attr({
            d: "M6 6L18 18M6 18L18 6",
            stroke: "currentColor",
            "stroke-width": "1.5",
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
          }),
        ),
    );
}

function buildRegionOptionItem($, link) {
  const source = $(link);
  const sourceItem = source.closest("li");
  const item = $("<li></li>");

  if (sourceItem.attr("class")) {
    item.attr("class", sourceItem.attr("class"));
  }

  if (sourceItem.attr("data-recent") != null) {
    item.attr({
      "data-recent": "",
      "data-kagi-filter-recent": "",
    });
  }

  item.append(regionButtonFromLink($, link));
  return item;
}

function buildRegionForm($, state, regionLinks) {
  const form = $("<form></form>")
    .attr("method", "get")
    .attr("action", state.action)
    .attr("data-kagi-region-form", "");
  const list = $("<ul></ul>");
  const search = $("<div></div>")
    .addClass("list_filter_wrpr")
    .attr("data-kagi-filter-search", "")
    .append(
      $("<input>").attr({
        class: "list_filter _0_k_ui_dropdown_sort_list_input",
        type: "search",
        placeholder: "Search region...",
        "data-kagi-region-search": "",
      }),
      buildRegionSearchClear($),
    );
  const regions = $("<div></div>")
    .addClass("_0_data_sort_list")
    .attr("data-kagi-region-list", "");

  appendHiddenInputs($, form, state.params);
  list.append(search);

  regionLinks.each((_, link) => {
    regions.append(buildRegionOptionItem($, link));
  });

  list.append(regions);
  form.append(list);
  return form;
}

function optimizeRegionFilter($) {
  const regionFilter = $('[data-kagi-filter="region"]').first();
  const regionLinks = regionFilter.find(
    '[data-kagi-filter-option][data-name="r"]',
  );

  if (!regionFilter.length || !regionLinks.length) {
    return;
  }

  const state = regionFormState(regionLinks);
  const triggerText = filterTriggerText(regionFilter, "Region");
  const panel = buildFilterOptionsPanel(
    $,
    buildRegionForm($, state, regionLinks),
    { "data-name": "r" },
  ).addClass("_0_data_list");

  rebuildFilterShell($, regionFilter, "region", triggerText, panel);
}

function buildOptimizedHtml(html, capture) {
  const $ = cheerio.load(html, { decodeEntities: false });

  addSemanticPageHooks($, capture, "optimized");
  optimizeFilterShell($);
  optimizeMatchingFilter($);
  optimizeTimeFilter($);
  optimizeSortFilter($);
  optimizeRegionFilter($);

  return $.html();
}

function buildHtmlVariant(html, variant, capture, domainInfoCapture) {
  if (variant === "original") {
    return prepareForLocalViewing(html, capture, domainInfoCapture);
  }

  if (variant === "backwards-compatible") {
    return addBackwardsCompatibleHooks(
      prepareForLocalViewing(html, capture, domainInfoCapture),
      capture,
    );
  }

  if (variant === "optimized") {
    return buildOptimizedHtml(
      prepareForLocalViewing(html, capture, domainInfoCapture),
      capture,
    );
  }

  throw new Error(`Unsupported HTML variant: ${variant}`);
}

function cssPathForVersion(sample, version) {
  return version === "semantic" ? sample.local_semantic : sample.local_original;
}

function validBundleVariantsForCssVersion(cssVersion) {
  if (cssVersion === "semantic") {
    return ["backwards-compatible", "optimized"].filter((variant) =>
      implementedBundleVariants.includes(variant),
    );
  }

  return ["original", "backwards-compatible"];
}

function validBundleVariantsForCssOption(cssOption) {
  if (cssOption.sampleId === "none") {
    return implementedBundleVariants;
  }

  return validBundleVariantsForCssVersion(cssOption.version);
}

function plannedCombinations(samples, captures, bundles) {
  if (captures.length === 0) {
    return [];
  }

  const cssOptions = cssOptionsForSamples(samples);

  return captures.flatMap((capture) =>
    cssOptions.flatMap((cssOption) =>
      validBundleVariantsForCssOption(cssOption).map((bundleVariant) => {
        const bundle = bundles.find((item) => item.id === bundleVariant);
        const matrixFileName = `${capture.id}__${bundleVariant}__${cssOption.sampleId}__${cssOption.version}.html`;
        const htmlFilePath = path.join(
          generatedRoot,
          "html",
          bundleVariant,
          `${capture.id}.html`,
        );
        const matrixFilePath = path.join(
          generatedRoot,
          "matrix",
          matrixFileName,
        );

        return {
          captureId: capture.id,
          captureFile: relativeProjectPath(capture.sourcePath),
          bundleVariant,
          htmlVariant: bundle.htmlVariant,
          kagiCssVariant: bundle.kagiCssVariant,
          kagiCssSource: bundle.kagiCssSource,
          kagiCssPaths: bundle.kagiCssPaths,
          kagiAuthoredCssMetrics: bundle.kagiAuthoredCssMetrics,
          htmlPath: relativeProjectPath(htmlFilePath),
          cssSample: cssOption.sampleId,
          cssSampleName: cssOption.sampleName,
          cssVersion: cssOption.version,
          cssPath: cssOption.path,
          cssBuiltIn: cssOption.builtIn,
          matrixFileName,
          matrixPath: relativeProjectPath(matrixFilePath),
        };
      }),
    ),
  );
}

function isKagiAuthoredCssLink($, element) {
  const node = $(element);
  const rel = node.attr("rel") ?? "";
  const href = node.attr("href") ?? "";

  return (
    /\bstylesheet\b/i.test(rel) &&
    href.startsWith(`${kagiOrigin}/asset/`) &&
    href.includes("/css/")
  );
}

function injectCssLinks(html, combination) {
  const $ = cheerio.load(html, { decodeEntities: false });

  if (combination.kagiCssSource === "local-lab") {
    $("link[href]").each((_, element) => {
      if (isKagiAuthoredCssLink($, element)) {
        $(element).remove();
      }
    });

    for (const cssPath of combination.kagiCssPaths ?? []) {
      const href = `../../${cssPath}`;
      const cssLink = `<link rel="stylesheet" href="${href}" data-fixture-kagi-css="${combination.kagiCssVariant}">`;

      $("head").append(`\n    ${cssLink}\n  `);
    }
  }

  if (combination.cssPath) {
    const href = `../../${combination.cssPath}`;
    const cssLink = `<link rel="stylesheet" href="${href}" data-fixture-custom-css="${combination.cssSample}" data-fixture-css-version="${combination.cssVersion}">`;

    $("head").append(`\n    ${cssLink}\n  `);
  }

  $("html")
    .attr("data-fixture-capture", combination.captureId)
    .attr("data-fixture-bundle-variant", combination.bundleVariant)
    .attr("data-fixture-html-variant", combination.htmlVariant)
    .attr("data-fixture-kagi-css-variant", combination.kagiCssVariant)
    .attr("data-fixture-css-sample", combination.cssSample)
    .attr("data-fixture-css-version", combination.cssVersion);

  return $.html();
}

async function writeBundleHtml(captures, bundles) {
  const written = [];

  for (const capture of captures) {
    const html = await fs.readFile(capture.sourcePath, "utf8");
    const domainInfoCapture = await readJsonIfExists(capture.domainInfoPath);

    for (const bundle of bundles) {
      const outputPath = path.join(
        generatedRoot,
        "html",
        bundle.id,
        `${capture.id}.html`,
      );
      const variantHtml = buildHtmlVariant(
        html,
        bundle.htmlVariant,
        capture,
        domainInfoCapture,
      );

      await fs.writeFile(
        outputPath,
        variantHtml.endsWith("\n") ? variantHtml : `${variantHtml}\n`,
      );
      written.push({
        captureId: capture.id,
        bundleVariant: bundle.id,
        htmlVariant: bundle.htmlVariant,
        kagiCssVariant: bundle.kagiCssVariant,
        kagiCssSource: bundle.kagiCssSource,
        kagiCssPaths: bundle.kagiCssPaths,
        path: relativeProjectPath(outputPath),
        htmlBytes: Buffer.byteLength(variantHtml),
        kagiAuthoredCssMetrics: bundle.kagiAuthoredCssMetrics,
        totalBundleBytes:
          bundle.kagiAuthoredCssMetrics?.minifiedBytes == null
            ? null
            : Buffer.byteLength(variantHtml) +
              bundle.kagiAuthoredCssMetrics.minifiedBytes,
        domainInfo:
          rendererForCapture(capture) === "enhanced" && domainInfoCapture
            ? relativeProjectPath(capture.domainInfoPath)
            : null,
      });
    }
  }

  return written;
}

async function writeMatrixPages(combinations) {
  for (const combination of combinations) {
    const html = await fs.readFile(
      path.join(projectRoot, combination.htmlPath),
      "utf8",
    );
    const matrixHtml = injectCssLinks(html, combination);

    await fs.writeFile(
      path.join(projectRoot, combination.matrixPath),
      matrixHtml.endsWith("\n") ? matrixHtml : `${matrixHtml}\n`,
    );
  }
}

async function main() {
  await ensureGeneratedDirs();

  const manifestPath = path.join(fixtureRoot, "css-corpus", "manifest.json");
  const manifest = await readJson(manifestPath);
  const samples = manifest.samples ?? [];
  const captures = await listHtmlCaptures();
  const cssOptions = cssOptionsForSamples(samples);
  const bundles = await bundleOptions();
  const generatedBundles = await writeBundleHtml(captures, bundles);
  const matrix = plannedCombinations(samples, captures, bundles);
  const domainInfoCaptures = (
    await Promise.all(
      captures.map(async (capture) =>
        (await pathExists(capture.domainInfoPath))
          ? {
              captureId: capture.id,
              path: relativeProjectPath(capture.domainInfoPath),
            }
          : null,
      ),
    )
  ).filter(Boolean);

  await writeMatrixPages(matrix);

  const summary = {
    status: captures.length === 0 ? "waiting-for-captures" : "ready",
    plannedBundleVariants,
    implementedBundleVariants,
    bundles,
    captureFiles: captures.map((capture) => capture.fileName),
    domainInfoCaptures,
    cssSamples: samples.map((sample) => sample.id).sort(),
    cssOptions: cssOptions.map((cssOption) => ({
      sampleId: cssOption.sampleId,
      sampleName: cssOption.sampleName,
      version: cssOption.version,
      path: cssOption.path,
      builtIn: cssOption.builtIn,
    })),
    generatedBundles,
    generatedMatrixPageCount: matrix.length,
    nextStep:
      captures.length === 0
        ? "Add redacted HTML captures to fixture-lab/captures/original/."
        : "Collect public CSS samples and decide whether visual screenshot automation is worth maintaining.",
  };

  await fs.writeFile(
    path.join(generatedRoot, "reports", "generation-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  await fs.writeFile(
    path.join(generatedRoot, "matrix", "manifest.json"),
    `${JSON.stringify(
      {
        captures: captures.map((capture) => ({
          id: capture.id,
          file: relativeProjectPath(capture.sourcePath),
          domainInfoFile: domainInfoCaptures.find(
            (domainInfoCapture) => domainInfoCapture.captureId === capture.id,
          )?.path,
        })),
        bundleVariants: implementedBundleVariants,
        bundles,
        cssSamples: samples.map((sample) => ({
          id: sample.id,
          name: sample.name,
          versions: cssVersionsForSample(sample),
        })),
        cssOptions: cssOptions.map((cssOption) => ({
          sampleId: cssOption.sampleId,
          sampleName: cssOption.sampleName,
          version: cssOption.version,
          path: cssOption.path,
          builtIn: cssOption.builtIn,
        })),
        combinations: matrix,
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    `Generated ${generatedBundles.length} bundle HTML page(s) and ${matrix.length} matrix page(s) from ${captures.length} capture(s).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
