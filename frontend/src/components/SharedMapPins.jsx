/**
 * SharedMapPins — collaborative real-time map annotations for group travel.
 *
 * This is the feature neither Google Maps nor Waze has for groups:
 * any member drops a pin and every other member sees it appear on the map
 * in real-time via Supabase Realtime (< 200 ms latency).
 *
 * Props:
 *   tripId        — active trip/group UUID
 *   onPinsChange  — (pins: Pin[]) → void — called whenever the pin list changes so
 *                   Navigation.jsx can pass them into <Map sharedPins={...} />
 *   onFlyTo       — (lat, lng) → void — centers map on a pin
 *   addPinMode    — boolean — when true the next map click creates a pin here
 *   pendingCoords — {lat, lng} | null — coordinates from the last map click (Navigation passes this)
 *   onPendingConsumed — () → void — called after we consume the pending coords
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getPins, createPin, deletePin, upvotePin, updatePin } from '../services/mapPinsService';
import {
  MapPinIcon,
  TrashIcon,
  HandThumbUpIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  SignalIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { HandThumbUpIcon as ThumbUpSolid } from '@heroicons/react/24/solid';

const EMOJI_OPTIONS = ['📍', '🍕', '🏨', '🏖️', '🎡', '⛽', '🛒', '☕', '🍺', '🎭', '🏥', '⚠️', '⭐', '🎯'];
const COLOR_OPTIONS = ['#183a37', '#dc2626', '#7c3aed', '#0284c7', '#d97706', '#16a34a', '#db2777'];

export default function SharedMapPins({
  tripId,
  onPinsChange,
  onFlyTo,
  addPinMode = false,
  pendingCoords = null,
  onPendingConsumed,
}) {
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState('disconnected'); // connected | disconnected | error
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formEmoji, setFormEmoji] = useState('📍');
  const [formColor, setFormColor] = useState('#183a37');
  const [formCoords, setFormCoords] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNote, setEditNote] = useState('');
  const channelRef = useRef(null);

  // Propagate pin changes to parent for map rendering
  useEffect(() => {
    onPinsChange?.(pins);
  }, [pins, onPinsChange]);

  // When addPinMode is on and a map click arrives via pendingCoords, open the form
  useEffect(() => {
    if (addPinMode && pendingCoords) {
      setFormCoords(pendingCoords);
      setFormTitle('');
      setFormNote('');
      setShowForm(true);
      onPendingConsumed?.();
    }
  }, [addPinMode, pendingCoords, onPendingConsumed]);

  // Initial fetch
  const fetchPins = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    try {
      const data = await getPins(tripId);
      setPins(data);
    } catch (e) {
      console.error('SharedMapPins fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchPins();
  }, [fetchPins]);

  // Supabase Realtime subscription — broadcasts INSERT/UPDATE/DELETE to all members
  useEffect(() => {
    if (!tripId || !supabase) return;

    const channel = supabase
      .channel(`shared_map_pins:trip:${tripId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_map_pins',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPins((prev) => {
              if (prev.some((p) => p.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          } else if (payload.eventType === 'UPDATE') {
            setPins((prev) =>
              prev.map((p) => (p.id === payload.new.id ? payload.new : p))
            );
          } else if (payload.eventType === 'DELETE') {
            setPins((prev) => prev.filter((p) => p.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setRealtimeStatus('error');
      });

    channelRef.current = channel;
    setRealtimeStatus('connected');

    return () => {
      supabase.removeChannel(channel);
      setRealtimeStatus('disconnected');
    };
  }, [tripId]);

  // Create a new pin
  const handleCreate = async () => {
    if (!formTitle.trim() || !formCoords) return;
    setSaving(true);
    try {
      await createPin({
        tripId,
        lat: formCoords.lat,
        lng: formCoords.lng,
        title: formTitle.trim(),
        note: formNote.trim() || null,
        emoji: formEmoji,
        color: formColor,
      });
      // Realtime will pick up the INSERT — no manual state update needed
      setShowForm(false);
      setFormTitle('');
      setFormNote('');
      setFormCoords(null);
    } catch (e) {
      console.error('Create pin error:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pinId) => {
    try {
      await deletePin(pinId);
      // Realtime will pick up DELETE
    } catch (e) {
      console.error('Delete pin error:', e);
    }
  };

  const handleUpvote = async (pinId) => {
    try {
      const updated = await upvotePin(pinId);
      setPins((prev) => prev.map((p) => (p.id === pinId ? { ...p, ...updated } : p)));
    } catch (e) {
      console.error('Upvote error:', e);
    }
  };

  const startEdit = (pin) => {
    setEditingId(pin.id);
    setEditTitle(pin.title);
    setEditNote(pin.note || '');
  };

  const saveEdit = async (pin) => {
    try {
      await updatePin(pin.id, { title: editTitle, note: editNote || null, emoji: pin.emoji, color: pin.color });
    } catch (e) {
      console.error('Update pin error:', e);
    }
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const currentUserId = (() => {
    try {
      const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (raw) return JSON.parse(raw)?.id || JSON.parse(raw)?.user_id;
    } catch {}
    return null;
  })();

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPinIcon className="w-4 h-4" style={{ color: '#183a37' }} />
          <h3 className="text-sm font-semibold" style={{ color: '#160f29' }}>
            Shared Pins
          </h3>
          {pins.length > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: '#f0f0e8', color: '#5c6b73' }}
            >
              {pins.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Realtime indicator */}
          <span className="flex items-center gap-1">
            <SignalIcon
              className="w-3 h-3"
              style={{ color: realtimeStatus === 'connected' ? '#16a34a' : '#9ca3af' }}
            />
            <span
              className="text-xs"
              style={{ color: realtimeStatus === 'connected' ? '#16a34a' : '#9ca3af' }}
            >
              {realtimeStatus === 'connected' ? 'LIVE' : 'offline'}
            </span>
          </span>
        </div>
      </div>

      {/* Add-pin hint */}
      {addPinMode && (
        <div
          className="text-xs px-3 py-2 rounded-lg text-center animate-pulse"
          style={{ background: '#fef3c7', color: '#92400e' }}
        >
          📍 Click anywhere on the map to drop a pin
        </div>
      )}

      {/* New pin form (shown after map click) */}
      {showForm && formCoords && (
        <div
          className="rounded-xl border p-3 space-y-2"
          style={{ background: '#f8f8f3', borderColor: '#d1d1c7' }}
        >
          <p className="text-xs font-medium" style={{ color: '#5c6b73' }}>
            📍 {formCoords.lat.toFixed(5)}, {formCoords.lng.toFixed(5)}
          </p>

          <input
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Pin title (required)"
            className="w-full text-sm border rounded-lg px-3 py-1.5 focus:outline-none"
            style={{ borderColor: '#d1d1c7', background: 'white' }}
            autoFocus
          />
          <textarea
            value={formNote}
            onChange={(e) => setFormNote(e.target.value)}
            placeholder="Add a note (optional)"
            rows={2}
            className="w-full text-sm border rounded-lg px-3 py-1.5 focus:outline-none resize-none"
            style={{ borderColor: '#d1d1c7', background: 'white' }}
          />

          {/* Emoji picker */}
          <div className="flex flex-wrap gap-1">
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                onClick={() => setFormEmoji(e)}
                className={`text-base rounded-md p-0.5 transition ${formEmoji === e ? 'ring-2 ring-offset-1' : ''}`}
                style={formEmoji === e ? { ringColor: '#183a37' } : {}}
              >
                {e}
              </button>
            ))}
          </div>

          {/* Color picker */}
          <div className="flex gap-1.5">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => setFormColor(c)}
                className="w-5 h-5 rounded-full border-2 transition"
                style={{
                  background: c,
                  borderColor: formColor === c ? 'white' : 'transparent',
                  boxShadow: formColor === c ? `0 0 0 2px ${c}` : 'none',
                }}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !formTitle.trim()}
              className="flex-1 text-sm py-1.5 rounded-lg font-medium transition disabled:opacity-50"
              style={{ background: '#183a37', color: 'white' }}
            >
              {saving ? 'Dropping…' : `${formEmoji} Drop Pin`}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-3 text-sm py-1.5 rounded-lg transition"
              style={{ background: '#e8e8e0', color: '#160f29' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Pin list */}
      {loading && pins.length === 0 ? (
        <p className="text-xs text-center py-3" style={{ color: '#9ca3af' }}>Loading…</p>
      ) : pins.length === 0 ? (
        <div className="text-center py-4" style={{ color: '#9ca3af' }}>
          <MapPinIcon className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
          <p className="text-xs">No shared pins yet</p>
          <p className="text-xs mt-0.5">Enable Pin Mode and click the map to add one</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
          {pins.map((pin) => {
            const isOwner = pin.user_id === currentUserId;
            const isEditing = editingId === pin.id;
            const upvoted = Array.isArray(pin.upvoters) && pin.upvoters.includes(currentUserId);

            return (
              <div
                key={pin.id}
                className="rounded-lg border p-2.5 space-y-1.5"
                style={{ background: '#fafaf7', borderColor: '#e0e0d8' }}
              >
                {isEditing ? (
                  <>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full text-xs border rounded px-2 py-1"
                      style={{ borderColor: '#d1d1c7' }}
                    />
                    <textarea
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      rows={2}
                      className="w-full text-xs border rounded px-2 py-1 resize-none"
                      style={{ borderColor: '#d1d1c7' }}
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => saveEdit(pin)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                        style={{ background: '#183a37', color: 'white' }}
                      >
                        <CheckIcon className="w-3 h-3" /> Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                        style={{ background: '#e8e8e0', color: '#160f29' }}
                      >
                        <XMarkIcon className="w-3 h-3" /> Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      {/* Emoji dot with color */}
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 mt-0.5"
                        style={{ background: pin.color || '#183a37' }}
                      >
                        {pin.emoji || '📍'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => onFlyTo?.(pin.lat, pin.lng)}
                          className="text-xs font-medium text-left hover:underline truncate block w-full"
                          style={{ color: '#160f29' }}
                        >
                          {pin.title}
                        </button>
                        {pin.note && (
                          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#5c6b73' }}>
                            {pin.note}
                          </p>
                        )}
                        <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                          by {pin.username || 'Member'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pl-9">
                      {/* Upvote */}
                      <button
                        onClick={() => handleUpvote(pin.id)}
                        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition"
                        style={{
                          background: upvoted ? '#dcfce7' : '#f0f0e8',
                          color: upvoted ? '#166534' : '#5c6b73',
                        }}
                      >
                        {upvoted
                          ? <ThumbUpSolid className="w-3 h-3" />
                          : <HandThumbUpIcon className="w-3 h-3" />}
                        {(pin.upvoters || []).length}
                      </button>

                      {/* Navigate */}
                      <button
                        onClick={() => onFlyTo?.(pin.lat, pin.lng)}
                        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition"
                        style={{ background: '#f0f0e8', color: '#5c6b73' }}
                      >
                        <MapPinIcon className="w-3 h-3" /> Go
                      </button>

                      {/* Owner controls */}
                      {isOwner && (
                        <>
                          <button
                            onClick={() => startEdit(pin)}
                            className="ml-auto p-0.5 rounded transition hover:opacity-70"
                            style={{ color: '#9ca3af' }}
                          >
                            <PencilIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(pin.id)}
                            className="p-0.5 rounded transition hover:opacity-70"
                            style={{ color: '#ef4444' }}
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
