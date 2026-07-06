const controls = {
  captureOptions: document.querySelector("#capture-options"),
  cssSampleOptions: document.querySelector("#css-sample-options"),
  htmlComparison: document.querySelector("#html-comparison"),
  cssVersionComparison: document.querySelector("#css-version-comparison"),
  summaryCards: document.querySelector("#summary-cards"),
  matrixRows: document.querySelector("#matrix-rows"),
};

const preferredSelection = {
  captureId: "search",
  cssSample: "sidebar",
};

let generationSummary = null;
let compatibilitySummary = null;
let selectorInventory = { samples: [] };
let selectorMatches = { matches: [] };
let matrixManifest = {
  bundleVariants: [],
  bundles: [],
  captures: [],
  combinations: [],
  cssOptions: [],
  cssSamples: [],
};
let state = { ...preferredSelection };

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function uniqueValues(items, getValue) {
  return [...new Set(items.map(getValue))];
}

function currentCombinations() {
  return matrixManifest.combinations ?? [];
}

function cssOptions() {
  return matrixManifest.cssOptions ?? [];
}

function ensureValidState() {
  const captures = captureOptions();
  const samples = cssSampleOptions();

  if (!captures.some((item) => item.id === state.captureId)) {
    state.captureId =
      captures.find((item) => item.id === preferredSelection.captureId)?.id ??
      captures[0]?.id ??
      preferredSelection.captureId;
  }

  if (!samples.some((item) => item.id === state.cssSample)) {
    state.cssSample =
      samples.find((item) => item.id === preferredSelection.cssSample)?.id ??
      samples.find((item) => item.id !== "none")?.id ??
      samples[0]?.id ??
      preferredSelection.cssSample;
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not load ${url}`);
  }

  return response.json();
}

function humanize(value) {
  const labels = {
    "backwards-compatible": "Backwards-compatible hooks",
    "backwards-compatible-preserved": "Backwards-compatible preserved",
    "backwards-compatible-regressions": "Backwards-compatible regressions",
    current: "Current",
    "html-search": "Basic HTML search",
    none: "No CSS",
    original: "Original",
    optimized: "Optimized",
    ready: "Ready",
    search: "JS search",
    semantic: "Semantic",
    sidebar: "Kagi Sidebar",
    "selector-inventory-only": "Selector inventory only",
    "waiting-for-captures": "Waiting for captures",
  };

  return labels[value] ?? String(value).replaceAll("-", " ");
}

function bundleVariantLabel(value) {
  if (value === "original") {
    return "Original bundle";
  }

  return humanize(value);
}

function cssSampleLabel(sample) {
  if (sample.id === "none") {
    return "No CSS";
  }

  return sample.name || humanize(sample.id);
}

function cssVersionLabel(version) {
  const cssVersion = version.cssVersion ?? version.version;

  if (version.cssSample === "none") {
    return "No CSS baseline";
  }

  return humanize(cssVersion);
}

function cssCombinationLabel(option) {
  if (option.cssSample === "none") {
    return "No CSS baseline";
  }

  const sampleName =
    cssOptions().find((item) => item.sampleId === option.cssSample)
      ?.sampleName ?? humanize(option.cssSample);

  return `${sampleName} ${cssVersionLabel(option)}`;
}

function formatBytes(bytes) {
  if (bytes == null) {
    return "Pending";
  }

  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1000 && unitIndex < units.length - 1) {
    size /= 1000;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDelta(bytes) {
  if (bytes == null || bytes === 0) {
    return "0 B";
  }

  const sign = bytes > 0 ? "+" : "-";

  return `${sign}${formatBytes(Math.abs(bytes))}`;
}

function statRow(label, value) {
  return `<span class="metric-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></span>`;
}

function renderEmpty(target, message) {
  target.className = "empty-state";
  target.innerHTML = escapeHtml(message);
}

function renderChoiceGroup({
  target,
  name,
  options,
  selectedValue,
  valueFor,
  labelFor,
  metaFor,
  onChange,
}) {
  if (!options.length) {
    renderEmpty(target, "Run pnpm generate.");
    return;
  }

  target.className = options.length < 3 ? "choice-grid" : "select-row";

  if (options.length < 3) {
    target.innerHTML = options
      .map((option) => {
        const value = valueFor(option);
        const checked = value === selectedValue;

        return `<label class="choice-card${checked ? " is-selected" : ""}">
          <input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(value)}"${checked ? " checked" : ""} />
          <span class="choice-title">${escapeHtml(labelFor(option))}</span>
          <span class="choice-meta">${metaFor(option)}</span>
        </label>`;
      })
      .join("");

    target.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", () => onChange(input.value));
    });
    return;
  }

  target.innerHTML = `<select aria-label="${escapeHtml(name)}">
    ${options
      .map((option) => {
        const value = valueFor(option);

        return `<option value="${escapeHtml(value)}"${value === selectedValue ? " selected" : ""}>${escapeHtml(labelFor(option))}</option>`;
      })
      .join("")}
  </select>`;

  target.querySelector("select").addEventListener("change", (event) => {
    onChange(event.target.value);
  });
}

function captureOptions() {
  return uniqueValues(currentCombinations(), (item) => item.captureId).map(
    (captureId) => {
      const capture = (matrixManifest.captures ?? []).find(
        (item) => item.id === captureId,
      );

      return {
        id: captureId,
        file: capture?.file ?? "",
      };
    },
  );
}

function cssSampleOptions() {
  const samples = new Map();

  for (const option of cssOptions()) {
    samples.set(option.sampleId, {
      id: option.sampleId,
      name: option.sampleName,
      builtIn: option.builtIn,
      versions: cssOptionsForSample(option.sampleId),
    });
  }

  return [...samples.values()].sort((a, b) => {
    if (a.id === "none") {
      return -1;
    }

    if (b.id === "none") {
      return 1;
    }

    return cssSampleLabel(a).localeCompare(cssSampleLabel(b));
  });
}

function bundleVariants() {
  return matrixManifest.bundleVariants?.length
    ? matrixManifest.bundleVariants
    : uniqueValues(
        currentCombinations().filter(
          (item) => item.captureId === state.captureId,
        ),
        (item) => item.bundleVariant ?? item.htmlVariant,
      );
}

function cssOptionsForSample(cssSample) {
  return cssOptions().filter((item) => item.sampleId === cssSample);
}

function bundleMetric(captureId, bundleVariant) {
  const generatedBundles =
    generationSummary?.generatedBundles ?? generationSummary?.generatedHtml ?? [];

  return generatedBundles.find(
    (item) =>
      item.captureId === captureId &&
      (item.bundleVariant ?? item.htmlVariant) === bundleVariant,
  );
}

function cssMetric(cssSample, cssVersion) {
  if (cssSample === "none") {
    return {
      bytes: 0,
      sourceBytes: 0,
      minifiedBytes: 0,
      lineCount: 0,
      selectorCount: 0,
      privateSelectorCount: 0,
      privateSelectorTokenCount: 0,
      structuralSelectorCount: 0,
      modernSelectorCount: 0,
    };
  }

  return (selectorInventory.samples ?? []).find(
    (item) => item.sampleId === cssSample && item.version === cssVersion,
  );
}

function selectorMatch(captureId, bundleVariant, cssSample, cssVersion) {
  return (selectorMatches.matches ?? []).find(
    (item) =>
      item.captureId === captureId &&
      (item.bundleVariant ?? item.htmlVariant) === bundleVariant &&
      item.sampleId === cssSample &&
      item.cssVersion === cssVersion,
  );
}

function selectorMatchText(captureId, bundleVariant, cssSample, cssVersion) {
  if (cssSample === "none") {
    return "Baseline";
  }

  const match = selectorMatch(captureId, bundleVariant, cssSample, cssVersion);

  return match
    ? `${match.matchedSelectorCount}/${match.selectorCount} matched`
    : "No selector report";
}

function matrixCombinationsForBundleVariant(bundleVariant) {
  return currentCombinations().filter(
    (item) =>
      item.captureId === state.captureId &&
      (item.bundleVariant ?? item.htmlVariant) === bundleVariant &&
      item.cssSample === state.cssSample,
  );
}

function selectedCaptureOriginalBytes() {
  return bundleMetric(state.captureId, "original")?.htmlBytes;
}

function measuredTotalBytes(bundle, cssMetricValue) {
  if (!bundle || bundle.htmlBytes == null) {
    return null;
  }

  if (bundle.kagiAuthoredCssMetrics?.minifiedBytes == null) {
    return null;
  }

  return (
    bundle.htmlBytes +
    bundle.kagiAuthoredCssMetrics.minifiedBytes +
    (cssMetricValue?.minifiedBytes ?? cssMetricValue?.bytes ?? 0)
  );
}

function renderSummaryCards() {
  const combinations = currentCombinations();
  const status =
    compatibilitySummary?.status ?? generationSummary?.status ?? "Loading";
  const cards = [
    {
      label: "Status",
      value: humanize(status),
    },
    {
      label: "Captures",
      value: String(matrixManifest.captures?.length ?? 0),
    },
    {
      label: "Bundle pages",
      value: String(
        (
          generationSummary?.generatedBundles ??
          generationSummary?.generatedHtml ??
          []
        ).length,
      ),
    },
    {
      label: "Matrix pages",
      value: String(
        generationSummary?.generatedMatrixPageCount ?? combinations.length,
      ),
    },
    {
      label: "CSS files",
      value: String(compatibilitySummary?.cssFileCount ?? 0),
    },
    {
      label: "Selectors",
      value: String(compatibilitySummary?.selectorCount ?? 0),
    },
    {
      label: "Kagi hooks",
      value: String(compatibilitySummary?.privateSelectorTokenCount ?? 0),
    },
    {
      label: "Regressions",
      value: String(
        compatibilitySummary?.backwardsCompatibleRegressionCount ?? 0,
      ),
    },
  ];

  controls.summaryCards.innerHTML = cards
    .map(
      (card) => `<article class="summary-card">
        <span class="summary-label">${escapeHtml(card.label)}</span>
        <strong>${escapeHtml(card.value)}</strong>
      </article>`,
    )
    .join("");
}

function renderCaptureOptions() {
  renderChoiceGroup({
    target: controls.captureOptions,
    name: "capture",
    options: captureOptions(),
    selectedValue: state.captureId,
    valueFor: (option) => option.id,
    labelFor: (option) => humanize(option.id),
    metaFor: (option) =>
      [
        statRow("File", option.file),
        statRow("Pages", capturePageCount(option.id)),
      ].join(""),
    onChange: (value) => {
      state.captureId = value;
      render();
    },
  });
}

function renderCssSampleOptions() {
  renderChoiceGroup({
    target: controls.cssSampleOptions,
    name: "custom CSS",
    options: cssSampleOptions(),
    selectedValue: state.cssSample,
    valueFor: (option) => option.id,
    labelFor: cssSampleLabel,
    metaFor: (option) =>
      [
        statRow("Versions", String(option.versions.length)),
        statRow(
          "Pages",
          String(
            currentCombinations().filter(
              (item) =>
                item.captureId === state.captureId &&
                item.cssSample === option.id,
            ).length,
          ),
        ),
      ].join(""),
    onChange: (value) => {
      state.cssSample = value;
      render();
    },
  });
}

function renderHtmlComparison() {
  const variants = bundleVariants();
  const originalBytes = selectedCaptureOriginalBytes();

  if (!variants.length) {
    renderEmpty(controls.htmlComparison, "Run pnpm generate.");
    return;
  }

  controls.htmlComparison.className = "comparison-grid html-comparison-grid";
  controls.htmlComparison.innerHTML = variants
    .map((bundleVariant) => {
      const metric = bundleMetric(state.captureId, bundleVariant);
      const delta =
        metric?.htmlBytes == null || originalBytes == null
          ? "Pending"
          : formatDelta(metric.htmlBytes - originalBytes);
      const combinations = matrixCombinationsForBundleVariant(bundleVariant);
      const localKagiCss =
        metric?.kagiAuthoredCssMetrics?.minifiedBytes == null
          ? "External"
          : formatBytes(metric.kagiAuthoredCssMetrics.minifiedBytes);
      const bundleSurface =
        metric?.totalBundleBytes == null
          ? null
          : formatBytes(metric.totalBundleBytes);

      return `<article class="comparison-card">
        <div class="card-heading">
          <h3>${escapeHtml(bundleVariantLabel(bundleVariant))}</h3>
        </div>
        <div class="choice-meta">
          ${statRow("HTML", formatBytes(metric?.htmlBytes))}
          ${statRow("HTML delta", delta)}
          ${statRow("Kagi CSS min", localKagiCss)}
          ${statRow("Bundle total", bundleSurface ?? "External CSS")}
          ${statRow("Source", metric?.path ?? "Pending")}
        </div>
        ${renderHtmlVariantLinkList(combinations, "No generated pages for selected CSS.")}
      </article>`;
    })
    .join("");
}

function renderCssVersionComparison() {
  const versions = cssOptionsForSample(state.cssSample);

  if (!versions.length) {
    renderEmpty(controls.cssVersionComparison, "Select a Custom CSS sample.");
    return;
  }

  controls.cssVersionComparison.className = "comparison-grid";
  controls.cssVersionComparison.innerHTML = versions
    .map((version) => {
      const metric = cssMetric(version.sampleId, version.version);
      const combinations = currentCombinations().filter(
        (item) =>
          item.captureId === state.captureId &&
          item.cssSample === version.sampleId &&
          item.cssVersion === version.version,
      );

      return `<article class="comparison-card">
        <div class="card-heading">
          <h3>${escapeHtml(cssVersionLabel(version))}</h3>
        </div>
        <div class="choice-meta">
          ${statRow("Source", formatBytes(metric?.sourceBytes ?? metric?.bytes))}
          ${statRow("Minified", formatBytes(metric?.minifiedBytes ?? metric?.bytes))}
          ${statRow("Lines", String(metric?.lineCount ?? 0))}
          ${statRow("Selectors", String(metric?.selectorCount ?? 0))}
          ${statRow("Kagi hooks", String(metric?.privateSelectorTokenCount ?? 0))}
          ${statRow("Private entries", String(metric?.privateSelectorCount ?? 0))}
          ${statRow("Structural", String(metric?.structuralSelectorCount ?? 0))}
          ${statRow(":has()", String(metric?.modernSelectorCount ?? 0))}
        </div>
        ${renderVersionMatchList(version, combinations)}
      </article>`;
    })
    .join("");
}

function renderVersionMatchList(version, combinations) {
  if (!combinations.length) {
    return `<p class="empty-inline">No generated pages for this version.</p>`;
  }

  return `<div class="version-matches">
    ${combinations
      .map((combination) => {
        const text = selectorMatchText(
          combination.captureId,
          combination.bundleVariant ?? combination.htmlVariant,
          version.sampleId,
          version.version,
        );

        return `<a class="link-chip" href="/${escapeHtml(combination.matrixPath)}">
          <span>${escapeHtml(bundleVariantLabel(combination.bundleVariant ?? combination.htmlVariant))}</span>
          <strong>${escapeHtml(text)}</strong>
        </a>`;
      })
      .join("")}
  </div>`;
}

function renderHtmlVariantLinkList(combinations, emptyMessage) {
  if (!combinations.length) {
    return `<p class="empty-inline">${escapeHtml(emptyMessage)}</p>`;
  }

  return `<div class="link-list">
    ${combinations
      .map((combination) => {
        const text = selectorMatchText(
          combination.captureId,
          combination.bundleVariant ?? combination.htmlVariant,
          combination.cssSample,
          combination.cssVersion,
        );
        const bundle = bundleMetric(
          combination.captureId,
          combination.bundleVariant ?? combination.htmlVariant,
        );
        const customCss = cssMetric(combination.cssSample, combination.cssVersion);
        const totalSurface = measuredTotalBytes(bundle, customCss);
        const surfaceText =
          totalSurface == null ? "external CSS" : formatBytes(totalSurface);

        return `<a class="link-chip" href="/${escapeHtml(combination.matrixPath)}" title="${escapeHtml(combination.matrixFileName)}">
          <span>${escapeHtml(cssVersionLabel(combination))}</span>
          <strong>${escapeHtml(`${text} · ${surfaceText}`)}</strong>
        </a>`;
      })
      .join("")}
  </div>`;
}

function capturePageCount(captureId) {
  return String(
    currentCombinations().filter((item) => item.captureId === captureId).length,
  );
}

function renderMatrixRows(combinations) {
  if (!combinations.length) {
    controls.matrixRows.innerHTML =
      '<tr><td colspan="5">Run pnpm generate.</td></tr>';
    return;
  }

  controls.matrixRows.innerHTML = combinations
    .map(
      (item) => `<tr>
        <td>${escapeHtml(humanize(item.captureId))}</td>
        <td>${escapeHtml(bundleVariantLabel(item.bundleVariant ?? item.htmlVariant))}</td>
        <td>${escapeHtml(cssCombinationLabel(item))}</td>
        <td>${escapeHtml(item.matrixFileName)}</td>
        <td><a href="/${escapeHtml(item.matrixPath)}">Open</a></td>
      </tr>`,
    )
    .join("");
}

function render() {
  ensureValidState();
  renderSummaryCards();
  renderCaptureOptions();
  renderCssSampleOptions();
  renderHtmlComparison();
  renderCssVersionComparison();
  renderMatrixRows(currentCombinations());
}

async function loadReports() {
  const [generation, compatibility, inventory, matches, manifest] =
    await Promise.all([
      fetchJson("/generated/reports/generation-summary.json").catch(() => null),
      fetchJson("/generated/reports/compatibility-summary.json").catch(
        () => null,
      ),
      fetchJson("/generated/reports/selector-inventory.json").catch(() => ({
        samples: [],
      })),
      fetchJson("/generated/reports/selector-matches.json").catch(() => ({
        matches: [],
      })),
      fetchJson("/generated/matrix/manifest.json").catch(() => ({
        bundleVariants: [],
        bundles: [],
        captures: [],
        combinations: [],
        cssOptions: [],
        cssSamples: [],
      })),
    ]);

  generationSummary = generation;
  compatibilitySummary = compatibility;
  selectorInventory = inventory;
  selectorMatches = matches;
  matrixManifest = manifest;
  ensureValidState();
  render();
}

function init() {
  render();
  loadReports();
}

init();
