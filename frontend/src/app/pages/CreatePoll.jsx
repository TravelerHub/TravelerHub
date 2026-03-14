import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function CreatePoll() {
  const navigate = useNavigate();
  // Grab the trip_id from the URL parameters
  const { tripId } = useParams(); 
  
  // Renamed 'question' to 'title' to align better with the backend schema
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => {
    setOptions([...options, '']);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const validOptions = options.filter(opt => opt.trim() !== '');

    if (!title.trim() || validOptions.length < 2) {
      setError("Please enter a title and at least two options.");
      setIsSubmitting(false);
      return;
    }

    if (!tripId) {
      setError("Trip ID is missing. Cannot create a poll without a valid trip.");
      setIsSubmitting(false);
      return;
    }

    // Format options to match the backend expectation: [{ text: "...", description: "..." }]
    const formattedOptions = validOptions.map(opt => ({
      text: opt,
      description: "" // Optional: You could add UI for option descriptions later
    }));

    try {
      // 1. Updated the URL to match the FastAPI route and include the tripId
      const response = await fetch(`http://localhost:8000/polls/trips/${tripId}/polls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 2. Uncommented Authorization to pass FastAPI's get_current_user dependency
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        // 3. Structured the payload to match the backend's PollCreate schema
        body: JSON.stringify({
          title: title,
          description: description,
          options: formattedOptions
        })
      });

      if (!response.ok) {
        // Attempt to extract the specific error message from FastAPI
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Server rejected the request');
      }

      const data = await response.json();
      
      // Teleport the user to the newly created poll page
      navigate(`/polls/${data.id}`);

    } catch (err) {
      console.error("Error creating poll:", err);
      setError(`Failed to create poll: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 md:p-12">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
        
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Create a New Poll</h1>
          <p className="text-gray-500 text-sm mt-1">Ask your group a question and let them vote.</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Poll Title (Question)</label>
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Where should we go for our next trip?"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Description (Optional)</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any extra details or context here..."
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Options</label>
            <div className="space-y-3">
              {options.map((option, index) => (
                <input 
                  key={index}
                  type="text"
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition"
                  required={index < 2} 
                />
              ))}
            </div>
            
            <button 
              type="button" 
              onClick={addOption}
              className="mt-3 text-sm text-blue-600 font-medium hover:text-blue-800 transition flex items-center gap-1"
            >
              + Add another option
            </button>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className={`w-full py-3 rounded-lg font-medium transition shadow-sm text-white ${
              isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSubmitting ? 'Creating Poll...' : 'Create Poll'}
          </button>

        </form>
      </div>
    </div>
  );
}