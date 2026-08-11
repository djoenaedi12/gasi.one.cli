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
  const noticeBlock = leadingPropertyCommentBlock(generatedContent);
  const shouldPrependNotice = noticeBlock && !existingContent.includes(noticeBlock);
  const missingLines = generatedContent
    .split(/\r?\n/)
    .filter((line) => {
      const key = propertyKey(line);
      return key && !existingKeys.has(key);
    });

  if (!shouldPrependNotice && missingLines.length === 0) return null;

  const contentWithNotice = shouldPrependNotice
    ? `${noticeBlock}\n\n${existingContent.replace(/^\s+/, '')}`
    : existingContent;
  if (missingLines.length === 0) return contentWithNotice;

  const separator = contentWithNotice.endsWith('\n') ? '' : '\n';
  return `${contentWithNotice}${separator}${missingLines.join('\n')}\n`;
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

function leadingPropertyCommentBlock(content) {
  const lines = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed && lines.length > 0) break;
    if (!trimmed) continue;
    if (!trimmed.startsWith('#') && !trimmed.startsWith('!')) break;
    lines.push(line);
  }

  return lines.some((line) => line.includes('Copyright (c)')) ? lines.join('\n') : '';
}
