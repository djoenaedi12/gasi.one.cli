export function pascalCase(value) {
  return words(value).map(capitalize).join('');
}

export function camelCase(value) {
  const [first = '', ...rest] = words(value);
  return first + rest.map(capitalize).join('');
}

export function kebabCase(value) {
  return words(value).join('-');
}

export function snakeCase(value) {
  return words(value).join('_');
}

export function titleCase(value) {
  return words(value).map(capitalize).join(' ');
}

export function pluralSnakeCase(value) {
  const parts = words(value);
  const last = parts.pop();
  return [...parts, pluralize(last)].join('_');
}

export function pluralKebabCase(value) {
  const parts = words(value);
  const last = parts.pop();
  return [...parts, pluralize(last)].join('-');
}

export function packageToPath(packageName) {
  return packageName.split('.').join('/');
}

export function featurePathFromPackage(packageName) {
  return packageName.replace(/^gasi\.one\.?/, '').split('.').filter(Boolean).join('/');
}

function pluralize(word) {
  if (!word) return '';
  if (word.endsWith('y') && !/[aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  return `${word}s`;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function words(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}
