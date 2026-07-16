import { z } from "zod";

// ==========================================
// 1. UNIFIED STRICT OUTPUT SCHEMA (Target State)
// ==========================================
export const CanadianProvinceEnum = z.enum([
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"
]);

export const UnifiedInvoiceSchema = z.object({
  invoiceNumber: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be absolute YYYY-MM-DD format"),
  gstHstNumber: z.string().regex(/^\d{9}RT\d{4}$/, "Must match Canadian GST format (9 digits + RT + 4 digits)").nullable(),
  qstNumber: z.string().regex(/^\d{10}TQ\d{4}$/, "Must match Quebec QST format (10 digits + TQ + 4 digits)").nullable(),
  province: CanadianProvinceEnum.nullable(),
  subtotal: z.number(),
  taxTotal: z.number(),
  total: z.number(),
});

type UnifiedInvoice = z.infer<typeof UnifiedInvoiceSchema>;


// ==========================================
// 2. PIPELINE A: DIGITAL TEXT SCHEMA (Tight Constraints)
// ==========================================
// Because digital native PDFs have perfect character mapping, we can enforce regex 
// patterns directly within the schema without risking unexpected parsing crashes.
export const PipelineADigitalSchema = z.object({
  invoiceNumber: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enforce strict YYYY-MM-DD generation"),
  gstHstNumber: z.string().regex(/^\d{9}RT\d{4}$/).nullable(),
  qstNumber: z.string().regex(/^\d{10}TQ\d{4}$/).nullable(),
  province: CanadianProvinceEnum.nullable(),
  subtotal: z.number(),
  taxTotal: z.number(),
  total: z.number(),
}).strict();


// ==========================================
// 3. PIPELINE B: SCANNED / IMAGE SCHEMA (Relaxed Constraints)
// ==========================================
// Scans are prone to dirty text layouts, bad dates, and character swaps. 
// We accept soft types (strings instead of strict enums/regex) and use .describe() 
// to gently nudge the LLM before running validation rules on our backend logic.
export const PipelineBScanSchema = z.object({
  invoiceNumber: z.string().nullable()
    .describe("Raw invoice code string. Capture exactly what is visible."),
  date: z.string().nullable()
    .describe("Raw text of the date. Capture as found (e.g., '15/07/2026', 'July 15, 2026', '15-07-26')."),
  gstHstNumber: z.string().nullable()
    .describe("GST/HST identifier. Grab any raw text that resembles the business tax registration number."),
  qstNumber: z.string().nullable()
    .describe("Quebec QST identifier number. Grab any raw string match."),
  province: z.string().nullable()
    .describe("Raw province text or shortcode. E.g., 'Quebec', 'Québec', 'Ont', 'BC'."),
  subtotal: z.string().or(z.number()).nullable()
    .describe("Raw subtotal. Extract as string if characters are obfuscated by currency symbols."),
  taxTotal: z.string().or(z.number()).nullable()
    .describe("Raw combined or specific tax total."),
  total: z.string().or(z.number()).nullable()
    .describe("Grand total amount at bottom of invoice."),
}).strict();

type PipelineBScanInput = z.infer<typeof PipelineBScanSchema>;


// ==========================================
// 4. PIPELINE B: BACKEND REGEX SANITIZATION ENGINE
// ==========================================
/**
 * Sanitizes messy textual outputs from Pipeline B (Scans) into a strict UnifiedInvoice layout.
 * Corrects common OCR hallucinations, missing format conventions, and loose typing.
 */
export function sanitizeAndValidateScan(raw: PipelineBScanInput): UnifiedInvoice {
  // --- 1. Clean Numeric Fields ---
  const parseNumeric = (val: string | number | null): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === "number") return val;
    // Strip dollar signs, spaces, commas used for readability, and unexpected text fragments
    const normalized = val.replace(/[^0-9.-]/g, "");
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  };

  // --- 2. Normalize and Repair Dates via Regex ---
  let finalDate = "2026-01-01"; // Safe structural fallback or flag for fallback logic
  if (raw.date) {
    let cleanDate = raw.date.trim().replace(/[\/\s]/g, "-"); // Swop slashes or spaces to dashes
    
    // Check YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      finalDate = cleanDate;
    } 
    // Convert DD-MM-YYYY to YYYY-MM-DD
    else if (/^(\d{2})-(\d{2})-(\d{4})$/.test(cleanDate)) {
      finalDate = cleanDate.replace(/^(\d{2})-(\d{2})-(\d{4})$/, "$3-$2-$1");
    }
    // Convert short year notation (DD-MM-YY) assuming 2000s era context
    else if (/^(\d{2})-(\d{2})-(\d{2})$/.test(cleanDate)) {
      finalDate = cleanDate.replace(/^(\d{2})-(\d{2})-(\d{2})$/, "20$3-$2-$1");
    }
  }

  // --- 3. Fix OCR Tax Number Artifacts ---
  const cleanTaxNumber = (rawTax: string | null, type: "GST" | "QST"): string | null => {
    if (!rawTax) return null;
    
    // Normalize string casing and clean out whitespace separation strings
    let txt = rawTax.toUpperCase().replace(/[\s-]/g, "");

    if (type === "GST") {
      // Fix common OCR zero/one letter swaps inside standard suffixes: e.g., RTOOO1, RT0O0I -> RT0001
      txt = txt.replace(/RT[O0]{3}[1I]/g, "RT0001");
      const match = txt.match(/\d{9}RT\d{4}/);
      return match ? match[0] : null;
    } else {
      // QST adjustments: e.g., TQOOO1 -> TQ0001
      txt = txt.replace(/TQ[O0]{3}[1I]/g, "TQ0001");
      const match = txt.match(/\d{10}TQ\d{4}/);
      return match ? match[0] : null;
    }
  };

  // --- 4. Normalize Bilingual Canadian Provinces ---
  const normalizeProvince = (rawProv: string | null): z.infer<typeof CanadianProvinceEnum> | null => {
    if (!rawProv) return null;
    const provStr = rawProv.toUpperCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents
    
    const mapping: Record<string, z.infer<typeof CanadianProvinceEnum>> = {
      "QUEBEC": "QC", "QC": "QC", "QUE": "QC",
      "ONTARIO": "ON", "ON": "ON",
      "ALBERTA": "AB", "AB": "AB",
      "BRITISH COLUMBIA": "BC", "COLOMBIE-BRITANNIQUE": "BC", "BC": "BC",
      "MANITOBA": "MB", "MB": "MB",
      "SASKATCHEWAN": "SK", "SK": "SK",
      "NEW BRUNSWICK": "NB", "NOUVEAU-BRUNSWICK": "NB", "NB": "NB",
      "NOVA SCOTIA": "NS", "NOUVELLE-ECOSSE": "NS", "NS": "NS",
      "PRINCE EDWARD ISLAND": "PE", "ILE-DU-PRINCE-EDOUARD": "PE", "PEI": "PE", "PE": "PE",
      "NEWFOUNDLAND": "NL", "TERRE-NEUVE": "NL", "LABRADOR": "NL", "NL": "NL",
    };

    return mapping[provStr] || null;
  };

  // Compile unified layout shape mapping parameters safely
  const processedData = {
    invoiceNumber: raw.invoiceNumber || "UNKNOWN",
    date: finalDate,
    gstHstNumber: cleanTaxNumber(raw.gstHstNumber, "GST"),
    qstNumber: cleanTaxNumber(raw.qstNumber, "QST"),
    province: normalizeProvince(raw.province),
    subtotal: parseNumeric(raw.subtotal),
    taxTotal: parseNumeric(raw.taxTotal),
    total: parseNumeric(raw.total),
  };

  // Enforce strict downstream verification structure against final runtime target
  return UnifiedInvoiceSchema.parse(processedData);
}


// ==========================================
// 5. THE ROUTING LAYER ARCHITECTURE
// ==========================================
export enum DocumentMode {
  DIGITAL_TEXT = "DIGITAL_TEXT",
  SCANNED_IMAGE = "SCANNED_IMAGE"
}

export class InvoiceProcessingRouter {
  
  /**
   * Evaluates the physical/digital layout of a document vector to determine runtime pipeline routing.
   */
  public async inspectAndRoute(fileBuffer: Buffer, mimeType: string): Promise<DocumentMode> {
    if (mimeType.startsWith("image/")) {
      return DocumentMode.SCANNED_IMAGE;
    }

    if (mimeType === "application/pdf") {
      // Simulated: Check PDF internal structure layers for a searchable string map
      // e.g., using dependencies like pdf-parse:
      // const parsed = await pdfParse(fileBuffer);
      // return parsed.text.trim().length > 20 ? DocumentMode.DIGITAL_TEXT : DocumentMode.SCANNED_IMAGE;
      
      const simulatedContainsTextLayer = true; 
      return simulatedContainsTextLayer ? DocumentMode.DIGITAL_TEXT : DocumentMode.SCANNED_IMAGE;
    }

    return DocumentMode.SCANNED_IMAGE;
  }

  /**
   * Orchestrates the targeted pipeline execution path based on routed structural classification.
   */
  public async processInvoice(
    fileBuffer: Buffer, 
    mimeType: string, 
    llmRunner: (schema: z.ZodObject<any, any>) => Promise<any>
  ): Promise<UnifiedInvoice> {
    
    const mode = await this.inspectAndRoute(fileBuffer, mimeType);

    if (mode === DocumentMode.DIGITAL_TEXT) {
      console.log("Routing into [Pipeline A]: Native Digital Data Extraction.");
      // Pass strict schema constraints directly to the LLM structured engine
      const rawLlmOutput = await llmRunner(PipelineADigitalSchema);
      return UnifiedInvoiceSchema.parse(rawLlmOutput);
    } 
    
    else {
      console.log("Routing into [Pipeline B]: OCR Scan Visual Data Extraction.");
      // Pass highly loose schema criteria down to the visual LLM interface
      const rawLlmOutput = await llmRunner(PipelineBScanSchema);
      
      // Perform defensive post-processing via regex normalization engines
      return sanitizeAndValidateScan(rawLlmOutput);
    }
  }
}