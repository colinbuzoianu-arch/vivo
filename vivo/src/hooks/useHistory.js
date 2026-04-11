// src/hooks/useHistory.js
// Loads and manages past consultation sessions from localStorage via db.js
// Returns everything the HistorySidebar and SessionCard components need.

import { useState, useEffect, useCallback } from "react";
import { db } from "../lib/db.js";

export function useHistory() {
  const [sessions, setSessions]       = useState([]);
  const [selected, setSelected]       = useState(null); // full session object
  const [isOpen, setIsOpen]           = useState(false);

  // Load sessions from localStorage on mount
  useEffect(() => {
    setSessions(db.getSessions());
  }, []);

  // Open sidebar and refresh list
  const open = useCallback(() => {
    setSessions(db.getSessions());
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setSelected(null);
  }, []);

  // Select a session to view its detail inside the sidebar
  const select = useCallback((id) => {
    const session = db.getSession(id);
    setSelected(session);
  }, []);

  const clearSelected = useCallback(() => {
    setSelected(null);
  }, []);

  // Delete a session and refresh the list
  const remove = useCallback((id) => {
    db.deleteSession(id);
    setSessions(db.getSessions());
    // If the deleted session was selected, clear it
    setSelected(prev => (prev?.id === id ? null : prev));
  }, []);

  // Called from App.jsx after a full consultation completes
  const save = useCallback(({ profile, messages, topRemedies, analysisText }) => {
    const entry = db.saveSession({ profile, messages, topRemedies, analysisText });
    setSessions(db.getSessions());
    return entry;
  }, []);

  return {
    sessions,     // array — full list for the sidebar
    selected,     // object | null — session being viewed in detail
    isOpen,       // bool — whether sidebar is visible
    open,
    close,
    select,
    clearSelected,
    remove,
    save,
  };
}
