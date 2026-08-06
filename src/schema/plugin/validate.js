export function validatePluginDocument(document) {
  if (!document.name) throw new Error('Plugin name is required.');
  if (!/^[a-z][a-z0-9-]*$/.test(document.name)) {
    throw new Error('Plugin name must be kebab-case and may contain lowercase letters, numbers, and dashes.');
  }
  if (!/^[a-z][a-z0-9-]*$/.test(document.code)) {
    throw new Error(`Plugin ${document.name} code must be kebab-case and may contain lowercase letters, numbers, and dashes.`);
  }
  if (!document.version) throw new Error(`Plugin ${document.name} must include version.`);
  if (!Array.isArray(document.dependsOn)) {
    throw new Error(`Plugin ${document.name} dependsOn must be an array.`);
  }
}
