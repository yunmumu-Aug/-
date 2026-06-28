"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface TagFilterContextType {
  selectedTag: string | null;
  setSelectedTag: (tag: string | null) => void;
  clearFilter: () => void;
}

const TagFilterContext = createContext<TagFilterContextType>({
  selectedTag: null,
  setSelectedTag: () => {},
  clearFilter: () => {},
});

export function TagFilterProvider({ children }: { children: React.ReactNode }) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const clearFilter = useCallback(() => setSelectedTag(null), []);

  return (
    <TagFilterContext.Provider value={{ selectedTag, setSelectedTag, clearFilter }}>
      {children}
    </TagFilterContext.Provider>
  );
}

export function useTagFilter() {
  return useContext(TagFilterContext);
}
