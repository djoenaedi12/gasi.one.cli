import { readFile } from 'node:fs/promises';
import path from 'node:path';

const templatesRoot = path.resolve('templates');
const legalNoticeContext = {
  year: new Date().getFullYear(),
  companyName: 'PT Gunatronikatama Cipta',
  shortName: 'GASI'
};

export async function renderTemplate(templatePath, context, options = {}) {
  const absolutePath = path.join(templatesRoot, templatePath);
  const template = await readFile(absolutePath, 'utf8');
  const renderContext = { ...legalNoticeContext, ...context };
  const content = render(template, renderContext).replace(/\n{3,}/g, '\n\n');
  return addLegalNotice(content, options.outputPath ?? templatePath);
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

async function addLegalNotice(content, outputPath) {
  const ext = path.extname(outputPath);
  const notice = await legalNoticeForExtension(ext);
  if (!notice || content.startsWith(notice)) return content;

  if (ext === '.xml') {
    const withNotice = content.replace(/^(<\?xml[^>]*\?>\r?\n?)/, `$1${notice}\n\n`);
    return withNotice === content ? `${notice}\n\n${content}` : withNotice;
  }

  return `${notice}\n\n${content}`;
}

async function legalNoticeForExtension(ext) {
  const templatePath = legalNoticeTemplatePath(ext);
  if (!templatePath) return null;

  const template = await readTemplateIfExists(templatePath);
  if (!template) return null;
  return render(template, legalNoticeContext).trimEnd();
}

function legalNoticeTemplatePath(ext) {
  if (ext === '.java' || ext === '.js') return 'legal/java.hbs';
  if (ext === '.ts' || ext === '.tsx') return 'legal/typescript.hbs';
  if (ext === '.sql') return 'legal/sql.hbs';
  if (ext === '.properties') return 'legal/properties.hbs';
  if (ext === '.xml') return 'legal/xml.hbs';
  return null;
}

async function readTemplateIfExists(templatePath) {
  try {
    return await readFile(path.join(templatesRoot, templatePath), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}
