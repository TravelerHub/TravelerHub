import { useState, useEffect } from 'react';
import {
  HandThumbUpIcon,
  HandThumbDownIcon,
  TrashIcon,
  MapPinIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  XMarkIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { HandThumbUpIcon as ThumbUpSolid, HandThumbDownIcon as ThumbDownSolid } from '@heroicons/react/24/solid';
import {
  getShortlist,
  voteOnNomination,
  nominatePlace,
  deleteNomination,
  detectConflicts,
} from '../services/nominationsService';

/**
 * ShortlistSidebar — collaborative voting on places the group wants to visit.
 *
 * Props:
 *   groupId         — current group ID
 *   tripId          — current trip ID
 *   visible         — whether sidebar is visible
 *   onClose         — callback to hide
 *   onAddToRoute    — callback(nomination) to add an approved place to the route
 */
export default function ShortlistSidebar({ groupId, tripId, visible, onClose, onAddToRoute }) {
  const [shortlist, setShortlist] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showNominateForm, setShowNominateForm] = useState(false);
  const [nominateData, setNominateData] = useState({ place_name: '', note: '' });

  useEffect(() => {
    if (groupId && visible) {
      loadShortlist();
      loadConflicts();
    }
  }, [groupId, tripId, visible]);

  async function loadShortlist() {
    setLoading(true);
    try {
      const data = await getShortlist(groupId, tripId);
      setShortlist(data.shortlist || []);
      setMemberCount(data.member_count || 0);
    } catch (err) {
      console.error('Failed to load shortlist:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadConflicts() {
    try {
      const data = await detectConflicts(groupId, tripId);
      setConflicts(data.conflicts || []);
    } catch {
      // Non-critical
    }
  }

  async function handleVote(nominationId, vote) {
    try {
      await voteOnNomination(groupId, nominationId, vote);
      loadShortlist(); // Refresh
    } catch (err) {
      console.error('Vote failed:', err);
    }
  }

  async function handleNominate(e) {
    e.preventDefault();
    if (!nominateData.place_name.trim()) return;

    try {
      await nominatePlace(groupId, {
        trip_id: tripId,
        place_name: nominateData.place_name,
        note: nominateData.note || null,
      });
      setNominateData({ place_name: '', note: '' });
      setShowNominateForm(false);
      loadShortlist();
    } catch (err) {
      console.error('Nominate failed:', err);
    }
  }

  async function handleDelete(nominationId) {
    try {
      await deleteNomination(nominationId);
      loadShortlist();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }

  if (!visible) return null;

  const approved = shortlist.filter(n => n.status === 'approved');
  const pending = shortlist.filter(n => n.status === 'pending');

  return (
    <div className="absolute top-16 left-4 z-20 w-80 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col max-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white shrink-0">
        <div className="flex items-center gap-2">
          <MapPinIcon className="w-5 h-5" />
          <span className="font-semibold text-sm">Group Shortlist</span>
          <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full">
            {shortlist.length}
          </span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition">
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Nominate Button */}
      <div className="px-4 py-2 border-b border-gray-100 shrink-0">
        {showNominateForm ? (
          <form onSubmit={handleNominate} className="space-y-2">
            <input
              type="text"
              placeholder="Place name..."
              value={nominateData.place_name}
              onChange={e => setNominateData(d => ({ ...d, place_name: e.target.value }))}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400"
              autoFocus
            />
            <input
              type="text"
              placeholder="Note (optional)"
              value={nominateData.note}
              onChange={e => setNominateData(d => ({ ...d, note: e.target.value }))}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-3 py-1.5 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 transition"
              >
                Nominate
              </button>
              <button
                type="button"
                onClick={() => setShowNominateForm(false)}
                className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowNominateForm(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-100 transition"
          >
            <PlusIcon className="w-4 h-4" />
            Nominate a Place
          </button>
        )}
      </div>

      {/* Conflicts Warning */}
      {conflicts.length > 0 && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 shrink-0">
          <div className="flex items-center gap-1.5 mb-1">
            <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
            <span className="text-xs font-medium text-red-700">Scheduling Conflicts</span>
          </div>
          {conflicts.slice(0, 2).map((c, i) => (
            <p key={i} className="text-xs text-red-600 mt-0.5">
              {c.place_a.name} ↔ {c.place_b.name}: {c.distance_km}km apart
            </p>
          ))}
        </div>
      )}

      {/* Shortlist */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-6 text-center text-gray-400 text-sm">Loading...</div>
        ) : shortlist.length === 0 ? (
          <div className="px-4 py-6 text-center text-gray-400 text-sm">
            No nominations yet. Be the first to suggest a place!
          </div>
        ) : (
          <>
            {/* Approved places */}
            {approved.length > 0 && (
              <div>
                <p className="px-4 pt-3 pb-1 text-xs font-medium text-green-600">
                  Approved ({approved.length})
                </p>
                {approved.map(nom => (
                  <NominationCard
                    key={nom.id}
                    nom={nom}
                    memberCount={memberCount}
                    onVote={handleVote}
                    onDelete={handleDelete}
                    onAddToRoute={onAddToRoute}
                    isApproved
                  />
                ))}
              </div>
            )}

            {/* Pending places */}
            {pending.length > 0 && (
              <div>
                <p className="px-4 pt-3 pb-1 text-xs font-medium text-gray-500">
                  Pending Votes ({pending.length})
                </p>
                {pending.map(nom => (
                  <NominationCard
                    key={nom.id}
                    nom={nom}
                    memberCount={memberCount}
                    onVote={handleVote}
                    onDelete={handleDelete}
                    onAddToRoute={onAddToRoute}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 shrink-0">
        <p className="text-xs text-gray-400 text-center">
          Majority vote ({Math.ceil(memberCount / 2)}/{memberCount}) auto-approves
        </p>
      </div>
    </div>
  );
}

function NominationCard({ nom, memberCount, onVote, onDelete, onAddToRoute, isApproved = false }) {
  const votePercent = memberCount > 0 ? Math.round((nom.upvotes / memberCount) * 100) : 0;

  return (
    <div className={`px-4 py-2.5 border-b border-gray-50 last:border-0 ${isApproved ? 'bg-green-50/50' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {isApproved && <CheckCircleIcon className="w-4 h-4 text-green-500 shrink-0" />}
            <p className="text-sm font-medium text-gray-800 truncate">{nom.place_name}</p>
          </div>
          {nom.note && <p className="text-xs text-gray-400 mt-0.5 truncate">{nom.note}</p>}
          <p className="text-xs text-gray-400 mt-0.5">
            by {nom.nominated_by} · {nom.category || 'General'}
          </p>
        </div>

        {/* Vote buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onVote(nom.id, 1)}
            className={`p-1 rounded transition ${nom.my_vote === 1 ? 'text-green-600 bg-green-100' : 'text-gray-400 hover:text-green-500'}`}
          >
            {nom.my_vote === 1 ? <ThumbUpSolid className="w-4 h-4" /> : <HandThumbUpIcon className="w-4 h-4" />}
          </button>
          <span className="text-xs font-medium text-gray-600 min-w-[20px] text-center">
            {nom.net_votes}
          </span>
          <button
            onClick={() => onVote(nom.id, -1)}
            className={`p-1 rounded transition ${nom.my_vote === -1 ? 'text-red-600 bg-red-100' : 'text-gray-400 hover:text-red-500'}`}
          >
            {nom.my_vote === -1 ? <ThumbDownSolid className="w-4 h-4" /> : <HandThumbDownIcon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Vote progress bar */}
      <div className="mt-1.5 flex items-center gap-2">
        <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isApproved ? 'bg-green-400' : 'bg-blue-400'}`}
            style={{ width: `${votePercent}%` }}
          />
        </div>
        <span className="text-xs text-gray-400">{nom.upvotes}/{memberCount}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-1.5">
        {isApproved && onAddToRoute && (
          <button
            onClick={() => onAddToRoute(nom)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            + Add to Route
          </button>
        )}
        <button
          onClick={() => onDelete(nom.id)}
          className="text-xs text-gray-400 hover:text-red-500 ml-auto"
        >
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
