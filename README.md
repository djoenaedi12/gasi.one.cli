# gasi:one CLI

`gasi-one` is a JSON-driven CRUD generator for Spring Boot API and React web resources.

## Usage

```bash
node ./bin/gasi-one.js resource sync -f examples/resources.json -o generated --target api
```

Available domains are `resource` and `plugin`.
Available actions are `validate`, `plan`, `sync`, and `clean`.
`--target` is required for `plan`, `sync`, and `clean`; supported values are `api` and `web`.

## Plugin JSON

```json
{
  "name": "human-resource",
  "code": "hr",
  "displayName": "HR",
  "version": "1.0.0",
  "description": "Human resource plugin",
  "dependsOn": []
}
```

### Plugin Properties

| Property | Required | Description |
| --- | --- | --- |
| `name` | Yes | Plugin name. Must be kebab-case. Controls the generated folder and artifact (`<name>-plugin`). |
| `code` | No | Short plugin identifier used by metadata, i18n basename, and resource grouping. Defaults to `name`. |
| `displayName` | No | Human-readable plugin name. Defaults to title-case from `name`. |
| `version` | No | Plugin version. Defaults to `1.0.0`. |
| `description` | No | Plugin description. Defaults to `<displayName> plugin`. |
| `dependsOn` | No | Array of plugin codes this plugin depends on. Defaults to `[]`. |

Plugin files are generated directly under `<output-dir>/<name>-plugin`.
The plugin generator does not create migration folders; SQL migration files are created by the resource generator.

## Resource JSON

Resource input can be a JSON object with a `resources` array, a single resource object, or an array of resource objects.

```json
{
  "resources": [
    {
      "name": "Employee",
      "pluginName": "hr",
      "package": "gasi.one.plugins.hr.employee",
      "fields": [
        { "name": "fullName", "type": "string", "required": true }
      ]
    }
  ]
}
```

### Resource Properties

| Property | Required | Description |
| --- | --- | --- |
| `name` | Yes | Resource/entity name. `entityName` is also accepted as an alias. Normalized to PascalCase. |
| `package` | Yes | Java package. Must start with `gasi.one` and use lowercase package segments. |
| `fields` | Yes | Array of field definitions. At least one field is required. |
| `pluginName` | No | Plugin/group name for migration and i18n folders. Must be lowercase kebab-case when provided. |
| `mode` | No | `crud`, `read`, or `embed`. Defaults to `crud`. |
| `table` | No | Database table name. Defaults to plural snake_case from `name`. |
| `endpoint` | No | API base path. Defaults to plural kebab-case from `name`. |
| `lookup` | No | Generate `/lookup/query/page` for this resource. Defaults to `false`. Not supported for `embed` or nested routes. |
| `parent` | No | Parent resource metadata for nested API routes. |
| `i18n` | No | Locale-specific field text and validation messages. |

### Field Properties

| Property | Required | Description |
| --- | --- | --- |
| `name` | Yes | Field name. Normalized to camelCase. |
| `type` | Yes | Supported values: `string`, `text`, `integer`, `long`, `decimal`, `double`, `boolean`, `date`, `datetime`, `instant`, `uuid`, `enum`. |
| `column` | No | Database column name. Defaults to snake_case from `name`. |
| `length` | No | String column length and JPA column length. |
| `precision` | No | Decimal precision. Defaults to SQL `19` when omitted for decimal migrations. |
| `scale` | No | Decimal scale. Defaults to SQL `4` when omitted for decimal migrations. |
| `required` | No | Adds non-null/not-blank validation and non-null database column. Defaults to `false`. |
| `unique` | No | Adds a unique database constraint and JPA unique column metadata. Defaults to `false`. |
| `defaultValue` | No | SQL default value for generated migrations. Supports boolean, number, and string values. |
| `validation` | No | Validation rule object. See supported validation properties below. |
| `dto` | No | DTO inclusion flags. Defaults to all DTOs. |
| `projection` | No | Adds this field to the default query projection. Defaults to `false`. |
| `relation` | No | Relation definition. Currently supports `many-to-one`. |
| `enum` | Yes for `enum` | Enum definition object. See enum properties below. |

Supported `validation` properties are `email`, `minLength`, `maxLength`, `pattern`, `positive`, `positiveOrZero`, `negative`, `negativeOrZero`, `past`, `pastOrPresent`, `future`, and `futureOrPresent`.

### DTO And Projection Properties

Field DTO inclusion is controlled with `dto`. When `dto` is omitted, the field is included in every generated DTO.

```json
{
  "name": "salary",
  "type": "decimal",
  "dto": {
    "summary": false
  }
}
```

| Property | Default | Description |
| --- | --- | --- |
| `dto.create` | `true` | Include the field in `CreateRequest`. |
| `dto.update` | `true` | Include the field in `UpdateRequest`. |
| `dto.summary` | `true` | Include the field in `SummaryResponse`. |
| `dto.detail` | `true` | Include the field in `DetailResponse`. |

`projection: true` adds the field to `getDefaultProjectionFields()` for query list/page responses when the request omits `fields`.
`id` is always included automatically. A projected field must also be included in `SummaryResponse`.

Set resource-level `lookup: true` when the resource should expose `/lookup/query/page`. Lookup is generated as a custom controller endpoint with `LOOKUP` permission and does not run controller hooks. It uses the same default projection as query list/page, and callers can still override fields from `QueryRequest.fields`.

### Enum Properties

Enum fields use a nested `enum` object, similar to `relation`.

```json
{
  "name": "employmentType",
  "type": "enum",
  "enum": {
    "name": "EmploymentType",
    "values": ["PERMANENT", "CONTRACT"]
  }
}
```

| Property | Required | Description |
| --- | --- | --- |
| `name` | Yes | Java enum class name. Normalized to PascalCase. |
| `type` | No | Persistence type: `ordinal` or `string`. Defaults to `ordinal`. |
| `values` | Yes for generated enum | Enum constants. When provided without `package`, the generator creates the enum file. |
| `package` | No | Existing enum Java package. When provided, the generator imports the enum and does not create the enum file. |

Generated enum files are created under `<resource.package>.domain.model`.
Set `type` to `string` when the enum should use `EnumType.STRING` and a `VARCHAR(50)` column.

### Relation Properties

| Property | Required | Description |
| --- | --- | --- |
| `type` | Yes | Currently only `many-to-one` is supported. |
| `target` | Yes | Target resource/entity name. |
| `package` | Yes | Target resource Java package. |
| `joinColumn` | No | Foreign key column. Defaults to the field column name. |
| `fetch` | No | JPA fetch mode. Defaults to `lazy`. |
| `cascade` | No | Cascade values array. Preserved in normalized context. |
| `orphanRemoval` | No | Boolean flag. Defaults to `false`. |

### Parent Properties

`parent` can be used for nested API routes and embedded child resources. Database and JPA relations are still declared normally with a field `relation`.

```json
{
  "name": "EmployeeCertification",
  "endpoint": "/certifications",
  "parent": {
    "resource": "Employee",
    "route": "nested"
  }
}
```

| Property | Required | Description |
| --- | --- | --- |
| `resource` | Yes | Parent resource name. |
| `route` | No | Use `nested` to generate the endpoint under the parent route. |
| `package` | No | Parent resource package. Derived when the parent resource is in the same JSON. |
| `endpoint` | No | Parent endpoint. Derived from the parent resource when possible, otherwise from parent name. |
| `pathParam` | No | Parent path variable. Defaults to camelCase parent name plus `Id`, for example `employeeId`. |
| `field` | No | For `nested`, the parent relation field name. For `embed`, the collection field on the parent DTO/domain/entity. |
| `joinColumn` | No | Parent FK column name. Defaults to `<field>_id`. |
| `table` | No | Parent table name. Derived from the parent resource when possible. |

Nested resources must include a normal `many-to-one` relation field to the parent resource.
For `nested` routes, the parent relation field is still generated in create/update DTOs so the generated hook can fill it from the URL path variable. The request body does not need to send that field; validation is suppressed for the nested parent DTO field and the path value wins.

For `mode: "embed"`, the child does not generate its own controller, service, repository port, repository adapter, or entity repository. It generates internal model/entity/DTO/mapper files and a child table migration. The parent must be generated first, either earlier in the same JSON file or in a previous sync recorded in `.gasi-one/manifest.json`. When the embed child is synced, the CLI updates the parent DTO/domain/entity/mapper with the configured collection field.

### I18n Properties

`i18n` is keyed by locale code. Each locale can define:

| Property | Description |
| --- | --- |
| `field` | Object keyed by field name for field labels. |
| `validation` | Object keyed by field name, then validation rule name, for generated validation messages. |

If no locale is provided, `messages_en.properties` is generated beside `messages.properties`.
Existing message keys are preserved. Missing generated keys are appended.

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

## Manifest

Each sync merges into `.gasi-one/manifest.json`.
The manifest records resources, schema snapshots, generated Java/React file paths, migration file paths, i18n files, write strategies, and cleanup eligibility.
Generated source and migration entries are marked `cleanup: true`; i18n entries are marked `cleanup: false` because i18n is cleaned by key.

## Clean

Clean removes generated source files for the resources in the JSON by reading `.gasi-one/manifest.json`.
Migration files owned by the cleaned resource are removed too.
I18n files are not deleted directly; only keys owned by the cleaned resource are removed.
If an i18n file becomes empty after those keys are removed, the file is deleted.
Empty generated folders are removed after cleanup.
