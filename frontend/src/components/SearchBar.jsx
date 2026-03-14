export default function SearchBar({ 
  searchQuery, 
  onSearchChange, 
  placeholder = "Search...",
  activeFilter,
  onFilterChange,
  filterOptions = ['All', 'Active', 'Closed'] 
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      {/* Search Input */}
      <div className="flex-1 relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
          🔍
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
        />
      </div>

      {/* Filter Dropdown */}
      <select
        value={activeFilter}
        onChange={(e) => onFilterChange(e.target.value)}
        className="px-4 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500 transition cursor-pointer"
      >
        {filterOptions.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}