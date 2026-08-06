import { runPluginCommand } from './commands/plugin.js';
import { runResourceCommand } from './commands/resource.js';

const helpText = `gasi:one CLI

Usage:
  gasi-one resource validate -f <resources.json>
  gasi-one resource plan     -f <resources.json> -o <output-dir> --target api|web
  gasi-one resource sync     -f <resources.json> -o <output-dir> --target api|web
  gasi-one resource clean    -f <resources.json> -o <output-dir> --target api|web
  gasi-one plugin validate   -f <plugin.json>
  gasi-one plugin plan       -f <plugin.json> -o <output-dir> --target api|web
  gasi-one plugin sync       -f <plugin.json> -o <output-dir> --target api|web
  gasi-one plugin clean      -f <plugin.json> -o <output-dir> --target api|web

Options:
  -h, --help      Show help.
`;

export async function run(argv) {
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    console.log(helpText);
    return;
  }

  const [group, command, ...args] = argv;

  if (group === 'resource') {
    return runResourceCommand(command, args);
  }

  if (group === 'plugin') {
    return runPluginCommand(command, args);
  }

  throw new Error(`Unknown command group: ${group}\n\n${helpText}`);
}
