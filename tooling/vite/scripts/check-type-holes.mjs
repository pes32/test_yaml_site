#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../..');
const allowlistPath = join(repoRoot, 'tooling/vite/type-hole-allowlist.json');

const sourceRoots = [
  'frontend/js',
  'tooling/vite/src',
  'tests'
];
const sourceFiles = [
  'tooling/vite/vite.config.ts'
];
const sourceExtensions = new Set(['.ts', '.tsx', '.mts', '.cts', '.vue']);
const ignoredSegments = new Set([
  'node_modules',
  'frontend/dist',
  'playwright-report',
  'sudoku'
]);

const bannedPatterns = [
  {
    name: ': any',
    regexp: /:\s*any\b/g
  },
  {
    name: 'as unknown as',
    regexp: /as\s+unknown\s+as/g
  },
  {
    name: 'ThisType<any>',
    regexp: /ThisType\s*<\s*any\s*>/g
  },
  {
    name: '@ts-ignore',
    regexp: /@ts-ignore/g
  },
  {
    name: '@ts-expect-error',
    regexp: /@ts-expect-error/g
  },
  {
    name: 'compatOptions',
    regexp: /compatOptions/g
  },
  {
    name: 'compatBlock',
    regexp: /compatBlock/g
  }
];

function toPosixPath(path) {
  return path.split(sep).join('/');
}

function isIgnored(path) {
  const normalized = toPosixPath(relative(repoRoot, path));
  return [...ignoredSegments].some((segment) =>
    normalized === segment || normalized.startsWith(`${segment}/`) || normalized.includes(`/${segment}/`)
  );
}

function fileExtension(path) {
  const match = path.match(/(\.[^.]+)$/);
  return match ? match[1] : '';
}

function collectFiles(path, files = []) {
  if (isIgnored(path)) {
    return files;
  }

  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) {
      collectFiles(join(path, entry), files);
    }
    return files;
  }

  if (stat.isFile() && sourceExtensions.has(fileExtension(path))) {
    files.push(path);
  }
  return files;
}

function readAllowlist() {
  try {
    const parsed = JSON.parse(readFileSync(allowlistPath, 'utf8'));
    if (!Array.isArray(parsed)) {
      throw new Error('allowlist root must be an array');
    }
    return parsed;
  } catch (error) {
    throw new Error(`Failed to read ${toPosixPath(relative(repoRoot, allowlistPath))}: ${error.message}`);
  }
}

function validateAllowlistEntry(entry, index) {
  const prefix = `allowlist[${index}]`;
  const missing = [];
  for (const key of ['path', 'pattern', 'reason', 'owner']) {
    if (typeof entry?.[key] !== 'string' || !entry[key].trim()) {
      missing.push(key);
    }
  }
  if (
    (typeof entry?.removeBy !== 'string' || !entry.removeBy.trim()) &&
    (typeof entry?.tracking !== 'string' || !entry.tracking.trim())
  ) {
    missing.push('removeBy|tracking');
  }
  if (missing.length) {
    throw new Error(`${prefix} is missing required field(s): ${missing.join(', ')}`);
  }
}

function buildAllowlist(entries) {
  const allowed = new Map();
  entries.forEach((entry, index) => {
    validateAllowlistEntry(entry, index);
    const key = `${entry.path}::${entry.pattern}`;
    if (!allowed.has(key)) {
      allowed.set(key, []);
    }
    allowed.get(key).push({ ...entry, used: false });
  });
  return allowed;
}

function lineNumberAt(content, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

function findViolations(files) {
  const violations = [];
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const path = toPosixPath(relative(repoRoot, file));

    for (const pattern of bannedPatterns) {
      pattern.regexp.lastIndex = 0;
      let match = pattern.regexp.exec(content);
      while (match) {
        violations.push({
          line: lineNumberAt(content, match.index),
          path,
          pattern: pattern.name,
          text: match[0]
        });
        match = pattern.regexp.exec(content);
      }
    }
  }
  return violations;
}

function isAllowed(violation, allowed) {
  const entries = allowed.get(`${violation.path}::${violation.pattern}`) || [];
  const entry = entries.find((candidate) => !candidate.used);
  if (!entry) {
    return false;
  }
  entry.used = true;
  return true;
}

function unusedAllowlistEntries(allowed) {
  return [...allowed.values()].flat().filter((entry) => !entry.used);
}

function main() {
  const allowed = buildAllowlist(readAllowlist());
  const files = [
    ...sourceRoots.flatMap((root) => collectFiles(join(repoRoot, root))),
    ...sourceFiles.map((file) => join(repoRoot, file))
  ];
  const violations = findViolations(files);
  const unexpected = violations.filter((violation) => !isAllowed(violation, allowed));
  const unused = unusedAllowlistEntries(allowed);

  if (!unexpected.length && !unused.length) {
    console.log('type-hole policy passed');
    return;
  }

  if (unexpected.length) {
    console.error('Unexpected type-hole policy violation(s):');
    for (const violation of unexpected) {
      console.error(`- ${violation.path}:${violation.line} ${violation.pattern} (${violation.text})`);
    }
  }

  if (unused.length) {
    console.error('Unused type-hole allowlist entry/entries:');
    for (const entry of unused) {
      console.error(`- ${entry.path} ${entry.pattern}: ${entry.reason}`);
    }
  }

  process.exitCode = 1;
}

main();
