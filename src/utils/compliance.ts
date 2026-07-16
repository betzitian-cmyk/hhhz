import { ParsedInvoice, ComplianceReport, ComplianceCheck, TaxBreakdownValue } from "../types";

/**
 * Normalizes tax numbers by removing whitespace, hyphens, and converting to uppercase.
 */
export function normalizeTaxNumber(num: string | null): string | null {
  if (!num) return null;
  return num.replace(/[\s-]/g, "").toUpperCase();
}

/**
 * Validates a GST/HST registry number format (9 digits + "RT" + 4 digits, e.g. 123456789RT0001).
 */
export function isValidGstHstFormat(num: string | null): boolean {
  if (!num) return false;
  const normalized = normalizeTaxNumber(num);
  return /^\d{9}RT\d{4}$/.test(normalized || "");
}

/**
 * Validates a QST registry number format (10 or 9 digits + "TQ" + 4 digits, e.g. 1234567890TQ0001).
 */
export function isValidQstFormat(num: string | null): boolean {
  if (!num) return false;
  const normalized = normalizeTaxNumber(num);
  return /^\d{9,10}TQ\d{4}$/.test(normalized || "");
}

/**
 * Generates an in-depth CRA and Revenu Québec tax compliance report.
 */
export function generateComplianceReport(invoice: ParsedInvoice): ComplianceReport {
  const checks: ComplianceCheck[] = [];
  const roundingTolerance = 0.021; // ±$0.02 tolerance

  const subtotal = invoice.subtotal ?? 0;
  const tax = invoice.tax ?? 0;
  const total = invoice.total ?? 0;
  const province = invoice.province;

  // ---------------------------------------------------------------------------
  // 1. MATHEMATICAL INTEGRITY CHECKS
  // ---------------------------------------------------------------------------

  // Check A: Global Total Math (subtotal + tax == total)
  const mathDiff = Math.abs(subtotal + tax - total);
  if (mathDiff <= roundingTolerance) {
    checks.push({
      id: "math-total",
      name: "Global Mathematical Reconciliation",
      status: "pass",
      category: "math",
      description: "Subtotal plus Tax successfully reconciles with Grand Total.",
      expectedValue: total,
      actualValue: Number((subtotal + tax).toFixed(2)),
    });
  } else {
    checks.push({
      id: "math-total",
      name: "Global Mathematical Reconciliation",
      status: "fail",
      category: "math",
      description: `Discrepancy detected: Subtotal (${subtotal.toFixed(2)}) + Tax (${tax.toFixed(2)}) equals ${(subtotal + tax).toFixed(2)}, but Total is specified as ${total.toFixed(2)} (variance of $${mathDiff.toFixed(2)}).`,
      expectedValue: total,
      actualValue: Number((subtotal + tax).toFixed(2)),
    });
  }

  // Check B: Line Items Sum vs Subtotal
  const lineItemsSum = invoice.items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const subtotalDiff = Math.abs(lineItemsSum - subtotal);
  if (subtotalDiff <= roundingTolerance) {
    checks.push({
      id: "math-subtotal-sum",
      name: "Line Item Sum vs Subtotal",
      status: "pass",
      category: "math",
      description: "The sum of all line item amounts matches the global subtotal.",
      expectedValue: subtotal,
      actualValue: Number(lineItemsSum.toFixed(2)),
    });
  } else {
    checks.push({
      id: "math-subtotal-sum",
      name: "Line Item Sum vs Subtotal",
      status: "fail",
      category: "math",
      description: `Discrepancy detected: Sum of line items ($${lineItemsSum.toFixed(2)}) does not match subtotal ($${subtotal.toFixed(2)}). Variance of $${subtotalDiff.toFixed(2)}.`,
      expectedValue: subtotal,
      actualValue: Number(lineItemsSum.toFixed(2)),
    });
  }

  // Check C: Line Items Tax Sum vs Global Tax
  const lineItemsTaxSum = invoice.items.reduce((sum, item) => sum + (item.tax ?? 0), 0);
  const taxDiff = Math.abs(lineItemsTaxSum - tax);
  if (taxDiff <= roundingTolerance) {
    checks.push({
      id: "math-tax-sum",
      name: "Line Item Tax vs Global Tax",
      status: "pass",
      category: "math",
      description: "The sum of taxes applied to individual line items matches the global invoice tax.",
      expectedValue: tax,
      actualValue: Number(lineItemsTaxSum.toFixed(2)),
    });
  } else {
    // If tax is 0 or null and item taxes are also 0/null, it's a pass. Otherwise, warn or fail.
    const isActuallyZero = Math.abs(lineItemsTaxSum) < 0.001 && Math.abs(tax) < 0.001;
    checks.push({
      id: "math-tax-sum",
      name: "Line Item Tax vs Global Tax",
      status: isActuallyZero ? "pass" : "warning",
      category: "math",
      description: isActuallyZero
        ? "Zero tax correctly reconciled."
        : `Sum of line item taxes ($${lineItemsTaxSum.toFixed(2)}) differs from global tax ($${tax.toFixed(2)}) by $${taxDiff.toFixed(2)}.`,
      expectedValue: tax,
      actualValue: Number(lineItemsTaxSum.toFixed(2)),
    });
  }

  // Check D: Tax Breakdown Components Sum vs Global Tax
  const globalBreakdown: TaxBreakdownValue = invoice.taxBreakdown || { gst: 0, pst: 0, hst: 0, qst: 0, rst: 0 };
  const breakdownSum =
    (globalBreakdown.gst ?? 0) +
    (globalBreakdown.pst ?? 0) +
    (globalBreakdown.hst ?? 0) +
    (globalBreakdown.qst ?? 0) +
    (globalBreakdown.rst ?? 0);
  const breakdownDiff = Math.abs(breakdownSum - tax);

  if (breakdownDiff <= roundingTolerance) {
    checks.push({
      id: "math-breakdown-sum",
      name: "Tax Breakdown Sum Reconciliation",
      status: "pass",
      category: "math",
      description: "Sum of individual tax components (GST, PST, HST, QST, RST) matches global tax.",
      expectedValue: tax,
      actualValue: Number(breakdownSum.toFixed(2)),
    });
  } else {
    checks.push({
      id: "math-breakdown-sum",
      name: "Tax Breakdown Sum Reconciliation",
      status: "warning",
      category: "math",
      description: `Tax breakdown components sum to $${breakdownSum.toFixed(2)}, which differs from global tax $${tax.toFixed(2)} (variance $${breakdownDiff.toFixed(2)}).`,
      expectedValue: tax,
      actualValue: Number(breakdownSum.toFixed(2)),
    });
  }

  // ---------------------------------------------------------------------------
  // 2. PLACE OF SUPPLY & PROV TAX RATES CHECKS
  // ---------------------------------------------------------------------------
  if (province) {
    let expectedCombinedRate = 0;
    let rateDetails = "";
    switch (province) {
      case "AB": case "NT": case "NU": case "YT":
        expectedCombinedRate = 0.05; // 5% GST
        rateDetails = "5% GST";
        break;
      case "BC":
        expectedCombinedRate = 0.12; // 5% GST + 7% PST
        rateDetails = "12% Combined (5% GST + 7% PST)";
        break;
      case "MB":
        expectedCombinedRate = 0.12; // 5% GST + 7% RST
        rateDetails = "12% Combined (5% GST + 7% RST)";
        break;
      case "SK":
        expectedCombinedRate = 0.11; // 5% GST + 6% PST
        rateDetails = "11% Combined (5% GST + 6% PST)";
        break;
      case "QC":
        expectedCombinedRate = 0.14975; // 5% GST + 9.975% QST
        rateDetails = "14.975% Combined (5% GST + 9.975% QST)";
        break;
      case "ON":
        expectedCombinedRate = 0.13; // 13% HST
        rateDetails = "13% HST";
        break;
      case "NS":
        expectedCombinedRate = 0.14; // 14% HST
        rateDetails = "14% HST";
        break;
      case "NB": case "NL": case "PE":
        expectedCombinedRate = 0.15; // 15% HST
        rateDetails = "15% HST";
        break;
    }

    // Check if the calculated global rate matches expected supply rate
    if (subtotal > 0 && tax > 0) {
      const actualGlobalRate = tax / subtotal;
      const rateVariance = Math.abs(actualGlobalRate - expectedCombinedRate);
      if (rateVariance < 0.015) { // Allow slight variance due to exempt/zero-rated mixtures
        checks.push({
          id: "place-of-supply-rate",
          name: `Tax Rate Compatibility (${province})`,
          status: "pass",
          category: "tax_rate",
          description: `Applied taxes are compatible with the Place of Supply rules for ${province} (${rateDetails}).`,
          expectedValue: Number((expectedCombinedRate * 100).toFixed(3)) + "%",
          actualValue: Number((actualGlobalRate * 100).toFixed(3)) + "%",
        });
      } else {
        checks.push({
          id: "place-of-supply-rate",
          name: `Tax Rate Compatibility (${province})`,
          status: "warning",
          category: "tax_rate",
          description: `The global rate of ${(actualGlobalRate * 100).toFixed(2)}% deviates from the standard ${province} Place of Supply rate of ${(expectedCombinedRate * 100).toFixed(3)}%. This is acceptable if the invoice has a mix of taxable, zero-rated, or exempt items.`,
          expectedValue: Number((expectedCombinedRate * 100).toFixed(3)) + "%",
          actualValue: Number((actualGlobalRate * 100).toFixed(3)) + "%",
        });
      }
    } else if (tax === 0 && subtotal > 0) {
      // Zero taxes applied
      const allZeroOrExempt = invoice.items.every(item => item.taxabilityGroup === "Zero-Rated" || item.taxabilityGroup === "Exempt");
      if (allZeroOrExempt) {
        checks.push({
          id: "place-of-supply-rate",
          name: `Tax Rate Compatibility (${province})`,
          status: "pass",
          category: "tax_rate",
          description: `Invoice is fully non-taxable (all items Zero-Rated or Exempt), conforming with tax policy.`,
          expectedValue: "0% (Zero-Rated/Exempt)",
          actualValue: "0%",
        });
      } else {
        checks.push({
          id: "place-of-supply-rate",
          name: `Tax Rate Compatibility (${province})`,
          status: "warning",
          category: "tax_rate",
          description: "No taxes were charged, but some line items are classified as standard 'Taxable'. Verify if tax should have been collected.",
          expectedValue: rateDetails,
          actualValue: "0%",
        });
      }
    }
  } else {
    checks.push({
      id: "place-of-supply-rate",
      name: "Place of Supply Identification",
      status: "warning",
      category: "tax_rate",
      description: "No Canadian province was specified or deduced. Unable to run province-specific Place of Supply compliance checks.",
    });
  }

  // ---------------------------------------------------------------------------
  // 3. REGISTRY / VENDOR TAX ID COMPLIANCE
  // ---------------------------------------------------------------------------
  const gstHst = invoice.vendorTaxNumbers?.gstHst ?? null;
  const qst = invoice.vendorTaxNumbers?.qst ?? null;
  const normalizedGst = normalizeTaxNumber(gstHst);
  const normalizedQst = normalizeTaxNumber(qst);

  // Rule: Under CRA, for invoice totals > $30, a GST/HST number must be printed for the customer to claim ITCs.
  if (total > 30 && tax > 0) {
    if (!gstHst) {
      // Missing entirely
      checks.push({
        id: "cra-gst-hst-present",
        name: "CRA GST/HST Registry Number",
        status: "fail",
        category: "vendor_id",
        description: `CRA REQUIREMENT: Since total ($${total.toFixed(2)}) is over $30.00 CAD and tax was collected, the vendor MUST provide their GST/HST registration number. Missing registration prevents claiming Input Tax Credits (ITCs).`,
        expectedValue: "9-digit RT0001 registration",
        actualValue: "Missing",
      });
    } else if (!isValidGstHstFormat(gstHst)) {
      // Invalid format
      checks.push({
        id: "cra-gst-hst-present",
        name: "CRA GST/HST Registry Number",
        status: "warning",
        category: "vendor_id",
        description: `GST/HST number '${gstHst}' is present but does not match standard 15-character CRA format (e.g. 123456789RT0001). Correcting formatting is recommended before claiming ITCs.`,
        expectedValue: "9-digit RT0001 registration",
        actualValue: gstHst,
      });
    } else {
      // Perfect
      checks.push({
        id: "cra-gst-hst-present",
        name: "CRA GST/HST Registry Number Verification",
        status: "pass",
        category: "vendor_id",
        description: `GST/HST registry number '${normalizedGst}' is present and structurally compliant with CRA rules.`,
        expectedValue: "CRA RT Compliant",
        actualValue: normalizedGst,
      });
    }
  } else if (tax > 0) {
    // Under $30 but has tax
    if (!gstHst) {
      checks.push({
        id: "cra-gst-hst-present",
        name: "CRA GST/HST Number",
        status: "warning",
        category: "vendor_id",
        description: "Tax was charged, but GST/HST number is missing. While permissible under $30, the purchaser cannot claim an ITC without it.",
        expectedValue: "Recommended for ITC",
        actualValue: "Missing",
      });
    }
  }

  // Quebec-specific check
  if (province === "QC" && tax > 0) {
    // Under Revenu Québec, a QST number (TQ) is required to claim Input Tax Refunds (ITRs) if provincial tax was charged.
    const qstTax = globalBreakdown.qst ?? 0;
    if (qstTax > 0 || (tax > 0 && !gstHst && !qst)) {
      if (!qst) {
        checks.push({
          id: "rq-qst-present",
          name: "Revenu Québec QST Registry Number",
          status: "fail",
          category: "vendor_id",
          description: "REVENU QUÉBEC REQUIREMENT: QST was charged or QC province is selected, but the vendor QST registry number (TQ) is missing. Purchaser cannot claim Input Tax Refunds (ITRs).",
          expectedValue: "9/10-digit TQ0001 registration",
          actualValue: "Missing",
        });
      } else if (!isValidQstFormat(qst)) {
        checks.push({
          id: "rq-qst-present",
          name: "Revenu Québec QST Registry Number",
          status: "warning",
          category: "vendor_id",
          description: `QST number '${qst}' is present but does not match standard Revenu Québec format (e.g. 1234567890TQ0001 or 123456789TQ0001). Verification is recommended before claiming ITRs.`,
          expectedValue: "9/10-digit TQ0001 registration",
          actualValue: qst,
        });
      } else {
        checks.push({
          id: "rq-qst-present",
          name: "Revenu Québec QST Registry Number Verification",
          status: "pass",
          category: "vendor_id",
          description: `QST registry number '${normalizedQst}' is present and structurally compliant with Revenu Québec rules.`,
          expectedValue: "RQ TQ Compliant",
          actualValue: normalizedQst,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 4. BILINGUAL AND GENERAL COMPLIANCE CHECKS
  // ---------------------------------------------------------------------------
  checks.push({
    id: "invoice-metadata-lang",
    name: "Bilingual Representation Check",
    status: "pass",
    category: "language",
    description: `Document language identified as '${invoice.language.toUpperCase()}'. Terminology successfully mapped to the target schema.`,
    expectedValue: "en | fr | mixed",
    actualValue: invoice.language,
  });

  if (!invoice.invoiceNumber) {
    checks.push({
      id: "invoice-number-present",
      name: "Invoice Number Audit",
      status: "warning",
      category: "compliance",
      description: "The document lacks a unique invoice number. This is recommended by both CRA and standard accounting protocols for audit tracking.",
      expectedValue: "Invoice Number String",
      actualValue: "Missing",
    });
  } else {
    checks.push({
      id: "invoice-number-present",
      name: "Invoice Number Audit",
      status: "pass",
      category: "compliance",
      description: `Invoice number '${invoice.invoiceNumber}' successfully extracted for audit logging.`,
      expectedValue: "Present",
      actualValue: invoice.invoiceNumber,
    });
  }

  if (!invoice.date) {
    checks.push({
      id: "invoice-date-present",
      name: "Tax Point / Document Date Check",
      status: "fail",
      category: "compliance",
      description: "CRA REQUIREMENT: The invoice is missing a document date. A tax point date is legally required to establish the correct fiscal period.",
      expectedValue: "YYYY-MM-DD Date",
      actualValue: "Missing",
    });
  } else {
    checks.push({
      id: "invoice-date-present",
      name: "Tax Point / Document Date Check",
      status: "pass",
      category: "compliance",
      description: `Document date '${invoice.date}' is present and establishes the correct tax period.`,
      expectedValue: "YYYY-MM-DD",
      actualValue: invoice.date,
    });
  }

  // ---------------------------------------------------------------------------
  // ITC AND ITR ELIGIBILITY DECISION ENGINE
  // ---------------------------------------------------------------------------
  // To claim an Input Tax Credit (ITC) for GST/HST under CRA:
  // - Math total check must not FAIL.
  // - Date must be present.
  // - If tax > 0 and total > 30, GST/HST must be present and format must not fail.
  const hasGstFail = checks.some(c => c.id === "cra-gst-hst-present" && c.status === "fail");
  const hasMathFail = checks.some(c => c.category === "math" && c.status === "fail");
  const hasDateFail = checks.some(c => c.id === "invoice-date-present" && c.status === "fail");
  const isEligibleForITC = tax > 0 && !hasGstFail && !hasMathFail && !hasDateFail;

  // To claim Input Tax Refund (ITR) for QST under Revenu Québec (if province is QC):
  const hasQstFail = checks.some(c => c.id === "rq-qst-present" && c.status === "fail");
  const isEligibleForITR = province === "QC" && tax > 0 && isEligibleForITC && !hasQstFail;

  const passedCount = checks.filter(c => c.status === "pass").length;
  const warningCount = checks.filter(c => c.status === "warning").length;
  const failedCount = checks.filter(c => c.status === "fail").length;

  return {
    passedCount,
    warningCount,
    failedCount,
    checks,
    isValidForITC: isEligibleForITC,
    isValidForITR: isEligibleForITR,
  };
}
