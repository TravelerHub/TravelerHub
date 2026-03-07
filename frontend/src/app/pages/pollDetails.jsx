import { useParams, useNavigate } from "react-router-dom";
import { PollResults } from "../../components/pollResults";

export default function PollDetail() {
  const { pollId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 md:p-12">
      <div className="max-w-2xl mx-auto">
        
        {/* Back Button */}
        <button 
          onClick={() => navigate(-1)} 
          className="text-blue-600 hover:text-blue-800 mb-6 flex items-center gap-2 font-medium transition"
        >
          ← Back to Dashboard
        </button>

        {/* Poll Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
          
          <div className="mb-6 border-b border-gray-100 pb-4">
            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
              Poll ID: {pollId}
            </span>
            <h1 className="text-2xl font-bold text-gray-800 mt-4">
              Trip Details & Voting
            </h1>
          </div>

          {/* This is YOUR component, doing all the heavy lifting! */}
          <PollResults pollId={pollId} />

        </div>
      </div>
    </div>
  );
}