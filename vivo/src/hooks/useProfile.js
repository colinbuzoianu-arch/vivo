// src/hooks/useProfile.js
// Loads and saves the user profile (display name + notes) via db.js.

import { useState, useCallback } from "react";
import { db } from "../lib/db.js";

export function useProfile() {
  const [profile, setProfile] = useState(() => db.getProfile());

  const update = useCallback((patch) => {
    setProfile(prev => {
      const updated = { ...prev, ...patch };
      db.saveProfile(updated);
      return updated;
    });
  }, []);

  return { profile, update };
}
