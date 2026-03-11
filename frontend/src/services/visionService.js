import { API_BASE } from '../config';

function getToken() {
  return localStorage.getItem("token");
}

export const analyzeReceipt = async (file) => {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/vision/analyze-receipt`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to analyze receipt");
  }

  return response.json();
};

export const analyzeDocument = async (file) => {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/vision/analyze-document`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to analyze document");
  }

  return response.json();
};