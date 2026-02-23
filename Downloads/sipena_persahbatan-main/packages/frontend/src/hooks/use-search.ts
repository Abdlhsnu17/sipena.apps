'use client';

import { useCallback, useEffect, useState } from 'react';

interface UseSearchOptions {
  debounceMs?: number;
  minLength?: number;
}

interface UseSearchReturn {
  searchTerm: string;
  debouncedTerm: string;
  setSearchTerm: (term: string) => void;
  clearSearch: () => void;
  isSearching: boolean;
}

export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const { debounceMs = 300, minLength = 0 } = options;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (searchTerm.length < minLength) {
      setDebouncedTerm('');
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
      setIsSearching(false);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchTerm, debounceMs, minLength]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedTerm('');
    setIsSearching(false);
  }, []);

  return {
    searchTerm,
    debouncedTerm,
    setSearchTerm,
    clearSearch,
    isSearching,
  };
}

export default useSearch;
