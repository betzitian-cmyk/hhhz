import fs from "fs";
import path from "path";
import { z } from "zod";
import * as dotenv from "dotenv";
import { createRequire } from "module";
import { GoogleGenAI } from "@google/genai";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

dotenv.config();

// ============================================================================
// SYSTEM CONFIGURATION & ENDPOINTS
// ============================================================================

const ENDPOINTS = {
  OPENROUTER_URL: "https://openrouter.ai/api/v1/chat/completions",
  GROQ_URL: "https://api.groq.com/openai/v1/chat/completions",
  DOCLING_URL: "http://38.247.148.215:5001/v1/convert/file",
};

const PROVINCE_CODES = [
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"
] as const;

export type UnifiedInvoiceOutput = z.infer<typeof ParsedInvoiceSchemaA>;

// ============================================================================
// 1. ZOD SCHEMAS: STRICT (Pipeline A) & RELAXED (Pipeline B)
// ============================================================================

// --- STRICT SCHEMAS (For Digital-Native PDFs & Final Output) ---
const StrictDateSchema = z.string().nullable();

const StrictGstHstSchema = z.string().nullable();

const StrictQstSchema = z.string().nullable();

export const TaxBreakdownValueSchemaA = z.object({
  gst: z.number().nullable(),
  pst: z.number().nullable(),
  hst: z.number().nullable(),
  qst: z.number().nullable(),
  rst: z.number().nullable(),
}).strict();

export const VendorTaxNumbersSchemaA = z.object({
  businessNumber: z.string().nullable(),
  gstHst: StrictGstHstSchema,
  qst: StrictQstSchema,
  pst: z.string().nullable(),
  rst: z.string().nullable(),
}).strict();

export const LineItemSchemaA = z.object({
  description: z.string(),
  quantity: z.number().nullable(),
  unitPrice: z.number().nullable(),
  amount: z.number().nullable(),
  tax: z.number().nullable(),
  taxRate: z.number().nullable(),
  isTaxExempt: z.boolean().nullable(),
  taxabilityGroup: z.enum(["Taxable", "Zero-Rated", "Exempt"]).nullable(),
  taxBreakdown: TaxBreakdownValueSchemaA.nullable(),
}).strict();

export const ParsedInvoiceSchemaA = z.object({
  invoiceNumber: z.string().nullable(),
  poNumber: z.string().nullable(),
  date: StrictDateSchema,
  dueDate: StrictDateSchema,
  language: z.enum(["en", "fr", "mixed"]),
  vendorName: z.string().nullable(),
  vendorAddress: z.string().nullable(),
  customerName: z.string().nullable(),
  customerAddress: z.string().nullable(),
  vendorTaxNumbers: VendorTaxNumbersSchemaA.nullable(),
  paymentTerms: z.string().nullable(),
  subtotal: z.number().nullable(),
  zeroRatedSubtotal: z.number().nullable(),
  exemptSubtotal: z.number().nullable(),
  tax: z.number().nullable(),
  total: z.number().nullable(),
  currency: z.string().nullable(),
  taxBreakdown: TaxBreakdownValueSchemaA.nullable(),
  province: z.enum(PROVINCE_CODES).nullable(),
  taxGroup: z.string().nullable(),
  items: z.array(LineItemSchemaA),
  summary: z.string().nullable(),
  cached: z.boolean(),
}).strict();

// --- RELAXED SCHEMAS (For Scanned PDFs & OCR Safety) ---
export const TaxBreakdownValueSchemaB = z.object({
  gst: z.union([z.number(), z.string()]).nullable().optional(),
  pst: z.union([z.number(), z.string()]).nullable().optional(),
  hst: z.union([z.number(), z.string()]).nullable().optional(),
  qst: z.union([z.number(), z.string()]).nullable().optional(),
  rst: z.union([z.number(), z.string()]).nullable().optional(),
}).catchall(z.any());

export const VendorTaxNumbersSchemaB = z.object({
  businessNumber: z.string().nullable().optional(),
  gstHst: z.string().nullable().optional(),
  qst: z.string().nullable().optional(),
  pst: z.string().nullable().optional(),
  rst: z.string().nullable().optional(),
}).catchall(z.any());

export const LineItemSchemaB = z.object({
  description: z.string().nullable().optional(),
  quantity: z.union([z.number(), z.string()]).nullable().optional(),
  unitPrice: z.union([z.number(), z.string()]).nullable().optional(),
  amount: z.union([z.number(), z.string()]).nullable().optional(),
  tax: z.union([z.number(), z.string()]).nullable().optional(),
  taxRate: z.union([z.number(), z.string()]).nullable().optional(),
  isTaxExempt: z.boolean().nullable().optional(),
  taxabilityGroup: z.string().nullable().optional(),
  taxBreakdown: TaxBreakdownValueSchemaB.nullable().optional(),
}).catchall(z.any());

export const ParsedInvoiceSchemaB = z.object({
  invoiceNumber: z.string().nullable().optional(),
  poNumber: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  vendorName: z.string().nullable().optional(),
  vendorAddress: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  customerAddress: z.string().nullable().optional(),
  vendorTaxNumbers: VendorTaxNumbersSchemaB.nullable().optional(),
  paymentTerms: z.string().nullable().optional(),
  subtotal: z.union([z.number(), z.string()]).nullable().optional(),
  zeroRatedSubtotal: z.union([z.number(), z.string()]).nullable().optional(),
  exemptSubtotal: z.union([z.number(), z.string()]).nullable().optional(),
  tax: z.union([z.number(), z.string()]).nullable().optional(),
  total: z.union([z.number(), z.string()]).nullable().optional(),
  currency: z.string().nullable().optional(),
  taxBreakdown: TaxBreakdownValueSchemaB.nullable().optional(),
  province: z.string().nullable().optional(),
  taxGroup: z.string().nullable().optional(),
  items: z.array(LineItemSchemaB).nullable().optional(),
  summary: z.string().nullable().optional(),
  cached: z.boolean().optional(),
}).catchall(z.any());

// ============================================================================
// 2. SANITIZATION ENGINE (Converts Loose OCR Types to Strict Values)
// ============================================================================

class PipelineBSanitizer {
  static cleanNumeric(val: number | string | null | undefined): number | null {
    if (val == null) return null;
    if (typeof val === "number") return val;
    const cleaned = val.replace(/[^0-9.-]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  static cleanDate(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null;
    let clean = dateStr.trim().replace(/[\s./]/g, "-");
    if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) return `${clean.split("-")[2]}-${clean.split("-")[1]}-${clean.split("-")[0]}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    if (/^\d{2}-\d{2}-\d{2}$/.test(clean)) return `20${clean}`;
    
    const parsedDate = new Date(dateStr);
    return !isNaN(parsedDate.getTime()) ? parsedDate.toISOString().split("T")[0] : null;
  }

  static cleanTaxID(raw: string | null | undefined, type: "GST" | "QST"): string | null {
    if (!raw) return null;
    let clean = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (type === "GST") clean = clean.replace(/RT([O0]{3})([1IL])/i, "RT0001");
    if (type === "QST") clean = clean.replace(/TQ([O0]{3})([1IL])/i, "TQ0001");
    return clean;
  }

  static cleanProvince(prov: string | null | undefined): typeof PROVINCE_CODES[number] | null {
    if (!prov) return null;
    const clean = prov.trim().toUpperCase();
    if (PROVINCE_CODES.includes(clean as any)) return clean as any;
    
    // Rigorous English and French province name mappings to ISO codes
    const nameMap: Record<string, typeof PROVINCE_CODES[number]> = {
      "ALBERTA": "AB",
      "BRITISH COLUMBIA": "BC",
      "COLOMBIE-BRITANNIQUE": "BC",
      "COLOMBIE BRITANNIQUE": "BC",
      "MANITOBA": "MB",
      "NEW BRUNSWICK": "NB",
      "NOUVEAU-BRUNSWICK": "NB",
      "NOUVEAU BRUNSWICK": "NB",
      "NEWFOUNDLAND": "NL",
      "NEWFOUNDLAND AND LABRADOR": "NL",
      "NEWFOUNDLAND & LABRADOR": "NL",
      "TERRE-NEUVE-ET-LABRADOR": "NL",
      "TERRE-NEUVE ET LABRADOR": "NL",
      "TERRE NEUVE": "NL",
      "NOVA SCOTIA": "NS",
      "NOVELLE-ÉCOSSE": "NS",
      "NOUVELLE ÉCOSSE": "NS",
      "NOUVELLE ECOSSE": "NS",
      "NORTHWEST TERRITORIES": "NT",
      "TERRITOIRES DU NORD-OUEST": "NT",
      "TERRITOIRES DU NORD OUEST": "NT",
      "NUNAVUT": "NU",
      "ONTARIO": "ON",
      "PRINCE EDWARD ISLAND": "PE",
      "ÎLE-DU-PRINCE-ÉDOUARD": "PE",
      "ILE-DU-PRINCE-EDOUARD": "PE",
      "ILE DU PRINCE EDOUARD": "PE",
      "PEI": "PE",
      "QUEBEC": "QC",
      "QUÉBEC": "QC",
      "SASKATCHEWAN": "SK",
      "YUKON": "YT",
    };

    if (nameMap[clean]) return nameMap[clean];
    
    return null;
  }

  static splitCombinedTax(totalTax: number | null, province: string | null): { gst: number | null; pst: number | null; hst: number | null; qst: number | null; rst: number | null } {
    const result = { gst: null, pst: null, hst: null, qst: null, rst: null } as any;
    if (!totalTax) return result;
    
    const prov = province ? province.toUpperCase() : null;
    
    if (prov === "QC") {
      result.gst = Math.round(totalTax * (5 / 14.975) * 100) / 100;
      result.qst = Math.round((totalTax - result.gst) * 100) / 100;
    } else if (prov === "BC") {
      result.gst = Math.round(totalTax * (5 / 12) * 100) / 100;
      result.pst = Math.round((totalTax - result.gst) * 100) / 100;
    } else if (prov === "MB") {
      result.gst = Math.round(totalTax * (5 / 12) * 100) / 100;
      result.rst = Math.round((totalTax - result.gst) * 100) / 100;
    } else if (prov === "SK") {
      result.gst = Math.round(totalTax * (5 / 11) * 100) / 100;
      result.pst = Math.round((totalTax - result.gst) * 100) / 100;
    } else if (["ON", "NS", "NB", "NL", "PE"].includes(prov || "")) {
      result.hst = totalTax;
    } else if (["AB", "NT", "NU", "YT"].includes(prov || "")) {
      result.gst = totalTax;
    } else {
      result.gst = totalTax; // default assuming GST
    }
    return result;
  }

  static deduceProvinceAndTaxGroup(
    prov: string | null,
    subtotal: number | null,
    tax: number | null,
    breakdown: any
  ): { province: typeof PROVINCE_CODES[number] | null; taxGroup: string | null } {
    let province = prov as typeof PROVINCE_CODES[number] | null;
    let taxGroup: string | null = null;

    // 1. If province is already specified, map taxGroup based on province
    if (province) {
      if (["AB", "NT", "NU", "YT"].includes(province)) taxGroup = "GST";
      else if (["BC", "SK"].includes(province)) taxGroup = "GST+PST";
      else if (province === "MB") taxGroup = "GST+RST";
      else if (province === "QC") taxGroup = "GST+QST";
      else if (["ON", "NS", "NB", "NL", "PE"].includes(province)) taxGroup = "HST";
      return { province, taxGroup };
    }

    // 2. Try to deduce from tax breakdown
    if (breakdown) {
      if (breakdown.qst && breakdown.qst > 0) {
        return { province: "QC", taxGroup: "GST+QST" };
      }
      if (breakdown.rst && breakdown.rst > 0) {
        return { province: "MB", taxGroup: "GST+RST" };
      }
      if (breakdown.pst && breakdown.pst > 0) {
        return { province: "BC", taxGroup: "GST+PST" };
      }
      if (breakdown.hst && breakdown.hst > 0) {
        if (subtotal && subtotal > 0) {
          const rate = (breakdown.hst / subtotal) * 100;
          if (rate > 12.5 && rate < 13.5) return { province: "ON", taxGroup: "HST" };
          if (rate > 13.5 && rate < 14.5) return { province: "NS", taxGroup: "HST" };
          if (rate > 14.5 && rate < 15.5) return { province: "NB", taxGroup: "HST" };
        }
        return { province: "ON", taxGroup: "HST" };
      }
    }

    // 3. Try to deduce from effective tax rate (tax / subtotal)
    if (subtotal && subtotal > 0 && tax && tax > 0) {
      const effectiveRate = (tax / subtotal) * 100;
      if (effectiveRate > 14.5 && effectiveRate < 15.2) {
        return { province: "QC", taxGroup: "GST+QST" };
      }
      if (effectiveRate >= 15.2 && effectiveRate < 16.0) {
        return { province: "NB", taxGroup: "HST" }; // 15%
      }
      if (effectiveRate > 12.5 && effectiveRate < 13.5) {
        return { province: "ON", taxGroup: "HST" };
      }
      if (effectiveRate > 13.5 && effectiveRate < 14.5) {
        return { province: "NS", taxGroup: "HST" };
      }
      if (effectiveRate > 11.5 && effectiveRate < 12.5) {
        return { province: "BC", taxGroup: "GST+PST" }; // 5% + 7% = 12%
      }
      if (effectiveRate > 10.5 && effectiveRate <= 11.5) {
        return { province: "SK", taxGroup: "GST+PST" }; // 5% + 6% = 11%
      }
      if (effectiveRate > 4.5 && effectiveRate < 5.5) {
        return { province: "AB", taxGroup: "GST" };
      }
    }

    return { province: null, taxGroup: null };
  }

  static sanitize(raw: any): UnifiedInvoiceOutput {
    const rawCleaned = raw || {};
    const itemsRaw = Array.isArray(rawCleaned.items) ? rawCleaned.items : [];
    
    // Map raw.language safely
    let lang: "en" | "fr" | "mixed" = "en";
    if (rawCleaned.language) {
      const rawLang = String(rawCleaned.language).toLowerCase();
      if (rawLang.includes("mixed") || (rawLang.includes("en") && rawLang.includes("fr"))) {
        lang = "mixed";
      } else if (rawLang.includes("fr")) {
        lang = "fr";
      }
    }

    const cleanSubtotal = this.cleanNumeric(rawCleaned.subtotal);
    const cleanTax = this.cleanNumeric(rawCleaned.tax);
    const cleanProvinceVal = this.cleanProvince(rawCleaned.province);

    // Initial taxBreakdown resolution
    let taxBreakdown = { gst: null, pst: null, hst: null, qst: null, rst: null } as any;
    if (rawCleaned.taxBreakdown) {
      taxBreakdown = {
        gst: this.cleanNumeric(rawCleaned.taxBreakdown.gst),
        pst: this.cleanNumeric(rawCleaned.taxBreakdown.pst),
        hst: this.cleanNumeric(rawCleaned.taxBreakdown.hst),
        qst: this.cleanNumeric(rawCleaned.taxBreakdown.qst),
        rst: this.cleanNumeric(rawCleaned.taxBreakdown.rst),
      };
    }

    // Deduce province & taxGroup
    const deduced = this.deduceProvinceAndTaxGroup(cleanProvinceVal, cleanSubtotal, cleanTax, taxBreakdown);
    const finalProvince = deduced.province;
    const finalTaxGroup = deduced.taxGroup;

    // Mathematically split combined/total tax if breakdown has no positive values but total tax is present
    const hasGlobalBreakdownValues = taxBreakdown && (taxBreakdown.gst || taxBreakdown.pst || taxBreakdown.hst || taxBreakdown.qst || taxBreakdown.rst);
    if (!hasGlobalBreakdownValues && cleanTax) {
      taxBreakdown = this.splitCombinedTax(cleanTax, finalProvince);
    }

    return {
      invoiceNumber: rawCleaned.invoiceNumber ? String(rawCleaned.invoiceNumber) : null,
      poNumber: rawCleaned.poNumber ? String(rawCleaned.poNumber) : null,
      date: this.cleanDate(rawCleaned.date),
      dueDate: this.cleanDate(rawCleaned.dueDate),
      language: lang,
      vendorName: rawCleaned.vendorName ? String(rawCleaned.vendorName) : null,
      vendorAddress: rawCleaned.vendorAddress ? String(rawCleaned.vendorAddress) : null,
      customerName: rawCleaned.customerName ? String(rawCleaned.customerName) : null,
      customerAddress: rawCleaned.customerAddress ? String(rawCleaned.customerAddress) : null,
      vendorTaxNumbers: rawCleaned.vendorTaxNumbers ? {
        businessNumber: rawCleaned.vendorTaxNumbers.businessNumber ? String(rawCleaned.vendorTaxNumbers.businessNumber).replace(/\D/g, "") : null,
        gstHst: this.cleanTaxID(rawCleaned.vendorTaxNumbers.gstHst, "GST"),
        qst: this.cleanTaxID(rawCleaned.vendorTaxNumbers.qst, "QST"),
        pst: rawCleaned.vendorTaxNumbers.pst ? String(rawCleaned.vendorTaxNumbers.pst) : null,
        rst: rawCleaned.vendorTaxNumbers.rst ? String(rawCleaned.vendorTaxNumbers.rst) : null,
      } : null,
      paymentTerms: rawCleaned.paymentTerms ? String(rawCleaned.paymentTerms) : null,
      subtotal: cleanSubtotal,
      zeroRatedSubtotal: this.cleanNumeric(rawCleaned.zeroRatedSubtotal),
      exemptSubtotal: this.cleanNumeric(rawCleaned.exemptSubtotal),
      tax: cleanTax,
      total: this.cleanNumeric(rawCleaned.total),
      currency: rawCleaned.currency ? String(rawCleaned.currency).replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3) : null,
      taxBreakdown: taxBreakdown,
      province: finalProvince,
      taxGroup: finalTaxGroup,
      items: itemsRaw.map((item: any) => {
        const cleanItemTax = this.cleanNumeric(item.tax);
        
        let itemTaxBreakdown = { gst: null, pst: null, hst: null, qst: null, rst: null } as any;
        if (item.taxBreakdown) {
          itemTaxBreakdown = {
            gst: this.cleanNumeric(item.taxBreakdown.gst),
            pst: this.cleanNumeric(item.taxBreakdown.pst),
            hst: this.cleanNumeric(item.taxBreakdown.hst),
            qst: this.cleanNumeric(item.taxBreakdown.qst),
            rst: this.cleanNumeric(item.taxBreakdown.rst),
          };
        }

        const hasItemBreakdownValues = itemTaxBreakdown && (itemTaxBreakdown.gst || itemTaxBreakdown.pst || itemTaxBreakdown.hst || itemTaxBreakdown.qst || itemTaxBreakdown.rst);
        if (!hasItemBreakdownValues && cleanItemTax) {
          itemTaxBreakdown = this.splitCombinedTax(cleanItemTax, finalProvince);
        }

        let taxGrp: "Taxable" | "Zero-Rated" | "Exempt" | null = "Taxable";
        if (item.taxabilityGroup) {
          const tg = String(item.taxabilityGroup).toLowerCase();
          if (tg.includes("exempt")) taxGrp = "Exempt";
          else if (tg.includes("zero") || tg.includes("0")) taxGrp = "Zero-Rated";
        }

        return {
          description: item.description ? String(item.description) : "Line Item",
          quantity: this.cleanNumeric(item.quantity),
          unitPrice: this.cleanNumeric(item.unitPrice),
          amount: this.cleanNumeric(item.amount),
          tax: cleanItemTax,
          taxRate: this.cleanNumeric(item.taxRate),
          isTaxExempt: item.isTaxExempt !== undefined ? Boolean(item.isTaxExempt) : null,
          taxabilityGroup: taxGrp,
          taxBreakdown: itemTaxBreakdown,
        };
      }),
      summary: rawCleaned.summary ? String(rawCleaned.summary) : null,
      cached: false,
    };
  }
}

// ============================================================================
// 3. DYNAMIC ROUTER LAYER & DOCLING SERVICE
// ============================================================================

enum RoutingPipeline {
  PIPELINE_A_DIGITAL = "PIPELINE_A_DIGITAL",
  PIPELINE_B_SCANNED = "PIPELINE_B_SCANNED"
}

class DocumentRouter {
  static async determinePipeline(fileBuffer: Buffer, fileName: string): Promise<RoutingPipeline> {
    const ext = path.extname(fileName).toLowerCase();
    if ([".png", ".jpg", ".jpeg", ".webp", ".txt", ".md"].includes(ext)) return RoutingPipeline.PIPELINE_B_SCANNED;
    if (ext === ".pdf") {
      try {
        const pdfData = await pdf(fileBuffer);
        if (pdfData.text.replace(/\s+/g, "").length < 20) return RoutingPipeline.PIPELINE_B_SCANNED;
        return RoutingPipeline.PIPELINE_A_DIGITAL;
      } catch {
        return RoutingPipeline.PIPELINE_B_SCANNED;
      }
    }
    throw new Error(`Unsupported format: ${ext}`);
  }
}

class DoclingService {
  static async extractMarkdown(fileBuffer: Buffer, fileName: string): Promise<string> {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === ".txt" || ext === ".md") {
      return fileBuffer.toString("utf-8");
    }

    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
    formData.append('files', blob, fileName);

    console.log(`[Docling] Uploading ${fileName} to ${ENDPOINTS.DOCLING_URL}...`);
    const response = await fetch(ENDPOINTS.DOCLING_URL, {
      method: "POST",
      body: formData as any, 
    });

    if (!response.ok) {
      throw new Error(`Docling extraction failed: ${response.statusText}`);
    }
    
    // Depending on Docling API version, this either returns the markdown or a task object
    const result = await response.json();
    return result.document?.md_content || result.markdown || JSON.stringify(result); 
  }
}

class GeminiFallbackService {
  private static getClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }

  private static async generateContentWithResilience(ai: GoogleGenAI, params: {
    contents: any[];
    config?: any;
    preferredModel?: string;
  }): Promise<any> {
    const preferredModel = params.preferredModel || "gemini-3.5-flash";
    const fallbackModel = "gemini-3.1-flash-lite";

    try {
      console.log(`[Gemini Resilience] Trying preferred model: ${preferredModel}...`);
      return await ai.models.generateContent({
        model: preferredModel,
        contents: params.contents,
        config: params.config,
      });
    } catch (err) {
      console.warn(`[Gemini Resilience] Model ${preferredModel} failed:`, (err as Error).message);
      if (preferredModel !== fallbackModel) {
        console.log(`[Gemini Resilience] Falling back to model: ${fallbackModel}...`);
        try {
          return await ai.models.generateContent({
            model: fallbackModel,
            contents: params.contents,
            config: params.config,
          });
        } catch (fbErr) {
          console.error(`[Gemini Resilience] Fallback model ${fallbackModel} also failed:`, (fbErr as Error).message);
          throw fbErr;
        }
      }
      throw err;
    }
  }

  static async extractMarkdownWithGemini(fileBuffer: Buffer, fileName: string): Promise<string> {
    const ai = this.getClient();
    const ext = path.extname(fileName).toLowerCase();
    let mimeType = "application/octet-stream";
    if (ext === ".pdf") mimeType = "application/pdf";
    else if (ext === ".png") mimeType = "image/png";
    else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
    else if (ext === ".webp") mimeType = "image/webp";

    const filePart = {
      inlineData: {
        mimeType,
        data: fileBuffer.toString("base64"),
      },
    };

    console.log(`[Gemini OCR] Extracting markdown for ${fileName} with resilient fallback strategy...`);
    const response = await this.generateContentWithResilience(ai, {
      preferredModel: "gemini-3.5-flash",
      contents: [
        filePart,
        { text: "Extract all text and tabular information from this document and format it cleanly as Markdown, preserving column structures and layout." }
      ]
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini OCR returned an empty response.");
    }
    return text;
  }

  static async parseWithGemini(markdownContent: string, schema: any): Promise<any> {
    const ai = this.getClient();
    console.log("[Gemini Parser] Parsing markdown content to JSON with resilient fallback strategy...");
    const response = await this.generateContentWithResilience(ai, {
      preferredModel: "gemini-3.5-flash",
      contents: [
        {
          text: `You are an expert Canadian invoice parser. Extract the data from the following document and return a JSON object conforming exactly to the target schema. Do not include any other text besides the JSON.
Target Schema:
${JSON.stringify(schema)}

Document Content:
${markdownContent}`
        }
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini Parser returned an empty response.");
    }
    return JSON.parse(text);
  }

  static async parseDirectWithGemini(fileBuffer: Buffer, fileName: string, schema: any): Promise<any> {
    const ai = this.getClient();
    const ext = path.extname(fileName).toLowerCase();
    let mimeType = "application/octet-stream";
    if (ext === ".pdf") mimeType = "application/pdf";
    else if (ext === ".png") mimeType = "image/png";
    else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
    else if (ext === ".webp") mimeType = "image/webp";
    else if (ext === ".txt" || ext === ".md") mimeType = "text/plain";

    const filePart = mimeType === "text/plain"
      ? { text: fileBuffer.toString("utf-8") }
      : {
          inlineData: {
            mimeType,
            data: fileBuffer.toString("base64"),
          },
        };

    console.log(`[Gemini Direct] Parsing ${fileName} directly with resilient fallback strategy...`);
    const response = await this.generateContentWithResilience(ai, {
      preferredModel: "gemini-3.5-flash",
      contents: [
        filePart,
        {
          text: `You are an expert, production-grade Canadian invoice parser specializing in optical document extraction.
Your task is to process the provided document and output a strictly structured JSON object conforming precisely to the following Target Schema.

Follow these strict Canadian Revenue Agency (CRA) and Revenu Québec compliance rules (2026 tax standards):
1. Resolve bilingual terminology and language (English/French/Mixed).
2. Resolve tax rate & province (Place of Supply) to determine applied taxes:
   - "AB", "NT", "NU", "YT": 5% GST (taxGroup: "GST")
   - "BC": 5% GST + 7% PST (taxGroup: "GST+PST")
   - "MB": 5% GST + 7% RST (taxGroup: "GST+RST")
   - "SK": 5% GST + 6% PST (taxGroup: "GST+PST")
   - "QC": 5% GST + 9.975% QST (taxGroup: "GST+QST")
   - "ON": 13% HST (taxGroup: "HST")
   - "NS": 14% HST (taxGroup: "HST")
   - "NB", "NL", "PE": 15% HST (taxGroup: "HST")
3. Maintain mathematical integrity: subtotal + tax = total. Line items sum to subtotal.
4. If an invoice presents a single combined tax line (e.g. "Taxes (14.975%)"), you must mathematically split it into its individual provincial/federal components (GST 5% + QST 9.975%) based on the identified province ("QC").
5. Clean tax registration numbers to remove spaces/dashes (e.g. "123456789 RT0001" -> "123456789RT0001").

Output ONLY a JSON object that matches the following schema. Set missing or unresolvable fields to null.

Target Schema:
${JSON.stringify(schema)}`
        }
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini Direct returned an empty response.");
    }
    return JSON.parse(text);
  }
}

// ============================================================================
// 4. DUAL LLM PROVIDER RACE LOGIC
// ============================================================================

class DualLLMRacer {
  static async executeRace(markdownContent: string, schema: any, onProgress?: (message: string) => void): Promise<any> {
    let winnerChosen = false;
    let openRouterStarted = false;
    let geminiStarted = false;
    let openRouterTimer: NodeJS.Timeout | null = null;
    let geminiTimer: NodeJS.Timeout | null = null;

    return new Promise(async (resolve, reject) => {
      const resolveWinner = (provider: string, data: any) => {
        if (!winnerChosen) {
          winnerChosen = true;
          if (openRouterTimer) clearTimeout(openRouterTimer);
          if (geminiTimer) clearTimeout(geminiTimer);
          console.log(`\n🏆 [Racer] Winner declared: ${provider}`);
          onProgress?.(`Winner declared: ${provider}! Successfully parsed structured payload.`);
          resolve({ provider, data });
        }
      };

      const cleanJSONParse = (text: string): any => {
        try {
          return JSON.parse(text);
        } catch (e) {
          // Fallback: try to extract JSON from markdown code block if present
          const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match && match[1]) {
            try {
              return JSON.parse(match[1].trim());
            } catch (innerE) {}
          }
          throw e;
        }
      };

      const startOpenRouter = async () => {
        if (openRouterStarted || winnerChosen) return;
        openRouterStarted = true;
        onProgress?.("Spawning OpenRouter backup racer...");
        try {
          const apiKey = process.env.OPENROUTER_API_KEY;
          if (!apiKey) {
            throw new Error("No OpenRouter API Key configured.");
          }
          onProgress?.(`Contacting OpenRouter extraction service (openai/gpt-oss-20b:free)...`);
          const openRouterPayload = {
            model: "openai/gpt-oss-20b:free",
            messages: [
              {
                role: "user",
                content: `You are an expert Canadian invoice data extraction engine.
Return ONLY valid JSON conforming exactly to the provided schema. Do not output conversational text.

Target JSON Schema:
${JSON.stringify(schema)}

Document Text:
${markdownContent}`
              }
            ],
            stream: true,
            temperature: 0.2,
            max_tokens: 500
          };
          const response = await fetch(ENDPOINTS.OPENROUTER_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'Connection': 'keep-alive'
            },
            body: JSON.stringify(openRouterPayload)
          });

          if (!response.ok) throw new Error(`OpenRouter returned ${response.status}`);
          
          const reader = response.body?.getReader();
          if (!reader) throw new Error("Failed to get OpenRouter stream reader");

          let accumulatedContent = "";
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");
            
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === "data: [DONE]") continue;
              
              if (trimmed.startsWith("data: ")) {
                try {
                  const data = JSON.parse(trimmed.slice(6));
                  const content = data.choices[0]?.delta?.content;
                  if (content) {
                    accumulatedContent += content;
                  }
                } catch (e) {
                  // Ignore parse errors for incomplete chunks
                }
              }
            }
          }

          const jsonOutput = cleanJSONParse(accumulatedContent);
          resolveWinner("OpenRouter", jsonOutput);
        } catch (err) {
          console.warn("[Racer] OpenRouter encountered an issue:", (err as Error).message);
          onProgress?.(`OpenRouter failed: ${(err as Error).message}.`);
          // If OpenRouter fails, immediately trigger Gemini if not already started
          startGemini();
        }
      };

      const startGemini = async () => {
        if (geminiStarted || winnerChosen) return;
        geminiStarted = true;
        onProgress?.("Spawning Gemini fallback racer...");
        try {
          onProgress?.("Contacting Gemini extraction service (gemini-3.5-flash)...");
          const jsonOutput = await GeminiFallbackService.parseWithGemini(markdownContent, schema);
          resolveWinner("Gemini", jsonOutput);
        } catch (err) {
          console.error("[Racer] Gemini fallback also failed:", (err as Error).message);
          onProgress?.(`Gemini fallback failed: ${(err as Error).message}`);
          reject(new Error(`Catastrophic Failure: All LLM extraction services (Groq, OpenRouter, Gemini) failed. Last error: ${(err as Error).message}`));
        }
      };

      // 1. Instantly fire Groq request
      onProgress?.("Launching parallel LLM extraction race...");
      try {
        const groqKey = process.env.GROQ_API_KEY;
        if (!groqKey) {
          throw new Error("No Groq API Key configured.");
        }
        onProgress?.(`Contacting Groq extraction service (openai/gpt-oss-20b)...`);
        
        // Start cascading timers as safety fallbacks for slowness
        openRouterTimer = setTimeout(() => {
          startOpenRouter();
        }, 5000);

        geminiTimer = setTimeout(() => {
          startGemini();
        }, 10000);

        const groqPayload = {
          model: "openai/gpt-oss-20b",
          messages: [
            {
              role: "user",
              content: `You are an expert Canadian invoice data extraction engine.
Return ONLY valid JSON conforming exactly to the provided schema. Do not output conversational text.

Target JSON Schema:
${JSON.stringify(schema)}

Document Text:
${markdownContent}`
            }
          ],
          temperature: 0,
          max_completion_tokens: 1000,
          stream: true
        };

        const response = await fetch(ENDPOINTS.GROQ_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
          },
          body: JSON.stringify(groqPayload)
        });

        if (!response.ok) throw new Error(`Groq returned ${response.status}`);
        
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Failed to get Groq stream reader");

        let accumulatedContent = "";
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "data: [DONE]") continue;
            
            if (trimmed.startsWith("data: ")) {
              try {
                const data = JSON.parse(trimmed.slice(6));
                const content = data.choices[0]?.delta?.content;
                if (content) {
                  accumulatedContent += content;
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }

        const jsonOutput = cleanJSONParse(accumulatedContent);
        resolveWinner("Groq", jsonOutput);
      } catch (err) {
        console.warn("[Racer] Groq encountered an issue:", (err as Error).message);
        onProgress?.(`Groq failed: ${(err as Error).message}. Continuing other racers...`);
        // If Groq fails instantly, immediately start OpenRouter to avoid waiting the 5s timeout
        startOpenRouter();
      }
    });
  }
}

// ============================================================================
// 5. MASTER ORCHESTRATION PIPELINE
// ============================================================================

export class InvoiceProcessingService {
  static async processInvoice(filePath: string, onProgress?: (message: string) => void): Promise<UnifiedInvoiceOutput> {
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    // Step 1: Detect Document Type
    onProgress?.("Analyzing invoice file layout and structure (Digital vs. Scanned)...");
    const pipeline = await DocumentRouter.determinePipeline(fileBuffer, fileName);
    console.log(`[Pipeline] Routing document to: ${pipeline}`);
    onProgress?.(`Routing document to: ${pipeline === RoutingPipeline.PIPELINE_A_DIGITAL ? "Pipeline A (Digital-Native PDF)" : "Pipeline B (Scanned Document/Image)"}`);

    // Step 2: Extract Markdown via Docling HTTP Endpoint
    onProgress?.("Sending document to Docling HTTP Endpoint for markdown structure extraction...");
    const extractedMarkdown = await DoclingService.extractMarkdown(fileBuffer, fileName);
    onProgress?.("Markdown extraction complete! Preserved document structure.");

    // Step 3 & 4: Race LLMs & Strict Zod Validation
    const targetExtractionSchema = ParsedInvoiceSchemaB; // Always use relaxed schema for the racer to be safe from strict JSON types
    
    if (pipeline === RoutingPipeline.PIPELINE_A_DIGITAL) {
      console.log("[Pipeline] Initiating Extraction (Pipeline A - Digital)...");
      onProgress?.("Initiating data extraction (Pipeline A - Digital)...");
      const rawResult = await DualLLMRacer.executeRace(extractedMarkdown, targetExtractionSchema, onProgress);
      
      onProgress?.("Parsing extracted invoice data...");
      const relaxedData = ParsedInvoiceSchemaB.parse({ ...rawResult.data, cached: false });
      
      console.log("[Pipeline] Sanitizing extraction artifacts...");
      onProgress?.("Sanitizing extraction artifacts and formatting...");
      const cleanData = PipelineBSanitizer.sanitize(relaxedData);
      
      onProgress?.("Applying 2026 Canadian place-of-supply tax standard schema...");
      return ParsedInvoiceSchemaA.parse(cleanData);
      
    } else {
      console.log("[Pipeline] Initiating Extraction (Pipeline B - Scanned)...");
      onProgress?.("Initiating relaxed data extraction (Pipeline B - Scanned)...");
      const rawResult = await DualLLMRacer.executeRace(extractedMarkdown, targetExtractionSchema, onProgress);
      
      onProgress?.("Parsing loose OCR structure...");
      const relaxedData = ParsedInvoiceSchemaB.parse({ ...rawResult.data, cached: false });
      
      console.log("[Pipeline] Sanitizing OCR artifacts...");
      onProgress?.("Sanitizing OCR artifacts and alignment...");
      const cleanData = PipelineBSanitizer.sanitize(relaxedData);
      
      onProgress?.("Applying 2026 Canadian place-of-supply tax standard schema...");
      return ParsedInvoiceSchemaA.parse(cleanData);
    }
  }
}
