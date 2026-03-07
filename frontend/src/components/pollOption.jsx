

export function PollOption({ option, isSelected, onSelect, isActive }) {
  const handleClick = () => {
    if (isActive) {
      onSelect(option.id);
    }
  };

  return (
    <div
      className={`poll-option ${isSelected ? "selected" : ""} ${!isActive ? "disabled" : ""}`}
      onClick={handleClick}
      style={{
        padding: "12px",
        margin: "8px 0",
        border: isSelected ? "2px solid #007bff" : "1px solid #ddd",
        borderRadius: "6px",
        cursor: isActive ? "pointer" : "not-allowed",
        backgroundColor: isSelected ? "#e7f3ff" : "#fff",
        opacity: isActive ? 1 : 0.6
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: "500" }}>{option.text}</span>
        <span style={{ color: "#666", fontSize: "14px" }}>
          {option.vote_count} votes
        </span>
      </div>
      {option.description && (
        <p style={{ margin: "8px 0 0 0", color: "#888", fontSize: "14px" }}>
          {option.description}
        </p>
      )}
    </div>
  );
}