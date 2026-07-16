const Groq = require('groq-sdk');
const groq = new Groq();

// The MD text extracted from your docling process
const doclingExtractedMd = `...INSERT YOUR DOCLING MD OUTPUT HERE...`;

async function main() {
  const systemInstruction = `You are an expert, production-grade API parser specializing in optical document extraction. 
  Your task is to process the provided Markdown (from OCR/Docling) and output a strictly structured JSON object 
  conforming precisely to the TypeScript ParsedInvoiceSchema provided. 
  
  [... INSERT FULL SYSTEM CONFIG FROM PREVIOUS STEP HERE ... ]
  
  Always return valid JSON. Do not include any conversational filler.`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: systemInstruction,
        },
        {
          role: 'user',
          content: `Extract the invoice data from this content: \n\n${doclingExtractedMd}`,
        },
      ],
      model: 'llama-3.3-70b-versatile', 
      temperature: 0.1,
      max_tokens: 4096, // Increased to accommodate large JSON objects
      top_p: 1,
      stream: false,
      response_format: { type: "json_object" }, // Enforces JSON output
    });

    // Parse the result
    const result = JSON.parse(chatCompletion.choices[0]?.message?.content || '{}');
    console.log(result);
    
  } catch (error) {
    console.error("Error parsing invoice:", error);
  }
}

main();