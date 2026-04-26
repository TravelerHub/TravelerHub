import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE, getToken } from '../services/api.js';
import { setActiveGroupId } from '../services/groupService.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';

export default function OnboardingModal({ onClose }) {
  const [step, setStep] = useState(1);
  const modalRef = useFocusTrap(true);
  const [tripName, setTripName] = useState('');
  const [groupId, setGroupId] = useState(null);
  const [inviteLink, setInviteLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  // Step 1 → 2: create the trip, then generate invite link
  async function handleCreateTrip() {
    if (!tripName.trim()) return;
    setLoading(true);
    setError('');
    try {
      // 1. Create the group/trip
      const createRes = await fetch(`${API_BASE}/groups/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ name: tripName.trim() }),
      });

      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to create trip (${createRes.status})`);
      }

      const createData = await createRes.json();
      const newGroupId = createData.group_id || createData.trip?.id;
      if (!newGroupId) throw new Error('No group ID returned from server');

      setGroupId(newGroupId);

      // 2. Generate invite link
      const inviteRes = await fetch(`${API_BASE}/groups/${newGroupId}/invite-link`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      let inviteUrl = `${window.location.origin}/join/`;
      if (inviteRes.ok) {
        const inviteData = await inviteRes.json();
        // inviteData.invite_url is the full URL from the server; we show it directly
        inviteUrl = inviteData.invite_url || inviteUrl;
      }
      // Even if invite generation fails we can still proceed — show a fallback URL
      setInviteLink(inviteUrl);
      setStep(2);
    } catch (err) {
      console.error('[OnboardingModal] createTrip error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Step 3 "Let's go!" — store active group and navigate to dashboard
  function handleFinish() {
    if (groupId) {
      setActiveGroupId(groupId);
    }
    onClose();
    navigate('/dashboard');
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available (e.g. non-https dev env)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="onboarding-modal-title">
      <div ref={modalRef} className="relative bg-[#160f29] border border-[#183a37] rounded-2xl p-6 sm:p-8 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-white/40 hover:text-white/80 text-xl"
        ><span aria-hidden="true">✕</span></button>

        {/* Step indicator */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-[#c8a96e]' : 'bg-white/10'}`} />
          ))}
        </div>

        {step === 1 && (
          <div>
            <h2 id="onboarding-modal-title" className="text-white text-2xl font-bold mb-2">Plan your first trip ✈️</h2>
            <p className="text-white/50 text-sm mb-6">Give your adventure a name to get started.</p>
            <label htmlFor="trip-name" className="sr-only">Trip name</label>
            <input
              id="trip-name"
              value={tripName}
              onChange={e => setTripName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && tripName.trim() && !loading && handleCreateTrip()}
              placeholder="e.g. Tokyo 2025"
              className="w-full bg-[#183a37]/50 border border-[#183a37] rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#c8a96e] mb-4"
            />
            {error && (
              <p className="text-red-400 text-sm mb-3">{error}</p>
            )}
            <button
              disabled={!tripName.trim() || loading}
              onClick={handleCreateTrip}
              className="w-full py-3 rounded-xl bg-[#c8a96e] text-[#160f29] font-semibold disabled:opacity-40 hover:bg-[#d4b87a] transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-[#160f29]/40 border-t-[#160f29] rounded-full animate-spin" />
                  Creating…
                </>
              ) : 'Next →'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 id="onboarding-modal-title" className="text-white text-2xl font-bold mb-2">Invite your crew 👥</h2>
            <p className="text-white/50 text-sm mb-6">Share this link so your group can join.</p>
            <div className="flex gap-2 mb-4">
              <label htmlFor="invite-link" className="sr-only">Invite link</label>
              <input
                id="invite-link"
                readOnly
                value={inviteLink}
                aria-label="Invite link"
                className="flex-1 bg-[#183a37]/50 border border-[#183a37] rounded-xl px-4 py-3 text-white/70 text-sm focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                aria-label={copied ? 'Link copied' : 'Copy invite link'}
                className="px-4 py-3 rounded-xl bg-[#183a37] text-[#c8a96e] text-sm font-semibold hover:bg-[#183a37]/80 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <button
              onClick={() => setStep(3)}
              className="w-full py-3 rounded-xl bg-[#c8a96e] text-[#160f29] font-semibold hover:bg-[#d4b87a] transition-colors"
            >Next →</button>
          </div>
        )}

        {step === 3 && (
          <div className="text-center">
            <div className="text-6xl mb-4" aria-hidden="true">🎉</div>
            <h2 id="onboarding-modal-title" className="text-white text-2xl font-bold mb-2">You're all set!</h2>
            <p className="text-white/50 text-sm mb-6">TravelerHub is ready. Start planning, voting on spots, and exploring together.</p>
            <button
              onClick={handleFinish}
              className="w-full py-3 rounded-xl bg-[#c8a96e] text-[#160f29] font-semibold hover:bg-[#d4b87a] transition-colors"
            >Let's go! 🚀</button>
          </div>
        )}
      </div>
    </div>
  );
}
