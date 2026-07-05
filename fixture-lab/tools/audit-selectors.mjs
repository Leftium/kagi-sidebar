import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const fixtureRoot = path.join(projectRoot, "fixture-lab");
const reportsRoot = path.join(projectRoot, "generated", "reports");

const privateSelectorPattern =
  /(^|[\s>+~,(])(?:#[\w-]*(?:dd_toggle|sidebarForm|web_archive)[\w-]*|\.(?:_0_|__|sri-|newsResultItem|podcast_result|quick-search-btn)[\w-]*)/;
const structuralSelectorPattern = /(?:\+|~|>|:nth-child|:nth-of-type)/;
const modernSelectorPattern = /:has\(/;

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

function classifySelector(selector) {
  return {
    selector,
    privateKagiSelector: privateSelectorPattern.test(selector),
    structuralDependency: structuralSelectorPattern.test(selector),
    modernSelector: modernSelectorPattern.test(selector),
  };
}

function auditCss(css, from) {
  const root = postcss.parse(css, { from });
  const selectors = [];
  let declarationCount = 0;
  let tokenDeclarationCount = 0;

  root.walkRules((rule) => {
    if (
      rule.parent?.type === "atrule" &&
      /keyframes$/i.test(rule.parent.name)
    ) {
      return;
    }

    for (const selector of splitSelectors(rule.selector)) {
      selectors.push(classifySelector(selector));
    }

    rule.walkDecls((declaration) => {
      declarationCount += 1;

      if (
        declaration.prop.startsWith("--") ||
        /var\(--/.test(declaration.value)
      ) {
        tokenDeclarationCount += 1;
      }
    });
  });

  return {
    selectorCount: selectors.length,
    privateSelectorCount: selectors.filter((item) => item.privateKagiSelector)
      .length,
    structuralSelectorCount: selectors.filter(
      (item) => item.structuralDependency,
    ).length,
    modernSelectorCount: selectors.filter((item) => item.modernSelector).length,
    declarationCount,
    tokenDeclarationCount,
    selectors,
  };
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
    ...auditCss(css, absolutePath),
  };
}

function summarizeReports(reports) {
  const presentReports = reports.filter((report) => report && !report.missing);

  return {
    status: "selector-inventory-only",
    note: "HTML selector matching will be added after redacted captures and generated variants exist.",
    cssFileCount: presentReports.length,
    selectorCount: presentReports.reduce(
      (total, report) => total + report.selectorCount,
      0,
    ),
    privateSelectorCount: presentReports.reduce(
      (total, report) => total + report.privateSelectorCount,
      0,
    ),
    structuralSelectorCount: presentReports.reduce(
      (total, report) => total + report.structuralSelectorCount,
      0,
    ),
    modernSelectorCount: presentReports.reduce(
      (total, report) => total + report.modernSelectorCount,
      0,
    ),
  };
}

async function main() {
  await fs.mkdir(reportsRoot, { recursive: true });

  const manifestPath = path.join(fixtureRoot, "css-corpus", "manifest.json");
  const manifest = await readJson(manifestPath);
  const samples = manifest.samples ?? [];

  const reports = (
    await Promise.all(
      samples.flatMap((sample) => [
        auditSampleVersion(sample, "original", sample.local_original),
        auditSampleVersion(sample, "semantic", sample.local_semantic),
      ]),
    )
  ).filter(Boolean);

  const inventory = {
    samples: reports,
  };
  const summary = summarizeReports(reports);

  await fs.writeFile(
    path.join(reportsRoot, "selector-inventory.json"),
    `${JSON.stringify(inventory, null, 2)}\n`,
  );

  await fs.writeFile(
    path.join(reportsRoot, "compatibility-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  console.log(
    `Audited ${summary.cssFileCount} CSS file(s) and ${summary.selectorCount} selector(s).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
