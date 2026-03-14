import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSearchAndFilter } from '../../services/useSearchandFilter';
import SearchBar from '../../components/SearchBar'; 

export default function AllPollsPage() {
  // Grab the tripId from the URL (e.g., /trips/123/polls)
  const { tripId } = useParams(); 
  const [allPolls, setAllPolls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Fetch the real data from FastAPI when the page loads
  useEffect(() => {
    async function fetchPolls() {
      if (!tripId) {
        setError("No trip ID provided.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`http://localhost:8000/polls/trips/${tripId}/polls`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Failed to fetch polls");
        }

        const data = await response.json();
        setAllPolls(data);
      } catch (err) {
        console.error("Error fetching polls:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPolls();
  }, [tripId]); // Re-run if the tripId changes

  // 2. Plug the real data into your custom hook (swapped 'question' for 'title')
  const { 
    searchQuery, setSearchQuery, 
    activeFilter, setActiveFilter, 
    filteredData 
  } = useSearchAndFilter(allPolls, ['title']);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">All Polls</h1>

        {/* 3. The Search Bar Component */}
        <SearchBar 
          searchQuery={searchQuery} 
          onSearchChange={setSearchQuery}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          placeholder="Search for a poll..."
        />

        {/* 4. Display Error, Loading State, or Data */}
        {error ? (
          <div className="text-center py-10 bg-red-50 text-red-600 rounded-xl border border-red-100">
            {error}
          </div>
        ) : isLoading ? (
          <div className="text-center py-10 text-gray-500">Loading polls...</div>
        ) : (
          <div className="space-y-4">
            {filteredData.map(poll => (
              <div key={poll.id} className="p-6 bg-white rounded-xl shadow-sm border border-gray-200 hover:border-blue-400 transition">
                <div className="flex justify-between items-start">
                  <div>
                    {/* Swapped poll.question for poll.title to match the backend */}
                    <h3 className="font-semibold text-lg text-gray-800">{poll.title}</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Created on {new Date(poll.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${poll.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {poll.is_active ? 'Active' : 'Closed'}
                  </span>
                </div>
              </div>
            ))}
            
            {/* If the search finds nothing */}
            {filteredData.length === 0 && (
              <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
                <p className="text-gray-500">No polls match your search.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}