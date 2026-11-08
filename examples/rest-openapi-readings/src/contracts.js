import { readFile } from 'node:fs/promises';
import SwaggerParser from '@apidevtools/swagger-parser';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export const sourceSpec = JSON.parse(
  await readFile(new URL('../openapi.json', import.meta.url), 'utf8'),
);
export const spec = await SwaggerParser.validate(structuredClone(sourceSpec), {
  resolve: { external: false },
});
export const ajv = new Ajv2020({ strict: true, allErrors: true, coerceTypes: false });
addFormats(ajv);
export const validators = Object.fromEntries(
  Object.entries(spec.components.schemas).map(([name, schema]) => [name, ajv.compile(schema)]),
);

// Purpose-built for this fixture's JSON operations, not a generic OAS response validator.
export function checkResponse(path, method, status, headers, value) {
  const operation = spec.paths[path]?.[method.toLowerCase()];
  const response = operation?.responses[String(status)];
  if (!response) throw new Error(`Undocumented response ${method} ${path}: ${status}`);
  const mediaType = headers.get('content-type')?.split(';')[0].trim();
  const content = response.content?.[mediaType];
  if (!content) throw new Error(`Undocumented response media type: ${mediaType}`);
  const validate = ajv.compile(content.schema);
  if (!validate(value)) throw new Error(`Invalid response: ${ajv.errorsText(validate.errors)}`);
  for (const [name, contract] of Object.entries(response.headers ?? {})) {
    const actual = headers.get(name);
    if (contract.required && actual === null) throw new Error(`Missing response header ${name}`);
    if (actual !== null && !ajv.compile(contract.schema)(actual))
      throw new Error(`Invalid response header ${name}`);
  }
}
