import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(import.meta.url);
const defaultPlatformRoot = path.resolve(path.dirname(modulePath), "../..");
const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".runtime",
  "__tests__",
  "build",
  "coverage",
  "dist",
  "docs",
  "fixtures",
  "node_modules",
  "release",
  "test",
  "tests",
]);
const runtimeExtensions = new Set([
  ".cjs",
  ".cts",
  ".env",
  ".js",
  ".json",
  ".jsx",
  ".mjs",
  ".mts",
  ".ps1",
  ".sh",
  ".toml",
  ".ts",
  ".tsx",
  ".tf",
  ".yaml",
  ".yml",
]);
const hookPatterns = [
  { kind: "sibling-path", pattern: /(?:^|[\\/])Hook(?:[\\/]|$)/i },
  { kind: "environment", pattern: /\bHOOK_(?:URL|BASE_URL|TOKEN|API_KEY)\b/i },
  { kind: "service-name", pattern: /\b(?:hook-service|hook_service)\b/i },
  { kind: "endpoint", pattern: /https?:\/\/hook(?::|\/|\.)/i },
];
const dependencySections = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
  "bundledDependencies",
];
const inventoryRelativePath = path.normalize("scripts/acceptance/hook-inventory.mjs");

function isRuntimeFile(fileName) {
  if (/\.(?:test|spec)\.[^.]+$/i.test(fileName)) return false;
  if (/^\.env(?:\..+)?$/i.test(fileName)) return true;
  if (/^Dockerfile(?:\..+)?$/i.test(fileName) || /\.dockerfile$/i.test(fileName)) return true;
  return runtimeExtensions.has(path.extname(fileName).toLowerCase());
}

async function walk(directory, platformRoot, files) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) await walk(absolutePath, platformRoot, files);
      continue;
    }
    if (!entry.isFile() || !isRuntimeFile(entry.name)) continue;
    const relativePath = path.relative(platformRoot, absolutePath);
    if (path.normalize(relativePath) === inventoryRelativePath) continue;
    files.push({ absolutePath, relativePath });
  }
}

function dependencyNames(packageJson) {
  const names = [];
  for (const section of dependencySections) {
    const value = packageJson?.[section];
    if (Array.isArray(value)) {
      names.push(...value.filter((item) => typeof item === "string"));
    } else if (value && typeof value === "object") {
      names.push(...Object.keys(value));
    }
  }
  return names;
}

function isHookDependency(name) {
  return /^(?:@[^/]+\/)?hook(?:-client|-sdk|-service)?$/i.test(name);
}

function lineNumberFor(contents, needle) {
  const index = contents.indexOf(needle);
  if (index < 0) return 1;
  return contents.slice(0, index).split(/\r?\n/).length;
}

function inspectFile({ contents, relativePath }) {
  const matches = [];
  const lines = contents.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const { kind, pattern } of hookPatterns) {
      if (pattern.test(line)) {
        matches.push({ file: relativePath, line: index + 1, kind });
        break;
      }
    }
  });

  if (path.basename(relativePath).toLowerCase() === "package.json") {
    try {
      const parsed = JSON.parse(contents);
      for (const dependency of dependencyNames(parsed).filter(isHookDependency)) {
        matches.push({
          file: relativePath,
          line: lineNumberFor(contents, dependency),
          kind: "dependency",
          dependency,
        });
      }
    } catch {
      // Package parsing failures belong to build/typecheck gates; text patterns still apply here.
    }
  }

  return matches;
}

async function readRuntimeText({ absolutePath, relativePath }) {
  let buffer;
  try {
    buffer = await readFile(absolutePath);
  } catch (error) {
    throw new Error(
      `Hook inventory could not read runtime file ${relativePath}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  if (buffer.includes(0)) {
    throw new Error(`Hook inventory cannot inspect binary runtime file: ${relativePath}`);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch (error) {
    throw new Error(`Hook inventory runtime file is not valid UTF-8: ${relativePath}`, { cause: error });
  }
}

export async function inspectHookInventory({ platformRoot = defaultPlatformRoot } = {}) {
  const resolvedPlatformRoot = path.resolve(platformRoot);
  const files = [];
  await walk(resolvedPlatformRoot, resolvedPlatformRoot, files);

  const matches = [];
  for (const file of files) {
    const contents = await readRuntimeText(file);
    matches.push(...inspectFile({ contents, relativePath: file.relativePath }));
  }

  return {
    schemaVersion: 1,
    target: "Hook",
    status: matches.length === 0 ? "not-applicable" : "found-runtime-call-point",
    inspectedFileCount: files.length,
    matches,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  try {
    const result = await inspectHookInventory();
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === "not-applicable" ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
