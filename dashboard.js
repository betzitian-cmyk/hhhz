<div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-slate-200">
  <header className="bg-white border-b border-slate-200 sticky top-0 z-10 print:hidden">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
      <div className="flex items-center">
        <img src={applechaiLogo} alt="ApplechAI Logo" className="h-10 w-auto object-contain" referrerPolicy="no-referrer" />
      </div>
      <div className="flex items-center gap-4 text-sm text-slate-500">
        <button onClick={() => { console.clear(); window.location.reload(); }} className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 leading-[23px] font-sans">
          <Loader2 size={14} className="rotate-90" />
          Reset & Purge
        </button>
      </div>
    </div>
  </header>

  <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 print:p-0 print:py-4">
    <div className="grid lg:grid-cols-3 gap-6 lg:gap-10 print:grid-cols-1 print:gap-4">
      
      {/* Left Column: Upload & Main Totals */}
      <div className="lg:col-span-1 space-y-6 print:hidden">
        {/* Upload Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileUp size={18} className="text-slate-400" />
            Upload Document
          </h2>
          <div className={`relative border-2 border-dashed rounded-xl p-8 transition-colors text-center ${file ? 'border-slate-400 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
            <input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" accept=".pdf,.jpg,.jpeg,.png" />
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                <Receipt size={24} className="text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">{file ? file.name : "Click to select invoice"}</p>
              <p className="text-xs text-slate-400">PDF, PNG or JPG up to 10MB</p>
            </div>
          </div>
          <button onClick={handleUpload} disabled={!file || loading} className="w-full mt-6 py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 transition-all flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={18} className="animate-spin" /> {step || "Analyzing..."}</> : "Initiate Extraction"}
          </button>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
              <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-600 leading-relaxed">{error}</p>
            </div>
          )}
        </div>

        {/* Financial Audit Summary Card (Conditional) */}
        {data && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 text-slate-300 p-6 rounded-2xl shadow-xl space-y-6">
            {/* Financials details ... */}
          </motion.div>
        )}

        {/* Tax Number Verification Utility */}
        <div id="tax-verifier-card" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
           {/* Tax verifier form ... */}
        </div>
      </div>

      {/* Right Column: Dashboard Details */}
      <div className="lg:col-span-2 space-y-6 print:col-span-1 print:space-y-4 print:p-0">
        <AnimatePresence mode="wait">
          {!data ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-12 border border-slate-200 bg-white rounded-3xl">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 border border-slate-100">
                <ClipboardList size={32} className="text-slate-300" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Awaiting Document</h3>
              <p className="text-slate-500 max-w-sm">Upload an invoice to begin the automated Canadian inter-provincial tax audit and data extraction process.</p>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 print:space-y-4">
               {/* Audit Actions, Info Grid, Metadata, Tax Breakdown, Line Items ... */}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  </main>
</div>