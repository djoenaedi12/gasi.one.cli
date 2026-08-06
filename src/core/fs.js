import { mkdir, readdir, readFile, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function readJson(filePath) {
  const raw = await readFile(path.resolve(filePath), 'utf8');
  return JSON.parse(raw);
}

export async function readTextFile(filePath) {
  return readFile(filePath, 'utf8');
}

export async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function listFiles(directoryPath) {
  try {
    return await readdir(directoryPath);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function listDirEntries(directoryPath) {
  try {
    return await readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function removeFile(filePath) {
  try {
    await rm(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function removeEmptyDir(directoryPath) {
  try {
    await rmdir(directoryPath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTEMPTY') return false;
    throw error;
  }
}

export async function writeTextFile(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}
