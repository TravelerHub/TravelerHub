import { useNavigate } from 'react-router-dom';
export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#160f29] flex flex-col items-center justify-center text-white">
      <div className="text-8xl mb-4">🗺️</div>
      <h1 className="text-4xl font-bold mb-2">Lost?</h1>
      <p className="text-white/50 mb-8">This page doesn't exist on the map.</p>
      <button
        onClick={() => navigate('/')}
        className="px-6 py-3 rounded-xl bg-[#c8a96e] text-[#160f29] font-semibold hover:bg-[#d4b87a] transition-colors"
      >
        Back to home
      </button>
    </div>
  );
}
