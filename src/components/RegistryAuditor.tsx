import React from "react";
import { ShieldAlert, Loader2, Sparkles, Building2, MapPin } from "lucide-react";

interface RegistryAuditorProps {
  vendorTaxNumbers?: { gstHst: string | null; qst: string | null } | null;
  verificationResult?: { gst: any; qst: any } | null;
  isVerifying?: boolean;
  onVerify?: () => void;
}

export default function RegistryAuditor({
  vendorTaxNumbers,
  verificationResult,
  isVerifying = false,
  onVerify,
}: RegistryAuditorProps) {
  if (!(vendorTaxNumbers?.gstHst || vendorTaxNumbers?.qst)) return null;

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4 shadow-xs" id="live-registry-audit">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 flex-wrap gap-2">
        <div>
          <h3 className="font-sans font-semibold text-gray-900 text-sm tracking-tight flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" /> Live CRA & Revenu Québec Registry Audit
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Confirm vendor registration status in real-time before claiming GST/HST ITCs or QST ITRs.
          </p>
        </div>
        {!verificationResult && onVerify && (
          <button
            type="button"
            onClick={onVerify}
            disabled={isVerifying}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-rose-600 border border-rose-700 px-3 py-1.5 rounded-lg shadow-sm hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Auditing...
              </>
            ) : (
              "Run Live Registry Audit"
            )}
          </button>
        )}
      </div>

      {/* Verification Results Display */}
      {verificationResult ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* GST Verification */}
          {vendorTaxNumbers?.gstHst ? (
            <div 
              className={`p-4 rounded-xl border flex flex-col justify-between ${
                verificationResult.gst?.status === "VALID" 
                  ? "bg-emerald-50/20 border-emerald-200 text-emerald-900" 
                  : verificationResult.gst?.status === "INVALID"
                  ? "bg-rose-50/20 border-rose-200 text-rose-900"
                  : "bg-amber-50/20 border-amber-200 text-amber-900"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold text-gray-500">GST/HST: {vendorTaxNumbers.gstHst}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-mono border ${
                    verificationResult.gst?.status === "VALID" 
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200" 
                      : verificationResult.gst?.status === "INVALID"
                      ? "bg-rose-100 text-rose-800 border-rose-200"
                      : "bg-amber-100 text-amber-800 border-amber-200"
                  }`}>
                    {verificationResult.gst?.status}
                  </span>
                </div>

                <p className="mt-2 text-xs font-medium text-gray-800">
                  {verificationResult.gst?.message}
                </p>

                {verificationResult.gst?.details && (
                  <div className="mt-3 space-y-1.5 text-[11px] text-gray-600 border-t border-gray-100/50 pt-2">
                    {verificationResult.gst.details.businessName && (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="font-semibold text-gray-700">{verificationResult.gst.details.businessName}</span>
                      </div>
                    )}
                    {verificationResult.gst.details.address && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>{verificationResult.gst.details.address}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/30 flex items-center justify-center text-xs text-gray-400">
              No GST/HST Number on invoice
            </div>
          )}

          {/* QST Verification */}
          {vendorTaxNumbers?.qst ? (
            <div 
              className={`p-4 rounded-xl border flex flex-col justify-between ${
                verificationResult.qst?.status === "VALID" 
                  ? "bg-teal-50/20 border-teal-200 text-teal-900" 
                  : verificationResult.qst?.status === "INVALID"
                  ? "bg-rose-50/20 border-rose-200 text-rose-900"
                  : "bg-amber-50/20 border-amber-200 text-amber-900"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold text-gray-500">QST: {vendorTaxNumbers.qst}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-mono border ${
                    verificationResult.qst?.status === "VALID" 
                      ? "bg-teal-100 text-teal-850 border-teal-200" 
                      : verificationResult.qst?.status === "INVALID"
                      ? "bg-rose-100 text-rose-800 border-rose-200"
                      : "bg-amber-100 text-amber-800 border-amber-200"
                  }`}>
                    {verificationResult.qst?.status}
                  </span>
                </div>

                <p className="mt-2 text-xs font-medium text-gray-800">
                  {verificationResult.qst?.message}
                </p>

                {verificationResult.qst?.details && (
                  <div className="mt-3 space-y-1.5 text-[11px] text-gray-600 border-t border-gray-100/50 pt-2">
                    {verificationResult.qst.details.businessName && (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="font-semibold text-gray-700">{verificationResult.qst.details.businessName}</span>
                      </div>
                    )}
                    {verificationResult.qst.details.address && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>{verificationResult.qst.details.address}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/30 flex items-center justify-center text-xs text-gray-400">
              No QST Number on invoice (Non-Quebec supply)
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-rose-600 animate-pulse shrink-0" />
            <span className="text-xs text-gray-600 leading-normal">
              Live lookup will query CRA registries to confirm active status of GST/HST <span className="font-mono font-semibold">{vendorTaxNumbers?.gstHst || "N/A"}</span> and QST <span className="font-mono font-semibold">{vendorTaxNumbers?.qst || "N/A"}</span>.
            </span>
          </div>
          {onVerify && (
            <button
              type="button"
              onClick={onVerify}
              disabled={isVerifying}
              className="w-full md:w-auto inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-4 py-2 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Auditing...
                </>
              ) : (
                "Launch Live Registry Audit"
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
