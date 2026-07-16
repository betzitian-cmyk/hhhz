import React, { useState } from "react";
import { ParsedInvoice } from "../types";
import { Copy, Check, Download, FileJson } from "lucide-react";

interface JSONViewerProps {
  invoice: ParsedInvoice;
}

export default function JSONViewer({ invoice }: JSONViewerProps) {
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(invoice, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy JSON text", err);
    }
  };

  const handleDownload = () => {
    try {
      const fileName = invoice.invoiceNumber 
        ? `invoice-${invoice.invoiceNumber}.json` 
        : "parsed-canadian-invoice.json";
        
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download JSON file", err);
    }
  };

  return (
    <div className="space-y-4 font-sans" id="json-viewer">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileJson className="w-4 h-4 text-emerald-600" />
          <span className="font-sans font-medium text-xs text-gray-400 uppercase tracking-wider">
            CRA/RQ Compliant JSON Output
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors cursor-pointer"
            title="Copy JSON to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-gray-400" /> Copy JSON
              </>
            )}
          </button>

          {/* Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors cursor-pointer"
            title="Download JSON file"
          >
            <Download className="w-3.5 h-3.5" /> Download File
          </button>
        </div>
      </div>

      <div className="relative border border-gray-100 rounded-xl overflow-hidden bg-gray-900 shadow-sm">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-950 border-b border-gray-800 text-[10px] text-gray-500 font-mono">
          <span>PARSED_INVOICE_SCHEMA.JSON</span>
          <span>JSON FORMAT</span>
        </div>
        <pre className="p-4 overflow-auto max-h-[600px] text-[11px] font-mono text-gray-300 leading-relaxed scrollbar-thin">
          <code>{jsonString}</code>
        </pre>
      </div>
    </div>
  );
}
