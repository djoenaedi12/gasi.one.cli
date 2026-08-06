import { readJson } from '../../core/fs.js';
import { cleanResources } from '../../generator/resource/cleaner.js';
import { buildResourcePlan } from '../../generator/resource/planner.js';
import { writePlan } from '../../generator/writer.js';
import { normalizeResourceDocument } from '../../schema/resource/normalize.js';
import { validateResourceDocument } from '../../schema/resource/validate.js';
import { parseOptions, requireOption } from '../parser.js';

const helpText = `gasi:one resource

Usage:
  gasi-one resource validate -f <resources.json>
  gasi-one resource plan     -f <resources.json> -o <output-dir> --target api|web
  gasi-one resource sync     -f <resources.json> -o <output-dir> --target api|web
  gasi-one resource clean    -f <resources.json> -o <output-dir> --target api|web

Options:
  -f, --file      Resource JSON file.
  -o, --output    Output directory. Default: generated
  -t, --target    api or web. Required for plan, sync, and clean.
`;

const optionDefinitions = {
  '-f': { key: 'file' },
  '--file': { key: 'file' },
  '-o': { key: 'output' },
  '--output': { key: 'output' },
  '-t': { key: 'target' },
  '--target': { key: 'target' }
};

export async function runResourceCommand(command, args) {
  if (!['validate', 'plan', 'sync', 'clean'].includes(command)) {
    throw new Error(`Unknown resource command: ${command}\n\n${helpText}`);
  }

  const options = parseOptions(args, optionDefinitions);
  requireOption(options, 'file', '--file');

  const document = await loadResourceDocument(options.file);

  if (command === 'validate') {
    console.log(`Valid resource schema: ${document.resources.length} resource(s)`);
    return;
  }

  requireOption(options, 'target', '--target');
  validateTarget(options.target);

  if (command === 'clean') {
    const result = await cleanResources(document, {
      outputDir: options.output ?? 'generated'
    });
    console.log(`Cleaned ${result.removedResources} resource(s), deleted ${result.deletedFiles} generated file(s), deleted ${result.deletedMigrationFiles} migration file(s), updated ${result.updatedI18nFiles} i18n file(s), deleted ${result.deletedI18nFiles} empty i18n file(s), skipped ${result.skippedResources} missing resource(s)`);
    return;
  }

  const plan = await buildResourcePlan(document, {
    target: options.target,
    outputDir: options.output ?? 'generated'
  });

  if (command === 'plan') {
    printPlan(plan);
    return;
  }

  const result = await writePlan(plan);
  console.log(`Generated ${result.written} file(s), skipped ${result.skipped} existing file(s)`);
}

async function loadResourceDocument(file) {
  const rawDocument = await readJson(file);
  const document = normalizeResourceDocument(rawDocument);
  validateResourceDocument(document);
  return document;
}

function printPlan(plan) {
  for (const file of plan.files) {
    console.log(`${file.action.padEnd(8)} ${file.path}`);
  }
  console.log(`Planned ${plan.files.length} file(s)`);
}

function validateTarget(target) {
  if (!['api', 'web'].includes(target)) {
    throw new Error('--target must be api or web.');
  }
}
