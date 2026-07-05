import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const generatedRoot = path.join(projectRoot, "generated");
const fixtureRoot = path.join(projectRoot, "fixture-lab");

const plannedHtmlVariants = ["original", "backwards-compatible", "optimized"];
const implementedHtmlVariants = ["original", "backwards-compatible"];
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

async function listHtmlCaptures() {
  const captureDir = path.join(fixtureRoot, "captures", "original");

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
    ...plannedHtmlVariants.map((variant) =>
      path.join(generatedRoot, "html", variant),
    ),
    path.join(generatedRoot, "matrix"),
    path.join(generatedRoot, "reports"),
    path.join(generatedRoot, "screenshots"),
  ];

  await Promise.all(dirs.map((dir) => fs.mkdir(dir, { recursive: true })));
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

function prepareForLocalViewing(html) {
  const $ = cheerio.load(html, { decodeEntities: false });

  $("link[href]").each((_, element) => {
    const node = $(element);
    node.attr("href", toKagiAssetUrl(node.attr("href")));
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

  return $.html();
}

function addBackwardsCompatibleHooks(html, capture) {
  const $ = cheerio.load(html, { decodeEntities: false });

  $("html").attr("data-kagi-fixture-capture", capture.id);
  $("body")
    .attr("data-kagi-page", "search")
    .attr("data-kagi-mode", "web")
    .attr("data-kagi-fixture-variant", "backwards-compatible");

  $("#searchForm").attr("data-kagi-search-form", "");
  $("#tonav").attr("data-kagi-search-tabs", "");
  $("._0_filters-panel").attr("data-kagi-filter-panel", "");
  $("#sidebarForm").attr("data-kagi-search-filters", "");

  for (const [selector, filterName] of semanticFilterHooks) {
    const toggle = $(selector);
    const filter = toggle.closest(".filter-item");

    toggle.attr("data-kagi-filter-toggle", filterName);
    filter.attr("data-kagi-filter", filterName);
    filter
      .find(".dd-toggle-label")
      .first()
      .attr("data-kagi-filter-trigger", "");
    filter.find(".dd-list").first().attr("data-kagi-filter-options", "");
    filter.find(".inner-label").attr("data-kagi-filter-option", "");
  }

  $("#menu-advanced-search-toggle").attr("data-kagi-action", "advanced-search");
  $("._0_sidebar-filter-clear").attr("data-kagi-action", "clear-filters");

  $("._0_SRI, .search-result").attr("data-kagi-result", "");
  $("a.__sri_title_link, .__sri-title-box > a, .__srgi-title > a").attr(
    "data-kagi-result-title",
    "",
  );
  $(".__sri-url, .__sri-url-box a").attr("data-kagi-result-url", "");
  $(".__sri-desc, ._0_DESC").attr("data-kagi-result-description", "");

  return $.html();
}

function buildHtmlVariant(html, variant, capture) {
  if (variant === "original") {
    return prepareForLocalViewing(html);
  }

  if (variant === "backwards-compatible") {
    return addBackwardsCompatibleHooks(prepareForLocalViewing(html), capture);
  }

  throw new Error(`Unsupported HTML variant: ${variant}`);
}

function cssPathForVersion(sample, version) {
  return version === "semantic" ? sample.local_semantic : sample.local_original;
}

function validHtmlVariantsForCssVersion(cssVersion) {
  if (cssVersion === "semantic") {
    return ["backwards-compatible", "optimized"].filter((variant) =>
      implementedHtmlVariants.includes(variant),
    );
  }

  return ["original", "backwards-compatible"];
}

function validHtmlVariantsForCssOption(cssOption) {
  if (cssOption.sampleId === "none") {
    return implementedHtmlVariants;
  }

  return validHtmlVariantsForCssVersion(cssOption.version);
}

function plannedCombinations(samples, captures) {
  if (captures.length === 0) {
    return [];
  }

  const cssOptions = cssOptionsForSamples(samples);

  return captures.flatMap((capture) =>
    cssOptions.flatMap((cssOption) =>
      validHtmlVariantsForCssOption(cssOption).map((htmlVariant) => {
        const matrixFileName = `${capture.id}__${htmlVariant}__${cssOption.sampleId}__${cssOption.version}.html`;
        const htmlFilePath = path.join(
          generatedRoot,
          "html",
          htmlVariant,
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
          htmlVariant,
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

function injectCssLink(html, combination) {
  const $ = cheerio.load(html, { decodeEntities: false });

  if (combination.cssPath) {
    const href = `../../${combination.cssPath}`;
    const cssLink = `<link rel="stylesheet" href="${href}" data-fixture-custom-css="${combination.cssSample}" data-fixture-css-version="${combination.cssVersion}">`;

    $("head").append(`\n    ${cssLink}\n  `);
  }

  $("html")
    .attr("data-fixture-capture", combination.captureId)
    .attr("data-fixture-html-variant", combination.htmlVariant)
    .attr("data-fixture-css-sample", combination.cssSample)
    .attr("data-fixture-css-version", combination.cssVersion);

  return $.html();
}

async function writeHtmlVariants(captures) {
  const written = [];

  for (const capture of captures) {
    const html = await fs.readFile(capture.sourcePath, "utf8");

    for (const variant of implementedHtmlVariants) {
      const outputPath = path.join(
        generatedRoot,
        "html",
        variant,
        `${capture.id}.html`,
      );
      const variantHtml = buildHtmlVariant(html, variant, capture);

      await fs.writeFile(
        outputPath,
        variantHtml.endsWith("\n") ? variantHtml : `${variantHtml}\n`,
      );
      written.push({
        captureId: capture.id,
        htmlVariant: variant,
        path: relativeProjectPath(outputPath),
        bytes: Buffer.byteLength(variantHtml),
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
    const matrixHtml = injectCssLink(html, combination);

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
  const generatedHtml = await writeHtmlVariants(captures);
  const matrix = plannedCombinations(samples, captures);

  await writeMatrixPages(matrix);

  const summary = {
    status: captures.length === 0 ? "waiting-for-captures" : "ready",
    plannedHtmlVariants,
    implementedHtmlVariants,
    captureFiles: captures.map((capture) => capture.fileName),
    cssSamples: samples.map((sample) => sample.id).sort(),
    cssOptions: cssOptions.map((cssOption) => ({
      sampleId: cssOption.sampleId,
      sampleName: cssOption.sampleName,
      version: cssOption.version,
      path: cssOption.path,
      builtIn: cssOption.builtIn,
    })),
    generatedHtml,
    generatedMatrixPageCount: matrix.length,
    nextStep:
      captures.length === 0
        ? "Add redacted HTML captures to fixture-lab/captures/original/."
        : "Implement optimized HTML transforms and semantic CSS samples.",
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
        })),
        htmlVariants: implementedHtmlVariants,
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
    `Generated ${generatedHtml.length} HTML variant page(s) and ${matrix.length} matrix page(s) from ${captures.length} capture(s).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
