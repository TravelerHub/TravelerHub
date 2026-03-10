const API_BASE = 'http://localhost:8000';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function saveChecklist({ document_title, document_type, source_location, source_address, trip_id, items }) {
  const response = await fetch(`${API_BASE}/checklists/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ document_title, document_type, source_location, source_address, trip_id, items }),
  });
  if (!response.ok) throw new Error('Failed to save checklist');
  return response.json();
}

export async function getChecklists() {
  const response = await fetch(`${API_BASE}/checklists/`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to load checklists');
  return response.json();
}

export async function toggleChecklistItem(itemId, isCompleted) {
  const response = await fetch(`${API_BASE}/checklists/items/${itemId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ is_completed: isCompleted }),
  });
  if (!response.ok) throw new Error('Failed to update item');
  return response.json();
}

export async function deleteChecklist(checklistId) {
  const response = await fetch(`${API_BASE}/checklists/${checklistId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to delete checklist');
  return response.json();
}
