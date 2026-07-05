import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const generatedRoot = path.join(projectRoot, "generated");
const fixtureRoot = path.join(projectRoot, "fixture-lab");

const htmlVariants = ["original", "backwards-compatible", "optimized"];

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
    .map((entry) => entry.name)
    .sort();
}

async function ensureGeneratedDirs() {
  const dirs = [
    ...htmlVariants.map((variant) => path.join(generatedRoot, "html", variant)),
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

function plannedCombinations(samples, captures) {
  if (captures.length === 0) {
    return [];
  }

  return samples.flatMap((sample) =>
    htmlVariants.flatMap((htmlVariant) =>
      cssVersionsForSample(sample).map((cssVersion) => ({
        htmlVariant,
        cssSample: sample.id,
        cssVersion,
        captureCount: captures.length,
      })),
    ),
  );
}

async function main() {
  await ensureGeneratedDirs();

  const manifestPath = path.join(fixtureRoot, "css-corpus", "manifest.json");
  const manifest = await readJson(manifestPath);
  const samples = manifest.samples ?? [];
  const captures = await listHtmlCaptures();
  const matrix = plannedCombinations(samples, captures);

  const summary = {
    status: captures.length === 0 ? "waiting-for-captures" : "ready",
    htmlVariants,
    captureFiles: captures,
    cssSamples: samples.map((sample) => sample.id).sort(),
    plannedMatrixPageCount: matrix.length,
    nextStep:
      captures.length === 0
        ? "Add redacted HTML captures to fixture-lab/captures/original/."
        : "Implement HTML variant transforms and matrix page emission.",
  };

  await fs.writeFile(
    path.join(generatedRoot, "reports", "generation-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  await fs.writeFile(
    path.join(generatedRoot, "matrix", "manifest.json"),
    `${JSON.stringify({ combinations: matrix }, null, 2)}\n`,
  );

  console.log(
    `Prepared generated/ with ${captures.length} capture(s), ${samples.length} CSS sample(s), and ${matrix.length} planned matrix page(s).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
