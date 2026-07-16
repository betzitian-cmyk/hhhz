import { z } from "zod";

// ============================================================================
// 1. BILINGUAL ZOD SCHEMAS & CONFIGURATIONS
// ============================================================================

/**
 * TaxBreakdownValueSchema / GrilleRépartitionTaxesSchema
 * Detailed breakdown of Canadian sales taxes.
 * Répartition détaillée des taxes de vente canadiennes.
 */
export const TaxBreakdownValueSchema = z.object({
  gst: z.number().nullable()
    .describe("GST (Goods and Services Tax) amount / Montant de la TPS (Taxe sur les produits et services)"),
  pst: z.number().nullable()
    .describe("PST (Provincial Sales Tax) amount / Montant de la TVP (Taxe de vente provinciale)"),
  hst: z.number().nullable()
    .describe("HST (Harmonized Sales Tax) amount / Montant de la TVH (Taxe de vente harmonisée)"),
  qst: z.number().nullable()
    .describe("QST (Quebec Sales Tax) amount / Montant de la TVQ (Taxe de vente du Québec)"),
  rst: z.number().nullable()
    .describe("RST (Retail Sales Tax) amount / Montant de la TVD (Taxe de vente au détail - e.g., MB, SK)"),
}).strict().describe("Canadian tax breakdown / Répartition des taxes canadiennes");

/**
 * VendorTaxNumbersSchema / NumérosTaxesFournisseurSchema
 * Canadian tax registration numbers.
 * Numéros d'identification fiscale canadiens pour les taxes.
 */
export const VendorTaxNumbersSchema = z.object({
  businessNumber: z.string().nullable()
    .describe("Federal Business Number (9 digits) / Numéro d'entreprise fédéral (NE - 9 chiffres)"),
  gstHst: z.string().nullable()
    .describe("GST/HST Registration Number (usually RT0001 suffix) / Numéro d'inscription à la TPS/TVH"),
  qst: z.string().nullable()
    .describe("QST Registration Number (Quebec - usually TQ0001 suffix) / Numéro d'inscription à la TVQ"),
  pst: z.string().nullable()
    .describe("PST Number (BC, MB, SK) / Numéro de TVP (Colombie-Britannique, Manitoba, Saskatchewan)"),
  rst: z.string().nullable()
    .describe("RST Number / Numéro de taxe sur les ventes au détail (TVD)"),
}).strict().describe("Vendor tax registration numbers / Numéros de taxes du fournisseur");

/**
 * LineItemSchema / ÉlémentLigneSchema
 * Represents a single line item within the invoice.
 * Représente un article individuel de la facture.
 */
export const LineItemSchema = z.object({
  description: z.string()
    .describe("Description of the product or service / Description du produit ou service"),
  quantity: z.number().nullable()
    .describe("Quantity of items / Quantité d'articles"),
  unitPrice: z.number().nullable()
    .describe("Unit price of the item / Prix unitaire de l'article"),
  amount: z.number().nullable()
    .describe("Line net total amount excluding tax / Montant total net de la ligne hors taxes"),
  tax: z.number().nullable()
    .describe("Calculated tax amount for this line / Montant de taxe calculé pour cette ligne"),
  taxRate: z.number().nullable()
    .describe("Tax rate applied as decimal or percentage (e.g., 0.05 or 5%) / Taux de taxe appliqué"),
  isTaxExempt: z.boolean().nullable()
    .describe("True if item is explicitly marked as tax-exempt / Vrai si l'article es explicitement exonéré"),
  taxabilityGroup: z.enum([
    "Taxable",      // Taxable / Imposable
    "Zero-Rated",   // Zero-Rated / Détaxé (0%)
    "Exempt"        // Exempt / Exonéré
  ]).nullable().describe("Canadian taxability status / Statut d'imposabilité canadien"),
  taxBreakdown: TaxBreakdownValueSchema.nullable()
    .describe("Specific tax split for this line / Répartition spécifique des taxes pour cette ligne"),
}).strict().describe("Invoice line item detail / Détail de l'article de la facture");

/**
 * ParsedInvoiceSchema / FactureAnalyséeSchema
 * The root structure optimized for multi-language Canadian invoice parsing.
 * Structure racine optimisée pour l'extraction de factures canadiennes bilingues.
 */
export const ParsedInvoiceSchema = z.object({
  invoiceNumber: z.string().nullable()
    .describe("Invoice identifier (Invoice #, Numéro de facture, Facture N°)"),
  poNumber: z.string().nullable()
    .describe("Purchase Order number (PO #, Bon de commande, BDC)"),
  date: z.string().nullable()
    .describe("Invoice date in YYYY-MM-DD format (Date de facturation)"),
  dueDate: z.string().nullable()
    .describe("Payment due date in YYYY-MM-DD format (Date d'échéance)"),
  language: z.enum(["en", "fr", "mixed"])
    .describe("Primary language of the document / Langue principale du document"),
  vendorName: z.string().nullable()
    .describe("Name of the issuing company / Raison sociale du fournisseur"),
  vendorAddress: z.string().nullable()
    .describe("Full billing address of the vendor / Adresse complète du fournisseur"),
  customerName: z.string().nullable()
    .describe("Recipient or customer company name / Nom du client ou de l'acheteur"),
  customerAddress: z.string().nullable()
    .describe("Billing or delivery address of the customer / Adresse complète du client"),
  vendorTaxNumbers: VendorTaxNumbersSchema.nullable()
    .describe("Extracted tax IDs of the vendor / Numéros fiscaux du fournisseur"),
  paymentTerms: z.string().nullable()
    .describe("Payment terms or conditions (e.g., Net 30, Due on Receipt / Conditions de paiement)"),
  subtotal: z.number().nullable()
    .describe("Subtotal amount before taxes / Sous-total avant taxes"),
  zeroRatedSubtotal: z.number().nullable()
    .describe("Portion of subtotal subjected to 0% tax / Portion du sous-total détaxée (0%)"),
  exemptSubtotal: z.number().nullable()
    .describe("Portion of subtotal exempted from tax / Portion du sous-total exonérée de taxe"),
  tax: z.number().nullable()
    .describe("Total tax amount on the invoice / Montant total des taxes"),
  total: z.number().nullable()
    .describe("Grand total amount including taxes / Montant total TTC de la facture"),
  currency: z.string().nullable()
    .describe("Three-letter ISO currency code (usually CAD or USD) / Devise en code ISO à trois lettres"),
  taxBreakdown: TaxBreakdownValueSchema.nullable()
    .describe("Global breakdown of taxes applied / Répartition globale des taxes appliquées"),
  province: z.enum([
    "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"
  ]).nullable().describe("Canadian province or territory code / Province ou territoire canadien (code ISO)"),
  taxGroup: z.string().nullable()
    .describe("Identified tax combination (e.g., 'GST+QST', 'HST', 'GST+PST') / Combinaison de taxes identifiée"),
  items: z.array(LineItemSchema)
    .describe("Extracted line items / Articles extraits de la facture"),
  summary: z.string().nullable()
    .describe("Brief description or executive summary of the invoice contents / Résumé global"),
  cached: z.boolean()
    .describe("Flag representing if result was retrieved from cache / Indique si le résultat provient du cache"),
}).strict().describe("Structured Canadian invoice data / Données structurées de facturation canadienne");

// ============================================================================
// 2. INFERRED STATIC TYPES
// ============================================================================

export type TaxBreakdownValue = z.infer<typeof TaxBreakdownValueSchema>;
export type VendorTaxNumbers = z.infer<typeof VendorTaxNumbersSchema>;
export type LineItem = z.infer<typeof LineItemSchema>;
export type ParsedInvoice = z.infer<typeof ParsedInvoiceSchema>;

// ============================================================================
// 3. SECURE DOMAIN MATHEMATICAL POST-PROCESSOR & RECONCILIATION ENGINE
// ============================================================================

/**
 * Utility to round numbers safely to 2 decimal places to avoid floating-point math issues.
 */
function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Clean up Canadian Tax registration formats (removes erratic whitespace or hyphens).
 */
function cleanTaxNumber(id: string | null | undefined): string | null {
  if (!id) return null;
  const cleaned = id.replace(/[\s-]/g, "").toUpperCase();
  return cleaned || null;
}

/**
 * Resolves combined tax values into split, componentized tax breakdowns 
 * based on provincial guidelines and statutory tax relationships.
 */
export function resolveCanadianTaxSplit(
  subtotal: number,
  totalTax: number,
  province: string | null,
  taxGroup: string | null
): TaxBreakdownValue {
  const breakdown: TaxBreakdownValue = {
    gst: null,
    pst: null,
    hst: null,
    qst: null,
    rst: null,
  };

  if (subtotal <= 0 || totalTax <= 0) {
    return breakdown;
  }

  const normalizedGroup = taxGroup?.toUpperCase() || "";
  const upperProv = province?.toUpperCase() || "";

  // 1. Quebec (GST 5% + QST 9.975% = 14.975% combined)
  if (upperProv === "QC" || normalizedGroup.includes("QST") || normalizedGroup.includes("TVQ")) {
    const calculatedGst = roundToTwo(subtotal * 0.05);
    // Deduct calculated GST from total tax to isolate QST. This handles penny rounding perfectly.
    const calculatedQst = roundToTwo(totalTax - calculatedGst);
    
    breakdown.gst = calculatedGst;
    breakdown.qst = calculatedQst > 0 ? calculatedQst : null;
    return breakdown;
  }

  // 2. HST Provinces (ON - 13%, NS/NB/NL/PE - 15%)
  if (["ON", "NS", "NB", "NL", "PE"].includes(upperProv) || normalizedGroup.includes("HST") || normalizedGroup.includes("TVH")) {
    breakdown.hst = roundToTwo(totalTax);
    return breakdown;
  }

  // 3. British Columbia, Saskatchewan, Manitoba (GST 5% + PST/RST)
  if (["BC", "SK", "MB"].includes(upperProv) || normalizedGroup.includes("PST") || normalizedGroup.includes("RST") || normalizedGroup.includes("TVP")) {
    const calculatedGst = roundToTwo(subtotal * 0.05);
    const calculatedPst = roundToTwo(totalTax - calculatedGst);

    breakdown.gst = calculatedGst;
    if (upperProv === "MB" || normalizedGroup.includes("RST")) {
      breakdown.rst = calculatedPst > 0 ? calculatedPst : null;
    } else {
      breakdown.pst = calculatedPst > 0 ? calculatedPst : null;
    }
    return breakdown;
  }

  // 4. Federal Only Provinces (AB, YT, NT, NU - GST 5% only)
  if (["AB", "YT", "NT", "NU"].includes(upperProv) || normalizedGroup === "GST" || normalizedGroup === "TPS") {
    breakdown.gst = roundToTwo(totalTax);
    return breakdown;
  }

  // Default fallback if province metadata is missing but standard GST is inferred
  breakdown.gst = roundToTwo(totalTax);
  return breakdown;
}

/**
 * Validates, reconciles, and cleanses the raw extracted JSON data.
 * Fixes broken rounding, processes splits, segments subtotals, and returns a verified ParsedInvoice object.
 * Throws structured Zod validation errors if requirements are not met.
 */
export function validateAndReconcileInvoice(rawInput: unknown): ParsedInvoice {
  // Initial parsing to validate basic types
  const validatedInput = ParsedInvoiceSchema.parse(rawInput);

  const subtotal = validatedInput.subtotal || 0;
  const totalTax = validatedInput.tax || 0;
  const total = validatedInput.total || 0;

  // 1. Cleanse Tax Registrations Numbers
  if (validatedInput.vendorTaxNumbers) {
    validatedInput.vendorTaxNumbers.businessNumber = cleanTaxNumber(validatedInput.vendorTaxNumbers.businessNumber);
    validatedInput.vendorTaxNumbers.gstHst = cleanTaxNumber(validatedInput.vendorTaxNumbers.gstHst);
    validatedInput.vendorTaxNumbers.qst = cleanTaxNumber(validatedInput.vendorTaxNumbers.qst);
    validatedInput.vendorTaxNumbers.pst = cleanTaxNumber(validatedInput.vendorTaxNumbers.pst);
    validatedInput.vendorTaxNumbers.rst = cleanTaxNumber(validatedInput.vendorTaxNumbers.rst);
  }

  // 2. Perform Dual-Tax Splitting if a consolidated tax breakdown is missing
  if (totalTax > 0 && subtotal > 0 && (!validatedInput.taxBreakdown || Object.values(validatedInput.taxBreakdown).every(v => v === null))) {
    validatedInput.taxBreakdown = resolveCanadianTaxSplit(
      subtotal,
      totalTax,
      validatedInput.province,
      validatedInput.taxGroup
    );
  }

  // 3. Reconcile Subtotal segments (Taxable, Zero-Rated, Exempt)
  let computedZeroRated = 0;
  let computedExempt = 0;
  let computedLineSubtotal = 0;

  validatedInput.items.forEach((item) => {
    const lineAmount = item.amount || 0;
    computedLineSubtotal += lineAmount;

    if (item.taxabilityGroup === "Zero-Rated") {
      computedZeroRated += lineAmount;
    } else if (item.taxabilityGroup === "Exempt" || item.isTaxExempt === true) {
      computedExempt += lineAmount;
    }
  });

  // Backfill subtotal parameters if omitted during processing
  if (validatedInput.zeroRatedSubtotal === null || validatedInput.zeroRatedSubtotal === 0) {
    validatedInput.zeroRatedSubtotal = roundToTwo(computedZeroRated);
  }
  if (validatedInput.exemptSubtotal === null || validatedInput.exemptSubtotal === 0) {
    validatedInput.exemptSubtotal = roundToTwo(computedExempt);
  }

  // 4. Mathematical Sanitization Check
  const subtotalSumCheck = Math.abs((validatedInput.subtotal || computedLineSubtotal) - computedLineSubtotal);
  if (subtotalSumCheck > 0.05) {
    console.warn(`[Warning] Discrepancy detected: Sum of line items ($${computedLineSubtotal}) does not match subtotal ($${validatedInput.subtotal})`);
  }

  const grandTotalCalculation = roundToTwo(subtotal + totalTax);
  const totalVariance = Math.abs(grandTotalCalculation - total);
  if (totalVariance > 0.05) {
    console.warn(`[Warning] Total calculation mismatch: Subtotal ($${subtotal}) + Tax ($${totalTax}) = $${grandTotalCalculation}. Extracted total was $${total}.`);
  }

  // Final verification with fully formatted outputs
  return ParsedInvoiceSchema.parse(validatedInput);
}