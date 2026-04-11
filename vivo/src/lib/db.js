// src/lib/db.js
// localStorage abstraction for vivo session history.
// All history read/write goes through here — swap this file later
// to upgrade to Vercel KV or Supabase without touching any component.

const SESSIONS_KEY  = "vivo_history";   // list of all past sessions
const PROFILE_KEY   = "vivo_profile";   // user display name + notes
const MAX_SESSIONS  = 50;               // cap so localStorage never bloats

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // localStorage can throw if storage quota is exceeded
    console.warn("vivo/db: could not write to localStorage", key);
    return false;
  }
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────
// Each saved session shape:
// {
//   id:            string,
//   date:          ISO string,
//   chiefComplaint: string,
//   profile:       object   (the PROFILE_COMPLETE JSON from the AI),
//   messages:      array    (the visible chat turns { role, text }),
//   topRemedies:   array    (scored remedy objects),
//   analysisText:  string,
// }

export const db = {
  // Return all sessions, newest first
  getSessions() {
    return readJSON(SESSIONS_KEY, []);
  },

  // Return a single session by id, or null
  getSession(id) {
    return db.getSessions().find(s => s.id === id) ?? null;
  },

  // Save a completed session. Generates an id and timestamps it.
  // Returns the saved session object.
  saveSession({ profile, messages, topRemedies, analysisText }) {
    const sessions = db.getSessions();

    const entry = {
      id:             generateId(),
      date:           new Date().toISOString(),
      chiefComplaint: profile?.chiefComplaint ?? "Consultation",
      profile,
      messages,
      topRemedies,
      analysisText,
    };

    // Prepend newest, cap at MAX_SESSIONS
    const updated = [entry, ...sessions].slice(0, MAX_SESSIONS);
    writeJSON(SESSIONS_KEY, updated);
    return entry;
  },

  // Delete a session by id
  deleteSession(id) {
    const updated = db.getSessions().filter(s => s.id !== id);
    writeJSON(SESSIONS_KEY, updated);
  },

  // Wipe all history
  clearSessions() {
    localStorage.removeItem(SESSIONS_KEY);
  },

  // ─── Profile ───────────────────────────────────────────────────────────────
  // Shape: { displayName: string, notes: string }

  getProfile() {
    return readJSON(PROFILE_KEY, { displayName: "", notes: "" });
  },

  saveProfile(profile) {
    writeJSON(PROFILE_KEY, profile);
  },
};
