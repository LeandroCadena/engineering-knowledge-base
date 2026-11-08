import { spec, validators } from './contracts.js';
let examples = 0;
for (const path of Object.values(spec.paths)) {
  for (const operation of Object.values(path)) {
    for (const response of Object.values(operation.responses ?? {})) {
      for (const media of Object.values(response.content ?? {})) {
        if ('example' in media) {
          const validate = (await import('./contracts.js')).ajv.compile(media.schema);
          if (!validate(media.example)) throw new Error('Declared example violates its schema');
          examples++;
        }
      }
    }
  }
}
console.log(
  `Validated OpenAPI ${spec.openapi}, ${Object.keys(validators).length} schemas, ${examples} declared response example(s).`,
);
