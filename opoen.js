import { OpenRouter } from "@openrouter/sdk";

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY, // Use environment variables for security
});

// Full System Configuration
const SYSTEM_INSTRUCTION = `
You are an expert, production-grade API parser specializing in optical document extraction. 
Your task is to process incoming image files, PDF files, or OCR-transcribed text of Canadian invoices 
and output a strictly structured JSON object conforming precisely to the provided TypeScript Zod schema.

[... INSERT FULL SYSTEM INSTRUCTIONS FROM PREVIOUS CONFIG HERE ... ]

OUTPUT: Output ONLY a raw, syntactically perfect JSON object. NO markdown, NO conversational filler.
`;

async function extractInvoiceData(doclingExtractedMd) {
  try {
    const response = await openrouter.chat.completions.create({
      // We recommend using a high-reasoning model like Llama 3.1 70B or Claude 3.5 Sonnet
      // for complex extraction tasks to ensure schema adherence.
      model: "meta-llama/llama-3.1-70b-instruct", 
      
      messages: [
        {
          role: "system",
          content: SYSTEM_INSTRUCTION
        },
        {
          role: "user",
          content: `Please parse the following invoice text:\n\n${doclingExtractedMd}`
        }
      ],
      // CRITICAL: Forces the model to return valid JSON
      response_format: { type: "json_object" }, 
      
      // Keep temperature low for deterministic data extraction
      temperature: 0.1, 
      max_tokens: 4096
    });

    // Accessing the content safely
    const content = response.choices[0].message.content;
    const parsedData = JSON.parse(content);
    
    return parsedData;

  } catch (error) {
    console.error("Extraction Failed:", error);
    throw error;
  }
}

// Usage Example
const markdownData = "/* Your extracted Docling MD here */";
extractInvoiceData(markdownData).then(console.log);