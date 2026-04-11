import { useState, useRef, useEffect, useCallback } from "react";
import { getTopRemedies } from "./lib/scorer.js";
import { sendChatMessage, fetchAnalysis } from "./lib/api.js";
import styles from "./App.module.css";

// ─── Phase components live below the main export ─────────────────────────────

export default function App() {
  const [phase, setPhase]               = useState("welcome");
  const [messages, setMessages]         = useState([]);
  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [profile, setProfile]           = useState(null);
  const [topRemedies, setTopRemedies]   = useState([]);
  const [analysisText, setAnalysisText] = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Full conversation history kept in a ref so it never triggers re-renders
  const conversationRef = useRef([]);
  const messagesEndRef  = useRef(null);
  const inputRef        = useRef(null);

  // Restore session on mount (survives page refresh within same tab)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("vivo_session");
      if (saved) {
        const s = JSON.parse(saved);
        if (s.phase && s.phase !== "welcome") {
          conversationRef.current = s.conversation || [];
          setMessages(s.messages   || []);
          setPhase(s.phase);
          if (s.profile)     setProfile(s.profile);
          if (s.topRemedies) setTopRemedies(s.topRemedies);
          if (s.analysisText) setAnalysisText(s.analysisText);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Persist session on every meaningful state change
  const saveSession = useCallback((patch) => {
    try {
      const current = JSON.parse(sessionStorage.getItem("vivo_session") || "{}");
      sessionStorage.setItem("vivo_session", JSON.stringify({ ...current, ...patch }));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Parse PROFILE_COMPLETE marker from AI response ────────────────────────
  const parseResponse = (text) => {
    const marker = "PROFILE_COMPLETE:";
    const idx = text.indexOf(marker);
    if (idx === -1) return { cleanText: text, profileData: null };
    const jsonStr   = text.slice(idx + marker.length).trim();
    const cleanText = text.slice(0, idx).trim();
    try   { return { cleanText, profileData: JSON.parse(jsonStr) }; }
    catch { return { cleanText: text, profileData: null }; }
  };

  // ── Add user message to conversation and call /api/chat ──────────────────
  const callAPI = async (userMessage) => {
    const newMsg  = { role: "user", content: userMessage };
    const updated = [...conversationRef.current, newMsg];
    conversationRef.current = updated;

    const raw = await sendChatMessage(updated); // throws on error
    conversationRef.current = [...updated, { role: "assistant", content: raw }];
    return raw;
  };

  // ── Start consultation ────────────────────────────────────────────────────
  const startSession = async () => {
    setPhase("intake");
    setError(null);
    setLoading(true);
    conversationRef.current = [];

    try {
      const raw = await callAPI("Hello, I'd like a consultation please.");
      const { cleanText } = parseResponse(raw);
      const msgs = [{ role: "assistant", text: cleanText }];
      setMessages(msgs);
      saveSession({ phase: "intake", messages: msgs, conversation: conversationRef.current });
    } catch (err) {
      setError(err.message === "rate_limited"
        ? "You've reached the request limit. Please try again in an hour."
        : "Could not connect to the server. Please try again.");
      setPhase("welcome");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // ── Send a message during intake ─────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const txt = input.trim();
    setInput("");
    setError(null);

    const userMsg = { role: "user", text: txt };
    setMessages(m => [...m, userMsg]);
    setLoading(true);

    try {
      const raw = await callAPI(txt);
      const { cleanText, profileData } = parseResponse(raw);
      const assistantMsg = { role: "assistant", text: cleanText };
      setMessages(m => {
        const updated = [...m, assistantMsg];
        saveSession({ messages: updated, conversation: conversationRef.current });
        return updated;
      });

      if (profileData) {
        // Short delay so the user reads the closing message
        setTimeout(() => runAnalysis(profileData), 1800);
      }
    } catch (err) {
      setMessages(m => [...m, {
        role: "assistant",
        text: err.message === "rate_limited"
          ? "⚠️ You've reached the request limit. Please try again in an hour."
          : "⚠️ Something went wrong. Please try again.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  // ── Run scoring + fetch rationale ────────────────────────────────────────
  const runAnalysis = async (profileData) => {
    setProfile(profileData);
    setPhase("analysis");
    saveSession({ phase: "analysis", profile: profileData });

    const top = getTopRemedies(profileData, 3);
    setTopRemedies(top);
    setAnalysisLoading(true);

    try {
      const text = await fetchAnalysis(profileData, top);
      setAnalysisText(text);
      saveSession({ phase: "results", topRemedies: top, analysisText: text });
    } catch {
      setAnalysisText("Clinical rationale unavailable. Please review the matched remedies.");
    } finally {
      setAnalysisLoading(false);
      setPhase("results");
    }
  };

  // ── Reset everything ─────────────────────────────────────────────────────
  const restart = () => {
    conversationRef.current = [];
    setMessages([]);
    setInput("");
    setError(null);
    setProfile(null);
    setTopRemedies([]);
    setAnalysisText("");
    setPhase("welcome");
    sessionStorage.removeItem("_session");
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className={styles.root}>
      <Header phase={phase} />

      <main className={styles.main}>
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {phase === "welcome"  && <WelcomeScreen  onStart={startSession} />}
        {phase === "intake"   && (
          <IntakeScreen
            messages={messages}
            loading={loading}
            input={input}
            setInput={setInput}
            sendMessage={sendMessage}
            handleKey={handleKey}
            inputRef={inputRef}
            messagesEndRef={messagesEndRef}
          />
        )}
        {phase === "analysis" && <AnalysisScreen profile={profile} />}
        {phase === "results"  && (
          <ResultsScreen
            const downloadPDF = () => {
              window.print();
            };
            profile={profile}
            topRemedies={topRemedies}
            analysisText={analysisText}
            analysisLoading={analysisLoading}
            onRestart={restart}
          />
        )}
      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Header({ phase }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="22" height="22" aria-hidden="true">
  <rect width="100" height="100" rx="14" fill="#0b0b0b"/>
  <line x1="22" y1="24" x2="50" y2="72" stroke="#c9b87a" strokeWidth="7" strokeLinecap="round"/>
  <line x1="78" y1="24" x2="50" y2="72" stroke="#c9b87a" strokeWidth="7" strokeLinecap="round"/>
  <line x1="15" y1="24" x2="29" y2="24" stroke="#c9b87a" strokeWidth="3" strokeLinecap="round"/>
  <line x1="71" y1="24" x2="85" y2="24" stroke="#c9b87a" strokeWidth="3" strokeLinecap="round"/>
  <line x1="50" y1="72" x2="50" y2="58" stroke="#c9b87a" strokeWidth="1.8" strokeLinecap="round"/>
  <path d="M50 58 C44 49 33 47 32 54 C31 61 42 62 50 58Z" fill="#c9b87a"/>
  <path d="M50 58 C56 49 67 47 68 54 C69 61 58 62 50 58Z" fill="#c9b87a"/>
  <ellipse cx="50" cy="53" rx="3.5" ry="5" fill="#c9b87a"/>
</svg>
<div>
  <div className={styles.logoText}>VIVO</div>
          <div className={styles.logoSub}>Classical Homeopathic Consultation</div>
        </div>
        <div className={styles.phaseIndicator}>
          <span style={{ color: ["welcome","intake"].includes(phase) ? "#c9b87a" : "rgba(232,226,217,0.3)" }}>
            {["welcome","intake"].includes(phase) ? "● " : ""}Part 1
          </span>
          <span className={styles.phaseSep}>/</span>
          <span style={{ color: ["analysis","results"].includes(phase) ? "#c9b87a" : "rgba(232,226,217,0.3)" }}>
            {["analysis","results"].includes(phase) ? "● " : ""}Part 2
          </span>
        </div>
      </div>
    </header>
  );
}

function ErrorBanner({ message, onDismiss }) {
  return (
    <div className={styles.errorBanner} role="alert">
      <span>{message}</span>
      <button onClick={onDismiss} className={styles.errorClose} aria-label="Dismiss">✕</button>
    </div>
  );
}

function WelcomeScreen({ onStart }) {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className={styles.welcome}>
      <div className={styles.welcomeGlow} aria-hidden="true" />
      <div className={styles.welcomeContent}>
       <div className={styles.crest} aria-hidden="true">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="80" height="80">
    <rect width="100" height="100" rx="14" fill="#0b0b0b"/>
    <line x1="22" y1="24" x2="50" y2="72" stroke="#c9b87a" strokeWidth="7" strokeLinecap="round"/>
    <line x1="78" y1="24" x2="50" y2="72" stroke="#c9b87a" strokeWidth="7" strokeLinecap="round"/>
    <line x1="15" y1="24" x2="29" y2="24" stroke="#c9b87a" strokeWidth="3" strokeLinecap="round"/>
    <line x1="71" y1="24" x2="85" y2="24" stroke="#c9b87a" strokeWidth="3" strokeLinecap="round"/>
    <line x1="50" y1="72" x2="50" y2="58" stroke="#c9b87a" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M50 58 C44 49 33 47 32 54 C31 61 42 62 50 58Z" fill="#c9b87a"/>
    <path d="M50 58 C56 49 67 47 68 54 C69 61 58 62 50 58Z" fill="#c9b87a"/>
    <ellipse cx="50" cy="53" rx="3.5" ry="5" fill="#c9b87a"/>
  </svg>
</div>

        <h1 className={styles.welcomeTitle}>The Art of Vivo</h1>
        <p className={styles.welcomeSubtitle}>
          A complete classical consultation in two parts — first we listen, then the remedy speaks.
        </p>

        <div className={styles.journeyMap} aria-label="Consultation steps">
          <div className={styles.journeyStep}>
            <div className={styles.journeyNum} aria-hidden="true">I</div>
            <div className={styles.journeyLabel}>Deep Intake</div>
            <div className={styles.journeyDesc}>Adaptive interview following your unique symptom picture</div>
          </div>
          <div className={styles.journeyArrow} aria-hidden="true">
            <svg width="40" height="10" viewBox="0 0 40 10">
              <line x1="0" y1="5" x2="34" y2="5" stroke="#c9b87a" strokeWidth="0.6" opacity="0.4"/>
              <path d="M30 1 L38 5 L30 9" stroke="#c9b87a" strokeWidth="0.6" fill="none" opacity="0.4"/>
            </svg>
          </div>
          <div className={styles.journeyStep}>
            <div className={styles.journeyNum} aria-hidden="true">II</div>
            <div className={styles.journeyLabel}>Remedy Match</div>
            <div className={styles.journeyDesc}>Top 3 remedies from 100-remedy database with potency guidance</div>
          </div>
        </div>

        {/* Medical disclaimer — must accept before proceeding */}
        <div className={styles.disclaimerBox}>
          <label className={styles.disclaimerLabel}>
            <input
              type="checkbox"
              checked={accepted}
              onChange={e => setAccepted(e.target.checked)}
              className={styles.disclaimerCheck}
            />
            <span>
              I understand this is for <strong>educational and wellness purposes only</strong> and
              not a substitute for professional medical advice. I will consult a qualified
              practitioner for any health decisions.
            </span>
          </label>
        </div>

        <button
          className={styles.startBtn}
          onClick={onStart}
          disabled={!accepted}
          aria-disabled={!accepted}
        >
          Begin Consultation
        </button>
      </div>
    </div>
  );
}

function IntakeScreen({ messages, loading, input, setInput, sendMessage, handleKey, inputRef, messagesEndRef }) {
  return (
    <div className={styles.intakeWrap}>
      <div className={styles.messages} role="log" aria-live="polite" aria-label="Consultation conversation">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "assistant" ? styles.assistRow : styles.userRow}>
            {m.role === "assistant" && (
              <div className={styles.assistAvatar} aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" stroke="#c9b87a" strokeWidth="0.8"/>
                  <circle cx="7" cy="7" r="2" fill="#c9b87a"/>
                </svg>
              </div>
            )}
            <div className={m.role === "assistant" ? styles.assistBubble : styles.userBubble}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className={styles.assistRow} aria-label="Homeopath is responding">
            <div className={styles.assistAvatar} aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="#c9b87a" strokeWidth="0.8"/>
                <circle cx="7" cy="7" r="2" fill="#c9b87a"/>
              </svg>
            </div>
            <div className={styles.assistBubble}>
              <span className={styles.dots} aria-hidden="true">
                <span/><span/><span/>
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputBar}>
        <textarea
          ref={inputRef}
          className={styles.chatInput}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Describe your symptoms, feelings, or answer the question…"
          rows={1}
          disabled={loading}
          aria-label="Your message"
        />
        <button
          className={styles.sendBtn}
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          aria-label="Send message"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 14 L8 2 M3 7 L8 2 L13 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

function AnalysisScreen() {
  return (
    <div className={styles.analysisWrap} role="status" aria-live="polite">
      <div className={styles.analysisPulse} aria-hidden="true">
        <div className={`${styles.pulsering} ${styles.r1}`}/>
        <div className={`${styles.pulsering} ${styles.r2}`}/>
        <div className={`${styles.pulsering} ${styles.r3}`}/>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="18" stroke="#c9b87a" strokeWidth="1"/>
          <circle cx="20" cy="20" r="4" fill="#c9b87a"/>
        </svg>
      </div>
      <h2 className={styles.analysisTitle}>Analysing Your Case</h2>
      <p className={styles.analysisSubtitle}>Matching your symptom totality against the remedy database…</p>
      <div className={styles.analysisSteps} aria-hidden="true">
        {["Compiling symptom picture", "Evaluating modalities", "Scoring 100 remedies", "Preparing clinical rationale"]
          .map((s, i) => <div key={i} className={styles.aStep} style={{ animationDelay: `${i * 0.6}s` }}>{s}</div>)}
      </div>
    </div>
  );
}

function ResultsScreen({ profile, topRemedies, analysisText, analysisLoading, onRestart }) {
  const [expanded, setExpanded] = useState(0);
  const accentColors = ["#c9b87a", "#a8c4a5", "#b4a8c4"];
  const ranks = ["Vivo", "Second Choice", "Third Choice"];
  
  const downloadPDF = () => {
    window.print();
    
  return (
    <div className={styles.resultsWrap}>
      <div className={styles.resultsHeader}>
        <div className={styles.resultsBadge}>Remedy Selection</div>
        <h2 className={styles.resultsTitle}>Your Homeopathic Picture</h2>
        {profile?.chiefComplaint && (
          <p className={styles.resultsComplaint}>
            Chief complaint: <em>{profile.chiefComplaint}</em>
          </p>
        )}
      </div>

      {/* Clinical rationale */}
      <div className={styles.rationaleBox}>
        <div className={styles.rationaleLabel}>Clinical Rationale</div>
        {analysisLoading
          ? <div className={styles.rationaleLoading}>Preparing analysis…</div>
          : <p className={styles.rationaleText}>{analysisText}</p>}
      </div>

      {/* Top 3 */}
      <div className={styles.remedyList}>
        {topRemedies.map((item, idx) => {
          const r      = item.remedy;
          const isOpen = expanded === idx;
          const color  = accentColors[idx];
          const pct    = Math.min(99, Math.round(item.score / (item.score + 20) * 100));

          return (
            <div
              key={r.id}
              className={styles.remedyCard}
              style={{ borderColor: isOpen ? color : "rgba(255,255,255,0.07)" }}
              onClick={() => setExpanded(isOpen ? -1 : idx)}
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              onKeyDown={e => e.key === "Enter" && setExpanded(isOpen ? -1 : idx)}
            >
              <div className={styles.remedyTop}>
                <div>
                  <div className={styles.remedyRank} style={{ color }}>{ranks[idx]}</div>
                  <div className={styles.remedyName}>{r.name}</div>
                  <div className={styles.remedyAbbr}>{r.abbr}</div>
                </div>
                <div className={styles.remedyRight}>
                  <div style={{ color }}>
                    <span className={styles.scoreNum}>{pct}%</span>
                    <span className={styles.scoreLabel}>match</span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                    style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "0.2s", opacity: 0.4 }}
                    aria-hidden="true">
                    <path d="M3 5 L7 9 L11 5" stroke="#e8e2d9" strokeWidth="1" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>

              {isOpen && (
                <div className={styles.remedyDetail}>
                  <div className={styles.detailGrid}>
                    <DetailSection label="Keynotes"     items={r.keynotes.slice(0,5)} color="rgba(201,184,122,0.1)" textColor="rgba(232,226,217,0.65)" borderColor="rgba(201,184,122,0.15)" />
                    <DetailSection label="Better From"  items={r.modalities.better.slice(0,4)} color="rgba(134,185,130,0.12)" textColor="#86b982" borderColor="rgba(134,185,130,0.2)" />
                    <DetailSection label="Worse From"   items={r.modalities.worse.slice(0,4)}  color="rgba(185,130,130,0.12)" textColor="#b98282" borderColor="rgba(185,130,130,0.2)" />
                    <DetailSection label="Mental Picture" items={r.mentals.slice(0,4)}          color="rgba(148,130,185,0.12)" textColor="#9482b9" borderColor="rgba(148,130,185,0.2)" />
                  </div>

                  <div className={styles.potencyBox}>
                    <div className={styles.potencyTitle}>Potency Guidance</div>
                    <div className={styles.potencyGrid}>
                      <div>
                        <div className={styles.potencyPhase}>Acute</div>
                        <div className={styles.potencyDose}>{r.potency.acute}</div>
                      </div>
                      <div className={styles.potencyDivider} aria-hidden="true"/>
                      <div>
                        <div className={styles.potencyPhase}>Chronic</div>
                        <div className={styles.potencyDose}>{r.potency.chronic}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Case summary */}
      {profile && (
        <div className={styles.caseSummary}>
          <div className={styles.caseSummaryTitle}>Case Summary</div>
          <dl className={styles.caseGrid}>
            {profile.symptoms?.modalities?.better?.length > 0 && (
              <><dt>Better from</dt><dd>{profile.symptoms.modalities.better.join(" · ")}</dd></>
            )}
            {profile.symptoms?.modalities?.worse?.length > 0 && (
              <><dt>Worse from</dt><dd>{profile.symptoms.modalities.worse.join(" · ")}</dd></>
            )}
            {profile.constitution?.temperature && (
              <><dt>Constitution</dt><dd style={{ textTransform: "capitalize" }}>{profile.constitution.temperature}</dd></>
            )}
            {profile.appetite?.thirst && (
              <><dt>Thirst</dt><dd>{profile.appetite.thirst}</dd></>
            )}
          </dl>
        </div>
      )}
      <button className={styles.downloadBtn} onClick={downloadPDF}>
        Download Results as PDF
      </button>
      <button className={styles.restartBtn} onClick={onRestart}>
        Start New Consultation
      </button>
      <p className={styles.finalDisclaimer}>
        For educational purposes only. Consult a qualified homeopath before beginning any treatment.
      </p>
    </div>
  );
}

function DetailSection({ label, items, color, textColor, borderColor }) {
  return (
    <div>
      <div className={styles.detailLabel}>{label}</div>
      <div className={styles.tagRow}>
        {items.map((item, i) => (
          <span key={i} className={styles.tag}
            style={{ background: color, color: textColor, borderColor }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
