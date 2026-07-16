const { z } = require("zod");
const { zodToJsonSchema } = require("zod-to-json-schema");
console.log(zodToJsonSchema(z.object({ name: z.string() })));
