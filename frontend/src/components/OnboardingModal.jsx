import React, { useState } from 'react';

export default function OnboardingModal({ onClose }) {
  const [step, setStep] = useState(1);
  const [tripName, setTripName] = useState('');
  const inviteLink = window.location.origin + '/join/demo';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative bg-[#160f29] border border-[#183a37] rounded-2xl p-8 w-full max-w-md mx-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white/80 text-xl"
        >✕</button>
        
        {/* Step indicator */}
        <div className="flex gap-2 mb-6">
          {[1,2,3].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-[#c8a96e]' : 'bg-white/10'}`} />
          ))}
        </div>

        {step === 1 && (
          <div>
            <h2 className="text-white text-2xl font-bold mb-2">Plan your first trip ✈️</h2>
            <p className="text-white/50 text-sm mb-6">Give your adventure a name to get started.</p>
            <input
              value={tripName}
              onChange={e => setTripName(e.target.value)}
              placeholder="e.g. Tokyo 2025"
              className="w-full bg-[#183a37]/50 border border-[#183a37] rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#c8a96e] mb-4"
            />
            <button
              disabled={!tripName.trim()}
              onClick={() => setStep(2)}
              className="w-full py-3 rounded-xl bg-[#c8a96e] text-[#160f29] font-semibold disabled:opacity-40 hover:bg-[#d4b87a] transition-colors"
            >Next →</button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-white text-2xl font-bold mb-2">Invite your crew 👥</h2>
            <p className="text-white/50 text-sm mb-6">Share this link so your group can join.</p>
            <div className="flex gap-2 mb-4">
              <input
                readOnly
                value={inviteLink}
                className="flex-1 bg-[#183a37]/50 border border-[#183a37] rounded-xl px-4 py-3 text-white/70 text-sm focus:outline-none"
              />
              <button
                onClick={() => navigator.clipboard.writeText(inviteLink)}
                className="px-4 py-3 rounded-xl bg-[#183a37] text-[#c8a96e] text-sm font-semibold hover:bg-[#183a37]/80 transition-colors"
              >Copy</button>
            </div>
            <button
              onClick={() => setStep(3)}
              className="w-full py-3 rounded-xl bg-[#c8a96e] text-[#160f29] font-semibold hover:bg-[#d4b87a] transition-colors"
            >Next →</button>
          </div>
        )}

        {step === 3 && (
          <div className="text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-white text-2xl font-bold mb-2">You're all set!</h2>
            <p className="text-white/50 text-sm mb-6">TravelerHub is ready. Start planning, voting on spots, and exploring together.</p>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-[#c8a96e] text-[#160f29] font-semibold hover:bg-[#d4b87a] transition-colors"
            >Let's go! 🚀</button>
          </div>
        )}
      </div>
    </div>
  );
}
