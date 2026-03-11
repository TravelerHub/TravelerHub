const BASE_URL = "http://127.0.0.1:8000";

function getToken() {
  return localStorage.getItem("token");
}

export async function sendMessage(message, conversationId = null) {
  const token = getToken();
  const response = await fetch(`${BASE_URL}/ai-chat/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
    }),
  });
  if (!response.ok) throw new Error("Failed to send message");
  return response.json();
}

export async function getConversations() {
  const token = getToken();
  const response = await fetch(`${BASE_URL}/ai-chat/conversations`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Failed to load conversations");
  return response.json();
}

export async function getConversationMessages(conversationId) {
  const token = getToken();
  const response = await fetch(
    `${BASE_URL}/ai-chat/conversations/${conversationId}/messages`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) throw new Error("Failed to load messages");
  return response.json();
}

export async function deleteConversation(conversationId) {
  const token = getToken();
  const response = await fetch(
    `${BASE_URL}/ai-chat/conversations/${conversationId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!response.ok) throw new Error("Failed to delete conversation");
  return response.json();
}
