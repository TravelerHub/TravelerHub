import { useState } from "react";
import { PollOption } from "./pollOption";
import { pollService } from "../services/pollService";

export function Poll({ poll, onVoteSuccess }) {
  const [selectedOption, setSelectedOption] = useState(poll.user_vote_id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleVote = async () => {
    if (!selectedOption) {
      setError("Please select an option");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await pollService.castVote({
        poll_id: poll.id,
        option_id: selectedOption
      });
      onVoteSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      padding: "20px",
      border: "1px solid #ddd",
      borderRadius: "8px",
      marginBottom: "20px",
      backgroundColor: "#f9f9f9"
    }}>
      <h3 style={{ marginTop: 0 }}>{poll.title}</h3>
      {poll.description && (
        <p style={{ color: "#666", marginBottom: "16px" }}>{poll.description}</p>
      )}

      <div style={{ marginBottom: "16px" }}>
        {poll.options.map((option) => (
          <PollOption
            key={option.id}
            option={option}
            isSelected={selectedOption === option.id}
            onSelect={setSelectedOption}
            isActive={poll.is_active}
          />
        ))}
      </div>

      {error && <p style={{ color: "#d32f2f", marginBottom: "12px" }}>{error}</p>}

      {poll.is_active && (
        <button
          onClick={handleVote}
          disabled={loading || !selectedOption}
          style={{
            padding: "10px 20px",
            backgroundColor: selectedOption && !loading ? "#007bff" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: selectedOption && !loading ? "pointer" : "not-allowed",
            fontSize: "16px"
          }}
        >
          {loading ? "Voting..." : "Vote"}
        </button>
      )}

      {!poll.is_active && (
        <p style={{ color: "#888", fontStyle: "italic" }}>Poll is closed</p>
      )}
    </div>
  );
}