const fs = require('fs');

let content = fs.readFileSync('pipeline.ts', 'utf-8');

// Insert the import of zodToJsonSchema and ParsedInvoiceSchema
if (!content.includes('zod-to-json-schema')) {
    content = content.replace(
        'import { z } from "zod";',
        'import { z } from "zod";\nimport { zodToJsonSchema } from "zod-to-json-schema";\nimport { ParsedInvoiceSchema } from "./exempt_valid.js";'
    );
}

// Modify the SYSTEM_INSTRUCTION
content = content.replace(
    'Set missing/unresolvable numerical fields to null (do not default to 0 unless explicitly indicated on the document).`;',
    'Set missing/unresolvable numerical fields to null (do not default to 0 unless explicitly indicated on the document).\n\nHere is the JSON schema you MUST follow precisely:\n${JSON.stringify(zodToJsonSchema(ParsedInvoiceSchema), null, 2)}`;'
);

fs.writeFileSync('pipeline.ts', content);
