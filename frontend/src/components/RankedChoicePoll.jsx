import { useState, useEffect } from 'react';
import { submitRankedVote, getBordaResults, getFrustrationIndex } from '../services/smartRouteService';
import { API_BASE } from '../config';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { TrophyIcon, ArrowsUpDownIcon, ChartBarIcon } from '@heroicons/react/24/outline';

export default function RankedChoicePoll({ pollId, tripId, onClose }) {
  const [options, setOptions] = useState([]);
  const [rankings, setRankings] = useState([]); // user's drag-ordered ranking
  const [results, setResults] = useState(null);
  const [frustration, setFrustration] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    loadPoll();
  }, [pollId]);

  const loadPoll = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/polls/${pollId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const poll = await res.json();
      setOptions(poll.options || []);
      setRankings((poll.options || []).map((o) => o.id));

      if (poll.status === 'closed') {
        const bordaRes = await getBordaResults(pollId);
        setResults(bordaRes);
        setShowResults(true);
      }
    } catch (e) {
      console.error('Failed to load poll:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadFrustration = async () => {
    if (!tripId) return;
    try {
      const data = await getFrustrationIndex(tripId);
      setFrustration(data);
    } catch (e) {
      console.error('Failed to load frustration index:', e);
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(rankings);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setRankings(items);
  };

  const handleSubmit = async () => {
    const rankData = rankings.map((optionId, idx) => ({
      option_id: optionId,
      rank: idx + 1,
    }));
    try {
      await submitRankedVote(pollId, rankData);
      setSubmitted(true);
      // Refresh results
      const bordaRes = await getBordaResults(pollId);
      setResults(bordaRes);
      setShowResults(true);
      loadFrustration();
    } catch (e) {
      console.error('Failed to submit vote:', e);
    }
  };

  const getOptionLabel = (optionId) => {
    const opt = options.find((o) => o.id === optionId);
    return opt?.label || opt?.text || 'Unknown';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs text-gray-400 animate-pulse">Loading poll...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrophyIcon className="w-5 h-5 text-amber-600" />
          <h3 className="font-semibold text-sm text-gray-800">Ranked Choice Vote</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Drag to rank your preferences. 1st choice gets the most points (Borda Count).
      </p>

      {/* Drag-and-drop ranking */}
      {!submitted && !showResults && (
        <>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="rankings">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                  {rankings.map((optionId, index) => (
                    <Draggable key={optionId} draggableId={optionId} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                            snapshot.isDragging
                              ? 'bg-indigo-50 border-indigo-300 shadow-md'
                              : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                            index === 0 ? 'bg-amber-100 text-amber-700' :
                            index === 1 ? 'bg-gray-200 text-gray-600' :
                            index === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {index + 1}
                          </span>
                          <span className="flex-1 text-xs font-medium text-gray-700">
                            {getOptionLabel(optionId)}
                          </span>
                          <ArrowsUpDownIcon className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <button
            onClick={handleSubmit}
            className="w-full px-3 py-2 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors"
          >
            Submit Rankings
          </button>
        </>
      )}

      {/* Borda Count Results */}
      {showResults && results && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <ChartBarIcon className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-medium text-gray-600">
              Borda Results ({results.total_voters} voter{results.total_voters !== 1 ? 's' : ''})
            </span>
          </div>

          {results.results.map((r, i) => {
            const maxScore = results.results[0]?.borda_score || 1;
            const pct = Math.round((r.borda_score / maxScore) * 100);
            return (
              <div key={r.option_id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-700">
                    {i === 0 && <span className="text-amber-600 mr-1">Winner:</span>}
                    {r.label}
                  </span>
                  <span className="text-gray-500">{r.borda_score} pts</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${i === 0 ? 'bg-amber-500' : 'bg-indigo-300'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Frustration Index */}
      {frustration?.members?.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-600">Group Harmony Index</p>
          {frustration.members.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between text-xs">
              <span className="text-gray-700">
                {m.username}
                {m.needs_boost && (
                  <span className="ml-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full text-[10px]">
                    needs priority
                  </span>
                )}
              </span>
              <span className={`font-mono ${m.win_rate < 0.3 ? 'text-red-500' : 'text-green-600'}`}>
                {Math.round(m.win_rate * 100)}% win rate
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
