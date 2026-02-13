import ChatLayout from "../../components/chatbox/chatLayout";

export default function MessagesPage() {
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (!user) return <div className="p-6">Please log in.</div>;

  return (
    <div className="p-4">
      <ChatLayout currentUser={user} />
    </div>
  );
}
