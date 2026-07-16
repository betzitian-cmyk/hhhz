import { z } from "zod";

export const TaxBreakdownValueSchema = z.object({
  gst: z.number().nullable(),
  pst: z.number().nullable(),
  hst: z.number().nullable(),
  qst: z.number().nullable(),
  rst: z.number().nullable(),
}).strict();

export const VendorTaxNumbersSchema = z.object({
  businessNumber: z.string().nullable(),
  gstHst: z.string().nullable(),
  qst: z.string().nullable(),
  pst: z.string().nullable(),
  rst: z.string().nullable(),
}).strict();

export const LineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().nullable(),
  unitPrice: z.number().nullable(),
  amount: z.number().nullable(),
  tax: z.number().nullable(),
  taxRate: z.number().nullable(),
  isTaxExempt: z.boolean().nullable(),
  taxabilityGroup: z.enum(["Taxable", "Zero-Rated", "Exempt"]).nullable(),
  taxBreakdown: TaxBreakdownValueSchema.nullable(),
}).strict();

export const ParsedInvoiceSchema = z.object({
  invoiceNumber: z.string().nullable(),
  poNumber: z.string().nullable(),
  date: z.string().nullable(),
  dueDate: z.string().nullable(),
  language: z.enum(["en", "fr", "mixed"]),
  vendorName: z.string().nullable(),
  vendorAddress: z.string().nullable(),
  customerName: z.string().nullable(),
  customerAddress: z.string().nullable(),
  vendorTaxNumbers: VendorTaxNumbersSchema.nullable(),
  paymentTerms: z.string().nullable(),
  subtotal: z.number().nullable(),
  zeroRatedSubtotal: z.number().nullable(),
  exemptSubtotal: z.number().nullable(),
  tax: z.number().nullable(),
  total: z.number().nullable(),
  currency: z.string().nullable(),
  taxBreakdown: TaxBreakdownValueSchema.nullable(),
  province: z.enum(["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"]).nullable(),
  taxGroup: z.string().nullable(),
  items: z.array(LineItemSchema),
  summary: z.string().nullable(),
  cached: z.boolean(),
}).strict();

export type TaxBreakdownValue = z.infer<typeof TaxBreakdownValueSchema>;
export type VendorTaxNumbers = z.infer<typeof VendorTaxNumbersSchema>;
export type LineItem = z.infer<typeof LineItemSchema>;
export type ParsedInvoice = z.infer<typeof ParsedInvoiceSchema>;

export interface ComplianceCheck {
  id: string;
  name: string;
  status: "pass" | "fail" | "warning";
  category: "math" | "tax_rate" | "vendor_id" | "compliance" | "language";
  description: string;
  expectedValue?: string | number | null;
  actualValue?: string | number | null;
}

export interface ComplianceReport {
  passedCount: number;
  warningCount: number;
  failedCount: number;
  checks: ComplianceCheck[];
  isValidForITC: boolean; // Input Tax Credit eligibility (GST/HST number present, correct provincial rates, math correct)
  isValidForITR: boolean; // Input Tax Refund eligibility (QST number present for Quebec)
}
