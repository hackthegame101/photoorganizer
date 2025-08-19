import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePhoto } from '../../contexts/PhotoContext';

const SearchBar: React.FC = () => {
  const { state, dispatch } = usePhoto();
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchValue, setSearchValue] = useState(state.searchQuery);

  useEffect(() => {
    setSearchValue(state.searchQuery);
  }, [state.searchQuery]);

  const handleSearch = (value: string) => {
    setSearchValue(value);
    dispatch({ type: 'SET_SEARCH_QUERY', payload: value });
  };

  const clearSearch = () => {
    setSearchValue('');
    dispatch({ type: 'SET_SEARCH_QUERY', payload: '' });
    setIsExpanded(false);
  };

  return (
    <div className="search-container">
      <motion.div
        className={`search-bar ${isExpanded || searchValue ? 'expanded' : ''}`}
        animate={{ width: isExpanded || searchValue ? 300 : 200 }}
        transition={{ duration: 0.2 }}
      >
        <div className="search-input-container">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search photos..."
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            onBlur={() => setIsExpanded(false)}
            className="search-input"
          />
          <AnimatePresence>
            {searchValue && (
              <motion.button
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                className="clear-search"
                onClick={clearSearch}
              >
                ✕
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <AnimatePresence>
        {searchValue && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="search-suggestions"
          >
            <div className="suggestion-item">
              <span className="suggestion-icon">📸</span>
              <span>Search in filenames</span>
            </div>
            <div className="suggestion-item">
              <span className="suggestion-icon">🏷️</span>
              <span>Search in tags</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SearchBar;