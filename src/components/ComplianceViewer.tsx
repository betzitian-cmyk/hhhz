import React, { useState } from "react";
import { ComplianceReport } from "../types";
import { CheckCircle2, AlertTriangle, XCircle, Award, FileCheck2, ShieldAlert, X } from "lucide-react";
import RegistryAuditor from "./RegistryAuditor";

interface ComplianceViewerProps {
  report: ComplianceReport;
  verificationResult?: { gst: any; qst: any } | null;
  isVerifying?: boolean;
  onVerify?: () => void;
  vendorTaxNumbers?: { gstHst: string | null; qst: string | null } | null;
}

export default function ComplianceViewer({ 
  report, 
  verificationResult, 
  isVerifying = false, 
  onVerify,
  vendorTaxNumbers
}: ComplianceViewerProps) {
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case "math": return "Mathematical Integrity";
      case "tax_rate": return "Place of Supply Rates";
      case "vendor_id": return "Registry / Business ID";
      case "compliance": return "Document Audit";
      case "language": return "Language & Translation";
      default: return cat;
    }
  };

  const getStatusIcon = (status: "pass" | "fail" | "warning") => {
    switch (status) {
      case "pass":
        return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
      case "fail":
        return <XCircle className="w-5 h-5 text-rose-500 shrink-0" />;
    }
  };

  return (
    <div className="space-y-6" id="compliance-viewer">
      <RegistryAuditor
        vendorTaxNumbers={vendorTaxNumbers}
        verificationResult={verificationResult}
        isVerifying={isVerifying}
        onVerify={onVerify}
      />

      {/* ITC and ITR Eligibility Badges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 hidden">
        {/* CRA ITC Panel */}
        <div 
          className={`p-5 rounded-xl border ${
            report.isValidForITC 
              ? "bg-emerald-50/40 border-emerald-200" 
              : "bg-rose-50/40 border-rose-200"
          }`}
          id="cra-itc-panel"
        >
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-lg ${report.isValidForITC ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-sans font-semibold text-gray-900 text-sm tracking-tight">
                CRA Input Tax Credit (ITC)
              </h3>
              <div className="mt-1 flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${report.isValidForITC ? "bg-emerald-500" : "bg-rose-500"}`} />
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-gray-700">
                  {report.isValidForITC ? "ELIGIBLE FOR CLAIM" : "INELIGIBLE"}
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-600 leading-relaxed">
                {report.isValidForITC
                  ? "Fully compliant. The vendor provided a structurally valid 9-digit GST/HST registration number, the tax point date is present, and mathematical checks reconciled perfectly."
                  : "Purchaser cannot claim a GST/HST tax credit. Ensure a valid 9-digit RT0001 registration is printed on the invoice and mathematical totals reconcile."}
              </p>
            </div>
          </div>
        </div>

        {/* Revenu Québec ITR Panel */}
        <div 
          className={`p-5 rounded-xl border ${
            report.isValidForITR 
              ? "bg-teal-50/40 border-teal-200" 
              : "bg-gray-50 border-gray-200"
          }`}
          id="rq-itr-panel"
        >
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-lg ${report.isValidForITR ? "bg-teal-600 text-white" : "bg-gray-400 text-white"}`}>
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-sans font-semibold text-gray-900 text-sm tracking-tight">
                Revenu Québec Input Tax Refund (ITR)
              </h3>
              <div className="mt-1 flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${report.isValidForITR ? "bg-teal-500" : "bg-gray-400"}`} />
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-gray-700">
                  {report.isValidForITR ? "ELIGIBLE FOR CLAIM" : "NOT APPLICABLE / INELIGIBLE"}
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-600 leading-relaxed">
                {report.isValidForITR
                  ? "Fully compliant for Quebec. The invoice contains a valid QST (TQ) registration number, correct place of supply dual taxation, and reconciled totals."
                  : "To claim QST refund, Quebec Place of Supply requires a valid QST registration number (10-digit TQ0001 or 9-digit TQ0001) and fully validated dual taxes."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Overview Banner */}
      <div className="flex flex-wrap gap-4 items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hidden">
        <div className="flex gap-6">
          <div className="text-center">
            <span className="block font-mono text-xl font-bold text-emerald-600">{report.passedCount}</span>
            <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Passed</span>
          </div>
          <div className="text-center border-l border-gray-200 pl-6">
            <span className="block font-mono text-xl font-bold text-amber-500">{report.warningCount}</span>
            <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Warnings</span>
          </div>
          <div className="text-center border-l border-gray-200 pl-6">
            <span className="block font-mono text-xl font-bold text-rose-500">{report.failedCount}</span>
            <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Failures</span>
          </div>
        </div>
        <div className="flex gap-2">
          {report.failedCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
              <ShieldAlert className="w-3.5 h-3.5" /> Compliance Errors Detected
            </span>
          )}
          {report.failedCount === 0 && report.warningCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              <AlertTriangle className="w-3.5 h-3.5" /> Minor Warnings
            </span>
          )}
          {report.failedCount === 0 && report.warningCount === 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" /> Standard Met
            </span>
          )}
        </div>
      </div>

      {/* Action to View Checklist */}
      <div className="flex justify-end">
        <button 
          onClick={() => setIsChecklistOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm"
        >
          View Audit Checklist
        </button>
      </div>

      {/* Detailed Audit Checklist Drawer */}
      {isChecklistOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsChecklistOpen(false)} 
          />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-gray-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/80 backdrop-blur-md">
              <h4 className="font-sans font-medium text-gray-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gray-500" />
                Compliance Checklist
              </h4>
              <button 
                onClick={() => setIsChecklistOpen(false)}
                className="p-1.5 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50" id="audit-checklist">
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden bg-white shadow-sm">
                {report.checks.map((check) => (
                  <div 
                    key={check.id} 
                    className={`p-4 flex items-start gap-3.5 transition-colors border-l-4 ${
                      check.status === "pass" 
                        ? "border-l-emerald-500 hover:bg-emerald-50/5" 
                        : check.status === "warning"
                        ? "border-l-amber-500 hover:bg-amber-50/5"
                        : "border-l-rose-500 hover:bg-rose-50/5"
                    }`}
                    id={`check-${check.id}`}
                  >
                    {getStatusIcon(check.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-sans font-medium text-gray-900 text-sm">
                          {check.name}
                        </span>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 uppercase tracking-wider font-mono shrink-0">
                          {getCategoryLabel(check.category)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-600 leading-relaxed">
                        {check.description}
                      </p>

                      {/* Optional Actual vs Expected Breakdown */}
                      {(check.expectedValue !== undefined || check.actualValue !== undefined) && (
                        <div className="mt-2.5 flex flex-wrap gap-4 text-[11px] font-mono p-2 rounded bg-gray-50/70 border border-gray-100">
                          {check.expectedValue !== undefined && (
                            <div>
                              <span className="text-gray-400 font-sans">Target Value: </span>
                              <span className="text-gray-700 font-semibold">{check.expectedValue ?? "N/A"}</span>
                            </div>
                          )}
                          {check.actualValue !== undefined && (
                            <div>
                              <span className="text-gray-400 font-sans">Extracted Value: </span>
                              <span className={`font-semibold ${check.status === "fail" ? "text-rose-600" : check.status === "warning" ? "text-amber-600" : "text-emerald-600"}`}>
                                {check.actualValue ?? "N/A"}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
