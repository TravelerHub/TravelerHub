// Floating "Today" / "Yesterday" / "Mar 14, 2026" pill between message clusters.

function formatDayLabel(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";

  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

export default function DateDivider({ dateStr }) {
  const label = formatDayLabel(dateStr);
  if (!label) return null;
  return (
    <div className="flex items-center justify-center my-3" role="separator" aria-label={label}>
      <span
        className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide"
        style={{
          background: "rgba(22, 15, 41, 0.06)",
          color: "#5c6b73",
          backdropFilter: "blur(4px)",
        }}
      >
        {label}
      </span>
    </div>
  );
}
