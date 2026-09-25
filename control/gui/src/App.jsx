import { useState, useEffect, useRef, useCallback } from "react";

const API = "http://localhost:3333";
const MONO = "'Courier New', monospace";
const SANS = "'Helvetica Neue', Arial, sans-serif";

const GLOBAL_DIMS = [
  {
    id: "fidelity", label: "Fidelity", color: "#f97316", low: "Sketch", high: "Complete",
    desc: "Controls how finished the output is per prompt. Low produces structural outlines and stubs only — each prompt adds one layer. High produces fully implemented, production-ready code in one pass.",
  },
  {
    id: "autonomy", label: "Autonomy", color: "#8b5cf6", low: "Literal", high: "Creative",
    desc: "Controls how freely the AI interprets instructions. Low means word-for-word execution — nothing added, nothing reinterpreted. High means the AI treats the instruction as a brief and freely adds ideas, reframes the problem, and expands scope.",
  },
  {
    id: "clarification", label: "Clarification", color: "#0ea5e9", low: "Assumes", high: "Asks",
    desc: "Controls whether the agent clarifies before starting. Low means it picks an interpretation and proceeds without comment. High requires the agent to restate the task, list all assumptions, and wait for explicit approval before writing anything.",
  },
  {
    id: "explanations", label: "Explanations", color: "#10b981", low: "Silent", high: "Detailed",
    desc: "Controls how much the agent explains its work. Low means output only — no commentary at all. High means a thorough written account of every step, decision, and alternative considered.",
  },
  {
    id: "ethics", label: "Ethical Awareness", color: "#ec4899", low: "Provocative", high: "Aware",
    desc: "Controls how much ethical and social considerations shape the output. Low is a design provocation mode — the agent actively challenges norms and ignores harm and DEI concerns. High applies full ethical scrutiny and blocks suggestions with significant risk.",
  },
];

const STRENGTH_LABELS = ["Minimal", "Low", "Medium", "High", "Maximum"];

// --- Sub-components ---

function GlobalSlider({ dim, value, onChange }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
        <span style={{ fontSize: "12px", fontFamily: MONO, color: "#374151", letterSpacing: "0.04em" }}>
          {dim.label}
        </span>
        <span style={{ fontSize: "11px", fontFamily: MONO, color: dim.color, fontWeight: "700" }}>
          {STRENGTH_LABELS[value - 1]}
        </span>
      </div>
      <div style={{ fontSize: "10px", color: "#9ca3af", fontFamily: SANS, lineHeight: "1.5", marginBottom: "8px" }}>
        {dim.desc}
      </div>
      <input
        type="range" min={1} max={5} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width: "100%", cursor: "pointer", accentColor: dim.color }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px" }}>
        <span style={{ fontSize: "9px", fontFamily: MONO, color: "#9ca3af" }}>{dim.low}</span>
        <span style={{ fontSize: "9px", fontFamily: MONO, color: "#9ca3af" }}>{dim.high}</span>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{
      background: "white",
      borderRadius: "20px",
      padding: "22px",
      boxShadow: "0 1px 16px #0000000c, 0 0 0 1px #e5e7eb",
      marginBottom: "14px",
    }}>
      <div style={{ fontSize: "9px", fontFamily: MONO, letterSpacing: "0.22em", color: "#9ca3af", marginBottom: "20px" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// --- Main app ---

const DEFAULT_GLOBALS = { fidelity: 3, autonomy: 2, clarification: 2, explanations: 2, ethics: 3 };

export default function App() {
  const [globals, setGlobals]       = useState(DEFAULT_GLOBALS);
  const [mode, setMode]             = useState("admin");
  const [currentCase, setCurrentCase] = useState("");
  const [syncStatus, setSyncStatus] = useState("loading");
  const [decisions, setDecisions]       = useState([]);
  const [analyzing, setAnalyzing]       = useState(false);
  const [lastAnalyzed, setLastAnalyzed] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creatingCase, setCreatingCase] = useState(false);

  const triggerAnalysis = useCallback(() => {
    setAnalyzing(true);
    fetch(`${API}/report`, { method: "POST" })
      .then(r => r.json())
      .then(data => {
        if (data.path) {
          // Reload decisions from the freshly-written decisions.md
          return fetch(`${API}/decisions`)
            .then(r => r.json())
            .then(d => {
              setDecisions(d.decisions);
              setLastAnalyzed(new Date());
              // Open the generated HTML report in a new tab using the file path
              window.open(`${API}/report/view`, "_blank");
            });
        }
      })
      .catch(() => {})
      .finally(() => setAnalyzing(false));
  }, []);

  const createCase = useCallback(() => {
    setCreatingCase(true);
    fetch(`${API}/new-case`, { method: "POST" })
      .then(r => {
        if (!r.ok) throw new Error("bad response");
        return r.json();
      })
      .then(data => {
        if (data.case) {
          fullConfigRef.current = data.config;
          setCurrentCase(data.case);
          setMode("case");
          setDecisions([]);
          setLastAnalyzed(null);
        }
      })
      .catch(() => {})
      .finally(() => setCreatingCase(false));
  }, []);

  const debounceRef    = useRef(null);
  const initializedRef = useRef(false);
  // Preserve fields we don't expose in the UI (e.g. current_case)
  const fullConfigRef  = useRef({});

  // Fetch config on mount
  useEffect(() => {
    fetch(`${API}/config`)
      .then(r => {
        if (!r.ok) throw new Error("bad response");
        return r.json();
      })
      .then(data => {
        fullConfigRef.current = data;
        if (data.global) setGlobals(data.global);
        setMode(data.mode === "case" ? "case" : "admin");
        setCurrentCase(data.current_case || "");
        setSyncStatus("synced");
        initializedRef.current = true;
      })
      .catch(() => {
        setSyncStatus("offline");
        initializedRef.current = true;
      });
  }, []);

  // Debounced PUT whenever globals change (skip first render / load)
  useEffect(() => {
    if (!initializedRef.current) return;
    if (syncStatus === "offline") return;

    setSyncStatus("saving");
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const payload = { ...fullConfigRef.current, global: globals, mode };
      fetch(`${API}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(r => {
          if (!r.ok) throw new Error("bad response");
          setSyncStatus("synced");
        })
        .catch(() => setSyncStatus("offline"));
    }, 500);
  }, [globals, mode]);

  const statusText  = { synced: "Synced", saving: "Saving...", loading: "Loading...", offline: "Offline" }[syncStatus];
  const statusColor = { synced: "#10b981", saving: "#f59e0b", loading: "#9ca3af", offline: "#ef4444" }[syncStatus];

  return (
    <div style={{ minHeight: "100vh", background: "#f5f4f0", padding: "28px 20px 60px", fontFamily: SANS }}>
      <div style={{ maxWidth: "520px", margin: "0 auto" }}>

        {/* Offline warning */}
        {syncStatus === "offline" && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "12px",
            padding: "10px 16px", marginBottom: "16px",
            fontSize: "11px", fontFamily: MONO, color: "#b91c1c",
          }}>
            Server is not running — changes will not be saved.
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <h1 style={{ margin: 0, fontSize: "20px", color: "#111", fontWeight: "700", letterSpacing: "-0.02em" }}>
                Agent Control
              </h1>
              <span style={{
                fontSize: "8px", fontFamily: MONO, letterSpacing: "0.2em",
                color: "white", background: "#111", padding: "3px 8px", borderRadius: "4px",
              }}>
                PROTOTYPE
              </span>
            </div>
            <div style={{ fontSize: "11px", color: "#9ca3af", fontFamily: MONO }}>
              Configures the behaviour of the active agent
            </div>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            aria-label="Settings"
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "4px", color: "#9ca3af", lineHeight: 0,
              transition: "color 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#111")}
            onMouseLeave={e => (e.currentTarget.style.color = "#9ca3af")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>

        {/* Global sliders */}
        <Section title="PARAMETERS">
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {GLOBAL_DIMS.map(dim => (
              <GlobalSlider
                key={dim.id}
                dim={dim}
                value={globals[dim.id]}
                onChange={v => setGlobals(g => ({ ...g, [dim.id]: v }))}
              />
            ))}
          </div>
        </Section>

          <Section title="DECISION LOG">
            {/* Trigger button */}
            <button
              onClick={triggerAnalysis}
              disabled={analyzing || syncStatus === "offline"}
              style={{
                width: "100%", padding: "10px", marginBottom: "16px",
                background: analyzing ? "#f3f4f6" : "#111",
                color: analyzing ? "#9ca3af" : "white",
                border: "none", borderRadius: "10px",
                fontSize: "11px", fontFamily: MONO, letterSpacing: "0.1em",
                cursor: analyzing ? "not-allowed" : "pointer",
                transition: "background 0.2s",
              }}
            >
              {analyzing ? "ANALYSING SESSION..." : "ANALYSE SESSION"}
            </button>

            {lastAnalyzed && (
              <div style={{ fontSize: "9px", fontFamily: MONO, color: "#9ca3af", marginBottom: "12px" }}>
                Last analysed: {lastAnalyzed.toLocaleTimeString()}
              </div>
            )}

            {/* Summary: how many decisions, how autonomous */}
            {decisions.length > 0 && (() => {
              const n   = decisions.length;
              const aut = decisions.filter(d => d.derivation === "Autonomous").length;
              const itp = decisions.filter(d => d.derivation === "Interpretation").length;
              const dir = decisions.filter(d => d.derivation === "Direct").length;
              return (
                <div style={{
                  fontSize: "10px", fontFamily: MONO, color: "#374151",
                  marginBottom: "12px", padding: "8px 10px",
                  background: "#f9f9f8", borderRadius: "8px",
                }}>
                  <strong>{n}</strong> decisions ·{" "}
                  <span style={{ color: "#ef4444" }}>{aut} autonomous</span> ·{" "}
                  <span style={{ color: "#f59e0b" }}>{itp} interpretation</span> ·{" "}
                  <span style={{ color: "#10b981" }}>{dir} direct</span>
                </div>
              );
            })()}

            {/* Empty state */}
            {decisions.length === 0 && !analyzing && (
              <div style={{ fontSize: "11px", fontFamily: MONO, color: "#9ca3af", textAlign: "center", padding: "20px 0" }}>
                No decisions logged yet
              </div>
            )}

            {/* Decision list */}
            {decisions.map(d => {
              const color = d.derivation === "Autonomous"     ? "#ef4444"
                          : d.derivation === "Interpretation" ? "#f59e0b"
                          : "#10b981";
              return (
                <div key={d.id} style={{
                  borderLeft: `3px solid ${color}`,
                  paddingLeft: "12px", marginBottom: "12px",
                }}>
                  <div style={{ fontSize: "10px", fontFamily: MONO, color: "#374151", fontWeight: "700" }}>
                    MDR-{d.id} · {d.type}
                    <span style={{ color, marginLeft: "8px" }}>{d.derivation}</span>
                  </div>
                  <div style={{ fontSize: "11px", fontFamily: SANS, color: "#374151", marginTop: "3px", fontWeight: 600 }}>
                    {d.title}
                  </div>
                  <div style={{ fontSize: "11px", fontFamily: SANS, color: "#6b7280", marginTop: "2px" }}>
                    {d.decision}
                  </div>
                </div>
              );
            })}
          </Section>

        <div style={{ textAlign: "center", fontSize: "9px", color: "#c4c4bc", fontFamily: MONO, letterSpacing: "0.12em" }}>
          HCI RESEARCH — PROGRAMMING WITH AI
        </div>
      </div>

      {/* Settings modal */}
      {settingsOpen && (
        <div
          onClick={() => setSettingsOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "#0008",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px", zIndex: 50,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "white", borderRadius: "20px", padding: "24px",
              width: "100%", maxWidth: "420px",
              boxShadow: "0 10px 40px #00000030",
            }}
          >
            {/* Modal header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "9px", fontFamily: MONO, letterSpacing: "0.22em", color: "#9ca3af" }}>
                SETTINGS
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                aria-label="Close"
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "#9ca3af", lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {/* Mode */}
            <div style={{ fontSize: "11px", fontFamily: MONO, color: "#374151", marginBottom: "8px" }}>Mode</div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              {["admin", "case"].map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    flex: 1, padding: "12px", borderRadius: "10px", cursor: "pointer",
                    border: mode === m ? "2px solid #111" : "1px solid #e5e7eb",
                    background: mode === m ? "#111" : "white",
                    color: mode === m ? "white" : "#6b7280",
                    fontSize: "11px", fontFamily: MONO, letterSpacing: "0.12em",
                    transition: "all 0.15s",
                  }}
                >
                  {m === "admin" ? "ADMIN" : "CASE"}
                </button>
              ))}
            </div>
            <div style={{ fontSize: "10px", fontFamily: MONO, color: "#9ca3af", lineHeight: "1.6", marginBottom: "24px" }}>
              {mode === "case"
                ? <>Active case: <strong style={{ color: "#374151" }}>{currentCase || "(none)"}</strong>. Edits are restricted to <code>cases/{currentCase || "…"}/</code>; behaviour parameters apply.</>
                : <>Full access to the control panel and all files. Behaviour parameters do not constrain admin work.</>}
            </div>

            {/* Case management */}
            <div style={{ fontSize: "11px", fontFamily: MONO, color: "#374151", marginBottom: "8px" }}>Case management</div>
            <button
              onClick={createCase}
              disabled={creatingCase || syncStatus === "offline"}
              style={{
                width: "100%", padding: "12px",
                background: creatingCase ? "#f3f4f6" : "white",
                color: creatingCase ? "#9ca3af" : "#111",
                border: "1px solid #e5e7eb", borderRadius: "10px",
                fontSize: "11px", fontFamily: MONO, letterSpacing: "0.1em",
                cursor: creatingCase || syncStatus === "offline" ? "not-allowed" : "pointer",
              }}
            >
              {creatingCase ? "CREATING..." : "+ NEW CASE"}
            </button>
            <div style={{ fontSize: "10px", fontFamily: MONO, color: "#9ca3af", lineHeight: "1.6", marginTop: "8px" }}>
              Creates the next numbered case folder, makes it the active case, and switches to Case mode.
            </div>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "white", borderTop: "1px solid #e5e7eb",
        padding: "8px 20px",
        display: "flex", alignItems: "center", gap: "6px",
        fontSize: "10px", fontFamily: MONO, color: "#6b7280",
      }}>
        <div style={{
          width: "6px", height: "6px", borderRadius: "50%",
          background: statusColor, flexShrink: 0,
          transition: "background 0.3s",
        }} />
        {statusText}
        <span style={{ marginLeft: "auto", color: "#9ca3af" }}>
          {mode === "case" ? `CASE · ${currentCase || "—"}` : "ADMIN"}
        </span>
      </div>
    </div>
  );
}
