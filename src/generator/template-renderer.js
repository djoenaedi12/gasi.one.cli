import { readFile } from 'node:fs/promises';
import path from 'node:path';

const templatesRoot = path.resolve('templates');

export async function renderTemplate(templatePath, context) {
  const absolutePath = path.join(templatesRoot, templatePath);
  const template = await readFile(absolutePath, 'utf8');
  return render(template, context).replace(/\n{3,}/g, '\n\n');
}

function render(template, context) {
  let output = template;
  output = renderEachBlocks(output, context);
  output = renderIfBlocks(output, context);
  return output.replace(/{{\s*([^#/][^}]*)\s*}}/g, (_, expression) => stringify(resolveValue(context, expression.trim())));
}

function renderEachBlocks(template, context) {
  return template.replace(/{{#each\s+([^}]+)}}([\s\S]*?){{\/each}}/g, (_, expression, block) => {
    const value = resolveValue(context, expression.trim());
    if (!Array.isArray(value)) return '';
    return value.map((item) => render(block, { ...context, this: item, ...item })).join('');
  });
}

function renderIfBlocks(template, context) {
  return template.replace(/{{#if\s+([^}]+)}}([\s\S]*?){{\/if}}/g, (_, expression, block) => {
    return resolveValue(context, expression.trim()) ? render(block, context) : '';
  });
}

function resolveValue(context, expression) {
  if (expression === 'this') return context.this;
  return expression.split('.').reduce((value, key) => {
    if (value === null || value === undefined) return undefined;
    return value[key];
  }, context);
}

function stringify(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}
