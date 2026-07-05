import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const fixtureRoot = path.join(projectRoot, "fixture-lab");
const reportsRoot = path.join(projectRoot, "generated", "reports");
const matrixManifestPath = path.join(
  projectRoot,
  "generated",
  "matrix",
  "manifest.json",
);

const privateSelectorPattern =
  /(^|[\s>+~,(])(?:#[\w-]*(?:dd_toggle|sidebarForm|web_archive)[\w-]*|\.(?:_0_|__|sri-|newsResultItem|podcast_result|quick-search-btn)[\w-]*)/;
const privateSelectorTokenPattern =
  /#[\w-]*(?:dd_toggle|sidebarForm|web_archive)[\w-]*|\.(?:_0_|__|sri-|newsResultItem|podcast_result|quick-search-btn)[\w-]*/g;
const structuralSelectorPattern = /(?:\+|~|>|:nth-child|:nth-of-type)/;
const modernSelectorPattern = /:has\(/;
const pseudoElementPattern = /::[\w-]+/;

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

function splitSelectors(selectorText) {
  const selectors = [];

  selectorParser((root) => {
    root.each((selector) => {
      const value = selector.toString().trim();

      if (value) {
        selectors.push(value);
      }
    });
  }).processSync(selectorText);

  return selectors;
}

function closestParentRule(rule) {
  let parent = rule.parent;

  while (parent) {
    if (parent.type === "rule") {
      return parent;
    }

    parent = parent.parent;
  }

  return null;
}

function combineNestedSelector(parentSelector, childSelector) {
  if (childSelector.includes("&")) {
    return childSelector.replaceAll("&", parentSelector);
  }

  return `${parentSelector} ${childSelector}`;
}

function resolvedSelectorsForRule(rule, cache = new WeakMap()) {
  const cached = cache.get(rule);

  if (cached) {
    return cached;
  }

  const selectors = splitSelectors(rule.selector);
  const parentRule = closestParentRule(rule);

  if (!parentRule) {
    cache.set(rule, selectors);
    return selectors;
  }

  const parentSelectors = resolvedSelectorsForRule(parentRule, cache);
  const resolvedSelectors = parentSelectors.flatMap((parentSelector) =>
    selectors.map((selector) =>
      combineNestedSelector(parentSelector, selector),
    ),
  );

  cache.set(rule, resolvedSelectors);
  return resolvedSelectors;
}

function classifySelector(selector) {
  return {
    selector,
    privateKagiSelector: privateSelectorPattern.test(selector),
    structuralDependency: structuralSelectorPattern.test(selector),
    modernSelector: modernSelectorPattern.test(selector),
  };
}

function selectorForMatching(selector) {
  if (pseudoElementPattern.test(selector)) {
    return null;
  }

  return selector;
}

function countLines(value) {
  if (!value) {
    return 0;
  }

  const newlineCount = value.match(/\n/g)?.length ?? 0;

  return value.endsWith("\n") ? newlineCount : newlineCount + 1;
}

function uniquePrivateSelectorTokens(selectors) {
  return [
    ...new Set(
      selectors.flatMap(
        (item) => item.selector.match(privateSelectorTokenPattern) ?? [],
      ),
    ),
  ].sort();
}

function auditCss(css, from) {
  const root = postcss.parse(css, { from });
  const selectors = [];
  let declarationCount = 0;
  let tokenDeclarationCount = 0;
  const selectorCache = new WeakMap();

  root.walkRules((rule) => {
    if (
      rule.parent?.type === "atrule" &&
      /keyframes$/i.test(rule.parent.name)
    ) {
      return;
    }

    for (const selector of resolvedSelectorsForRule(rule, selectorCache)) {
      selectors.push(classifySelector(selector));
    }

    rule.each((node) => {
      if (node.type !== "decl") {
        return;
      }

      const declaration = node;
      declarationCount += 1;

      if (
        declaration.prop.startsWith("--") ||
        /var\(--/.test(declaration.value)
      ) {
        tokenDeclarationCount += 1;
      }
    });
  });

  const privateSelectorTokens = uniquePrivateSelectorTokens(selectors);

  return {
    lineCount: countLines(css),
    selectorCount: selectors.length,
    privateSelectorCount: selectors.filter((item) => item.privateKagiSelector)
      .length,
    privateSelectorTokenCount: privateSelectorTokens.length,
    privateSelectorTokens,
    structuralSelectorCount: selectors.filter(
      (item) => item.structuralDependency,
    ).length,
    modernSelectorCount: selectors.filter((item) => item.modernSelector).length,
    declarationCount,
    tokenDeclarationCount,
    selectors,
  };
}

async function readMatrixManifest() {
  if (!(await pathExists(matrixManifestPath))) {
    return null;
  }

  return readJson(matrixManifestPath);
}

async function auditSampleVersion(sample, version, localPath) {
  if (!localPath) {
    return null;
  }

  const absolutePath = path.join(projectRoot, localPath);

  if (!(await pathExists(absolutePath))) {
    return {
      sampleId: sample.id,
      version,
      path: localPath,
      missing: true,
    };
  }

  const css = await fs.readFile(absolutePath, "utf8");
  return {
    sampleId: sample.id,
    version,
    path: localPath,
    missing: false,
    bytes: Buffer.byteLength(css),
    ...auditCss(css, absolutePath),
  };
}

async function loadHtmlVariantPages(matrixManifest) {
  const pages = new Map();

  if (!matrixManifest) {
    return pages;
  }

  const htmlPaths = new Map();
  for (const combination of matrixManifest.combinations ?? []) {
    htmlPaths.set(
      `${combination.captureId}::${combination.htmlVariant}`,
      combination.htmlPath,
    );
  }

  await Promise.all(
    [...htmlPaths.entries()].map(async ([key, relativePath]) => {
      const html = await fs.readFile(
        path.join(projectRoot, relativePath),
        "utf8",
      );
      pages.set(key, {
        path: relativePath,
        $: cheerio.load(html, { decodeEntities: false }),
      });
    }),
  );

  return pages;
}

function countSelectorMatches($, selector) {
  const matchableSelector = selectorForMatching(selector);

  if (!matchableSelector) {
    return {
      count: 0,
      unsupported: true,
      reason: "pseudo-element",
    };
  }

  try {
    return {
      count: $(matchableSelector).length,
      unsupported: false,
      reason: null,
    };
  } catch (error) {
    return {
      count: 0,
      unsupported: true,
      reason: error.message,
    };
  }
}

function uniqueMatchTargets(report, matrixManifest) {
  const targets = new Map();

  for (const combination of matrixManifest?.combinations ?? []) {
    if (
      combination.cssSample !== report.sampleId ||
      combination.cssVersion !== report.version
    ) {
      continue;
    }

    targets.set(`${combination.captureId}::${combination.htmlVariant}`, {
      captureId: combination.captureId,
      htmlVariant: combination.htmlVariant,
    });
  }

  return [...targets.values()];
}

function matchSelectors(report, pages, matrixManifest) {
  if (!report || report.missing || !report.selectors) {
    return [];
  }

  return uniqueMatchTargets(report, matrixManifest).map((target) => {
    const key = `${target.captureId}::${target.htmlVariant}`;
    const page = pages.get(key);

    if (!page) {
      throw new Error(`Missing generated HTML page for ${key}`);
    }

    const selectors = report.selectors.map((item) => {
      const match = countSelectorMatches(page.$, item.selector);

      return {
        ...item,
        matchCount: match.count,
        unsupported: match.unsupported,
        unsupportedReason: match.reason,
      };
    });

    return {
      sampleId: report.sampleId,
      cssVersion: report.version,
      captureId: target.captureId,
      htmlVariant: target.htmlVariant,
      htmlPath: page.path,
      selectorCount: selectors.length,
      matchedSelectorCount: selectors.filter((item) => item.matchCount > 0)
        .length,
      unsupportedSelectorCount: selectors.filter((item) => item.unsupported)
        .length,
      selectors,
    };
  });
}

function summarizeCompatibility(reports, selectorMatches) {
  const presentReports = reports.filter((report) => report && !report.missing);
  const privateSelectorTokens = [
    ...new Set(
      presentReports.flatMap((report) => report.privateSelectorTokens ?? []),
    ),
  ].sort();
  const regressions = [];

  const originalMatches = new Map();
  for (const matchReport of selectorMatches) {
    if (matchReport.htmlVariant !== "original") {
      continue;
    }

    for (const selector of matchReport.selectors) {
      if (selector.matchCount > 0) {
        originalMatches.set(
          [
            matchReport.sampleId,
            matchReport.cssVersion,
            matchReport.captureId,
            selector.selector,
          ].join("::"),
          selector.matchCount,
        );
      }
    }
  }

  for (const matchReport of selectorMatches) {
    if (matchReport.htmlVariant !== "backwards-compatible") {
      continue;
    }

    for (const selector of matchReport.selectors) {
      const key = [
        matchReport.sampleId,
        matchReport.cssVersion,
        matchReport.captureId,
        selector.selector,
      ].join("::");

      if (originalMatches.has(key) && selector.matchCount === 0) {
        regressions.push({
          sampleId: matchReport.sampleId,
          cssVersion: matchReport.cssVersion,
          captureId: matchReport.captureId,
          selector: selector.selector,
          originalMatchCount: originalMatches.get(key),
        });
      }
    }
  }

  return {
    status:
      selectorMatches.length === 0
        ? "selector-inventory-only"
        : regressions.length === 0
          ? "backwards-compatible-preserved"
          : "backwards-compatible-regressions",
    cssFileCount: presentReports.length,
    selectorCount: presentReports.reduce(
      (total, report) => total + report.selectorCount,
      0,
    ),
    privateSelectorCount: presentReports.reduce(
      (total, report) => total + report.privateSelectorCount,
      0,
    ),
    privateSelectorTokenCount: privateSelectorTokens.length,
    privateSelectorTokens,
    structuralSelectorCount: presentReports.reduce(
      (total, report) => total + report.structuralSelectorCount,
      0,
    ),
    modernSelectorCount: presentReports.reduce(
      (total, report) => total + report.modernSelectorCount,
      0,
    ),
    htmlMatchReportCount: selectorMatches.length,
    backwardsCompatibleRegressionCount: regressions.length,
    regressions,
  };
}

async function main() {
  await fs.mkdir(reportsRoot, { recursive: true });

  const manifestPath = path.join(fixtureRoot, "css-corpus", "manifest.json");
  const manifest = await readJson(manifestPath);
  const samples = manifest.samples ?? [];
  const matrixManifest = await readMatrixManifest();
  const htmlPages = await loadHtmlVariantPages(matrixManifest);

  const reports = (
    await Promise.all(
      samples.flatMap((sample) => [
        auditSampleVersion(sample, "original", sample.local_original),
        auditSampleVersion(sample, "semantic", sample.local_semantic),
      ]),
    )
  ).filter(Boolean);

  const selectorMatches = reports.flatMap((report) =>
    matchSelectors(report, htmlPages, matrixManifest),
  );

  const inventory = {
    samples: reports,
  };
  const summary = summarizeCompatibility(reports, selectorMatches);

  await fs.writeFile(
    path.join(reportsRoot, "selector-inventory.json"),
    `${JSON.stringify(inventory, null, 2)}\n`,
  );

  await fs.writeFile(
    path.join(reportsRoot, "selector-matches.json"),
    `${JSON.stringify({ matches: selectorMatches }, null, 2)}\n`,
  );

  await fs.writeFile(
    path.join(reportsRoot, "compatibility-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  console.log(
    `Audited ${summary.cssFileCount} CSS file(s), ${summary.selectorCount} selector(s), and ${summary.htmlMatchReportCount} HTML match report(s).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
