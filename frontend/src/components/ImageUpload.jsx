// src/components/ImageUpload.jsx
import { useState } from "react";
import { uploadImage } from "../lib/api"; 

export default function ImageUpload({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const safePreview = preview && preview.startsWith("blob:") ? preview : null;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    setError("");
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const result = await uploadImage(file);
      console.log("Upload success:", result);
      
      if (onUploadSuccess) onUploadSuccess(result);

      setSuccess("Image uploaded.");
      setTimeout(() => setSuccess(""), 2500);
      setFile(null);
      setPreview(null);
    } catch (err) {
      console.error(err);
      setError("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg shadow-md bg-white max-w-sm mx-auto mt-10">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Upload Photo</h2>
      
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="block w-full text-sm text-gray-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-full file:border-0
          file:text-sm file:font-semibold
          file:bg-violet-50 file:text-violet-700
          hover:file:bg-violet-100
        "
      />

      {safePreview && (
        <div className="mt-4">
          <p className="text-sm text-gray-500 mb-2">Preview:</p>
          <img
            src={safePreview}
            alt="Preview"
            loading="lazy"
            decoding="async"
            className="w-full h-48 object-cover rounded-md border"
          />
        </div>
      )}

      {error && (
        <p className="text-red-500 text-sm mt-2">{error}</p>
      )}

      {success && (
        <p className="text-green-600 text-sm mt-2">{success}</p>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className={`mt-4 w-full py-2 px-4 rounded-md text-white font-medium transition-colors
          ${!file || uploading 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700'
          }
        `}
      >
        {uploading ? "Uploading..." : "Upload Image"}
      </button>
    </div>
  );
}