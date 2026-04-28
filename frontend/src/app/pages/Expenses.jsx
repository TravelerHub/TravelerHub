import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from '../../config';
import { haptic } from '../../utils/haptic';
import { analyzeReceipt, analyzeDocument } from "../../services/visionService.js";
import { saveChecklist } from "../../services/checklistService.js";
import {
  getExchangeRates,
  convertAmount,
  CURRENCY_SYMBOLS,
} from "../../services/currencyService";
import Navbar_Dashboard from "../../components/navbar/Navbar_dashboard.jsx";
import AppSidebar from "../../components/navbar/AppSidebar.jsx";
import { capturePhoto } from '../../utils/nativeCamera';

import {
  CameraIcon,
  ArrowUpTrayIcon,
  ArrowPathIcon,
  XMarkIcon,
  CheckIcon,
  PencilIcon,
  DocumentTextIcon,
  ReceiptPercentIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";

// ── Color palette (matches Dashboard / Booking)
// #160f29  deep dark   (sidebar, headings)
// #fbfbf2  off-white
// #5c6b73  slate-gray  (secondary text)
// #183a37  dark teal   (receipt accent)
// #1e3a5f  navy        (document accent)
// #f3f4f6  light gray  (page bg)


function Expenses() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Upload state
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  // Analysis mode: 'receipt' or 'document'
  const [mode, setMode] = useState("receipt");

  // Results state
  const [result, setResult] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(null);

  // Category auto-detection state
  const [categoryAutoDetected, setCategoryAutoDetected] = useState(false);

  // Checklist state
  const [checklistChecked, setChecklistChecked] = useState({});
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [checklistSaved, setChecklistSaved] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState("");

  // Exchange-rate state. We always show the receipt's native currency
  // and, if the user picked a different display currency, the converted
  // amount in parens. Without this, every amount on the page rendered as
  // a hard-coded `$X.XX` even when the receipt was clearly in EUR/JPY/etc.
  const [rates, setRates] = useState(null);
  const [displayCurrency, setDisplayCurrency] = useState(
    localStorage.getItem("expenses_display_currency") || ""
  );
  useEffect(() => {
    getExchangeRates("USD").then(setRates).catch(() => {});
  }, []);
  useEffect(() => {
    if (displayCurrency) {
      localStorage.setItem("expenses_display_currency", displayCurrency);
    }
  }, [displayCurrency]);

  // Format a single amount in the receipt's native currency, with an
  // optional converted equivalent appended in parens when the user has
  // picked a different display currency. Everywhere the page used to do
  // `$${amount.toFixed(2)}` should call this instead.
  const fmtAmount = useCallback((amount, fromCurrency) => {
    if (amount == null) return "";
    const native = (fromCurrency || result?.currency || "USD").toUpperCase();
    const sym = CURRENCY_SYMBOLS[native] || "";
    const nativeStr = `${sym}${Number(amount).toFixed(2)}${sym ? "" : ` ${native}`}`;
    if (!displayCurrency || displayCurrency === native || !rates) return nativeStr;
    try {
      const converted = convertAmount(Number(amount), native, displayCurrency, rates);
      const dispSym = CURRENCY_SYMBOLS[displayCurrency] || "";
      return `${nativeStr} (${dispSym}${converted.toFixed(2)})`;
    } catch {
      return nativeStr;
    }
  }, [rates, displayCurrency, result?.currency]);

  // Handle file selection (from gallery)
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError("");
  };

  // Handle camera input onChange (hidden file input fallback)
  const handleCameraInputChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError("");
  };

  // Native camera capture via Capacitor (falls back to file picker on web)
  const handleCameraCapture = async () => {
    try {
      const file = await capturePhoto();
      if (file) {
        setSelectedFile(file);
        setPreview(URL.createObjectURL(file));
        setResult(null);
        setError("");
      }
    } catch (err) {
      console.error('Camera capture failed:', err);
      setError("Could not open camera. Please try uploading a file instead.");
    }
  };

  // Analyze the image
  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setAnalyzing(true);
    setError("");
    try {
      let response;
      if (mode === "receipt") {
        response = await analyzeReceipt(selectedFile);
      } else {
        response = await analyzeDocument(selectedFile);
      }
      if (response.success) {
        setResult(response.data);
        setEditData(response.data);
        if (mode === "receipt" && response.data.category) {
          setCategoryAutoDetected(true);
        }
      } else {
        setError(response.error || "Could not analyze the image. Try a clearer photo.");
      }
    } catch (err) {
      console.error("Analysis error:", err);
      setError("Failed to analyze. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Clear everything
  const handleClear = () => {
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
    setEditData(null);
    setError("");
    setIsEditing(false);
    setCategoryAutoDetected(false);
  };

  // Save expense to database
  const handleSaveExpense = async () => {
    const token = localStorage.getItem("token");
    const data = isEditing ? editData : result;
    setError("");
    setSaveSuccess("");
    try {
      const response = await fetch(`${API_BASE}/vision/save-expense`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (response.ok) {
        haptic('light');
        setSaveSuccess("Expense saved.");
        setTimeout(() => setSaveSuccess(""), 2500);
        handleClear();
      } else {
        const detail = await response.json().catch(() => ({}));
        setError(detail?.detail || `Couldn't save expense (${response.status}).`);
      }
    } catch (err) {
      console.error("Save error:", err);
      setError("Couldn't reach the server to save this expense.");
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f3f4f6" }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <AppSidebar
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        header={
          <span className="text-xl font-bold tracking-tight" style={{ color: "#fbfbf2" }}>
            TravelHub
          </span>
        }
        footer={
          <div
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg"
            style={{ background: "#183a37" }}
          >
            <ReceiptPercentIcon className="w-4 h-4 shrink-0" style={{ color: "#fbfbf2" }} />
            <span className="text-sm font-semibold" style={{ color: "#fbfbf2" }}>
              Smart Scanner
            </span>
          </div>
        }
      />

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar_Dashboard onMenuClick={() => setMenuOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 md:pb-6">
          {/* Page header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold" style={{ color: "#160f29" }}>
              Smart Scanner
            </h1>
            <p className="text-sm mt-1" style={{ color: "#5c6b73" }}>
              Snap a receipt — AI fills in the rest.
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => { setMode("receipt"); handleClear(); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition"
              style={
                mode === "receipt"
                  ? { background: "#183a37", color: "#fbfbf2" }
                  : { background: "#fff", color: "#5c6b73", border: "1px solid #e5e7eb" }
              }
            >
              <ReceiptPercentIcon className="w-4 h-4" />
              Receipt
            </button>
            <button
              onClick={() => { setMode("document"); handleClear(); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition"
              style={
                mode === "document"
                  ? { background: "#1e3a5f", color: "#fbfbf2" }
                  : { background: "#fff", color: "#5c6b73", border: "1px solid #e5e7eb" }
              }
            >
              <DocumentTextIcon className="w-4 h-4" />
              Travel Document
            </button>
          </div>

          {/* Two-column content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* ── Left: Upload panel ─────────────────────────────────────────── */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "#fff", border: "1px solid #e5e7eb" }}
            >
              <div className="px-6 py-4" style={{ borderBottom: "1px solid #f3f4f6" }}>
                <h2 className="text-sm font-semibold" style={{ color: "#160f29" }}>
                  {mode === "receipt" ? "Upload Receipt" : "Upload Document"}
                </h2>
              </div>

              <div className="p-6">
                {!preview ? (
                  /* Drop zone */
                  <div
                    className="rounded-xl flex flex-col items-center justify-center text-center py-14 px-6"
                    style={{
                      border: "2px dashed #d1d5db",
                      background: "#fafafa",
                    }}
                  >
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                      style={{ background: mode === "receipt" ? "#183a37" : "#1e3a5f" }}
                    >
                      {mode === "receipt"
                        ? <ReceiptPercentIcon className="w-7 h-7 text-white" />
                        : <DocumentTextIcon className="w-7 h-7 text-white" />
                      }
                    </div>
                    <p className="text-sm font-medium mb-1" style={{ color: "#160f29" }}>
                      {mode === "receipt" ? "Scan your receipt" : "Scan your document"}
                    </p>
                    <p className="text-xs mb-6" style={{ color: "#5c6b73" }}>
                      JPEG, PNG, or WebP · max 10 MB
                    </p>

                    <div className="flex gap-3 flex-wrap justify-center">
                      <button
                        onClick={handleCameraCapture}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition"
                        style={{ background: "#160f29", color: "#fbfbf2" }}
                      >
                        <CameraIcon className="w-4 h-4" />
                        📷 Scan Receipt
                      </button>
                      <button
                        onClick={() => fileInputRef.current.click()}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition"
                        style={{ background: "#f3f4f6", color: "#160f29", border: "1px solid #e5e7eb" }}
                      >
                        <ArrowUpTrayIcon className="w-4 h-4" />
                        Upload
                      </button>
                    </div>

                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleCameraInputChange}
                      className="hidden"
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                ) : (
                  /* Preview */
                  <div>
                    <div className="relative mb-4 rounded-xl overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
                      <img
                        src={preview}
                        alt="Preview"
                        loading="lazy"
                        decoding="async"
                        className="w-full max-h-72 object-contain"
                        style={{ background: "#f9fafb" }}
                      />
                      <button
                        onClick={handleClear}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition"
                        style={{ background: "#160f29", color: "#fff" }}
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs mb-4 truncate" style={{ color: "#5c6b73" }}>
                      {selectedFile?.name}
                    </p>

                    {!result && (
                      <button
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        className="w-full py-3 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
                        style={
                          analyzing
                            ? { background: "#e5e7eb", color: "#9ca3af", cursor: "not-allowed" }
                            : { background: mode === "receipt" ? "#183a37" : "#1e3a5f", color: "#fbfbf2" }
                        }
                      >
                        {analyzing ? (
                          <>
                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                            Analyzing…
                          </>
                        ) : (
                          <>
                            <CheckIcon className="w-4 h-4" />
                            Analyze {mode === "receipt" ? "Receipt" : "Document"}
                          </>
                        )}
                      </button>
                    )}

                    {result && (
                      <button
                        onClick={handleClear}
                        className="w-full py-2.5 rounded-xl text-sm font-medium transition"
                        style={{ background: "#f3f4f6", color: "#5c6b73", border: "1px solid #e5e7eb" }}
                      >
                        Scan another
                      </button>
                    )}
                  </div>
                )}

                {error && (
                  <div
                    className="mt-4 p-3 rounded-xl text-sm"
                    style={{ background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}
                  >
                    {error}
                  </div>
                )}

                {saveSuccess && (
                  <div
                    className="mt-4 p-3 rounded-xl text-sm flex items-center gap-2"
                    style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0" }}
                  >
                    <CheckIcon className="w-4 h-4" />
                    {saveSuccess}
                  </div>
                )}
              </div>
            </div>

            {/* ── Right: Results panel ───────────────────────────────────────── */}
            <div>
              {/* Receipt results */}
              {result && mode === "receipt" && (
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ background: "#fff", border: "1px solid #e5e7eb" }}
                >
                  <div
                    className="px-6 py-4 flex items-center justify-between gap-3 flex-wrap"
                    style={{ borderBottom: "1px solid #f3f4f6" }}
                  >
                    <h2 className="text-sm font-semibold" style={{ color: "#160f29" }}>
                      Extracted Receipt Data
                    </h2>
                    <div className="flex items-center gap-2">
                      <select
                        value={displayCurrency || ""}
                        onChange={(e) => setDisplayCurrency(e.target.value)}
                        className="px-2 py-1 rounded-lg text-xs font-medium"
                        style={{ border: "1px solid #d1d5db", background: "#fff", color: "#374151" }}
                        title="Show converted equivalent in this currency"
                      >
                        <option value="">native only</option>
                        {["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "SGD", "THB", "MXN"].map((c) => (
                          <option key={c} value={c}>{CURRENCY_SYMBOLS[c] || ""} {c}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          setIsEditing(!isEditing);
                          if (!isEditing) setEditData({ ...result });
                        }}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition"
                        style={
                          isEditing
                            ? { background: "#fee2e2", color: "#991b1b" }
                            : { background: "#f3f4f6", color: "#5c6b73" }
                        }
                      >
                        <PencilIcon className="w-3.5 h-3.5" />
                        {isEditing ? "Cancel" : "Edit"}
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-5">
                    {/* Merchant & Date */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium mb-1" style={{ color: "#5c6b73" }}>Merchant</p>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editData.merchant_name || ""}
                            onChange={(e) => setEditData({ ...editData, merchant_name: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg text-sm"
                            style={{ border: "1px solid #d1d5db" }}
                          />
                        ) : (
                          <p className="text-sm font-semibold" style={{ color: "#160f29" }}>
                            {result.merchant_name || "Unknown"}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium mb-1" style={{ color: "#5c6b73" }}>Date</p>
                        {isEditing ? (
                          <input
                            type="date"
                            value={editData.date || ""}
                            onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg text-sm"
                            style={{ border: "1px solid #d1d5db" }}
                          />
                        ) : (
                          <p className="text-sm font-semibold" style={{ color: "#160f29" }}>
                            {result.date || "—"}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Category */}
                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: "#5c6b73" }}>Category</p>
                      <div className="flex items-center gap-2">
                        <select
                          value={(isEditing ? editData.category : result.category) || "other"}
                          onChange={(e) => {
                            setCategoryAutoDetected(false);
                            if (isEditing) {
                              setEditData({ ...editData, category: e.target.value });
                            } else {
                              setResult({ ...result, category: e.target.value });
                            }
                          }}
                          className="px-3 py-2 rounded-lg text-sm"
                          style={{ border: "1px solid #d1d5db", background: "#fff", color: "#160f29" }}
                        >
                          <option value="food">Food</option>
                          <option value="transport">Transport</option>
                          <option value="lodging">Lodging</option>
                          <option value="activities">Activities</option>
                          <option value="shopping">Shopping</option>
                          <option value="health">Health</option>
                          <option value="entertainment">Entertainment</option>
                          <option value="other">Other</option>
                        </select>
                        {categoryAutoDetected && (
                          <span className="text-xs font-medium" style={{ color: "#16a34a" }}>
                            ✓ Auto-detected
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Items */}
                    {result.items && result.items.length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-2" style={{ color: "#5c6b73" }}>Items</p>
                        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #f3f4f6" }}>
                          {(isEditing ? editData.items : result.items).map((item, index) => (
                            <div
                              key={index}
                              className="flex justify-between items-center px-4 py-2.5 text-sm"
                              style={{
                                borderBottom: index < result.items.length - 1 ? "1px solid #f3f4f6" : "none",
                              }}
                            >
                              <span style={{ color: "#374151" }}>{item.name}</span>
                              <span className="font-semibold" style={{ color: "#160f29" }}>
                                {fmtAmount(item.price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Totals */}
                    <div
                      className="rounded-xl p-4 space-y-2"
                      style={{ background: "#f9fafb", border: "1px solid #f3f4f6" }}
                    >
                      {result.subtotal != null && (
                        <div className="flex justify-between text-sm">
                          <span style={{ color: "#5c6b73" }}>Subtotal</span>
                          <span style={{ color: "#374151" }}>{fmtAmount(result.subtotal)}</span>
                        </div>
                      )}
                      {result.tax != null && (
                        <div className="flex justify-between text-sm">
                          <span style={{ color: "#5c6b73" }}>Tax</span>
                          <span style={{ color: "#374151" }}>{fmtAmount(result.tax)}</span>
                        </div>
                      )}
                      {result.tip != null && (
                        <div className="flex justify-between text-sm">
                          <span style={{ color: "#5c6b73" }}>Tip</span>
                          <span style={{ color: "#374151" }}>{fmtAmount(result.tip)}</span>
                        </div>
                      )}
                      <div
                        className="flex justify-between items-center pt-2 mt-1"
                        style={{ borderTop: "1px solid #e5e7eb" }}
                      >
                        <span className="text-sm font-bold" style={{ color: "#160f29" }}>Total</span>
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editData.total || ""}
                            onChange={(e) => setEditData({ ...editData, total: parseFloat(e.target.value) })}
                            className="w-24 px-2 py-1 rounded-lg text-right text-sm font-bold"
                            style={{ border: "1px solid #d1d5db" }}
                          />
                        ) : (
                          <span className="text-base font-bold" style={{ color: "#160f29" }}>
                            {fmtAmount(result.total)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Payment method */}
                    {result.payment_method && (
                      <p className="text-xs" style={{ color: "#5c6b73" }}>
                        Paid by <span className="font-medium capitalize" style={{ color: "#374151" }}>{result.payment_method}</span>
                      </p>
                    )}

                    {/* Save */}
                    <button
                      onClick={handleSaveExpense}
                      className="w-full py-3 rounded-xl text-sm font-semibold transition"
                      style={{ background: "#183a37", color: "#fbfbf2" }}
                    >
                      Save Expense
                    </button>
                  </div>
                </div>
              )}

              {/* Document results */}
              {result && mode === "document" && (
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ background: "#fff", border: "1px solid #e5e7eb" }}
                >
                  <div
                    className="px-6 py-4"
                    style={{ borderBottom: "1px solid #f3f4f6" }}
                  >
                    <h2 className="text-sm font-semibold" style={{ color: "#160f29" }}>
                      Document Info
                    </h2>
                  </div>

                  <div className="p-6 space-y-4">
                    {/* Type badge + title */}
                    <div className="flex items-start gap-3">
                      <div
                        className="px-3 py-1 rounded-full text-xs font-semibold capitalize shrink-0"
                        style={{ background: "#e0f2fe", color: "#0369a1" }}
                      >
                        {result.document_type?.replace(/_/g, " ") || "Document"}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium mb-1" style={{ color: "#5c6b73" }}>Title</p>
                      <p className="text-sm font-semibold" style={{ color: "#160f29" }}>
                        {result.title || "—"}
                      </p>
                    </div>

                    {result.details && (
                      <div
                        className="rounded-xl divide-y"
                        style={{ border: "1px solid #f3f4f6" }}
                      >
                        {result.details.confirmation_number && (
                          <div className="px-4 py-3">
                            <p className="text-xs mb-0.5" style={{ color: "#5c6b73" }}>Confirmation #</p>
                            <p className="text-sm font-mono font-semibold" style={{ color: "#160f29" }}>
                              {result.details.confirmation_number}
                            </p>
                          </div>
                        )}
                        {result.details.date && (
                          <div className="px-4 py-3">
                            <p className="text-xs mb-0.5" style={{ color: "#5c6b73" }}>Date</p>
                            <p className="text-sm font-semibold" style={{ color: "#160f29" }}>
                              {result.details.date}
                            </p>
                          </div>
                        )}
                        {result.details.time && (
                          <div className="px-4 py-3">
                            <p className="text-xs mb-0.5" style={{ color: "#5c6b73" }}>Time</p>
                            <p className="text-sm font-semibold" style={{ color: "#160f29" }}>
                              {result.details.time}
                            </p>
                          </div>
                        )}
                        {result.details.location && (
                          <div className="px-4 py-3">
                            <p className="text-xs mb-0.5" style={{ color: "#5c6b73" }}>Location</p>
                            <p className="text-sm font-semibold" style={{ color: "#160f29" }}>
                              {result.details.location}
                            </p>
                          </div>
                        )}
                        {result.details.amount != null && (
                          <div className="px-4 py-3">
                            <p className="text-xs mb-0.5" style={{ color: "#5c6b73" }}>Amount</p>
                            <p className="text-sm font-bold" style={{ color: "#160f29" }}>
                              {fmtAmount(result.details.amount, result.details.currency)}
                            </p>
                          </div>
                        )}
                        {result.details.notes && (
                          <div className="px-4 py-3">
                            <p className="text-xs mb-0.5" style={{ color: "#5c6b73" }}>Notes</p>
                            <p className="text-sm" style={{ color: "#374151" }}>
                              {result.details.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Checklist */}
                    {result.checklist_items && result.checklist_items.length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-3" style={{ color: "#5c6b73" }}>
                          Action Checklist
                        </p>
                        <div className="space-y-2 mb-4">
                          {result.checklist_items.map((item, index) => (
                            <label
                              key={index}
                              className="flex items-start gap-3 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5 rounded"
                                checked={checklistChecked[index] || false}
                                onChange={(e) =>
                                  setChecklistChecked(prev => ({ ...prev, [index]: e.target.checked }))
                                }
                              />
                              <span
                                className="text-sm leading-snug"
                                style={{
                                  color: checklistChecked[index] ? "#9ca3af" : "#374151",
                                  textDecoration: checklistChecked[index] ? "line-through" : "none",
                                }}
                              >
                                {item}
                              </span>
                            </label>
                          ))}
                        </div>

                        {!checklistSaved ? (
                          <button
                            onClick={async () => {
                              setSavingChecklist(true);
                              try {
                                await saveChecklist({
                                  document_title: result.title || 'Untitled Document',
                                  document_type: result.document_type || 'unknown',
                                  source_location: result.details?.location || null,
                                  source_address: result.details?.address || null,
                                  items: result.checklist_items,
                                });
                                setChecklistSaved(true);
                              } catch (err) {
                                console.error('Save checklist error:', err);
                                setError(err?.message || "Failed to save checklist.");
                              } finally {
                                setSavingChecklist(false);
                              }
                            }}
                            disabled={savingChecklist}
                            className="w-full py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
                            style={
                              savingChecklist
                                ? { background: "#e5e7eb", color: "#9ca3af", cursor: "not-allowed" }
                                : { background: "#1e3a5f", color: "#fbfbf2" }
                            }
                          >
                            {savingChecklist ? (
                              <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Saving…</>
                            ) : (
                              <><CheckIcon className="w-4 h-4" /> Save Checklist</>
                            )}
                          </button>
                        ) : (
                          <p
                            className="text-sm font-medium flex items-center gap-1.5"
                            style={{ color: "#16a34a" }}
                          >
                            <CheckIcon className="w-4 h-4" /> Checklist saved!
                          </p>
                        )}
                      </div>
                    )}

                    {/* Navigate here */}
                    {result.details && (result.details.location || result.details.address) && (
                      <button
                        onClick={() => {
                          const addr = result.details.address || result.details.location;
                          navigate(`/navigation?destination=${encodeURIComponent(addr)}`);
                        }}
                        className="w-full py-3 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
                        style={{ background: "#160f29", color: "#fbfbf2" }}
                      >
                        <MapPinIcon className="w-4 h-4" />
                        Navigate to this Location
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!result && !analyzing && (
                <div
                  className="rounded-2xl flex flex-col items-center justify-center text-center py-20 px-8"
                  style={{ background: "#fff", border: "1px solid #e5e7eb" }}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: "#f3f4f6" }}
                  >
                    {mode === "receipt"
                      ? <ReceiptPercentIcon className="w-7 h-7" style={{ color: "#9ca3af" }} />
                      : <DocumentTextIcon  className="w-7 h-7" style={{ color: "#9ca3af" }} />
                    }
                  </div>
                  <p className="text-sm font-medium mb-1" style={{ color: "#374151" }}>
                    Results will appear here
                  </p>
                  <p className="text-xs" style={{ color: "#9ca3af" }}>
                    {mode === "receipt"
                      ? "Upload a receipt to extract merchant, items, and totals"
                      : "Upload a document to extract dates, confirmation numbers, and checklist items"
                    }
                  </p>
                </div>
              )}

              {/* Analyzing state */}
              {analyzing && (
                <div
                  className="rounded-2xl flex flex-col items-center justify-center py-20"
                  style={{ background: "#fff", border: "1px solid #e5e7eb" }}
                >
                  <ArrowPathIcon
                    className="w-10 h-10 animate-spin mb-3"
                    style={{ color: mode === "receipt" ? "#183a37" : "#1e3a5f" }}
                  />
                  <p className="text-sm font-medium" style={{ color: "#374151" }}>
                    Analyzing with AI…
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>
                    This usually takes a few seconds
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Expenses;
