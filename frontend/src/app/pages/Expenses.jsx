import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { analyzeReceipt, analyzeDocument } from "../../services/visionService.js";

import {
  CameraIcon,
  ArrowUpTrayIcon,
  ArrowPathIcon,
  XMarkIcon,
  CheckIcon,
  PencilIcon,
  DocumentTextIcon,
  ReceiptPercentIcon,
} from "@heroicons/react/24/outline";

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
      const response = await fetch("http://127.0.0.1:8000/vision/save-expense", {
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ReceiptPercentIcon className="w-7 h-7 text-green-600" />
              Smart Scanner
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Upload Section */}
          <div className="space-y-4">
            {/* Mode Toggle */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">What are you scanning?</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setMode("receipt")}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                    mode === "receipt"
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <ReceiptPercentIcon className="w-4 h-4 inline mr-2" />
                  Receipt
                </button>
                <button
                  onClick={() => setMode("document")}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                    mode === "document"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <DocumentTextIcon className="w-4 h-4 inline mr-2" />
                  Travel Document
                </button>
              </div>
            </div>

            {/* Upload Area */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              {!preview ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">📸</div>
                  <p className="text-gray-600 mb-6">
                    {mode === "receipt"
                      ? "Take a photo or upload a receipt"
                      : "Take a photo or upload a travel document"}
                  </p>
                  <div className="flex gap-3 justify-center">
                    {/* Camera Button */}
                    <button
                      onClick={() => cameraInputRef.current.click()}
                      className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition"
                    >
                      <CameraIcon className="w-5 h-5" />
                      Camera
                    </button>
                    {/* Upload Button */}
                    <button
                      onClick={() => fileInputRef.current.click()}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
                    >
                      <ArrowUpTrayIcon className="w-5 h-5" />
                      Upload
                    </button>
                  </div>

                  {/* Hidden file inputs */}
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
                <div>
                  {/* Preview */}
                  <div className="relative mb-4">
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full max-h-80 object-contain rounded-lg border border-gray-200"
                    />
                    <button
                      onClick={handleClear}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Analyze Button */}
                  {!result && (
                    <button
                      onClick={handleAnalyze}
                      disabled={analyzing}
                      className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition disabled:bg-gray-400 flex items-center justify-center gap-2"
                    >
                      {analyzing ? (
                        <>
                          <ArrowPathIcon className="w-5 h-5 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <CheckIcon className="w-5 h-5" />
                          Analyze {mode === "receipt" ? "Receipt" : "Document"}
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Right: Results Section */}
          <div>
            {result && mode === "receipt" && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Extracted Data</h3>
                  <button
                    onClick={() => {
                      setIsEditing(!isEditing);
                      if (!isEditing) setEditData({ ...result });
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <PencilIcon className="w-4 h-4" />
                    {isEditing ? "Cancel Edit" : "Edit"}
                  </button>
                </div>

                {/* Merchant & Date */}
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Merchant</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editData.merchant_name || ""}
                        onChange={(e) => setEditData({ ...editData, merchant_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    ) : (
                      <p className="text-gray-900 font-medium">{result.merchant_name || "Unknown"}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Date</label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={editData.date || ""}
                        onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    ) : (
                      <p className="text-gray-900">{result.date || "Not detected"}</p>
                    )}
                  </div>
                </div>

                {/* Items */}
                {result.items && result.items.length > 0 && (
                  <div className="mb-4">
                    <label className="text-xs text-gray-500 font-medium">Items</label>
                    <div className="mt-1 space-y-2">
                      {(isEditing ? editData.items : result.items).map((item, index) => (
                        <div key={index} className="flex justify-between text-sm py-1 border-b border-gray-100">
                          <span className="text-gray-700">{item.name}</span>
                          <span className="text-gray-900 font-medium">${item.price?.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Totals */}
                <div className="border-t border-gray-200 pt-3 space-y-2">
                  {result.subtotal && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="text-gray-900">${result.subtotal?.toFixed(2)}</span>
                    </div>
                  )}
                  {result.tax && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Tax</span>
                      <span className="text-gray-900">${result.tax?.toFixed(2)}</span>
                    </div>
                  )}
                  {result.tip && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Tip</span>
                      <span className="text-gray-900">${result.tip?.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-300">
                    <span>Total</span>
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editData.total || ""}
                        onChange={(e) => setEditData({ ...editData, total: parseFloat(e.target.value) })}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-right text-sm"
                      />
                    ) : (
                      <span>${result.total?.toFixed(2)}</span>
                    )}
                  </div>
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSaveExpense}
                  className="w-full mt-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition"
                >
                  Save Expense
                </button>
              </div>
            )}

            {/* Document Results */}
            {result && mode === "document" && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Document Info</h3>

                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Type</label>
                    <p className="text-gray-900 font-medium capitalize">
                      {result.document_type?.replace(/_/g, " ") || "Unknown"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Title</label>
                    <p className="text-gray-900">{result.title || "Not detected"}</p>
                  </div>

                  {result.details && (
                    <>
                      {result.details.confirmation_number && (
                        <div>
                          <label className="text-xs text-gray-500 font-medium">Confirmation #</label>
                          <p className="text-gray-900 font-mono">{result.details.confirmation_number}</p>
                        </div>
                      )}
                      {result.details.date && (
                        <div>
                          <label className="text-xs text-gray-500 font-medium">Date</label>
                          <p className="text-gray-900">{result.details.date}</p>
                        </div>
                      )}
                      {result.details.location && (
                        <div>
                          <label className="text-xs text-gray-500 font-medium">Location</label>
                          <p className="text-gray-900">{result.details.location}</p>
                        </div>
                      )}
                      {result.details.amount && (
                        <div>
                          <label className="text-xs text-gray-500 font-medium">Amount</label>
                          <p className="text-gray-900 font-medium">
                            ${result.details.amount?.toFixed(2)} {result.details.currency}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Checklist Items */}
                {result.checklist_items && result.checklist_items.length > 0 && (
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Checklist</label>
                    <div className="mt-2 space-y-2">
                      {result.checklist_items.map((item, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <input type="checkbox" className="mt-1 rounded" />
                          <span className="text-sm text-gray-700">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Empty State */}
            {!result && !analyzing && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="text-center py-12 text-gray-400">
                  <DocumentTextIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">
                    {mode === "receipt"
                      ? "Upload a receipt to see extracted data here"
                      : "Upload a document to see extracted info here"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Expenses;