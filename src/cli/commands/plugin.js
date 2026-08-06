import { readJson } from '../../core/fs.js';
import { cleanPluginPlan } from '../../generator/plugin/cleaner.js';
import { buildPluginPlan } from '../../generator/plugin/planner.js';
import { writePlan } from '../../generator/writer.js';
import { normalizePluginDocument } from '../../schema/plugin/normalize.js';
import { validatePluginDocument } from '../../schema/plugin/validate.js';
import { parseOptions, requireOption } from '../parser.js';

const helpText = `gasi:one plugin

Usage:
  gasi-one plugin validate -f <plugin.json>
  gasi-one plugin plan     -f <plugin.json> -o <output-dir> --target api|web
  gasi-one plugin sync     -f <plugin.json> -o <output-dir> --target api|web
  gasi-one plugin clean    -f <plugin.json> -o <output-dir> --target api|web

Alias:
  gasi-one module <command> ...

Options:
  -f, --file      Plugin JSON file.
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

export async function runPluginCommand(command, args) {
  if (!['validate', 'plan', 'sync', 'clean'].includes(command)) {
    throw new Error(`Unknown plugin command: ${command}\n\n${helpText}`);
  }

  const options = parseOptions(args, optionDefinitions);
  requireOption(options, 'file', '--file');

  const document = await loadPluginDocument(options.file);

  if (command === 'validate') {
    console.log(`Valid plugin schema: ${document.name}`);
    return;
  }

  requireOption(options, 'target', '--target');
  validateTarget(options.target);

  const plan = await buildPluginPlan(document, {
    target: options.target,
    outputDir: options.output ?? 'generated'
  });

  if (command === 'plan') {
    printPlan(plan);
    return;
  }

  if (command === 'clean') {
    const result = await cleanPluginPlan(plan);
    console.log(`Cleaned plugin ${document.name}, deleted ${result.deleted} file(s), skipped ${result.skipped} missing file(s)`);
    return;
  }

  const result = await writePlan(plan);
  console.log(`Generated ${result.written} file(s), skipped ${result.skipped} existing file(s)`);
}

async function loadPluginDocument(file) {
  const rawDocument = await readJson(file);
  const document = normalizePluginDocument(rawDocument);
  validatePluginDocument(document);
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
