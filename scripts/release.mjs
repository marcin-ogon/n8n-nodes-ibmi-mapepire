#!/usr/bin/env node
/**
 * Lightweight release helper.
 *
 * Usage:
 *   npm run release:patch
 *   npm run release:minor
 *   npm run release:major
 *
 * Steps:
 * 1. Determine bump type (patch|minor|major)
 * 2. Verify clean git working tree
 * 3. Bump version in package.json
 * 4. Generate/update CHANGELOG.md (prepends Unreleased -> new version section)
 * 5. Commit changes
 * 6. Create git tag (vX.Y.Z)
 * 7. Push commit and tag
 *
 * Changelog format expected:
 * # Changelog\n\n## Unreleased\n...optional notes...\n\n## x.y.z - yyyy-mm-dd\n
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(process.cwd());
const pkgPath = path.join(root, 'package.json');
const changelogPath = path.join(root, 'CHANGELOG.md');

const bumpType = process.argv[2];
if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('Bump type required: patch | minor | major');
  process.exit(1);
}

function run(cmd) {
  return execSync(cmd, { stdio: 'pipe' }).toString().trim();
}

function ensureCleanGit() {
  const status = run('git status --porcelain');
  if (status) {
    console.error('Working tree not clean. Commit or stash changes first.');
    process.exit(1);
  }
}

function bumpVersion(version, type) {
  const [maj, min, pat] = version.split('.').map(Number);
  if (type === 'major') return `${maj + 1}.0.0`;
  if (type === 'minor') return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

function updatePackageJson() {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const oldVersion = pkg.version;
  const newVersion = bumpVersion(oldVersion, bumpType);
  pkg.version = newVersion;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  return { oldVersion, newVersion };
}

function formatDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function updateChangelog(newVersion) {
  let text = readFileSync(changelogPath, 'utf8');
  // Ensure Unreleased section exists; if not, create placeholder at top
  if (!/## Unreleased/i.test(text)) {
    text = text.replace(/# Changelog\n?/, '# Changelog\n\n## Unreleased\n- No unreleased changes.\n\n');
  }

  const date = formatDate();

  // Capture Unreleased section content (lines between '## Unreleased' and next '## ')
  const unreleasedMatch = text.match(/## Unreleased\n([\s\S]*?)(?=\n## )/i);
  let unreleasedBody = '';
  if (unreleasedMatch) {
    unreleasedBody = unreleasedMatch[1].trim();
  }

  // If unreleased empty or placeholder, set a default note
  if (!unreleasedBody || /No unreleased changes/i.test(unreleasedBody)) {
    unreleasedBody = '- Internal changes only.';
  }

  const newSection = `## ${newVersion} - ${date}\n${unreleasedBody}\n\n`;

  // Replace unreleased body with placeholder after release
  const updated = text.replace(/## Unreleased\n([\s\S]*?)(?=\n## )/, '## Unreleased\n- No unreleased changes.\n\n$&')
    // The above keeps original; simpler: rebuild from scratch below

  // Simpler approach: remove existing Unreleased block entirely then prepend new structure
  const stripped = text.replace(/## Unreleased\n([\s\S]*?)(?=\n## )/i, '## Unreleased\n- No unreleased changes.\n');

  const finalText = stripped.replace(/(# Changelog\n+)/, `$1\n${newSection}`);
  writeFileSync(changelogPath, finalText.trimEnd() + '\n');
}

function gitCommitTagPush(newVersion) {
  run('git add package.json CHANGELOG.md');
  run(`git commit -m "chore(release): v${newVersion}"`);
  run(`git tag v${newVersion}`);
  const currentBranch = run('git rev-parse --abbrev-ref HEAD');
  run(`git push origin ${currentBranch}`);
  run(`git push origin v${newVersion}`);
  console.log(`\nRelease v${newVersion} pushed. GitHub Action will publish.`);
}

(function main() {
  ensureCleanGit();
  const { newVersion } = updatePackageJson();
  updateChangelog(newVersion);
  gitCommitTagPush(newVersion);
})();
