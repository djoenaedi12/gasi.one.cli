# gasi:one CLI

`gasi-one` is a JSON-driven CRUD generator for Spring Boot API and React web resources.

## Commands

```bash
node ./bin/gasi-one.js resource validate -f examples/resources.json
node ./bin/gasi-one.js resource plan -f examples/resources.json -o generated
node ./bin/gasi-one.js resource sync -f examples/resources.json -o generated
node ./bin/gasi-one.js resource clean -f examples/resources.json -o generated
node ./bin/gasi-one.js plugin validate -f examples/plugin.json
node ./bin/gasi-one.js plugin plan -f examples/plugin.json -o generated
node ./bin/gasi-one.js plugin sync -f examples/plugin.json -o generated
```

Targets:

```bash
node ./bin/gasi-one.js resource sync -f examples/resources.json -o generated --target api
node ./bin/gasi-one.js resource sync -f examples/resources.json -o generated --target web
```

For global local usage during development:

```bash
npm link
gasi-one resource validate -f examples/resources.json
```

## Minimal JSON

```json
{
  "resources": [
    {
      "name": "Employee",
      "pluginName": "hr",
      "package": "gasi.one.hr.employee",
      "fields": [
        { "name": "fullName", "type": "string" }
      ]
    }
  ]
}
```

`table` and `column` are optional. The generator derives them from `name` and field names.
`pluginName` is optional per resource; if it is omitted, the generator uses the package segment after `gasi.one`.

## Plugin JSON

```json
{
  "name": "human-resource",
  "code": "hr",
  "displayName": "HR",
  "description": "Human resource plugin"
}
```

Only `name` is required. Optional flat fields are `code`, `displayName`, `version`, `description`, and `dependsOn`.
`name` controls the generated folder and artifact (`<name>-plugin`), while `code` is the short plugin identifier used by plugin metadata and resource grouping.
The plugin generator does not create migration folders; SQL migration files are created by the resource generator.

Plugin commands:

```bash
node ./bin/gasi-one.js plugin validate -f examples/plugin.json
node ./bin/gasi-one.js plugin plan -f examples/plugin.json -o generated --target api
node ./bin/gasi-one.js plugin sync -f examples/plugin.json -o generated --target api
node ./bin/gasi-one.js plugin clean -f examples/plugin.json -o generated --target web
```

`module` is available as an alias for `plugin`.
`--target` is required for plan, sync, and clean commands. Supported values are `api` and `web`.
Plugin files are generated directly under `<output-dir>/<name>-plugin`.
Plugin API templates live under `templates/plugin/api`.
Resource templates live under `templates/resource/api` and `templates/resource/web`.

## API Output

API files are generated directly under the output directory:

- `src/main/java/<package>/presentation/controller`
- `src/main/java/<package>/application/dto`
- `src/main/java/<package>/application/mapper`
- `src/main/java/<package>/application/service`
- `src/main/java/<package>/domain/model`
- `src/main/java/<package>/domain/port/inbound`
- `src/main/java/<package>/domain/port/outbound`
- `src/main/java/<package>/infrastructure/entity`
- `src/main/java/<package>/infrastructure/adapter`
- `src/main/java/<package>/infrastructure/mapper`
- `src/main/java/<package>/infrastructure/persistence`

## Migration

Flyway migrations are generated under:

```text
src/main/resources/db/migration/<pluginName>/V<timestamp>__create_<table>.sql
src/main/resources/db/migration/<pluginName>/V<timestamp>__alter_<table>.sql
```

Create migrations are created once. After the first sync, the generator stores a schema snapshot in `.gasi-one/manifest.json`.
When fields are added, changed, or removed, the next sync reads the previous snapshot from the manifest, generates an alter migration, and updates the manifest.

## I18n

Messages are generated per plugin folder:

```text
src/main/resources/i18n/<pluginName>/messages.properties
src/main/resources/i18n/<pluginName>/messages_<locale>.properties
```

Existing message keys are preserved. Missing generated keys are appended.
If a plugin has no explicit locale in JSON, `messages_en.properties` is generated beside `messages.properties`.

## Manifest

Each sync merges into `.gasi-one/manifest.json`.
The manifest is the single metadata file for the generator. It records resources, schema snapshots, generated Java/React file paths, migration file paths, i18n files, write strategies, and cleanup eligibility.
When another resource is generated later into the same output directory, existing resource entries are preserved and the current resources are added or updated.
Generated source and migration entries are marked `cleanup: true`; i18n entries are marked `cleanup: false` because i18n is cleaned by key.

## Clean

Clean removes generated source files for the resources in the JSON by reading `.gasi-one/manifest.json`.
Migration files owned by the cleaned resource are removed too.
I18n files are not deleted directly; only keys owned by the cleaned resource are removed.
If an i18n file becomes empty after those keys are removed, the file is deleted.
Empty generated folders are removed after cleanup.
