import { useEffect, useState } from "react";
import { pollService } from "../services/pollService";

export function PollResults({ pollId }) {
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const data = await pollService.getPollResults(pollId);
        setPoll(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [pollId]);

  if (loading) return <p>Loading poll results...</p>;
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;
  if (!poll) return <p>Poll not found</p>;

  const maxVotes = Math.max(...poll.options.map(o => o.vote_count), 1);

  return (
    <div style={{ padding: "20px", border: "1px solid #ddd", borderRadius: "8px" }}>
      <h3>{poll.title}</h3>
      {poll.options.map((option) => (
        <div key={option.id} style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span>{option.text}</span>
            <span>{option.vote_count} votes</span>
          </div>
          <div style={{
            width: "100%",
            height: "24px",
            backgroundColor: "#e0e0e0",
            borderRadius: "4px",
            overflow: "hidden"
          }}>
            <div style={{
              width: `${(option.vote_count / maxVotes) * 100}%`,
              height: "100%",
              backgroundColor: "#007bff",
              transition: "width 0.3s ease"
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}