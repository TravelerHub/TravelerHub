function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function MessageBubble({ msg, isMine }) {
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[75%] rounded-2xl px-3 py-2 shadow-sm border text-sm",
          isMine
            ? "bg-white border-gray-200"
            : "bg-gray-100 border-gray-200",
        ].join(" ")}
      >
        <div className="text-gray-800 whitespace-pre-wrap break-words">
          {msg.content}
        </div>
        <div className="mt-1 text-[11px] text-gray-500">
          {formatTime(msg.sent_datetime)}
        </div>
      </div>
    </div>
  );
}
