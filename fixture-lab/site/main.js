const controls = {
  captureOptions: document.querySelector("#capture-options"),
  htmlVariantOptions: document.querySelector("#html-variant-options"),
  cssSampleOptions: document.querySelector("#css-sample-options"),
  cssVersionOptions: document.querySelector("#css-version-options"),
  openFixtureButton: document.querySelector("#open-fixture-button"),
  selectionStatus: document.querySelector("#selection-status"),
};

const preferredSelection = {
  captureId: "search",
  bundleVariant: "original",
  cssSample: "sidebar",
  cssVersion: "original",
};

let generationSummary = null;
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

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not load ${url}`);
  }

  return response.json();
}

function currentCombinations() {
  return matrixManifest.combinations ?? [];
}

function cssOptions() {
  return matrixManifest.cssOptions ?? [];
}

function humanize(value) {
  const labels = {
    "backwards-compatible": "Compat",
    current: "Current",
    "html-search": "HTML",
    none: "No CSS",
    original: "Original",
    optimized: "Optimized",
    search: "JS",
    semantic: "Semantic",
    sidebar: "Sidebar",
  };

  return labels[value] ?? String(value).replaceAll("-", " ");
}

function bundleVariantLabel(value) {
  return humanize(value);
}

function cssSampleLabel(sample) {
  if (sample.id === "none") {
    return "No CSS";
  }

  return sample.name || humanize(sample.id);
}

function cssVersionLabel(option) {
  const version = option.cssVersion ?? option.version;

  if ((option.cssSample ?? option.sampleId) === "none") {
    return "No CSS";
  }

  return humanize(version);
}

function captureDescription(captureId) {
  const descriptions = {
    "html-search": "Basic no-JS renderer.",
    search: "JS-enhanced renderer with Kagi runtime behavior.",
  };

  return descriptions[captureId] ?? "";
}

function htmlVariantDescription(bundleVariant) {
  const descriptions = {
    "backwards-compatible": "Captured DOM plus proposed semantic hooks.",
    optimized: "Rewritten DOM using the proposed search-result structure.",
    original: "Captured Kagi markup with private classes and IDs.",
  };

  return descriptions[bundleVariant] ?? "";
}

function cssVersionDescription(option) {
  if ((option.cssSample ?? option.sampleId) === "none") {
    return "No user Custom CSS.";
  }

  const descriptions = {
    original: "Targets Kagi's private classes and IDs.",
    semantic: "Targets proposed data-kagi hooks.",
  };

  return descriptions[option.cssVersion ?? option.version] ?? "";
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
  if (bytes == null) {
    return "Pending";
  }

  if (bytes === 0) {
    return "0 B";
  }

  return `${bytes > 0 ? "+" : "-"}${formatBytes(Math.abs(bytes))}`;
}

function statRow(label, value) {
  return `<span class="metric-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></span>`;
}

function renderEmpty(target, message) {
  target.className = "empty-state";
  target.innerHTML = escapeHtml(message);
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

function bundleOptions() {
  return (matrixManifest.bundles ?? []).length
    ? matrixManifest.bundles
    : (matrixManifest.bundleVariants ?? []).map((id) => ({ id }));
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

function cssOptionsForSample(cssSample) {
  return cssOptions().filter((item) => item.sampleId === cssSample);
}

function bundleMetric(captureId, bundleVariant) {
  const generatedBundles =
    generationSummary?.generatedBundles ??
    generationSummary?.generatedHtml ??
    [];

  return generatedBundles.find(
    (item) =>
      item.captureId === captureId &&
      (item.bundleVariant ?? item.htmlVariant) === bundleVariant,
  );
}

function cssMetric(cssSample, cssVersion) {
  if (cssSample === "none") {
    return {
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

function selectedCombination() {
  return findCombination(
    state.captureId,
    state.bundleVariant,
    state.cssSample,
    state.cssVersion,
  );
}

function findCombination(captureId, bundleVariant, cssSample, cssVersion) {
  return currentCombinations().find(
    (item) =>
      item.captureId === captureId &&
      (item.bundleVariant ?? item.htmlVariant) === bundleVariant &&
      item.cssSample === cssSample &&
      item.cssVersion === cssVersion,
  );
}

function combinationExists(bundleVariant, cssSample, cssVersion) {
  return Boolean(
    findCombination(state.captureId, bundleVariant, cssSample, cssVersion),
  );
}

function compatibleCssVersion(cssSample, bundleVariant, preferredVersion) {
  const versions = cssOptionsForSample(cssSample);

  return (
    versions.find(
      (option) =>
        option.version === preferredVersion &&
        combinationExists(bundleVariant, cssSample, option.version),
    )?.version ??
    versions.find(
      (option) =>
        option.version === preferredSelection.cssVersion &&
        combinationExists(bundleVariant, cssSample, option.version),
    )?.version ??
    versions.find((option) =>
      combinationExists(bundleVariant, cssSample, option.version),
    )?.version ??
    versions[0]?.version ??
    "none"
  );
}

function selectCompatibleCssVersion(bundleVariant = state.bundleVariant) {
  state.cssVersion = compatibleCssVersion(
    state.cssSample,
    bundleVariant,
    state.cssVersion,
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

function kagiCssMinBytes(metric) {
  return metric?.kagiAuthoredCssMetrics?.minifiedBytes;
}

function measuredTotalBytes(bundle, customCss) {
  if (bundle?.htmlBytes == null || kagiCssMinBytes(bundle) == null) {
    return null;
  }

  return (
    bundle.htmlBytes +
    kagiCssMinBytes(bundle) +
    (customCss?.minifiedBytes ?? customCss?.bytes ?? 0)
  );
}

function originalBundleMetric() {
  return bundleMetric(state.captureId, "original");
}

function ensureValidState() {
  const captures = captureOptions();
  const bundles = bundleOptions();
  const samples = cssSampleOptions();

  if (!captures.some((item) => item.id === state.captureId)) {
    state.captureId =
      captures.find((item) => item.id === preferredSelection.captureId)?.id ??
      captures[0]?.id ??
      preferredSelection.captureId;
  }

  if (!bundles.some((item) => item.id === state.bundleVariant)) {
    state.bundleVariant =
      bundles.find((item) => item.id === preferredSelection.bundleVariant)
        ?.id ??
      bundles[0]?.id ??
      preferredSelection.bundleVariant;
  }

  if (!samples.some((item) => item.id === state.cssSample)) {
    state.cssSample =
      samples.find((item) => item.id === preferredSelection.cssSample)?.id ??
      samples.find((item) => item.id !== "none")?.id ??
      samples[0]?.id ??
      preferredSelection.cssSample;
  }

  const versions = cssOptionsForSample(state.cssSample);

  if (!versions.some((item) => item.version === state.cssVersion)) {
    state.cssVersion =
      versions.find((item) => item.version === preferredSelection.cssVersion)
        ?.version ??
      versions[0]?.version ??
      "none";
  }

  if (
    !combinationExists(state.bundleVariant, state.cssSample, state.cssVersion)
  ) {
    selectCompatibleCssVersion();
  }
}

function renderChoiceCards({
  target,
  name,
  options,
  selectedValue,
  valueFor,
  labelFor,
  descriptionFor = () => "",
  metaFor,
  disabledFor = () => false,
  onChange,
}) {
  if (!options.length) {
    renderEmpty(target, "Run pnpm generate.");
    return;
  }

  target.className = "choice-grid";
  target.innerHTML = options
    .map((option) => {
      const value = valueFor(option);
      const selected = value === selectedValue;
      const disabled = disabledFor(option);
      const description = descriptionFor(option);

      return `<label class="choice-card${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""}" aria-disabled="${disabled ? "true" : "false"}">
        <input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(value)}"${selected ? " checked" : ""}${disabled ? " disabled" : ""} />
        <span class="choice-title">${escapeHtml(labelFor(option))}</span>
        ${
          description
            ? `<span class="choice-description">${escapeHtml(description)}</span>`
            : ""
        }
        <span class="choice-meta">${metaFor(option)}</span>
      </label>`;
    })
    .join("");

  target.querySelectorAll("input:not(:disabled)").forEach((input) => {
    input.addEventListener("change", () => onChange(input.value));
  });
}

function renderCaptureOptions() {
  renderChoiceCards({
    target: controls.captureOptions,
    name: "capture",
    options: captureOptions(),
    selectedValue: state.captureId,
    valueFor: (option) => option.id,
    labelFor: (option) => humanize(option.id),
    descriptionFor: (option) => captureDescription(option.id),
    metaFor: (option) => statRow("Source", option.file),
    onChange: (value) => {
      state.captureId = value;
      render();
    },
  });
}

function renderHtmlVariantOptions() {
  const original = originalBundleMetric();

  renderChoiceCards({
    target: controls.htmlVariantOptions,
    name: "html variant",
    options: bundleOptions(),
    selectedValue: state.bundleVariant,
    valueFor: (option) => option.id,
    labelFor: (option) => bundleVariantLabel(option.id),
    descriptionFor: (option) => htmlVariantDescription(option.id),
    metaFor: (option) => {
      const metric = bundleMetric(state.captureId, option.id);
      const customCss = cssMetric(state.cssSample, state.cssVersion);
      const total = measuredTotalBytes(metric, customCss);
      const htmlDelta =
        metric?.htmlBytes == null || original?.htmlBytes == null
          ? null
          : metric.htmlBytes - original.htmlBytes;
      const kagiCssDelta =
        kagiCssMinBytes(metric) == null || kagiCssMinBytes(original) == null
          ? null
          : kagiCssMinBytes(metric) - kagiCssMinBytes(original);

      return [
        statRow("HTML", formatBytes(metric?.htmlBytes)),
        statRow("HTML delta", formatDelta(htmlDelta)),
        statRow("Kagi CSS min", formatBytes(kagiCssMinBytes(metric))),
        statRow("Kagi CSS delta", formatDelta(kagiCssDelta)),
        statRow("Surface + custom", formatBytes(total)),
      ].join("");
    },
    onChange: (value) => {
      state.bundleVariant = value;
      selectCompatibleCssVersion(value);
      render();
    },
  });
}

function renderCssSampleOptions() {
  renderChoiceCards({
    target: controls.cssSampleOptions,
    name: "custom CSS",
    options: cssSampleOptions(),
    selectedValue: state.cssSample,
    valueFor: (option) => option.id,
    labelFor: cssSampleLabel,
    metaFor: (option) =>
      [
        statRow("Variants", String(option.versions.length)),
        statRow(
          "Compatible",
          String(
            option.versions.filter((version) =>
              combinationExists(
                state.bundleVariant,
                option.id,
                version.version,
              ),
            ).length,
          ),
        ),
      ].join(""),
    disabledFor: (option) =>
      !option.versions.some((version) =>
        combinationExists(state.bundleVariant, option.id, version.version),
      ),
    onChange: (value) => {
      state.cssSample = value;
      selectCompatibleCssVersion();
      render();
    },
  });
}

function renderCssVersionOptions() {
  const originalMetric =
    state.cssSample === "none"
      ? cssMetric("none", "none")
      : cssMetric(state.cssSample, "original");

  renderChoiceCards({
    target: controls.cssVersionOptions,
    name: "css variant",
    options: cssOptionsForSample(state.cssSample),
    selectedValue: state.cssVersion,
    valueFor: (option) => option.version,
    labelFor: cssVersionLabel,
    descriptionFor: cssVersionDescription,
    metaFor: (option) => {
      const metric = cssMetric(option.sampleId, option.version);
      const minDelta =
        metric?.minifiedBytes == null || originalMetric?.minifiedBytes == null
          ? null
          : metric.minifiedBytes - originalMetric.minifiedBytes;
      const matchText = selectorMatchText(
        state.captureId,
        state.bundleVariant,
        option.sampleId,
        option.version,
      );

      return [
        statRow("Source", formatBytes(metric?.sourceBytes ?? metric?.bytes)),
        statRow(
          "Minified",
          formatBytes(metric?.minifiedBytes ?? metric?.bytes),
        ),
        statRow("Min delta", formatDelta(minDelta)),
        statRow("Selectors", String(metric?.selectorCount ?? 0)),
        statRow("Kagi hooks", String(metric?.privateSelectorTokenCount ?? 0)),
        statRow("Structural", String(metric?.structuralSelectorCount ?? 0)),
        statRow(":has()", String(metric?.modernSelectorCount ?? 0)),
        statRow("Match", matchText),
      ].join("");
    },
    disabledFor: (option) =>
      !combinationExists(state.bundleVariant, option.sampleId, option.version),
    onChange: (value) => {
      state.cssVersion = value;
      render();
    },
  });
}

function renderOpenButton() {
  const combination = selectedCombination();
  const customCss = cssMetric(state.cssSample, state.cssVersion);
  const bundle = bundleMetric(state.captureId, state.bundleVariant);
  const total = measuredTotalBytes(bundle, customCss);

  if (!combination) {
    controls.openFixtureButton.href = "#";
    controls.openFixtureButton.setAttribute("aria-disabled", "true");
    controls.selectionStatus.textContent =
      "This HTML and Custom CSS pairing is not generated.";
    return;
  }

  controls.openFixtureButton.href = `/${combination.matrixPath}`;
  controls.openFixtureButton.removeAttribute("aria-disabled");
  controls.selectionStatus.textContent = `${humanize(state.captureId)} / ${bundleVariantLabel(state.bundleVariant)} / ${cssVersionLabel(combination)} / ${formatBytes(total)}`;
}

function render() {
  ensureValidState();
  renderCaptureOptions();
  renderHtmlVariantOptions();
  renderCssSampleOptions();
  renderCssVersionOptions();
  renderOpenButton();
}

async function loadReports() {
  const [generation, inventory, matches, manifest] = await Promise.all([
    fetchJson("/generated/reports/generation-summary.json").catch(() => null),
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
  selectorInventory = inventory;
  selectorMatches = matches;
  matrixManifest = manifest;
  render();
}

function init() {
  render();
  loadReports();
}

init();
