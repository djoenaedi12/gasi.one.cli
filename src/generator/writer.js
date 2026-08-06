import { pathExists, readTextFile, writeTextFile } from '../core/fs.js';

export async function writePlan(plan) {
  let written = 0;
  let skipped = 0;

  for (const file of plan.files) {
    const exists = await pathExists(file.absolutePath);
    if (file.writeStrategy === 'merge-properties') {
      const merged = exists ? await mergeProperties(file.absolutePath, file.content) : file.content;
      if (exists && merged === null) {
        skipped += 1;
        continue;
      }

      await writeTextFile(file.absolutePath, merged);
      written += 1;
      continue;
    }

    if (exists && (await readTextFile(file.absolutePath)) === file.content) {
      skipped += 1;
      continue;
    }

    await writeTextFile(file.absolutePath, file.content);
    written += 1;
  }

  return { written, skipped };
}

export async function mergeProperties(filePath, generatedContent) {
  const existingContent = await readTextFile(filePath);
  const existingKeys = propertyKeys(existingContent);
  const missingLines = generatedContent
    .split(/\r?\n/)
    .filter((line) => {
      const key = propertyKey(line);
      return key && !existingKeys.has(key);
    });

  if (missingLines.length === 0) return null;

  const separator = existingContent.endsWith('\n') ? '' : '\n';
  return `${existingContent}${separator}${missingLines.join('\n')}\n`;
}

function propertyKeys(content) {
  const keys = new Set();
  for (const line of content.split(/\r?\n/)) {
    const key = propertyKey(line);
    if (key) keys.add(key);
  }
  return keys;
}

function propertyKey(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) return null;
  const match = trimmed.match(/^([^:=\s]+)\s*[:=\s]/);
  return match?.[1] ?? null;
}
