import React from "react";
import { ParsedInvoice, VendorTaxNumbers, TaxBreakdownValue } from "../types";
import { MapPin, Receipt, Calendar, FileText, Landmark, CircleDollarSign } from "lucide-react";

interface InvoiceFormProps {
  invoice: ParsedInvoice;
  onChange: (updatedInvoice: ParsedInvoice) => void;
}

export default function InvoiceForm({ invoice, onChange }: InvoiceFormProps) {
  
  const handleFieldChange = (field: keyof ParsedInvoice, value: any) => {
    const updated = { ...invoice, [field]: value };
    onChange(updated);
  };

  const handleTaxNumbersChange = (field: keyof VendorTaxNumbers, value: any) => {
    const updatedTaxNumbers = { 
      ...(invoice.vendorTaxNumbers || { businessNumber: null, gstHst: null, qst: null, pst: null, rst: null }),
      [field]: value === "" ? null : value 
    };
    onChange({ ...invoice, vendorTaxNumbers: updatedTaxNumbers });
  };

  const handleTaxBreakdownChange = (field: keyof TaxBreakdownValue, value: any) => {
    const val = value === "" ? null : Number(value);
    const updatedBreakdown = {
      ...(invoice.taxBreakdown || { gst: null, pst: null, hst: null, qst: null, rst: null }),
      [field]: val
    };
    
    // Automatically recalculate total tax when components change
    const sum = 
      (updatedBreakdown.gst ?? 0) + 
      (updatedBreakdown.pst ?? 0) + 
      (updatedBreakdown.hst ?? 0) + 
      (updatedBreakdown.qst ?? 0) + 
      (updatedBreakdown.rst ?? 0);

    onChange({ 
      ...invoice, 
      taxBreakdown: updatedBreakdown,
      tax: Number(sum.toFixed(2))
    });
  };

  // Helper to pre-calculate standard tax rates based on the chosen province
  const applyStandardProvinceTax = () => {
    const prov = invoice.province;
    if (!prov) return;

    const sub = invoice.subtotal ?? 0;
    let gst = null;
    let pst = null;
    let hst = null;
    let qst = null;
    let rst = null;
    let group = "";

    switch (prov) {
      case "AB": case "NT": case "NU": case "YT":
        gst = Number((sub * 0.05).toFixed(2));
        group = "GST";
        break;
      case "BC":
        gst = Number((sub * 0.05).toFixed(2));
        pst = Number((sub * 0.07).toFixed(2));
        group = "GST+PST";
        break;
      case "MB":
        gst = Number((sub * 0.05).toFixed(2));
        rst = Number((sub * 0.07).toFixed(2));
        group = "GST+RST";
        break;
      case "SK":
        gst = Number((sub * 0.05).toFixed(2));
        pst = Number((sub * 0.06).toFixed(2));
        group = "GST+PST";
        break;
      case "QC":
        gst = Number((sub * 0.05).toFixed(2));
        qst = Number((sub * 0.09975).toFixed(2));
        group = "GST+QST";
        break;
      case "ON":
        hst = Number((sub * 0.13).toFixed(2));
        group = "HST";
        break;
      case "NS":
        hst = Number((sub * 0.14).toFixed(2));
        group = "HST";
        break;
      case "NB": case "NL": case "PE":
        hst = Number((sub * 0.15).toFixed(2));
        group = "HST";
        break;
    }

    const totalTax = Number(((gst ?? 0) + (pst ?? 0) + (hst ?? 0) + (qst ?? 0) + (rst ?? 0)).toFixed(2));
    const total = Number((sub + totalTax).toFixed(2));

    onChange({
      ...invoice,
      taxGroup: group,
      taxBreakdown: { gst, pst, hst, qst, rst },
      tax: totalTax,
      total: total
    });
  };

  const provinces = [
    { code: "AB", name: "Alberta (5% GST)" },
    { code: "BC", name: "British Columbia (5% GST + 7% PST)" },
    { code: "MB", name: "Manitoba (5% GST + 7% RST)" },
    { code: "NB", name: "New Brunswick (15% HST)" },
    { code: "NL", name: "Newfoundland & Labrador (15% HST)" },
    { code: "NS", name: "Nova Scotia (14% HST)" },
    { code: "ON", name: "Ontario (13% HST)" },
    { code: "PE", name: "Prince Edward Island (15% HST)" },
    { code: "QC", name: "Québec (5% GST + 9.975% QST)" },
    { code: "SK", name: "Saskatchewan (5% GST + 6% PST)" },
    { code: "NT", name: "Northwest Territories (5% GST)" },
    { code: "NU", name: "Nunavut (5% GST)" },
    { code: "YT", name: "Yukon (5% GST)" }
  ];

  const taxNumbers = invoice.vendorTaxNumbers || { businessNumber: "", gstHst: "", qst: "", pst: "", rst: "" };
  const breakdown = invoice.taxBreakdown || { gst: null, pst: null, hst: null, qst: null, rst: null };

  return (
    <div className="space-y-6 font-sans text-xs text-gray-800" id="invoice-form">
      
      {/* 1. DOCUMENT IDENTIFICATION & GENERAL */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-50 pb-2">
          <FileText className="w-4 h-4 text-emerald-600" />
          <h3 className="font-sans font-semibold text-gray-900 text-sm">General Document Metadata</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-gray-400 font-medium mb-1 font-sans">Invoice Number (Facture N°)</label>
            <input
              type="text"
              value={invoice.invoiceNumber ?? ""}
              onChange={(e) => handleFieldChange("invoiceNumber", e.target.value === "" ? null : e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
              placeholder="F-2026-XXXX"
            />
          </div>

          <div>
            <label className="block text-gray-400 font-medium mb-1 font-sans">PO Number (Bon de Commande)</label>
            <input
              type="text"
              value={invoice.poNumber ?? ""}
              onChange={(e) => handleFieldChange("poNumber", e.target.value === "" ? null : e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
              placeholder="PO-XXXXXX"
            />
          </div>

          <div>
            <label className="block text-gray-400 font-medium mb-1 font-sans">Language Code</label>
            <select
              value={invoice.language}
              onChange={(e) => handleFieldChange("language", e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
            >
              <option value="en">English (en)</option>
              <option value="fr">French (fr)</option>
              <option value="mixed">Mixed Bilingual (mixed)</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-400 font-medium mb-1 font-sans">Document Date (Tax Point)</label>
            <input
              type="date"
              value={invoice.date ?? ""}
              onChange={(e) => handleFieldChange("date", e.target.value === "" ? null : e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-gray-400 font-medium mb-1 font-sans">Due Date (Échéance)</label>
            <input
              type="date"
              value={invoice.dueDate ?? ""}
              onChange={(e) => handleFieldChange("dueDate", e.target.value === "" ? null : e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-gray-400 font-medium mb-1 font-sans">Payment Terms</label>
            <input
              type="text"
              value={invoice.paymentTerms ?? ""}
              onChange={(e) => handleFieldChange("paymentTerms", e.target.value === "" ? null : e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Net 30, Due on Receipt"
            />
          </div>
        </div>
      </div>

      {/* 2. PLACE OF SUPPLY & STATE REGISTRY IDENTIFIERS */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-50 pb-2">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-emerald-600" />
            <h3 className="font-sans font-semibold text-gray-900 text-sm">Place of Supply & CRA Compliance Registries</h3>
          </div>
          {invoice.province && (
            <button
              type="button"
              onClick={applyStandardProvinceTax}
              className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              Recompute Standard Tax For {invoice.province}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-gray-400 font-medium mb-1 font-sans">Place of Supply (Province)</label>
            <select
              value={invoice.province ?? ""}
              onChange={(e) => handleFieldChange("province", e.target.value === "" ? null : e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
            >
              <option value="">-- Select Province --</option>
              {provinces.map((p) => (
                <option key={p.code} value={p.code}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-400 font-medium mb-1 font-sans">9-Digit Business Number (NE)</label>
            <input
              type="text"
              value={taxNumbers.businessNumber ?? ""}
              onChange={(e) => handleTaxNumbersChange("businessNumber", e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
              placeholder="123456789"
            />
          </div>

          <div>
            <label className="block text-gray-400 font-medium mb-1 font-sans">CRA GST/HST Registration (RT0001)</label>
            <input
              type="text"
              value={taxNumbers.gstHst ?? ""}
              onChange={(e) => handleTaxNumbersChange("gstHst", e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono font-medium"
              placeholder="123456789RT0001"
            />
          </div>

          <div>
            <label className="block text-gray-400 font-medium mb-1 font-sans">Revenu Québec QST Number (TQ0001)</label>
            <input
              type="text"
              value={taxNumbers.qst ?? ""}
              onChange={(e) => handleTaxNumbersChange("qst", e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
              placeholder="1234567890TQ0001"
              disabled={invoice.province !== "QC"}
            />
          </div>

          <div>
            <label className="block text-gray-400 font-medium mb-1 font-sans">PST Number (BC, SK, etc.)</label>
            <input
              type="text"
              value={taxNumbers.pst ?? ""}
              onChange={(e) => handleTaxNumbersChange("pst", e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
              placeholder="PST-XXXXXX"
            />
          </div>

          <div>
            <label className="block text-gray-400 font-medium mb-1 font-sans">Tax Group String</label>
            <input
              type="text"
              value={invoice.taxGroup ?? ""}
              onChange={(e) => handleFieldChange("taxGroup", e.target.value === "" ? null : e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
              placeholder="GST+QST"
            />
          </div>
        </div>
      </div>

      {/* 3. BUSINESS TRADING PARTIES */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="flex items-center gap-2 border-b border-gray-50 pb-2 mb-3">
          <MapPin className="w-4 h-4 text-emerald-600" />
          <h3 className="font-sans font-semibold text-gray-900 text-sm">Trading Parties</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-sans font-medium text-gray-700 text-[11px] uppercase tracking-wider">Vendor (Seller)</h4>
            <div>
              <label className="block text-gray-400 mb-0.5">Company Name</label>
              <input
                type="text"
                value={invoice.vendorName ?? ""}
                onChange={(e) => handleFieldChange("vendorName", e.target.value === "" ? null : e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-200 rounded focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                placeholder="Vendor Ltd."
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-0.5">Address</label>
              <textarea
                value={invoice.vendorAddress ?? ""}
                onChange={(e) => handleFieldChange("vendorAddress", e.target.value === "" ? null : e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-200 rounded focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 h-16 resize-none"
                placeholder="Vendor physical location..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-sans font-medium text-gray-700 text-[11px] uppercase tracking-wider">Customer (Purchaser)</h4>
            <div>
              <label className="block text-gray-400 mb-0.5">Company/Client Name</label>
              <input
                type="text"
                value={invoice.customerName ?? ""}
                onChange={(e) => handleFieldChange("customerName", e.target.value === "" ? null : e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-200 rounded focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                placeholder="Customer Inc."
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-0.5">Address</label>
              <textarea
                value={invoice.customerAddress ?? ""}
                onChange={(e) => handleFieldChange("customerAddress", e.target.value === "" ? null : e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-200 rounded focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 h-16 resize-none"
                placeholder="Customer physical location..."
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. FINANCIAL TOTALS & TAX COMPONENT BREAKDOWN */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-50 pb-2">
          <CircleDollarSign className="w-4 h-4 text-emerald-600" />
          <h3 className="font-sans font-semibold text-gray-900 text-sm">Financial Summaries & Component Tax Audit</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Main Totals */}
          <div className="space-y-3 p-3 bg-gray-50/50 rounded-lg border border-gray-100">
            <h4 className="font-sans font-medium text-gray-700 text-[10px] uppercase tracking-wider">Aggregated Totals</h4>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-gray-400 mb-0.5">Currency</label>
                <input
                  type="text"
                  value={invoice.currency ?? "CAD"}
                  onChange={(e) => handleFieldChange("currency", e.target.value === "" ? null : e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded bg-white focus:border-emerald-500 font-mono text-center"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-0.5">Subtotal</label>
                <input
                  type="number"
                  value={invoice.subtotal ?? ""}
                  onChange={(e) => handleFieldChange("subtotal", e.target.value === "" ? null : Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded bg-white focus:border-emerald-500 font-mono font-medium"
                  step="any"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-0.5">Zero-Rated Subtotal</label>
                <input
                  type="number"
                  value={invoice.zeroRatedSubtotal ?? ""}
                  onChange={(e) => handleFieldChange("zeroRatedSubtotal", e.target.value === "" ? null : Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded bg-white focus:border-emerald-500 font-mono"
                  step="any"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-0.5">Exempt Subtotal</label>
                <input
                  type="number"
                  value={invoice.exemptSubtotal ?? ""}
                  onChange={(e) => handleFieldChange("exemptSubtotal", e.target.value === "" ? null : Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded bg-white focus:border-emerald-500 font-mono"
                  step="any"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-0.5">Total Combined Tax</label>
                <input
                  type="number"
                  value={invoice.tax ?? ""}
                  onChange={(e) => handleFieldChange("tax", e.target.value === "" ? null : Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded bg-white focus:border-emerald-500 font-mono"
                  step="any"
                />
              </div>

              <div>
                <label className="block text-rose-500 font-semibold mb-0.5">Grand Total</label>
                <input
                  type="number"
                  value={invoice.total ?? ""}
                  onChange={(e) => handleFieldChange("total", e.target.value === "" ? null : Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-rose-200 rounded bg-rose-50/50 focus:border-rose-500 font-mono font-bold text-rose-900"
                  step="any"
                />
              </div>
            </div>
          </div>

          {/* Tax Breakdown Component Split */}
          <div className="space-y-3 p-3 bg-gray-50/50 rounded-lg border border-gray-100">
            <h4 className="font-sans font-medium text-gray-700 text-[10px] uppercase tracking-wider">CRA / Provincial Breakdown Components</h4>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-gray-400 mb-0.5">GST (5% Fed Tax)</label>
                <input
                  type="number"
                  value={breakdown.gst ?? ""}
                  onChange={(e) => handleTaxBreakdownChange("gst", e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded bg-white focus:border-emerald-500 font-mono"
                  placeholder="0.00"
                  step="any"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-0.5">QST (9.975% Québec)</label>
                <input
                  type="number"
                  value={breakdown.qst ?? ""}
                  onChange={(e) => handleTaxBreakdownChange("qst", e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded bg-white focus:border-emerald-500 font-mono"
                  placeholder="0.00"
                  disabled={invoice.province !== "QC"}
                  step="any"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-0.5">HST (Combined Maritimes/ON)</label>
                <input
                  type="number"
                  value={breakdown.hst ?? ""}
                  onChange={(e) => handleTaxBreakdownChange("hst", e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded bg-white focus:border-emerald-500 font-mono"
                  placeholder="0.00"
                  step="any"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-0.5">PST (BC / SK / MB Provincial)</label>
                <input
                  type="number"
                  value={breakdown.pst ?? ""}
                  onChange={(e) => handleTaxBreakdownChange("pst", e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded bg-white focus:border-emerald-500 font-mono"
                  placeholder="0.00"
                  step="any"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-gray-400 mb-0.5">RST (Manitoba Retail Tax)</label>
                <input
                  type="number"
                  value={breakdown.rst ?? ""}
                  onChange={(e) => handleTaxBreakdownChange("rst", e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded bg-white focus:border-emerald-500 font-mono"
                  placeholder="0.00"
                  step="any"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
