// src/components/SessionCard.jsx
// A single past consultation row inside HistorySidebar.
// Shows complaint, date, top remedy, and a delete button.

import styles from "./HistorySidebar.module.css";

export function SessionCard({ session, onClick, onRemove }) {
  const topRemedy = session.topRemedies?.[0]?.remedy;
  const date      = formatDate(session.date);

  const handleRemove = (e) => {
    e.stopPropagation(); // don't fire onClick
    onRemove();
  };

  return (
    <div className={cardStyles.card} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onClick()}
      aria-label={`View consultation: ${session.chiefComplaint}`}
    >
      <div className={cardStyles.top}>
        <div className={cardStyles.complaint}>{session.chiefComplaint}</div>
        <button className={cardStyles.removeBtn} onClick={handleRemove} aria-label="Delete consultation">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M2 2 L8 8 M8 2 L2 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div className={cardStyles.meta}>
        <span className={cardStyles.date}>{date}</span>
        {topRemedy && (
          <>
            <span className={cardStyles.sep} aria-hidden="true">·</span>
            <span className={cardStyles.remedy}>{topRemedy.abbr}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Card-specific styles inlined as a plain object ─────────────────────────
// These extend HistorySidebar.module.css via a local style tag so we don't
// need a separate CSS file just for the card.

const cardStyles = (() => {
  if (typeof document === "undefined") return {};

  const id = "vivo-session-card-styles";
  if (!document.getElementById(id)) {
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
      .vsc-card {
        padding: 12px 16px;
        border-bottom: 0.5px solid rgba(255,255,255,0.05);
        cursor: pointer;
        transition: background 0.12s;
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .vsc-card:hover { background: rgba(255,255,255,0.03); }
      .vsc-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px;
      }
      .vsc-complaint {
        font-size: 13px;
        color: rgba(232,226,217,0.85);
        line-height: 1.4;
        flex: 1;
      }
      .vsc-remove-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: rgba(232,226,217,0.15);
        padding: 2px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        transition: color 0.15s;
      }
      .vsc-remove-btn:hover { color: rgba(185,130,130,0.7); }
      .vsc-meta {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        color: rgba(232,226,217,0.28);
      }
      .vsc-remedy { color: #c9b87a; opacity: 0.7; }
      .vsc-sep { opacity: 0.3; }
    `;
    document.head.appendChild(el);
  }

  return {
    card:      "vsc-card",
    top:       "vsc-top",
    complaint: "vsc-complaint",
    removeBtn: "vsc-remove-btn",
    meta:      "vsc-meta",
    date:      "",
    remedy:    "vsc-remedy",
    sep:       "vsc-sep",
  };
})();

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(d, today))     return "Today";
  if (isSameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}
