import React, { useState, useEffect, useRef } from "react";
import { ParsedInvoice, ComplianceReport } from "./types";
import { generateComplianceReport } from "./utils/compliance";
import { motion, AnimatePresence } from "motion/react";

import ComplianceViewer from "./components/ComplianceViewer";
import LineItemsTable from "./components/LineItemsTable";
import InvoiceForm from "./components/InvoiceForm";
import JSONViewer from "./components/JSONViewer";

import { 
  Upload, 
  Sparkles, 
  RefreshCw, 
  AlertCircle, 
  HelpCircle, 
  BookOpen, 
  Languages, 
  Activity, 
  ShieldCheck, 
  CheckCircle,
  FileCheck2,
  FileCode2,
  FileSpreadsheet,
  Download,
  ChevronDown,
  Printer,
  FileJson,
  FileText,
  CheckCheck,
  Search,
  Loader2,
  FileUp,
  Receipt,
  ClipboardList
} from "lucide-react";

import {
  exportSummaryCSV,
  exportItemsCSV,
  exportJSON,
  exportXML,
  exportIIF,
  printReport
} from "../export";

import applechaiLogo from "./assets/images/applechai_logo_1784166084722.jpg";

// Utility to map Zod parsed data (with null values) to looser export types (with undefined values)
function toAuditData(invoice: ParsedInvoice | null): any {
  if (!invoice) return null;
  const mapValue = <T,>(val: T | null | undefined): T | undefined => (val === null ? undefined : val);
  
  return {
    invoiceNumber: mapValue(invoice.invoiceNumber),
    poNumber: mapValue(invoice.poNumber),
    date: mapValue(invoice.date),
    dueDate: mapValue(invoice.dueDate),
    province: mapValue(invoice.province),
    currency: mapValue(invoice.currency),
    language: mapValue(invoice.language),
    subtotal: mapValue(invoice.subtotal),
    zeroRatedSubtotal: mapValue(invoice.zeroRatedSubtotal),
    exemptSubtotal: mapValue(invoice.exemptSubtotal),
    tax: mapValue(invoice.tax),
    total: mapValue(invoice.total),
    taxBreakdown: invoice.taxBreakdown ? {
      gst: mapValue(invoice.taxBreakdown.gst),
      pst: mapValue(invoice.taxBreakdown.pst),
      hst: mapValue(invoice.taxBreakdown.hst),
      qst: mapValue(invoice.taxBreakdown.qst),
      rst: mapValue(invoice.taxBreakdown.rst),
    } : undefined,
    vendorName: mapValue(invoice.vendorName),
    vendorAddress: mapValue(invoice.vendorAddress),
    vendorTaxNumbers: invoice.vendorTaxNumbers ? {
      businessNumber: mapValue(invoice.vendorTaxNumbers.businessNumber),
      gstHst: mapValue(invoice.vendorTaxNumbers.gstHst),
      qst: mapValue(invoice.vendorTaxNumbers.qst),
      pst: mapValue(invoice.vendorTaxNumbers.pst),
    } : undefined,
    customerName: mapValue(invoice.customerName),
    customerAddress: mapValue(invoice.customerAddress),
    summary: mapValue(invoice.summary),
    items: invoice.items?.map((item) => ({
      description: mapValue(item.description),
      quantity: mapValue(item.quantity),
      unitPrice: mapValue(item.unitPrice),
      amount: mapValue(item.amount),
      taxabilityGroup: mapValue(item.taxabilityGroup),
      taxRate: mapValue(item.taxRate),
    })),
  };
}

export default function App() {
  const [activeInvoice, setActiveInvoice] = useState<ParsedInvoice | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string>("");
  
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parsingMessage, setParsingMessage] = useState<string>("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"compliance" | "lines" | "general" | "json">("compliance");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressTimerRef = useRef<any>(null);

  // Live Registry & Actions state
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false);

  // Clear verification when activeInvoice changes to prevent showing old lookup results
  useEffect(() => {
    setVerificationResult(null);
  }, [activeInvoice?.invoiceNumber, activeInvoice?.vendorTaxNumbers?.gstHst, activeInvoice?.vendorTaxNumbers?.qst]);

  // Auto-verify tax when an invoice is successfully parsed
  useEffect(() => {
    if (activeInvoice && (activeInvoice.vendorTaxNumbers?.gstHst || activeInvoice.vendorTaxNumbers?.qst)) {
      handleVerifyTax();
    }
  }, [activeInvoice]);

  const handleVerifyTax = async () => {
    if (!activeInvoice) return;
    setIsVerifying(true);
    try {
      const response = await fetch("/api/verify-tax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gst: activeInvoice.vendorTaxNumbers?.gstHst || null,
          qst: activeInvoice.vendorTaxNumbers?.qst || null,
        }),
      });
      if (!response.ok) {
        throw new Error(`Verification service returned status ${response.status}`);
      }
      const data = await response.json();
      setVerificationResult(data);
    } catch (err: any) {
      console.error("[Registry Verification Error]", err);
      alert("Live Tax Registry Lookup failed: " + err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  // Animated progressive messages to show during Gemini extraction
  const progressMessages = [
    "Establishing secure full-stack connection...",
    "Sending document to Gemini 3.5 Flash server-side engine...",
    "Performing Optical Document Text alignment & layout analysis...",
    "Extracting trading party addresses and bilingual lexicons...",
    "Resolving French localized headers into standardized keys...",
    "Mapping place of supply to 2026 provincial tax standards...",
    "Splitting combined tax streams into separate GST and QST components...",
    "Validating mathematical subtotal aggregates and rounding limits (±$0.02)...",
    "Running CRA and Revenu Québec compliance rules verification...",
    "Structuring perfect, compliant Zod JSON output..."
  ];

  // Recalculate compliance report in real-time whenever the activeInvoice is edited
  const complianceReport: ComplianceReport | null = activeInvoice ? generateComplianceReport(activeInvoice) : null;
  const complianceScore = complianceReport 
    ? (complianceReport.checks.length > 0 
        ? Math.round((complianceReport.passedCount / complianceReport.checks.length) * 100) 
        : 100) 
    : 100;

  // Drag and Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const validTypes = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
      if (!validTypes.includes(droppedFile.type)) {
        setParseError("Supported formats are PNG, JPEG, and PDF documents.");
        return;
      }
      setFile(droppedFile);
      setParseError(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const validTypes = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
      if (!validTypes.includes(selectedFile.type)) {
        setParseError("Supported formats are PNG, JPEG, and PDF documents.");
        return;
      }
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setParseError(null);
    }
  };

  const handleUpload = () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = (reader.result as string).split(",")[1];
      triggerParse(base64String, file.type, file.name);
    };
    reader.onerror = () => {
      setParseError("Could not read selected file.");
    };
    reader.readAsDataURL(file);
  };

  // Cycle progressive loading messages
  const startProgressCycle = () => {
    let index = 0;
    setParsingMessage(progressMessages[0]);
    
    progressTimerRef.current = setInterval(() => {
      index = (index + 1) % progressMessages.length;
      setParsingMessage(progressMessages[index]);
    }, 2800);
  };

  const stopProgressCycle = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopProgressCycle();
  }, []);

  const getEstimatedProgress = (msg: string): number => {
    const text = msg.toLowerCase();
    if (!text) return 5;
    if (text.includes("securing") || text.includes("establishing") || text.includes("uploading")) return 10;
    if (text.includes("analyzing") || text.includes("layout")) return 20;
    if (text.includes("routing")) return 35;
    if (text.includes("sending") || text.includes("docling") || text.includes("structure extraction")) return 48;
    if (text.includes("extraction complete")) return 58;
    if (text.includes("strict extraction") || text.includes("relaxed ocr") || text.includes("parallel llm") || text.includes("groq")) return 72;
    if (text.includes("openrouter")) return 82;
    if (text.includes("gemini fallback") || text.includes("gemini extraction")) return 88;
    if (text.includes("winner") || text.includes("successfully parsed") || text.includes("parsing loose") || text.includes("sanitizing")) return 94;
    if (text.includes("applying")) return 98;
    return 15;
  };

  // API Call to parse-invoice via server-side Gemini Proxy
  const triggerParse = async (base64?: string, mimeType?: string, fileName?: string) => {
    setIsParsing(true);
    setParseError(null);
    setParsingMessage("Establishing secure link and uploading document...");

    try {
      const response = await fetch("/api/parse-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: rawText,
          file: base64 ? { base64, mimeType } : undefined
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to read the progress stream from the server.");
      }

      const decoder = new TextDecoder("utf-8");
      let finished = false;
      let buffer = "";
      let result: ParsedInvoice | null = null;

      while (!finished) {
        const { value, done } = await reader.read();
        finished = done;
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            let cleanLine = trimmed;
            if (trimmed.startsWith("data:")) {
              cleanLine = trimmed.replace(/^data:\s*/, "").trim();
            }

            let parsedPacket: any = null;
            try {
              parsedPacket = JSON.parse(cleanLine);
            } catch (e) {
              console.warn("Could not parse JSON packet:", cleanLine, e);
              continue;
            }

            if (parsedPacket) {
              if (parsedPacket.type === "progress") {
                setParsingMessage(parsedPacket.message);
              } else if (parsedPacket.type === "result") {
                result = parsedPacket.data;
              } else if (parsedPacket.type === "error") {
                throw new Error(parsedPacket.message);
              }
            }
          }
        }
      }

      // Check residual buffer
      if (buffer.trim()) {
        let cleanLine = buffer.trim();
        if (cleanLine.startsWith("data:")) {
          cleanLine = cleanLine.replace(/^data:\s*/, "").trim();
        }
        let parsedPacket: any = null;
        try {
          parsedPacket = JSON.parse(cleanLine);
        } catch {}

        if (parsedPacket) {
          if (parsedPacket.type === "progress") {
            setParsingMessage(parsedPacket.message);
          } else if (parsedPacket.type === "result") {
            result = parsedPacket.data;
          } else if (parsedPacket.type === "error") {
            throw new Error(parsedPacket.message);
          }
        }
      }

      if (!result) {
        throw new Error("Pipeline connection closed before extraction could be completed.");
      }
      
      // Update UI state
      setActiveInvoice(result);
      
      if (base64 && fileName) {
        setRawText(`[Uploaded Document: ${fileName}]\n\nExtraction completed. Check parsed line items and compliance details in the right panel.`);
      }
      
      // Auto-switch to compliance tab on successful parse
      setActiveTab("compliance");

    } catch (err: any) {
      console.error(err);
      setParseError(err.message || "An error occurred while calling the Gemini parser endpoint.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleRawTextParse = () => {
    if (!rawText.trim()) {
      setParseError("Invoice raw text input cannot be empty.");
      return;
    }
    triggerParse();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-slate-200" id="app-root">
      
      {/* HEADER BAR */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 print:hidden" id="app-header">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src={applechaiLogo} 
              alt="Logo" 
              className="h-10 w-auto object-contain rounded-lg" 
              referrerPolicy="no-referrer" 
            />
            <div className="hidden sm:block border-l border-slate-200 h-8" />
            <div>
              <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none mb-1">
                Canadian <span className="text-rose-600">Audit</span> Hub
              </h1>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest leading-none">
                Compliance & Extraction
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> 2026 Tax Rules Active</span>
            </div>
            <button 
              onClick={() => { setActiveInvoice(null); setFile(null); setPreviewUrl(null); setRawText(""); }} 
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <RefreshCw size={14} />
              Reset Workspace
            </button>
          </div>
        </div>
      </header>

      {/* WORKSPACE LAYOUT */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 print:p-0 print:py-4" id="app-workspace">
        {!activeInvoice && !isParsing ? (
          <div className="max-w-4xl mx-auto w-full space-y-12 py-12" id="landing-view">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 bg-rose-50 border border-rose-100 text-rose-800 text-[11px] font-semibold px-4 py-1.5 rounded-full">
                <ShieldCheck size={14} className="text-rose-600" />
                <span>CRA & Revenu Québec Compliance Engine</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight font-sans">
                Canadian Document <span className="text-rose-600">Intelligence</span> Hub
              </h1>
              <p className="text-slate-500 text-sm max-w-2xl mx-auto leading-relaxed font-sans">
                Professional-grade optical extraction for Canadian invoices. Resolves bilingual lexicons, provincial tax groups, and 2026 place-of-supply compliance rules automatically.
              </p>
            </div>

            <div className="bg-white p-8 rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-200 grid md:grid-cols-2 gap-12 relative overflow-hidden" id="upload-landing">
              <div className="absolute top-0 right-0 w-64 h-64 bg-rose-50 rounded-full -mr-32 -mt-32 opacity-20 blur-3xl pointer-events-none" />
              
              <div className="space-y-6 relative">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileUp size={20} className="text-rose-500" />
                  Primary Document Load
                </h2>
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`group relative border-2 border-dashed rounded-2xl p-10 transition-all text-center cursor-pointer select-none ${
                    dragActive 
                      ? "border-rose-500 bg-rose-50/50 scale-[0.99]" 
                      : "border-slate-200 hover:border-slate-400 hover:bg-slate-50/50"
                  }`}
                >
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept=".pdf,.jpg,.jpeg,.png" 
                  />
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-slate-100 group-hover:bg-rose-100 rounded-2xl flex items-center justify-center mb-4 transition-colors">
                      <Receipt size={32} className="text-slate-400 group-hover:text-rose-500 transition-colors" />
                    </div>
                    <p className="text-sm font-bold text-slate-900 mb-1">
                      {file ? file.name : "Drop invoice here or click to browse"}
                    </p>
                    <p className="text-xs text-slate-400">PDF, PNG or JPG (Max 10MB)</p>
                  </div>
                </div>

                <button 
                  onClick={handleUpload} 
                  disabled={!file || isParsing} 
                  className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold disabled:bg-slate-100 disabled:text-slate-400 transition-all flex items-center justify-center gap-3 cursor-pointer shadow-lg shadow-slate-200 active:scale-[0.98]"
                >
                  <Sparkles size={18} />
                  Initiate Optical Extraction
                </button>
              </div>

              <div className="space-y-6 border-t md:border-t-0 md:border-l border-slate-100 pt-8 md:pt-0 md:pl-12">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileText size={20} className="text-slate-400" />
                  Audit Text Stream
                </h2>
                <div className="flex flex-col h-full space-y-4">
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Paste raw OCR text or email transcript here..."
                    className="w-full flex-grow min-h-[200px] p-4 border border-slate-200 rounded-2xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-300 bg-slate-50/30 resize-none leading-relaxed"
                  />
                  <button 
                    onClick={handleRawTextParse} 
                    disabled={!rawText.trim() || isParsing} 
                    className="w-full py-3 border-2 border-slate-900 text-slate-900 hover:bg-slate-50 rounded-2xl font-bold disabled:border-slate-200 disabled:text-slate-300 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                  >
                    Parse Raw Text
                  </button>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {[
                { icon: ShieldCheck, title: "Registry Verification", desc: "Live checks against GST/HST and QST business registries." },
                { icon: Languages, title: "Bilingual Engine", desc: "Native support for English and French invoice lexicons." },
                { icon: FileCheck2, title: "Compliance Ready", desc: "Validates against 2026 CRA place-of-supply tax rules." }
              ].map((feature, i) => (
                <div key={i} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
                  <feature.icon className="w-6 h-6 text-rose-500 mb-3" />
                  <h3 className="text-sm font-bold text-slate-900 mb-1">{feature.title}</h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6" id="dashboard-view">
            
            {/* LEFT PANE: DOCUMENT PREVIEW & SUMMARY */}
            <div className="flex flex-col gap-6 h-full print:hidden">
              
              {/* Document Preview */}
              <div className="flex-grow bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col relative" id="document-preview">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-600 flex items-center gap-2 uppercase tracking-wider">
                    <BookOpen size={14} />
                    Document Source
                  </h3>
                  {file && (
                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">{file.name}</span>
                  )}
                </div>
                
                <div className="flex-grow overflow-auto p-4 bg-slate-100/50 flex items-center justify-center relative">
                  {isParsing ? (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-8 text-center">
                       <div className="relative mb-6">
                        <div className="w-16 h-16 border-4 border-slate-100 border-t-rose-500 rounded-full animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="font-bold text-xs text-rose-600 font-mono">CA</span>
                        </div>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm tracking-tight mb-2">Analyzing Document...</h3>
                      <p className="text-[11px] text-slate-500 max-w-[200px] font-mono leading-relaxed h-[40px]">
                        {parsingMessage}
                      </p>
                      <div className="w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-6">
                        <motion.div 
                          className="h-full bg-rose-500 rounded-full"
                          initial={{ width: "5%" }}
                          animate={{ width: `${getEstimatedProgress(parsingMessage)}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {previewUrl ? (
                    file?.type === "application/pdf" ? (
                      <iframe src={previewUrl} className="w-full h-full rounded-lg border border-slate-200 hidden" title="PDF Preview" />
                    ) : (
                      <img src={previewUrl} className="max-w-full h-auto shadow-lg rounded-lg" alt="Invoice Preview" />
                    )
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-white rounded-3xl shadow-sm flex items-center justify-center mx-auto">
                        <FileText size={24} className="text-slate-200" />
                      </div>
                      <p className="text-xs text-slate-400 font-sans italic">Text extraction mode (No file preview)</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Summary Card */}
              <div className="bg-slate-900 text-slate-300 p-6 rounded-3xl shadow-xl shadow-slate-200 space-y-5" id="financial-summary">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-white text-[11px] uppercase tracking-widest flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-rose-500" />
                    Audit Summary
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] bg-rose-500/10 text-rose-400 font-mono font-bold px-2 py-0.5 rounded border border-rose-500/20">
                      {activeInvoice?.currency || "CAD"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Total Payable</span>
                    <div className="text-2xl font-extrabold text-white">
                      {activeInvoice?.total !== null ? `$${activeInvoice?.total.toFixed(2)}` : "—"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Tax Recoverable</span>
                    <div className="text-2xl font-extrabold text-rose-400">
                      {activeInvoice?.tax !== null ? `$${activeInvoice?.tax.toFixed(2)}` : "—"}
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-slate-800/50">
                   <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Tax Group:</span>
                    <span className="font-bold text-slate-200">
                      {activeInvoice?.taxGroup || "Standard (GST)"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Compliance:</span>
                    <span className={`font-bold ${complianceScore >= 90 ? "text-emerald-400" : "text-amber-400"}`}>
                      {complianceScore}% Pass
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT PANE: DATA EXPLORER */}
            <div className="flex flex-col h-full bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm" id="data-explorer">
              
              {/* Tab Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30 flex-wrap gap-4">
                <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-2xs">
                  {[
                    { id: "compliance", icon: Activity, label: "Audit" },
                    { id: "lines", icon: FileSpreadsheet, label: "Lines" },
                    { id: "general", icon: FileCheck2, label: "General" },
                    { id: "json", icon: FileCode2, label: "JSON" }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                        activeTab === tab.id
                          ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                          : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                      }`}
                    >
                      <tab.icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                   {/* Export Actions Dropdown */}
                   <div className="relative">
                        <button
                          type="button"
                          onClick={() => setExportMenuOpen(!exportMenuOpen)}
                          className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2 cursor-pointer shadow-2xs active:scale-[0.98]"
                        >
                          <Download className="w-4 h-4 text-slate-400" />
                          <span>Export Results</span>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
                        </button>

                        {exportMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />
                            <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-100 bg-white p-2 shadow-2xl z-50 ring-1 ring-slate-900/5">
                              <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-1">
                                Download Formats
                              </div>
                              
                              {[
                                { icon: FileText, color: "text-blue-500", label: "CSV Summary", desc: "Totals & Metadata", action: () => exportSummaryCSV(toAuditData(activeInvoice)) },
                                { icon: FileSpreadsheet, color: "text-emerald-500", label: "CSV Line Items", desc: "Itemized transactions", action: () => exportItemsCSV(toAuditData(activeInvoice)) },
                                { icon: FileJson, color: "text-amber-500", label: "JSON Raw Data", desc: "Full schema dump", action: () => exportJSON(toAuditData(activeInvoice)) },
                                { icon: FileCode2, color: "text-purple-500", label: "XML Standard", desc: "Structured XML", action: () => exportXML(toAuditData(activeInvoice)) },
                                { icon: RefreshCw, color: "text-indigo-500", label: "QuickBooks IIF", desc: "Desktop Import", action: () => exportIIF(toAuditData(activeInvoice)) },
                              ].map((item, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => { item.action(); setExportMenuOpen(false); }}
                                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 flex items-center gap-3 transition-colors cursor-pointer group"
                                >
                                  <div className={`p-2 rounded-lg bg-white border border-slate-100 shadow-3xs group-hover:shadow-sm transition-all`}>
                                    <item.icon className={`w-4 h-4 ${item.color}`} />
                                  </div>
                                  <div>
                                    <div className="text-[11px] font-bold text-slate-900">{item.label}</div>
                                    <div className="text-[9px] text-slate-400">{item.desc}</div>
                                  </div>
                                </button>
                              ))}

                              <div className="border-t border-slate-100 my-2" />

                              <button
                                onClick={() => { printReport(); setExportMenuOpen(false); }}
                                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-rose-50 flex items-center gap-3 transition-colors cursor-pointer group"
                              >
                                <div className="p-2 rounded-lg bg-rose-50 border border-rose-100">
                                  <Printer className="w-4 h-4 text-rose-500" />
                                </div>
                                <div>
                                  <div className="text-[11px] font-bold text-rose-900 font-sans">Print PDF Report</div>
                                  <div className="text-[9px] text-rose-400">Formal Audit Layout</div>
                                </div>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-grow overflow-auto p-6 bg-white border border-slate-200 rounded-3xl shadow-sm" id="active-tab-content">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTab === "compliance" && activeInvoice && complianceReport && (
                      <ComplianceViewer 
                        report={complianceReport} 
                        verificationResult={verificationResult}
                        onVerify={handleVerifyTax}
                        isVerifying={isVerifying}
                        vendorTaxNumbers={activeInvoice.vendorTaxNumbers}
                      />
                    )}
                    
                    {activeTab === "lines" && activeInvoice && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 text-rose-500" />
                            Extracted Line Transactions
                          </h2>
                          <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                            {activeInvoice.items.length} Items Found ({activeInvoice.currency || "CAD"})
                          </div>
                        </div>
                        <LineItemsTable 
                          items={activeInvoice.items} 
                          onChange={(updatedItems) => setActiveInvoice({ ...activeInvoice, items: updatedItems })} 
                        />
                      </div>
                    )}
                    
                    {activeTab === "general" && activeInvoice && (
                      <InvoiceForm 
                        invoice={activeInvoice} 
                        onChange={(updated) => setActiveInvoice(updated)} 
                      />
                    )}
                    
                    {activeTab === "json" && activeInvoice && (
                      <JSONViewer invoice={activeInvoice} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* FOOTER SECTION */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-8 px-6 text-slate-500 text-xs font-sans shrink-0" id="instructions">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Languages className="w-4 h-4 text-rose-500" /> Bilingual Terminology Mapping
            </h4>
            <p className="leading-relaxed">
              Canadian invoices frequently leverage french terms like <span className="font-semibold text-slate-700">Facture N°</span>, <span className="font-semibold text-slate-700">Bon de commande</span>, <span className="font-semibold text-slate-700">Échéance</span>, and <span className="font-semibold text-slate-700">Sous-total</span>. The system's mapping dictionaries translate these values into strict compliant parameters in real-time.
            </p>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-rose-500" /> Place of Supply Rates (2026)
            </h4>
            <p className="leading-relaxed">
              Standard tax rates checked: 13% HST for Ontario; 15% HST for NB, NL, PE; 14% HST for NS; 5% GST + 9.975% QST for Québec; and 5% GST with varying PST rules for BC (7%), SK (6%), and MB (7%). Zero-Rated basic foods are exempt from collections but remain ITC-eligible.
            </p>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Input Tax Credit Rules (ITC)
            </h4>
            <p className="leading-relaxed">
              CRA mandates that any expense greater than $30.00 CAD must include a valid 9-digit Business registration number ending in RT0001 to claim Input Tax Credits. Revenu Québec rules require a TQ0001 registration number to claim Input Tax Refunds.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto border-t border-slate-100 mt-6 pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400">
          <div>
            🇨🇦 Canadian Invoice Compliance Workspace &bull; CRA Tax Policy compliant.
          </div>
          <div className="mt-2 sm:mt-0 font-mono text-[10px] opacity-50 uppercase tracking-widest">
            Audit Intelligence v2.4.0
          </div>
        </div>
      </footer>

    </div>
  );
}
