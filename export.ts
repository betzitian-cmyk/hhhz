// exportManager.ts

/**
 * Interface representing the Audit Data structure.
 */
export interface AuditData {
  invoiceNumber?: string;
  poNumber?: string;
  date?: string;
  dueDate?: string;
  province?: string;
  currency?: string;
  language?: string;
  subtotal?: number;
  zeroRatedSubtotal?: number;
  exemptSubtotal?: number;
  tax?: number;
  total?: number;
  taxBreakdown?: { gst?: number; pst?: number; hst?: number; qst?: number; rst?: number };
  vendorName?: string;
  vendorAddress?: string;
  vendorTaxNumbers?: { businessNumber?: string; gstHst?: string; qst?: string; pst?: string };
  customerName?: string;
  customerAddress?: string;
  summary?: string;
  items?: Array<{
    description?: string;
    quantity?: number;
    unitPrice?: number;
    amount?: number;
    taxabilityGroup?: string;
    taxRate?: number | null;
  }>;
}

// ============================================================================
// SHARED UTILITIES
// ============================================================================

const triggerDownload = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url); // Prevent memory leaks
};

const escapeCSV = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;

const escapeXML = (val: any) =>
  String(val ?? "").replace(/[<>&'"]/g, (c) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;"
  }[c] || c));

const escapeIIF = (val: any) => String(val ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " ");

// ============================================================================
// EXPORT HANDLERS
// ============================================================================

export const exportSummaryCSV = (data: AuditData) => {
  const rows = [
    ["Audit Summary Report", "Canaudit Pro / ApplechAI"],
    ["Generated On", new Date().toLocaleString()],
    [],
    ["Invoice Metadata"],
    ["Invoice Number", data.invoiceNumber || "N/A"],
    ["PO Number", data.poNumber || "N/A"],
    ["Issue Date", data.date || "N/A"],
    ["Due Date", data.dueDate || "N/A"],
    ["Province of Supply", data.province || "N/A"],
    ["Currency", data.currency || "CAD"],
    ["Language", data.language || "en"],
    [],
    ["Financials"],
    ["Subtotal", data.subtotal || 0],
    ["Tax Amount", data.tax || 0],
    ["Total Amount", data.total || 0],
    [],
    ["Vendor Details"],
    ["Name", data.vendorName || "N/A"],
    ["Address", data.vendorAddress || ""],
    ["GST/HST", data.vendorTaxNumbers?.gstHst || "N/A"],
  ];

  const content = rows.map((row) => row.map(escapeCSV).join(",")).join("\n");
  triggerDownload(content, `audit-summary-${data.invoiceNumber || "invoice"}.csv`, "text/csv");
};

export const exportItemsCSV = (data: AuditData) => {
  const headers = ["Description", "Quantity", "Unit Price", "Amount", "Taxability Group", "Tax Rate"];
  const rows = (data.items || []).map((item) => [
    escapeCSV(item.description),
    item.quantity ?? 1,
    item.unitPrice ?? 0,
    item.amount ?? 0,
    item.taxabilityGroup ?? "Taxable",
    `${(item.taxRate ?? 0) * 100}%`,
  ]);

  const content = [headers, ...rows].map((row) => row.join(",")).join("\n");
  triggerDownload(content, `audit-items-${data.invoiceNumber || "invoice"}.csv`, "text/csv");
};

export const exportJSON = (data: AuditData) => {
  triggerDownload(JSON.stringify(data, null, 2), `audit-report-${data.invoiceNumber || "invoice"}.json`, "application/json");
};

export const exportXML = (data: AuditData) => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<AuditReport>
  <InvoiceNumber>${escapeXML(data.invoiceNumber)}</InvoiceNumber>
  <Financials>
    <Subtotal>${data.subtotal || 0}</Subtotal>
    <Total>${data.total || 0}</Total>
  </Financials>
  <Items>
    ${(data.items || [])
      .map(
        (item) => `
    <Item>
      <Description>${escapeXML(item.description)}</Description>
      <Amount>${item.amount || 0}</Amount>
    </Item>`
      )
      .join("")}
  </Items>
</AuditReport>`;
  triggerDownload(xml, `audit-report-${data.invoiceNumber || "invoice"}.xml`, "application/xml");
};

export const exportIIF = (data: AuditData) => {
  const lines = [
    "!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO\tDUEDATE",
    `TRNS\t\tBILL\t${escapeIIF(data.date)}\tAccounts Payable\t${escapeIIF(data.vendorName)}\t-${data.total || 0}\t${escapeIIF(data.invoiceNumber)}\t${escapeIIF(data.summary)}\t${escapeIIF(data.dueDate)}`,
  ];

  (data.items || []).forEach((item) => {
    lines.push(`SPL\t\tBILL\t${escapeIIF(data.date)}\tTaxable Expense\t\t${item.amount}\t${escapeIIF(data.invoiceNumber)}\t${escapeIIF(item.description)}\t${item.quantity}\t${item.unitPrice}\t`);
  });

  lines.push("ENDTRNS");
  triggerDownload(lines.join("\r\n"), `audit-report-${data.invoiceNumber || "invoice"}.iif.txt`, "text/plain");
};

export const printReport = () => {
  window.print();
};