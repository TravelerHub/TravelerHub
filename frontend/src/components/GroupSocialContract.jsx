import { useState, useEffect } from 'react';
import { getGroupSettings, updateGroupSettings } from '../services/gcsService';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

const VOTE_MODES = [
  { value: 'majority', label: 'Majority Rules', desc: 'Most votes wins. Minority constraints go to a group vote.' },
  { value: 'unanimous', label: 'Unanimous', desc: 'Any single constraint violation blocks the decision.' },
  { value: 'leader_decides', label: 'Leader Decides', desc: 'Leader sees violations but makes the final call.' },
];

const VETO_SCOPES = [
  { value: 'tolls', label: 'Toll Roads' },
  { value: 'dietary_restrictions', label: 'Dietary Restrictions' },
  { value: 'avoid_types', label: 'Avoid Types (e.g. nightclubs)' },
];

export default function GroupSocialContract({ tripId, isLeader }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [tripId]);

  const loadSettings = async () => {
    if (!tripId) return;
    try {
      const data = await getGroupSettings(tripId);
      setSettings(data);
    } catch (e) {
      console.error('Failed to load group settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updates) => {
    if (!isLeader) return;
    setSaving(true);
    try {
      const data = await updateGroupSettings(tripId, updates);
      setSettings(data);
    } catch (e) {
      console.error('Failed to save settings:', e);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-400 animate-pulse">Loading group settings...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheckIcon className="w-5 h-5 text-emerald-600" />
        <h3 className="font-semibold text-sm text-gray-800">Group Social Contract</h3>
      </div>

      <p className="text-xs text-gray-500">
        How should the group handle disagreements and individual constraints?
      </p>

      {/* Vote Mode */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-gray-600">Decision Mode</p>
        {VOTE_MODES.map((mode) => (
          <button
            key={mode.value}
            disabled={!isLeader}
            onClick={() => handleSave({ vote_mode: mode.value })}
            className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
              settings.vote_mode === mode.value
                ? 'bg-emerald-50 border-emerald-300'
                : 'bg-gray-50 border-gray-200 hover:border-gray-300'
            } ${!isLeader ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
          >
            <p className={`text-xs font-medium ${
              settings.vote_mode === mode.value ? 'text-emerald-700' : 'text-gray-700'
            }`}>
              {mode.label}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">{mode.desc}</p>
          </button>
        ))}
      </div>

      {/* Veto Toggle */}
      <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
        <div>
          <p className="text-xs font-medium text-gray-700">Veto Power</p>
          <p className="text-[10px] text-gray-500">Allow individuals to block decisions that violate their constraints</p>
        </div>
        <button
          disabled={!isLeader}
          onClick={() => handleSave({ veto_enabled: !settings.veto_enabled })}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            settings.veto_enabled ? 'bg-emerald-500' : 'bg-gray-300'
          } ${!isLeader ? 'opacity-60' : ''}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            settings.veto_enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`} />
        </button>
      </div>

      {/* Veto Scope */}
      {settings.veto_enabled && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-600">What can trigger a veto?</p>
          {VETO_SCOPES.map((scope) => {
            const active = (settings.veto_scope || []).includes(scope.value);
            return (
              <label key={scope.value} className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  disabled={!isLeader}
                  onChange={() => {
                    const current = settings.veto_scope || [];
                    const next = active
                      ? current.filter((s) => s !== scope.value)
                      : [...current, scope.value];
                    handleSave({ veto_scope: next });
                  }}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                {scope.label}
              </label>
            );
          })}
        </div>
      )}

      {!isLeader && (
        <p className="text-[10px] text-gray-400 italic">Only the trip leader can modify these settings.</p>
      )}

      {saving && <p className="text-[10px] text-emerald-600 animate-pulse">Saving...</p>}
    </div>
  );
}
