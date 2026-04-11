// src/components/ProfileDrawer.jsx
// Slide-in panel for user display name and personal notes.
// Kept deliberately simple — no accounts, just local preferences.

import { useState, useEffect } from "react";
import styles from "./ProfileDrawer.module.css";

export function ProfileDrawer({ profile, onUpdate, onClose }) {
  const [name,  setName]  = useState(profile.displayName || "");
  const [notes, setNotes] = useState(profile.notes || "");
  const [saved, setSaved] = useState(false);

  // Sync if profile changes externally
  useEffect(() => {
    setName(profile.displayName || "");
    setNotes(profile.notes || "");
  }, [profile]);

  const handleSave = () => {
    onUpdate({ displayName: name.trim(), notes: notes.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isDirty =
    name.trim()  !== (profile.displayName || "") ||
    notes.trim() !== (profile.notes || "");

  return (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />

      <aside className={styles.drawer} aria-label="Your profile">
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="5" r="2.5" stroke="#c9b87a" strokeWidth="0.8"/>
              <path d="M2 12 C2 9 12 9 12 12" stroke="#c9b87a" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
            </svg>
            <span className={styles.title}>Your Profile</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close profile">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          <p className={styles.intro}>
            Stored locally on this device only. Used to personalise your consultation history.
          </p>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="pd-name">Display name</label>
            <input
              id="pd-name"
              className={styles.input}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="How should we address you?"
              maxLength={60}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="pd-notes">Personal notes</label>
            <textarea
              id="pd-notes"
              className={styles.textarea}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Anything useful to remember across consultations — chronic conditions, known sensitivities, constitutional notes…"
              rows={6}
              maxLength={1000}
            />
            <div className={styles.charCount}>{notes.length} / 1000</div>
          </div>

          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={!isDirty && !saved}
          >
            {saved ? "Saved ✓" : "Save profile"}
          </button>

          <div className={styles.privacyNote}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="0.8"/>
              <path d="M5.5 4.5 L5.5 7.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round"/>
              <circle cx="5.5" cy="3" r="0.5" fill="currentColor"/>
            </svg>
            This data never leaves your browser.
          </div>
        </div>
      </aside>
    </>
  );
}
