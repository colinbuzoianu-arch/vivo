// src/components/HistorySidebar.jsx
// Slide-in panel listing past consultations.
// Receives everything it needs from the useHistory hook via App.jsx.

import { useState } from "react";
import { SessionCard } from "./SessionCard.jsx";
import styles from "./HistorySidebar.module.css";

export function HistorySidebar({ sessions, selected, onSelect, onClearSelected, onClose, onRemove }) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? sessions.filter(s =>
        s.chiefComplaint?.toLowerCase().includes(query.toLowerCase()) ||
        s.topRemedies?.[0]?.remedy?.name?.toLowerCase().includes(query.toLowerCase())
      )
    : sessions;

  return (
    <>
      {/* Overlay — click outside to close */}
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />

      <aside className={styles.sidebar} aria-label="Consultation history">
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="6" stroke="#c9b87a" strokeWidth="0.8"/>
              <circle cx="7" cy="7" r="2" fill="#c9b87a"/>
            </svg>
            <span className={styles.title}>Past Consultations</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close history">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1"/>
            <path d="M8.5 8.5 L11 11" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
          </svg>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search by complaint or remedy…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search consultations"
          />
          {query && (
            <button className={styles.searchClear} onClick={() => setQuery("")} aria-label="Clear search">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M2 2 L8 8 M8 2 L2 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>

        {/* Session list or detail */}
        <div className={styles.body}>
          {selected ? (
            // ── Detail view ──────────────────────────────────────────────────
            <div className={styles.detail}>
              <button className={styles.backBtn} onClick={onClearSelected}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M8 2 L4 6 L8 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                Back
              </button>

              <div className={styles.detailDate}>{formatDate(selected.date)}</div>
              <div className={styles.detailComplaint}>{selected.chiefComplaint}</div>

              {/* Top remedy */}
              {selected.topRemedies?.[0] && (
                <div className={styles.detailRemedy}>
                  <div className={styles.detailRemedyLabel}>Vivo remedy</div>
                  <div className={styles.detailRemedyName}>
                    {selected.topRemedies[0].remedy.name}
                    <span className={styles.detailRemedyAbbr}>
                      {" · "}{selected.topRemedies[0].remedy.abbr}
                    </span>
                  </div>
                </div>
              )}

              {/* Clinical rationale */}
              {selected.analysisText && (
                <div className={styles.detailSection}>
                  <div className={styles.detailLabel}>Clinical Rationale</div>
                  <p className={styles.detailText}>{selected.analysisText}</p>
                </div>
              )}

              {/* Conversation transcript */}
              {selected.messages?.length > 0 && (
                <div className={styles.detailSection}>
                  <div className={styles.detailLabel}>Transcript</div>
                  <div className={styles.transcript}>
                    {selected.messages.map((m, i) => (
                      <div key={i} className={m.role === "assistant" ? styles.txAssist : styles.txUser}>
                        <span className={styles.txRole}>
                          {m.role === "assistant" ? "Homeopath" : "You"}
                        </span>
                        <span className={styles.txText}>{m.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                className={styles.deleteBtn}
                onClick={() => { onRemove(selected.id); onClearSelected(); }}
              >
                Delete this consultation
              </button>
            </div>
          ) : filtered.length === 0 ? (
            // ── Empty state ──────────────────────────────────────────────────
            <div className={styles.empty}>
              {query ? "No consultations match your search." : "No past consultations yet. Complete a consultation to see it here."}
            </div>
          ) : (
            // ── List ─────────────────────────────────────────────────────────
            <ul className={styles.list} role="list">
              {filtered.map(session => (
                <li key={session.id}>
                  <SessionCard
                    session={session}
                    onClick={() => onSelect(session.id)}
                    onRemove={() => onRemove(session.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.footer}>
          {sessions.length > 0 && !selected && (
            <span className={styles.footerCount}>
              {sessions.length} consultation{sessions.length !== 1 ? "s" : ""} stored locally
            </span>
          )}
        </div>
      </aside>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(d, today))     return "Today, " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isSameDay(d, yesterday)) return "Yesterday, " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}
