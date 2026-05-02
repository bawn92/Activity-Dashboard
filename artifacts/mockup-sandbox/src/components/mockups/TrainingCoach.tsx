import { useState } from "react";
import {
  TrendingUp,
  Calendar,
  Dumbbell,
  Target,
  Send,
  Bot,
} from "lucide-react";

const GRADIENT = "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)";
const GRADIENT_SOFT =
  "linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(139,92,246,0.12) 100%)";
const GRADIENT_HOVER =
  "linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(139,92,246,0.18) 100%)";

const chips = [
  {
    icon: TrendingUp,
    label: "What was my total running distance last month?",
  },
  {
    icon: Calendar,
    label: "Summarize my last 7 days by sport",
  },
  {
    icon: Dumbbell,
    label: "Analyze my year in strength training",
  },
  {
    icon: Target,
    label: "How consistent was I this month?",
  },
];

function ThinkingIndicator() {
  return (
    <div
      style={{
        position: "relative",
        width: 28,
        height: 28,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -2,
          borderRadius: "50%",
          background: GRADIENT,
          opacity: 0.25,
          animation: "pulse-ring 2.4s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: GRADIENT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            backgroundColor: "var(--tc-surface)",
            animation: "pulse-dot 2.4s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}

function CoachAvatar() {
  return (
    <div
      style={{
        position: "relative",
        width: 36,
        height: 36,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -2,
          borderRadius: "50%",
          background: GRADIENT,
          opacity: 0.35,
        }}
      />
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: GRADIENT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Bot size={18} color="var(--tc-surface)" />
      </div>
    </div>
  );
}

function StatCallout() {
  return (
    <div
      style={{
        marginTop: 12,
        background: GRADIENT_SOFT,
        border: "1px solid rgba(99,102,241,0.15)",
        borderRadius: 10,
        padding: "10px 14px",
        display: "flex",
        gap: 20,
      }}
    >
      {[
        { label: "Total distance", value: "148.4 km" },
        { label: "Longest run", value: "21.1 km" },
        { label: "Avg pace", value: "5:42 /km" },
      ].map(({ label, value }) => (
        <div key={label}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--tc-text-muted)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginBottom: 2,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              background: GRADIENT,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

function DotGrid() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage:
          "radial-gradient(circle, var(--tc-dot-color) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
        pointerEvents: "none",
      }}
    />
  );
}

function Chip({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "10px 14px",
        borderRadius: 12,
        border: `1px solid ${hovered ? "rgba(99,102,241,0.3)" : "var(--tc-border)"}`,
        background: hovered ? GRADIENT_HOVER : "var(--tc-chip-bg)",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.18s ease",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        boxShadow: hovered
          ? "0 4px 12px rgba(99,102,241,0.12)"
          : "0 1px 3px rgba(0,0,0,0.04)",
        flex: "1 1 0",
        minWidth: 0,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          marginTop: 1,
          color: hovered ? "#6366f1" : "var(--tc-text-muted)",
          transition: "color 0.18s ease",
        }}
      >
        <Icon size={14} strokeWidth={2} />
      </div>
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 450,
          lineHeight: 1.45,
          color: hovered ? "#4f46e5" : "var(--tc-text-secondary)",
          transition: "color 0.18s ease",
        }}
      >
        {label}
      </span>
    </button>
  );
}

export default function TrainingCoach() {
  const [inputFocused, setInputFocused] = useState(false);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');

        /* Neutral design tokens — swap these for a dark variant */
        :root {
          --tc-page-bg:       #f1f5f9;
          --tc-surface:       #ffffff;
          --tc-surface-raised:#ffffff;
          --tc-chip-bg:       rgba(248,250,252,0.8);
          --tc-input-bg:      #f8fafc;
          --tc-input-bg-focus:#fafbff;
          --tc-user-bubble:   #f1f5f9;
          --tc-border:        rgba(148,163,184,0.25);
          --tc-border-subtle: rgba(148,163,184,0.15);
          --tc-border-input:  rgba(148,163,184,0.22);
          --tc-dot-color:     rgba(148,163,184,0.25);
          --tc-text-primary:  #0f172a;
          --tc-text-body:     #334155;
          --tc-text-secondary:#64748b;
          --tc-text-muted:    #94a3b8;
          --tc-text-strong:   #1e293b;
        }

        @keyframes pulse-ring {
          0%, 100% { opacity: 0.18; transform: scale(1); }
          50% { opacity: 0.38; transform: scale(1.15); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }

        .coach-root * {
          box-sizing: border-box;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        .send-btn:hover {
          filter: brightness(1.1);
          box-shadow: 0 4px 16px rgba(99,102,241,0.38) !important;
        }
      `}</style>

      <div
        className="coach-root"
        style={{
          minHeight: "100vh",
          background: "var(--tc-page-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 860,
            aspectRatio: "16/9",
            background: "var(--tc-surface)",
            borderRadius: 20,
            boxShadow:
              "0 0 0 1px rgba(0,0,0,0.06), 0 4px 8px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.08), 0 40px 80px rgba(0,0,0,0.06)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "22px 28px 16px",
              borderBottom: "1px solid var(--tc-border-subtle)",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <ThinkingIndicator />
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 17,
                    fontWeight: 650,
                    letterSpacing: "-0.025em",
                    color: "var(--tc-text-primary)",
                    lineHeight: 1.2,
                  }}
                >
                  Training coach
                </h1>
                <p
                  style={{
                    margin: "3px 0 0",
                    fontSize: 12,
                    fontWeight: 400,
                    color: "var(--tc-text-muted)",
                    lineHeight: 1.4,
                  }}
                >
                  Ask about volume, trends, specific activities, or long-term
                  patterns
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 14,
              }}
            >
              {chips.map((chip) => (
                <Chip key={chip.label} icon={chip.icon} label={chip.label} />
              ))}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              position: "relative",
              overflowY: "auto",
              padding: "20px 28px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <DotGrid />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                position: "relative",
                zIndex: 1,
              }}
            >
              <div
                style={{
                  maxWidth: "62%",
                  background: "var(--tc-user-bubble)",
                  border: "1px solid var(--tc-border)",
                  borderRadius: "16px 16px 4px 16px",
                  padding: "10px 14px",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 13.5,
                    fontWeight: 400,
                    color: "var(--tc-text-body)",
                    lineHeight: 1.55,
                  }}
                >
                  What was my total running distance last month?
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                position: "relative",
                zIndex: 1,
              }}
            >
              <CoachAvatar />
              <div
                style={{
                  maxWidth: "72%",
                  background: "var(--tc-surface-raised)",
                  border: "1px solid var(--tc-border)",
                  borderRadius: "4px 16px 16px 16px",
                  padding: "12px 16px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 13.5,
                    fontWeight: 400,
                    color: "var(--tc-text-body)",
                    lineHeight: 1.65,
                  }}
                >
                  Last month you logged{" "}
                  <strong style={{ color: "var(--tc-text-strong)", fontWeight: 600 }}>
                    148.4 km
                  </strong>{" "}
                  across 14 runs — a solid month. Your volume is up{" "}
                  <strong style={{ color: "var(--tc-text-strong)", fontWeight: 600 }}>
                    12%
                  </strong>{" "}
                  compared to the prior month, driven mostly by your midweek
                  long runs. Peak week was April 14–20 at 42 km, which aligns
                  well with your race build. Consistency was strong: only one
                  planned run was skipped.
                </p>
                <StatCallout />
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "12px 20px 18px",
              borderTop: "1px solid var(--tc-border-subtle)",
              flexShrink: 0,
              background: "var(--tc-surface)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: inputFocused
                  ? "var(--tc-input-bg-focus)"
                  : "var(--tc-input-bg)",
                border: `1.5px solid ${inputFocused ? "rgba(99,102,241,0.4)" : "var(--tc-border-input)"}`,
                borderRadius: 999,
                padding: "8px 8px 8px 18px",
                boxShadow: inputFocused
                  ? "0 0 0 3px rgba(99,102,241,0.1), 0 4px 20px rgba(99,102,241,0.12)"
                  : "0 2px 12px rgba(99,102,241,0.06)",
                transition: "all 0.2s ease",
              }}
            >
              <input
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder="Ask your coach anything..."
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontSize: 13.5,
                  fontWeight: 400,
                  color: "var(--tc-text-body)",
                  fontFamily: "inherit",
                }}
              />
              <button
                className="send-btn"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  border: "none",
                  background: GRADIENT,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                  boxShadow: "0 2px 10px rgba(99,102,241,0.28)",
                  transition: "all 0.18s ease",
                }}
              >
                <Send size={15} color="white" strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
