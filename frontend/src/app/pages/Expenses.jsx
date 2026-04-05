import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from '../../config';
import { analyzeReceipt, analyzeDocument } from "../../services/visionService.js";
import { saveChecklist } from "../../services/checklistService.js";
import Navbar_Dashboard from "../../components/navbar/Navbar_dashboard.jsx";
import { SIDEBAR_ITEMS } from "../../constants/sidebarItems.js";

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

  // Checklist state
  const [checklistChecked, setChecklistChecked] = useState({});
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [checklistSaved, setChecklistSaved] = useState(false);

  // Handle file selection (from gallery)
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError("");
  };

  // Handle camera capture
  const handleCameraCapture = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError("");
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
  };

  // Save expense to database
  const handleSaveExpense = async () => {
    const token = localStorage.getItem("token");
    const data = isEditing ? editData : result;
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
        alert("Expense saved successfully!");
        handleClear();
      } else {
        alert("Failed to save expense.");
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save expense.");
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f3f4f6" }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className="shrink-0 flex flex-col h-full"
        style={{ width: 220, background: "#000", color: "#fbfbf2" }}
      >
        {/* Logo */}
        <div className="px-6 pt-8 pb-6">
          <span className="text-xl font-bold tracking-tight" style={{ color: "#fbfbf2" }}>
            TravelHub
          </span>
        </div>

        <div className="px-4 pb-4">
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {SIDEBAR_ITEMS.map((item) => {
            return (
              <button
                key={item.label}
                onClick={() => item.path && navigate(item.path)}
                disabled={!item.path}
                className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition"
                style={{
                  color: !item.path ? "rgba(251,251,242,0.3)" : "rgba(251,251,242,0.75)",
                  cursor: item.path ? "pointer" : "default",
                  background: "transparent",
                }}
                onMouseEnter={(e) => {
                  if (item.path) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Scanner label at bottom of sidebar */}
        <div className="px-3 pb-6">
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 16 }} />
          <div
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg"
            style={{ background: "#183a37" }}
          >
            <ReceiptPercentIcon className="w-4 h-4 shrink-0" style={{ color: "#fbfbf2" }} />
            <span className="text-sm font-semibold" style={{ color: "#fbfbf2" }}>
              Smart Scanner
            </span>
          </div>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar_Dashboard />

        <main className="flex-1 overflow-y-auto p-6">
          {/* Page header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-1" style={{ color: "#160f29" }}>
              Smart Scanner
            </h1>
            <p className="text-sm" style={{ color: "#5c6b73" }}>
              Snap or upload a receipt or travel document — AI extracts the key details instantly.
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

                    <div className="flex gap-3">
                      <button
                        onClick={() => cameraInputRef.current.click()}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition"
                        style={{ background: "#160f29", color: "#fbfbf2" }}
                      >
                        <CameraIcon className="w-4 h-4" />
                        Camera
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
                      onChange={handleCameraCapture}
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
                    className="px-6 py-4 flex items-center justify-between"
                    style={{ borderBottom: "1px solid #f3f4f6" }}
                  >
                    <h2 className="text-sm font-semibold" style={{ color: "#160f29" }}>
                      Extracted Receipt Data
                    </h2>
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
                                ${item.price?.toFixed(2)}
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
                          <span style={{ color: "#374151" }}>${result.subtotal?.toFixed(2)}</span>
                        </div>
                      )}
                      {result.tax != null && (
                        <div className="flex justify-between text-sm">
                          <span style={{ color: "#5c6b73" }}>Tax</span>
                          <span style={{ color: "#374151" }}>${result.tax?.toFixed(2)}</span>
                        </div>
                      )}
                      {result.tip != null && (
                        <div className="flex justify-between text-sm">
                          <span style={{ color: "#5c6b73" }}>Tip</span>
                          <span style={{ color: "#374151" }}>${result.tip?.toFixed(2)}</span>
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
                            ${result.total?.toFixed(2)}
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
                              ${result.details.amount?.toFixed(2)} {result.details.currency}
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
                                alert('Failed to save checklist.');
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
