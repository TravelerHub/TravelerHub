import { useState, useMemo } from 'react';

// data: The array of items you want to search (e.g., your polls or trips)
// searchKeys: An array of the object keys you want to search inside (e.g., ['question', 'created_by'])
export function useSearchAndFilter(data = [], searchKeys = []) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All'); // For dropdowns/tabs

  // useMemo ensures we only recalculate when the data or search terms change
  const filteredData = useMemo(() => {
    if (!data) return [];
    
    let result = data;

    // 1. Handle Text Search
    if (searchQuery.trim() !== '') {
      const lowerCaseQuery = searchQuery.toLowerCase();
      
      result = result.filter((item) => {
        // Check if ANY of the searchKeys contain the search query
        return searchKeys.some((key) => {
          const itemValue = item[key];
          if (!itemValue) return false;
          return String(itemValue).toLowerCase().includes(lowerCaseQuery);
        });
      });
    }

    // 2. Handle Category Filters (You can customize this logic based on your needs)
    if (activeFilter !== 'All') {
      // Example: If activeFilter is 'Active', only show items where is_active is true
      if (activeFilter === 'Active') {
        result = result.filter(item => item.is_active === true);
      } else if (activeFilter === 'Closed') {
        result = result.filter(item => item.is_active === false);
      }
    }

    return result;
  }, [data, searchQuery, searchKeys, activeFilter]);

  return {
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    filteredData
  };
}