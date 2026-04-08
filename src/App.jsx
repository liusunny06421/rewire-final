import { useEffect, useMemo, useRef, useState } from "react";
import AssessmentFlow from "./AssessmentFlow.jsx";
import { buildPersonalizationProfile, getDomainLabel } from "./personalization.js";

const SYSTEM_PROMPT = `You are Rewire, an expert AI ADHD life coach. You are warm, direct, non-judgmental, and deeply knowledgeable about ADHD — especially how it presents in women and adults diagnosed later in life.

You are trained on research from Understood.org and Amen Clinics, which identifies multiple ADHD subtypes: Classic ADHD, Inattentive ADHD, Overfocused ADHD, Temporal Lobe ADHD, Limbic ADHD, Ring of Fire ADHD, and Anxious ADHD.

Key knowledge:
- Women with ADHD are often misdiagnosed with anxiety or depression
- ADHD presents differently across hormonal cycles
- RSD (Rejection Sensitive Dysphoria) is common and debilitating
- Nutrition: protein timing, omega-3s, avoiding blood sugar crashes, stimulant appetite suppression
- Evidence-based strategies: body doubling, temptation bundling, implementation intentions, time blocking
- Executive function challenges: task initiation, working memory, emotional regulation, time blindness

Coach across: HOME (routines, organization), FOOD (nutrition, meal planning, meds), SOCIAL (relationships, RSD, masking), WORK (productivity, career, task breakdown).

Always: meet the user emotionally, break things into tiny steps, acknowledge struggle before solutions, never make user feel broken. Keep responses short and scannable. Use short paragraphs and clear next steps.

If someone is in distress, gently acknowledge and encourage professional support.`;

const CATEGORIES = [
  {
    id: "home",
    shortLabel: "Home",
    label: "Home & routines",
    desc: "Organization, chores, daily habits",
  },
  {
    id: "food",
    shortLabel: "Food",
    label: "Food & nutrition",
    desc: "Brain fuel, meal planning, meds & appetite",
  },
  {
    id: "social",
    shortLabel: "Social",
    label: "Social & relationships",
    desc: "RSD, communication, masking",
  },
  {
    id: "work",
    shortLabel: "Work",
    label: "Work & focus",
    desc: "Productivity, tasks, career",
  },
];

const STORAGE_KEYS = {
  ROUTINES: "rewire_routines_v1",
  USER_TYPE: "rewire_user_type_v1",
  ONBOARDING: "rewire_onboarding_answers_v1",
  AUTH_EMAIL: "rewire_auth_email_v1",
  ASSESSMENT: "rewire_assessment_v1",
  TRACKING: "rewire_tracking_v1",
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,300&family=DM+Serif+Display:ital@0;1&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f7f9fc; }

  .swoosh-bg {
    position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
    background: #f7f9fc;
  }

  .swoosh-bg::before {
    content: '';
    position: absolute;
    width: 140%; height: 140%;
    top: -20%; left: -20%;
    background:
      radial-gradient(ellipse 60% 40% at 15% 60%, rgba(180, 210, 255, 0.55) 0%, transparent 65%),
      radial-gradient(ellipse 50% 35% at 82% 22%, rgba(210, 230, 255, 0.45) 0%, transparent 60%),
      radial-gradient(ellipse 45% 30% at 55% 88%, rgba(160, 200, 255, 0.35) 0%, transparent 60%),
      radial-gradient(ellipse 50% 38% at 38% 8%, rgba(200, 220, 255, 0.3) 0%, transparent 65%),
      radial-gradient(ellipse 40% 25% at 90% 72%, rgba(230, 240, 255, 0.4) 0%, transparent 55%);
    animation: driftA 18s ease-in-out infinite alternate;
  }

  .swoosh-bg::after {
    content: '';
    position: absolute;
    width: 120%; height: 120%;
    top: -10%; left: -10%;
    background:
      radial-gradient(ellipse 70% 22% at 50% 48%, rgba(190, 215, 255, 0.28) 0%, transparent 70%),
      radial-gradient(ellipse 35% 55% at 18% 32%, rgba(150, 195, 255, 0.22) 0%, transparent 60%),
      radial-gradient(ellipse 40% 28% at 78% 68%, rgba(200, 225, 255, 0.2) 0%, transparent 55%);
    animation: driftB 22s ease-in-out infinite alternate;
  }

  @keyframes driftA {
    0% { transform: translate(0,0) rotate(0deg); }
    100% { transform: translate(2%, 3%) rotate(3deg); }
  }
  @keyframes driftB {
    0% { transform: translate(0,0) rotate(0deg); }
    100% { transform: translate(-2%, -2%) rotate(-2deg); }
  }

  .glass {
    background: rgba(255,255,255,0.72);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.85);
  }

  .glass-dark {
    background: rgba(14,22,42,0.9);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.1);
  }

  .nav-glass {
    background: rgba(247,249,252,0.82);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid rgba(255,255,255,0.7);
  }

  input::placeholder, textarea::placeholder { color: #aab; }
  input:focus, textarea:focus, select:focus {
    outline: none;
    border-color: rgba(100,160,255,0.5) !important;
  }

  .cat-card { transition: transform 0.2s, box-shadow 0.2s; cursor: pointer; }
  .cat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 32px rgba(80,140,230,0.14); }

  .btn-dark { transition: opacity 0.15s, transform 0.1s; cursor: pointer; }
  .btn-dark:hover { opacity: 0.87; }
  .btn-dark:active { transform: scale(0.98); }

  .opt-row { transition: all 0.15s; cursor: pointer; }
  .opt-row:hover { background: rgba(255,255,255,0.85) !important; }

  @keyframes pulse { 0%,100%{opacity:.2} 50%{opacity:.8} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
  .fadein { animation: fadeUp 0.4s ease both; }
`;

const BLUE = "#2563eb";
const BLUE_MID = "#60a5fa";
const BLUE_LIGHT = "#93c5fd";
const BLUE_GHOST = "rgba(96,165,250,0.15)";

function Swoosh() {
  return <div className="swoosh-bg" />;
}

function Logo({ dark = true }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <svg width="30" height="20" viewBox="0 0 60 40" fill="none">
        <path d="M4,20 A18,18 0 0,1 46,20" stroke={dark ? BLUE : "rgba(255,255,255,0.9)"} strokeWidth="3.5" strokeLinecap="round"/>
        <path d="M11,28 A14,14 0 0,0 39,28" stroke={dark ? BLUE_LIGHT : "rgba(255,255,255,0.65)"} strokeWidth="3.5" strokeLinecap="round"/>
        <circle cx="4" cy="20" r="3.5" fill={dark ? BLUE : "rgba(255,255,255,0.9)"}/>
        <circle cx="46" cy="20" r="3.5" fill={dark ? BLUE : "rgba(255,255,255,0.9)"}/>
        <circle cx="11" cy="28" r="2.5" fill={dark ? BLUE_LIGHT : "rgba(255,255,255,0.65)"}/>
        <circle cx="39" cy="28" r="2.5" fill={dark ? BLUE_LIGHT : "rgba(255,255,255,0.65)"}/>
      </svg>
      <span
        style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: "20px",
          fontWeight: 400,
          color: dark ? "#0f172a" : "white",
          letterSpacing: "-0.3px",
          fontStyle: "italic",
        }}
      >
        rewire
      </span>
    </div>
  );
}

function getDefaultRoutines() {
  return {
    home: [],
    food: [],
    social: [],
    work: [],
  };
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getDefaultTracking() {
  return {
    routineStarts: [],
    chatStarts: [],
    checkIns: [],
  };
}

function toDisplayDomain(domainId) {
  return domainId.replaceAll("_", " ");
}

function buildCoachSystemContext({ userType, activeCategory, personalization }) {
  const parts = [
    userType === "parent" ? "This user is a parent of a child with ADHD." : "This user has ADHD themselves.",
  ];

  if (activeCategory) {
    parts.push(`Coaching area: "${activeCategory}".`);
  }

  if (personalization) {
    parts.push(`Primary challenge: ${toDisplayDomain(personalization.primary_domain)}.`);
    parts.push(`Secondary challenge: ${toDisplayDomain(personalization.secondary_domain)}.`);
    parts.push(`Likely friction: ${personalization.chat_context.likelyFriction}.`);
    parts.push(`Recommended style: ${personalization.chat_context.style}.`);
    parts.push(`Support intensity: ${personalization.support_intensity}.`);
    parts.push(`Coaching tone should feel ${personalization.coaching_style}.`);
  }

  return parts.join(" ");
}

function getRecentItems(items, days) {
  const now = Date.now();
  const windowMs = days * 24 * 60 * 60 * 1000;
  return items.filter((item) => {
    const timestamp = new Date(item.at || item.createdAt || 0).getTime();
    return Number.isFinite(timestamp) && now - timestamp <= windowMs;
  });
}

function buildProgressSnapshot({ tracking, assessment, routines, personalization }) {
  const baselineDate = assessment?.completedAt ? new Date(assessment.completedAt) : null;
  const recentRoutineStarts = getRecentItems(tracking.routineStarts, 7);
  const recentChatStarts = getRecentItems(tracking.chatStarts, 7);
  const recentCheckIns = getRecentItems(tracking.checkIns, 7);
  const monthlyCheckIns = getRecentItems(tracking.checkIns, 30);
  const totalSavedRoutines = Object.values(routines).reduce((sum, items) => sum + items.length, 0);
  const averageFocus = recentCheckIns.length
    ? recentCheckIns.reduce((sum, item) => sum + item.focus, 0) / recentCheckIns.length
    : null;
  const averageOverwhelm = recentCheckIns.length
    ? recentCheckIns.reduce((sum, item) => sum + item.overwhelm, 0) / recentCheckIns.length
    : null;
  const previousWindow = tracking.checkIns
    .filter((item) => {
      const timestamp = new Date(item.at || 0).getTime();
      const now = Date.now();
      return now - timestamp > 7 * 24 * 60 * 60 * 1000 && now - timestamp <= 14 * 24 * 60 * 60 * 1000;
    });
  const previousAverageFocus = previousWindow.length
    ? previousWindow.reduce((sum, item) => sum + item.focus, 0) / previousWindow.length
    : null;

  let summary = "Start a quick check-in and try your first routine so Rewire can measure what is helping.";
  if (recentRoutineStarts.length || recentCheckIns.length) {
    summary = averageFocus && previousAverageFocus
      ? averageFocus >= previousAverageFocus
        ? "You're starting to build steadier momentum than last week."
        : "This week looks a little heavier, so Rewire will keep support more structured."
      : recentRoutineStarts.length >= 2
        ? "You're coming back to your support tools more consistently this week."
        : "You're beginning to build a baseline we can adapt around.";
  }

  return {
    baselineLabel: baselineDate ? baselineDate.toLocaleDateString() : "today",
    summary,
    metrics: [
      { label: "Routine starts", value: recentRoutineStarts.length, sublabel: "last 7 days" },
      { label: "Coach sessions", value: recentChatStarts.length, sublabel: "last 7 days" },
      {
        label: "Focus / overwhelm",
        value:
          averageFocus === null || averageOverwhelm === null
            ? "No check-ins yet"
            : `${averageFocus.toFixed(1)} / ${averageOverwhelm.toFixed(1)}`,
        sublabel: "7-day average",
      },
    ],
    adjustment:
      recentRoutineStarts.length === 0 && recentCheckIns.length === 0
        ? "Start with one short routine and one check-in so the dashboard can adapt around your real patterns."
        : personalization?.suggested_adjustment ||
          "Keep using the first recommendation for a few days before changing too many things at once.",
    totalSavedRoutines,
    monthlyCheckInCount: monthlyCheckIns.length,
  };
}

function DashboardPage({
  routines,
  onOpenCategory,
  onGoToRoutines,
  email,
  assessment,
  personalization,
  tracking,
  onStartRoutine,
  onAddCheckIn,
}) {
  const orderedCategories = personalization
    ? personalization.recommended_category_order
        .map((categoryId) => CATEGORIES.find((cat) => cat.id === categoryId))
        .filter(Boolean)
    : CATEGORIES;
  const progress = buildProgressSnapshot({ tracking, assessment, routines, personalization });
  const featuredTools = personalization?.recommended_tools || [];
  const routine = personalization?.routine;

  return (
    <div style={{ minHeight: "100vh", fontFamily: "'DM Sans', system-ui, sans-serif", position: "relative" }}>
      <style>{styles}</style>
      <Swoosh />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "48px 28px 72px" }}>
          <div className="fadein" style={{ marginBottom: "18px" }}>
            <p style={{ fontSize: "11px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 600, marginBottom: "14px" }}>
              PERSONALIZED DASHBOARD
            </p>
            <h1
              style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: "clamp(34px, 5vw, 58px)",
                fontWeight: 400,
                color: "#0f172a",
                lineHeight: 1,
                marginBottom: "12px",
                fontStyle: "italic",
                maxWidth: "760px",
              }}
            >
              {personalization?.hero.headline || `Welcome back${email ? `, ${email.split("@")[0]}` : ""}`}
            </h1>
            <p style={{ color: "#64748b", fontSize: "16px", fontWeight: 300, lineHeight: 1.6, maxWidth: "700px" }}>
              {personalization?.hero.explanation ||
                "Your routines and coaching tools are ready whenever you want to pick up where you left off."}
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: "16px", marginBottom: "18px" }}>
            <div
              className="glass"
              style={{
                borderRadius: "28px",
                padding: "28px",
                background: "linear-gradient(145deg, rgba(255,255,255,0.72), rgba(219,234,254,0.82))",
              }}
            >
              <p style={{ fontSize: "11px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 600, marginBottom: "10px" }}>
                START HERE
              </p>
              <h2
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontSize: "32px",
                  color: "#0f172a",
                  marginBottom: "12px",
                  fontStyle: "italic",
                  fontWeight: 400,
                }}
              >
                {routine?.title || "Your first step"}
              </h2>
              <p style={{ color: "#475569", fontSize: "15px", lineHeight: 1.7, fontWeight: 300, marginBottom: "18px", maxWidth: "560px" }}>
                {routine?.rationale || "We'll put the most useful support in front first so the dashboard feels easier to act on."}
              </p>
              <button
                onClick={() => routine && onStartRoutine(routine)}
                className="btn-dark"
                style={{
                  background: "#0f172a",
                  color: "white",
                  border: "none",
                  borderRadius: "16px",
                  padding: "15px 20px",
                  fontSize: "15px",
                  fontWeight: 500,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {personalization?.hero.cta || "Open support"} →
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="glass-dark" style={{ borderRadius: "24px", padding: "24px" }}>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "6px" }}>Support intensity</p>
                <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: "32px", color: "white", fontStyle: "italic", lineHeight: 1, marginBottom: "8px" }}>
                  {personalization ? personalization.support_intensity : "adaptive"}
                </p>
                <p style={{ color: "rgba(255,255,255,0.66)", fontSize: "13px", lineHeight: 1.6 }}>
                  {personalization
                    ? `Coaching will start ${personalization.coaching_style} with ${personalization.support_intensity} scaffolding.`
                    : "Coaching will adapt from your assessment as you use the app."}
                </p>
              </div>

              <div className="glass" style={{ borderRadius: "24px", padding: "24px" }}>
                <p style={{ fontSize: "11px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 600, marginBottom: "10px" }}>
                  WHAT WE LEARNED
                </p>
                <p style={{ color: "#0f172a", fontSize: "16px", lineHeight: 1.65, fontWeight: 400, marginBottom: "10px" }}>
                  {personalization
                    ? `Your assessment suggests ${getDomainLabel(personalization.primary_domain)} should come first, with extra help for ${getDomainLabel(personalization.secondary_domain)}.`
                    : "Your assessment is saved and ready to shape what support shows up first."}
                </p>
                <p style={{ color: "#64748b", fontSize: "14px", lineHeight: 1.6, fontWeight: 300 }}>
                  {personalization?.summary.adaptation || "Rewire keeps the language practical and focused on support, not labels."}
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: "16px", marginBottom: "18px" }}>
            <div className="glass" style={{ borderRadius: "24px", padding: "24px" }}>
              <p style={{ fontSize: "11px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 600, marginBottom: "10px" }}>
                RECOMMENDED FOR YOU
              </p>
              <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "28px", color: "#0f172a", marginBottom: "10px", fontStyle: "italic", fontWeight: 400 }}>
                {routine?.title || "Recommended first routine"}
              </h3>
              <p style={{ color: "#475569", fontSize: "15px", lineHeight: 1.7, fontWeight: 300, marginBottom: "14px" }}>
                {routine?.rationale || "We'll keep the first step short so you only have to decide one thing."}
              </p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
                <span style={{ background: BLUE_GHOST, color: BLUE, borderRadius: "999px", padding: "8px 12px", fontSize: "12px", fontWeight: 600 }}>
                  {routine?.estimatedTime || "5 min"}
                </span>
                <span style={{ background: "rgba(15,23,42,0.06)", color: "#334155", borderRadius: "999px", padding: "8px 12px", fontSize: "12px", fontWeight: 600 }}>
                  {routine?.stepsCount || 3} steps
                </span>
              </div>
              <button
                onClick={() => routine && onStartRoutine(routine)}
                className="btn-dark"
                style={{
                  background: "#0f172a",
                  color: "white",
                  border: "none",
                  borderRadius: "14px",
                  padding: "14px 18px",
                  width: "100%",
                  fontSize: "14px",
                  fontWeight: 500,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Start routine
              </button>
            </div>

            <div className="glass" style={{ borderRadius: "24px", padding: "24px" }}>
              <p style={{ fontSize: "11px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 600, marginBottom: "10px" }}>
                CORE TOOLS
              </p>
              <div style={{ display: "grid", gap: "12px", marginBottom: "16px" }}>
                {featuredTools.map((tool, index) => (
                  <div
                    key={tool.id}
                    style={{
                      background: index === 0 ? "rgba(219,234,254,0.62)" : "rgba(255,255,255,0.58)",
                      border: "1px solid rgba(255,255,255,0.88)",
                      borderRadius: "18px",
                      padding: "16px",
                    }}
                  >
                    <p style={{ fontSize: "10px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 600, marginBottom: "8px" }}>
                      {index === 0 ? "PRIMARY TOOL" : "SECONDARY TOOL"}
                    </p>
                    <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: "22px", color: "#0f172a", marginBottom: "6px", fontStyle: "italic" }}>
                      {tool.title}
                    </p>
                    <p style={{ fontSize: "14px", color: "#64748b", lineHeight: 1.5, fontWeight: 300, marginBottom: "12px" }}>
                      {tool.description}
                    </p>
                    <button
                      onClick={() => {
                        if (tool.action === "start_routine" && routine) onStartRoutine(routine);
                        if (tool.action === "open_chat") onOpenCategory(routine?.category || personalization?.recommended_category_order?.[0]);
                        if (tool.action === "open_check_in") onAddCheckIn({ focus: 3, overwhelm: 3 });
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: BLUE,
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: 600,
                        padding: 0,
                      }}
                    >
                      {tool.actionLabel} →
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={onGoToRoutines}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.65)",
                  color: "#334155",
                  border: "1px solid rgba(147,197,253,0.3)",
                  borderRadius: "14px",
                  padding: "14px 18px",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                More support
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "0.92fr 1.08fr", gap: "16px", marginBottom: "18px" }}>
            <div className="glass" style={{ borderRadius: "24px", padding: "24px" }}>
              <p style={{ fontSize: "11px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 600, marginBottom: "10px" }}>
                TALK TO YOUR COACH
              </p>
              <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "28px", color: "#0f172a", marginBottom: "10px", fontStyle: "italic", fontWeight: 400 }}>
                Personalized chat starters
              </h3>
              <div style={{ display: "grid", gap: "10px", marginBottom: "18px" }}>
                {(personalization?.recommended_chat_starters || []).map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => routine && onStartRoutine({ ...routine, prompt })}
                    className="opt-row"
                    style={{
                      background: "rgba(255,255,255,0.6)",
                      border: "1px solid rgba(147,197,253,0.3)",
                      borderRadius: "16px",
                      padding: "14px 16px",
                      textAlign: "left",
                      color: "#334155",
                      fontSize: "14px",
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <p style={{ color: "#64748b", fontSize: "13px", lineHeight: 1.6, fontWeight: 300 }}>
                The first chat includes your main friction points, support intensity, and recommended coaching style automatically.
              </p>
            </div>

            <div className="glass" style={{ borderRadius: "24px", padding: "24px" }}>
              <p style={{ fontSize: "11px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 600, marginBottom: "16px" }}>
                SUPPORT AREAS
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                {orderedCategories.map((cat, index) => (
                  <div
                    key={cat.id}
                    onClick={() => onOpenCategory(cat.id)}
                    className="cat-card"
                    style={{
                      background: index < 2 ? "rgba(219,234,254,0.62)" : "rgba(255,255,255,0.56)",
                      border: `1px solid ${index < 2 ? "rgba(96,165,250,0.32)" : "rgba(255,255,255,0.88)"}`,
                      borderRadius: "18px",
                      padding: "18px",
                    }}
                  >
                    <p style={{ fontSize: "10px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 600, marginBottom: "8px" }}>
                      {index < 2 ? "PRIORITY" : "AVAILABLE"}
                    </p>
                    <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: "20px", color: "#0f172a", marginBottom: "6px", fontStyle: "italic" }}>
                      {cat.label}
                    </p>
                    <p style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.4, fontWeight: 300, marginBottom: "10px" }}>
                      {cat.desc}
                    </p>
                    <p style={{ fontSize: "13px", color: BLUE, fontWeight: 600 }}>
                      {routines[cat.id]?.length || 0} saved routine{(routines[cat.id]?.length || 0) === 1 ? "" : "s"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "16px" }}>
            <div className="glass" style={{ borderRadius: "24px", padding: "24px" }}>
              <p style={{ fontSize: "11px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 600, marginBottom: "10px" }}>
                WHAT'S IMPROVING
              </p>
              <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "28px", color: "#0f172a", marginBottom: "10px", fontStyle: "italic", fontWeight: 400 }}>
                Progress against your baseline
              </h3>
              <p style={{ color: "#475569", fontSize: "15px", lineHeight: 1.7, fontWeight: 300, marginBottom: "18px" }}>
                {progress.summary} Baseline started on {progress.baselineLabel}.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "18px" }}>
                {progress.metrics.map((metric) => (
                  <div
                    key={metric.label}
                    style={{
                      background: "rgba(255,255,255,0.56)",
                      border: "1px solid rgba(255,255,255,0.88)",
                      borderRadius: "18px",
                      padding: "16px",
                    }}
                  >
                    <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>{metric.label}</p>
                    <p style={{ fontSize: "24px", color: "#0f172a", fontWeight: 700, marginBottom: "6px" }}>{metric.value}</p>
                    <p style={{ fontSize: "12px", color: "#94a3b8" }}>{metric.sublabel}</p>
                  </div>
                ))}
              </div>
              <div style={{ borderRadius: "18px", padding: "16px", background: "rgba(219,234,254,0.55)" }}>
                <p style={{ fontSize: "11px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 700, marginBottom: "8px" }}>
                  SUGGESTED ADJUSTMENT
                </p>
                <p style={{ color: "#334155", fontSize: "14px", lineHeight: 1.6 }}>{progress.adjustment}</p>
              </div>
            </div>

            <div className="glass" style={{ borderRadius: "24px", padding: "24px" }}>
              <p style={{ fontSize: "11px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 600, marginBottom: "10px" }}>
                QUICK CHECK-IN
              </p>
              <p style={{ color: "#334155", fontSize: "15px", lineHeight: 1.6, fontWeight: 300, marginBottom: "16px" }}>
                Rate today in one tap so Rewire can adapt support over time.
              </p>
              <div style={{ display: "grid", gap: "12px", marginBottom: "14px" }}>
                {[
                  { label: "Focused and steady", focus: 4, overwhelm: 2 },
                  { label: "Mixed day, manageable", focus: 3, overwhelm: 3 },
                  { label: "Scattered and overloaded", focus: 2, overwhelm: 4 },
                ].map((option) => (
                  <button
                    key={option.label}
                    onClick={() => onAddCheckIn(option)}
                    className="opt-row"
                    style={{
                      background: "rgba(255,255,255,0.62)",
                      border: "1px solid rgba(147,197,253,0.3)",
                      borderRadius: "16px",
                      padding: "14px 16px",
                      textAlign: "left",
                      color: "#334155",
                      fontSize: "14px",
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p style={{ color: "#94a3b8", fontSize: "13px", lineHeight: 1.6, fontWeight: 300 }}>
                {progress.monthlyCheckInCount} check-in{progress.monthlyCheckInCount === 1 ? "" : "s"} in the last 30 days.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MyRoutinesPage({ routines, onDeleteRoutine, onOpenCategory }) {
  return (
    <div style={{ minHeight: "100vh", fontFamily: "'DM Sans', system-ui, sans-serif", position: "relative" }}>
      <style>{styles}</style>
      <Swoosh />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "48px 28px 72px" }}>
          <div className="fadein" style={{ marginBottom: "28px" }}>
            <p style={{ fontSize: "11px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 600, marginBottom: "14px" }}>
              MY ROUTINES
            </p>
            <h1
              style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: "clamp(34px, 5vw, 58px)",
                fontWeight: 400,
                color: "#0f172a",
                lineHeight: 1,
                marginBottom: "12px",
                fontStyle: "italic",
              }}
            >
              Your saved routines
            </h1>
            <p style={{ color: "#64748b", fontSize: "16px", fontWeight: 300, lineHeight: 1.6 }}>
              Everything you save from chat gets sorted into its category here.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
            {CATEGORIES.map((cat) => {
              const items = routines[cat.id] || [];

              return (
                <div key={cat.id} className="glass" style={{ borderRadius: "24px", padding: "22px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                    <div>
                      <p style={{ fontSize: "10px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 600, marginBottom: "8px" }}>
                        {cat.shortLabel.toUpperCase()}
                      </p>
                      <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: "24px", color: "#0f172a", fontStyle: "italic" }}>
                        {cat.label}
                      </p>
                    </div>
                    <button
                      onClick={() => onOpenCategory(cat.id)}
                      style={{
                        background: BLUE_GHOST,
                        color: BLUE,
                        border: "1px solid rgba(96,165,250,0.25)",
                        borderRadius: "999px",
                        padding: "8px 12px",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Open chat
                    </button>
                  </div>

                  {items.length === 0 ? (
                    <p style={{ color: "#94a3b8", fontSize: "14px", fontWeight: 300 }}>
                      No routines saved yet.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {items.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            background: "rgba(255,255,255,0.52)",
                            border: "1px solid rgba(255,255,255,0.88)",
                            borderRadius: "16px",
                            padding: "14px",
                          }}
                        >
                          <p style={{ color: "#0f172a", fontSize: "15px", lineHeight: 1.5, fontWeight: 400, marginBottom: "8px" }}>
                            {item.text}
                          </p>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                            <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                              Added from chat
                            </span>
                            <button
                              onClick={() => onDeleteRoutine(cat.id, item.id)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#ef4444",
                                fontSize: "13px",
                                cursor: "pointer",
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);

  return (
    <div style={{ minHeight: "100vh", fontFamily: "'DM Sans', system-ui, sans-serif", position: "relative" }}>
      <style>{styles}</style>
      <Swoosh />
      <div style={{ position: "relative", zIndex: 1 }}>
        <nav className="nav-glass" style={{ padding: "20px 48px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Logo />
          <div style={{ display: "flex", gap: "36px" }}>
            {["HOME", "ABOUT", "TRIAL", "BLOG"].map((l) => (
              <span key={l} style={{ fontSize: "11px", letterSpacing: "1.5px", color: "#94a3b8", fontWeight: 500 }}>
                {l}
              </span>
            ))}
          </div>
        </nav>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            maxWidth: "1100px",
            margin: "0 auto",
            padding: "72px 48px",
            gap: "80px",
            alignItems: "center",
            minHeight: "calc(100vh - 65px)",
          }}
        >
          <div className="fadein">
            <h1
              style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: "clamp(54px, 7vw, 90px)",
                fontWeight: 400,
                lineHeight: 0.92,
                color: "#0f172a",
                marginBottom: "32px",
                letterSpacing: "-2px",
              }}
            >
              A gentle
              <br />
              approach to
              <br />
              <em style={{ color: BLUE }}>your ADHD</em>
            </h1>
            <p style={{ fontSize: "17px", color: "#64748b", lineHeight: 1.65, maxWidth: "360px", marginBottom: "48px", fontWeight: 300 }}>
              Personalized coaching for the ADHD brain — available 24/7, built especially for women diagnosed later in life.
            </p>
          </div>

          <div className="fadein glass" style={{ borderRadius: "28px", padding: "48px" }}>
            <h2
              style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: "30px",
                fontWeight: 400,
                color: "#0f172a",
                marginBottom: "8px",
                fontStyle: "italic",
              }}
            >
              {isSignup ? "Start your journey" : "Welcome back"}
            </h2>
            <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "32px", lineHeight: 1.5, fontWeight: 300 }}>
              {isSignup ? "Your brain is not broken. Let's rewire." : "Your coach is waiting for you."}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                type="email"
                style={{
                  background: "rgba(241,245,249,0.8)",
                  border: "1px solid rgba(147,197,253,0.35)",
                  borderRadius: "14px",
                  padding: "15px 18px",
                  fontSize: "15px",
                  color: "#0f172a",
                  fontFamily: "'DM Sans', sans-serif",
                  width: "100%",
                }}
              />

              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                type="password"
                style={{
                  background: "rgba(241,245,249,0.8)",
                  border: "1px solid rgba(147,197,253,0.35)",
                  borderRadius: "14px",
                  padding: "15px 18px",
                  fontSize: "15px",
                  color: "#0f172a",
                  fontFamily: "'DM Sans', sans-serif",
                  width: "100%",
                }}
              />

              <button
                onClick={() => onLogin(email)}
                className="btn-dark"
                style={{
                  background: "#0f172a",
                  color: "white",
                  border: "none",
                  borderRadius: "14px",
                  padding: "17px",
                  fontSize: "15px",
                  fontWeight: 500,
                  fontFamily: "'DM Sans', sans-serif",
                  marginTop: "4px",
                }}
              >
                {isSignup ? "Create account" : "Sign in"} →
              </button>
            </div>

            <p style={{ color: "#94a3b8", fontSize: "13px", textAlign: "center", marginTop: "24px" }}>
              {isSignup ? "Already have an account?" : "New here?"}{" "}
              <span onClick={() => setIsSignup(!isSignup)} style={{ color: BLUE, cursor: "pointer", fontWeight: 500 }}>
                {isSignup ? "Sign in" : "Create account"}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function WhoAreYouPage({ onSelect }) {
  return (
    <div style={{ minHeight: "100vh", fontFamily: "'DM Sans', system-ui, sans-serif", position: "relative" }}>
      <style>{styles}</style>
      <Swoosh />
      <div style={{ position: "relative", zIndex: 1 }}>
        <nav className="nav-glass" style={{ padding: "20px 48px" }}>
          <Logo />
        </nav>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "calc(100vh - 65px)",
            padding: "40px 24px",
          }}
        >
          <p style={{ fontSize: "11px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 600, marginBottom: "20px" }}>
            GETTING STARTED
          </p>
          <h1
            style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: "clamp(40px, 6vw, 72px)",
              fontWeight: 400,
              color: "#0f172a",
              marginBottom: "16px",
              letterSpacing: "-1.5px",
              textAlign: "center",
              lineHeight: 1,
              fontStyle: "italic",
            }}
          >
            Who is Rewire for?
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "16px", marginBottom: "52px", textAlign: "center", lineHeight: 1.6, fontWeight: 300 }}>
            We’ll build your experience around your situation.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", maxWidth: "640px", width: "100%" }}>
            {[
              { id: "self", tag: "FOR MYSELF", title: "I have ADHD", sub: "Help me understand my brain and hack my daily life", dark: true },
              { id: "parent", tag: "FOR MY CHILD", title: "I'm a parent", sub: "My child has ADHD and I want to support them better", dark: false },
            ].map((opt) => (
              <div
                key={opt.id}
                onClick={() => onSelect(opt.id)}
                className="cat-card"
                style={{
                  borderRadius: "24px",
                  padding: "36px 28px",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  ...(opt.dark
                    ? { background: "rgba(14,22,42,0.9)", border: "1px solid rgba(255,255,255,0.1)" }
                    : { background: "rgba(255,255,255,0.72)", border: "1px solid rgba(255,255,255,0.88)" }),
                }}
              >
                <p style={{ fontSize: "10px", letterSpacing: "2px", color: opt.dark ? BLUE_LIGHT : BLUE_MID, fontWeight: 600, marginBottom: "14px" }}>
                  {opt.tag}
                </p>
                <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: "28px", color: opt.dark ? "white" : "#0f172a", marginBottom: "10px", fontStyle: "italic", lineHeight: 1.1 }}>
                  {opt.title}
                </p>
                <p style={{ fontSize: "14px", color: opt.dark ? "rgba(255,255,255,0.45)" : "#64748b", lineHeight: 1.5, fontWeight: 300, marginBottom: "20px" }}>
                  {opt.sub}
                </p>
                <span style={{ fontSize: "18px", color: opt.dark ? BLUE_LIGHT : BLUE }}>→</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OnboardingPage({ userType, onComplete }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});

  const selfQ = [
    { q: "How long have you known about your ADHD?", opts: ["Just diagnosed", "A few years", "Known for a long time", "Still figuring it out"] },
    { q: "Which challenges hit you hardest?", opts: ["Starting tasks", "Staying focused", "Emotions & rejection", "Time & organization"], multi: true },
    { q: "Do you tend to be more...", opts: ["Distracted & spacey", "Hyperactive & restless", "A mix of both", "Anxious & overthinking"] },
    { q: "What area of life feels most out of control?", opts: ["Work & career", "Home & routines", "Relationships", "Food & health"] },
  ];

  const parentQ = [
    { q: "How old is your child?", opts: ["Under 6", "6–12", "13–17", "18+"] },
    { q: "What are you struggling with most?", opts: ["Understanding their behavior", "School & homework", "Managing meltdowns", "Talking to doctors"], multi: true },
    { q: "How are you feeling right now?", opts: ["Overwhelmed & exhausted", "Hopeful but lost", "Frustrated", "Pretty okay"] },
  ];

  const questions = userType === "self" ? selfQ : parentQ;
  const current = questions[step];
  const selected = answers[step] || [];
  const pct = (step / questions.length) * 100;

  function pick(opt) {
    if (current.multi) {
      const has = selected.includes(opt);
      setAnswers({
        ...answers,
        [step]: has ? selected.filter((x) => x !== opt) : [...selected, opt],
      });
    } else {
      const nextAnswers = { ...answers, [step]: [opt] };
      setAnswers(nextAnswers);

      setTimeout(() => {
        if (step < questions.length - 1) {
          setStep(step + 1);
        } else {
          onComplete(nextAnswers);
        }
      }, 220);
    }
  }

  return (
    <div style={{ minHeight: "100vh", fontFamily: "'DM Sans', system-ui, sans-serif", position: "relative" }}>
      <style>{styles}</style>
      <Swoosh />
      <div style={{ position: "relative", zIndex: 1 }}>
        <nav className="nav-glass" style={{ padding: "20px 48px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Logo />
          <span style={{ fontSize: "12px", color: "#94a3b8", letterSpacing: "1px", fontWeight: 300 }}>
            {step + 1} / {questions.length}
          </span>
        </nav>

        <div style={{ height: "2px", background: "rgba(147,197,253,0.2)" }}>
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${BLUE}, ${BLUE_MID})`,
              borderRadius: "2px",
              transition: "width 0.4s",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 70px)", padding: "60px 24px" }}>
          <div style={{ maxWidth: "520px", width: "100%" }} className="fadein">
            <h2
              style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: "clamp(28px, 4vw, 46px)",
                fontWeight: 400,
                color: "#0f172a",
                marginBottom: "36px",
                letterSpacing: "-1px",
                lineHeight: 1.1,
                fontStyle: "italic",
              }}
            >
              {current.q}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {current.opts.map((opt) => {
                const on = selected.includes(opt);

                return (
                  <div
                    key={opt}
                    onClick={() => pick(opt)}
                    className="opt-row"
                    style={{
                      background: on ? "rgba(14,22,42,0.9)" : "rgba(255,255,255,0.68)",
                      border: `1px solid ${on ? "transparent" : "rgba(255,255,255,0.85)"}`,
                      backdropFilter: "blur(16px)",
                      WebkitBackdropFilter: "blur(16px)",
                      borderRadius: "16px",
                      padding: "18px 22px",
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      color: on ? "white" : "#334155",
                    }}
                  >
                    <span
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: current.multi ? "6px" : "50%",
                        border: `1.5px solid ${on ? BLUE_LIGHT : "rgba(100,160,255,0.35)"}`,
                        background: on ? BLUE : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        fontSize: "12px",
                        color: "white",
                      }}
                    >
                      {on && "✓"}
                    </span>
                    <span style={{ fontSize: "15px", fontWeight: on ? 500 : 300 }}>{opt}</span>
                  </div>
                );
              })}
            </div>

            {current.multi && (
              <button
                onClick={() => {
                  if (step < questions.length - 1) {
                    setStep(step + 1);
                  } else {
                    onComplete(answers);
                  }
                }}
                className="btn-dark"
                style={{
                  marginTop: "28px",
                  background: "#0f172a",
                  color: "white",
                  border: "none",
                  borderRadius: "14px",
                  padding: "17px 32px",
                  fontSize: "15px",
                  fontWeight: 500,
                  width: "100%",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Continue →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddRoutineModal({ open, initialText, initialCategory, onClose, onSave }) {
  const [text, setText] = useState(initialText || "");
  const [category, setCategory] = useState(initialCategory || "home");

  useEffect(() => {
    if (open) {
      setText(initialText || "");
      setCategory(initialCategory || "home");
    }
  }, [open, initialText, initialCategory]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 20,
        background: "rgba(15,23,42,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div className="glass" style={{ width: "100%", maxWidth: "520px", borderRadius: "24px", padding: "24px" }}>
        <p style={{ fontSize: "11px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 600, marginBottom: "10px" }}>
          ADD TO MY ROUTINE
        </p>
        <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "30px", color: "#0f172a", marginBottom: "10px", fontStyle: "italic", fontWeight: 400 }}>
          Save this step
        </h3>
        <p style={{ color: "#64748b", fontSize: "14px", lineHeight: 1.6, fontWeight: 300, marginBottom: "18px" }}>
          You can edit the wording before saving it.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            style={{
              background: "rgba(255,255,255,0.65)",
              border: "1px solid rgba(147,197,253,0.3)",
              borderRadius: "14px",
              padding: "14px 16px",
              fontSize: "15px",
              fontFamily: "'DM Sans', sans-serif",
              color: "#0f172a",
              resize: "vertical",
            }}
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              background: "rgba(255,255,255,0.65)",
              border: "1px solid rgba(147,197,253,0.3)",
              borderRadius: "14px",
              padding: "14px 16px",
              fontSize: "15px",
              fontFamily: "'DM Sans', sans-serif",
              color: "#0f172a",
            }}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.65)",
              color: "#64748b",
              border: "1px solid rgba(147,197,253,0.3)",
              borderRadius: "14px",
              padding: "14px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          <button
            onClick={() => {
              if (!text.trim()) return;
              onSave(text.trim(), category);
            }}
            className="btn-dark"
            style={{
              flex: 1,
              background: "#0f172a",
              color: "white",
              border: "none",
              borderRadius: "14px",
              padding: "14px",
              fontSize: "14px",
              fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Save routine
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatPage({ userType, onSaveRoutine, initialCategory = null, initialPrompt = "", personalization, onTrackChatStart }) {
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(Boolean(initialCategory));
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingRoutineText, setPendingRoutineText] = useState("");
  const [pendingRoutineCategory, setPendingRoutineCategory] = useState(initialCategory || "home");

  const bottomRef = useRef(null);

  useEffect(() => {
    if (initialCategory) {
      startChat(initialCategory, initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCategory, initialPrompt]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function welcome(cat, prompt) {
    const catName = cat ? CATEGORIES.find((c) => c.id === cat)?.label : null;
    const base =
      userType === "parent"
        ? "Hey, I'm so glad you're here. Parenting a child with ADHD is one of the hardest — and most important — jobs there is. I'm your coach, available any time."
        : "Hey, welcome to Rewire. I'm your personal ADHD coach — no judgment, just real support built around how your brain actually works.";

    if (prompt) {
      return `${base}\n\nLet's start with ${catName || "the support that fits you best"}. I already know your main friction points, so we can keep this simple.`;
    }

    return catName ? `${base}\n\nLet's talk about ${catName}. What's going on?` : `${base}\n\nWhat do you want to tackle today?`;
  }

  function startChat(cat, prompt = "") {
    setActiveCategory(cat);
    setStarted(true);
    setInput(prompt);
    setMessages([{ role: "assistant", content: welcome(cat, prompt) }]);
    onTrackChatStart?.({ category: cat, source: prompt ? "personalized_prompt" : "manual" });
  }

  async function send() {
    if (!input.trim() || loading) return;

    const msg = { role: "user", content: input };
    const hist = [...messages, msg];

    setMessages(hist);
    setInput("");
    setLoading(true);

    try {
      const cat = activeCategory ? CATEGORIES.find((c) => c.id === activeCategory)?.label : null;
      const ctx = buildCoachSystemContext({
        userType,
        activeCategory: cat,
        personalization,
      });

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemPrompt: `${SYSTEM_PROMPT}\n\n${ctx}`,
          messages: hist,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }
      
      const reply = data.reply || "I'm here — can you say that again?";

      setMessages([...hist, { role: "assistant", content: reply }]);
    } catch (error) {
      setMessages([
        ...hist,
        {
          role: "assistant",
          content: `Something went wrong: ${error.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const activeCat = useMemo(
    () => CATEGORIES.find((c) => c.id === activeCategory),
    [activeCategory]
  );

  if (!started) {
    return (
      <div style={{ minHeight: "100vh", fontFamily: "'DM Sans', system-ui, sans-serif", position: "relative" }}>
        <style>{styles}</style>
        <Swoosh />
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          <div style={{ flex: 1, maxWidth: "960px", margin: "0 auto", width: "100%", padding: "56px 40px" }}>
            <p style={{ fontSize: "10px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 600, marginBottom: "16px" }}>
              YOUR SESSION
            </p>
            <h1
              style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: "clamp(36px, 5vw, 58px)",
                fontWeight: 400,
                color: "#0f172a",
                marginBottom: "44px",
                letterSpacing: "-1.5px",
                lineHeight: 1,
                fontStyle: "italic",
              }}
            >
              What do you need
              <br />
              help with today?
            </h1>

            {personalization?.recommended_chat_starters?.length ? (
              <div style={{ display: "grid", gap: "10px", marginBottom: "22px", maxWidth: "620px" }}>
                {personalization.recommended_chat_starters.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => startChat(personalization.routine.category, prompt)}
                    className="opt-row"
                    style={{
                      background: "rgba(255,255,255,0.68)",
                      border: "1px solid rgba(147,197,253,0.3)",
                      backdropFilter: "blur(16px)",
                      WebkitBackdropFilter: "blur(16px)",
                      borderRadius: "16px",
                      padding: "16px 18px",
                      textAlign: "left",
                      color: "#334155",
                      fontSize: "14px",
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", marginBottom: "10px" }}>
              {CATEGORIES.map((cat, i) => (
                <div
                  key={cat.id}
                  onClick={() => startChat(cat.id)}
                  className="cat-card"
                  style={{
                    borderRadius: "20px",
                    padding: "26px",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    ...(i === 0
                      ? { background: "rgba(14,22,42,0.9)", border: "1px solid rgba(255,255,255,0.1)" }
                      : { background: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.88)" }),
                  }}
                >
                  <p style={{ fontSize: "10px", letterSpacing: "2px", color: i === 0 ? BLUE_LIGHT : BLUE_MID, fontWeight: 600, marginBottom: "10px" }}>
                    {cat.shortLabel.toUpperCase()}
                  </p>
                  <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: "22px", color: i === 0 ? "white" : "#0f172a", marginBottom: "6px", fontStyle: "italic" }}>
                    {cat.label}
                  </p>
                  <p style={{ fontSize: "13px", color: i === 0 ? "rgba(255,255,255,0.45)" : "#64748b", lineHeight: 1.4, fontWeight: 300, marginBottom: "16px" }}>
                    {cat.desc}
                  </p>
                  <span style={{ fontSize: "16px", color: i === 0 ? BLUE_LIGHT : BLUE }}>→</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <AddRoutineModal
        open={modalOpen}
        initialText={pendingRoutineText}
        initialCategory={pendingRoutineCategory}
        onClose={() => setModalOpen(false)}
        onSave={(text, category) => {
          onSaveRoutine(text, category);
          setModalOpen(false);
        }}
      />

      <div style={{ minHeight: "100vh", fontFamily: "'DM Sans', system-ui, sans-serif", position: "relative", display: "flex", flexDirection: "column" }}>
        <style>{styles}</style>
        <Swoosh />
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          <nav className="nav-glass" style={{ padding: "16px 32px", display: "flex", alignItems: "center", gap: "14px" }}>
            <Logo />
            {activeCat && (
              <span
                style={{
                  background: BLUE_GHOST,
                  color: BLUE,
                  fontSize: "10px",
                  padding: "5px 14px",
                  borderRadius: "99px",
                  fontWeight: 600,
                  letterSpacing: "1.5px",
                  border: `1px solid rgba(96,165,250,0.25)`,
                }}
              >
                {activeCat.label.toUpperCase()}
              </span>
            )}
          </nav>

          <div style={{ flex: 1, overflowY: "auto", padding: "36px 24px", display: "flex", flexDirection: "column", gap: "18px", maxWidth: "720px", margin: "0 auto", width: "100%" }}>
            {messages.map((msg, i) => {
              const canSave = msg.role === "assistant" && i > 0;

              return (
                <div key={i} className="fadein" style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: "10px" }}>
                  {msg.role === "assistant" && (
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(14,22,42,0.88)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="16" height="11" viewBox="0 0 60 40" fill="none">
                        <path d="M4,20 A18,18 0 0,1 46,20" stroke={BLUE_LIGHT} strokeWidth="5" strokeLinecap="round"/>
                        <path d="M11,28 A14,14 0 0,0 39,28" stroke="white" strokeWidth="5" strokeLinecap="round"/>
                        <circle cx="4" cy="20" r="5" fill={BLUE_LIGHT}/>
                        <circle cx="46" cy="20" r="5" fill={BLUE_LIGHT}/>
                      </svg>
                    </div>
                  )}

                  <div style={{ maxWidth: "72%" }}>
                    <div
                      style={{
                        background: msg.role === "user" ? "rgba(14,22,42,0.9)" : "rgba(255,255,255,0.75)",
                        border: msg.role === "assistant" ? "1px solid rgba(255,255,255,0.88)" : "none",
                        backdropFilter: "blur(16px)",
                        WebkitBackdropFilter: "blur(16px)",
                        borderRadius: msg.role === "user" ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
                        padding: "14px 18px",
                        fontSize: "15px",
                        lineHeight: 1.65,
                        color: msg.role === "user" ? "white" : "#1e293b",
                        whiteSpace: "pre-wrap",
                        fontWeight: 300,
                      }}
                    >
                      {msg.content}
                    </div>

                    {canSave && (
                      <div style={{ display: "flex", justifyContent: "flex-start", marginTop: "8px" }}>
                        <button
                          onClick={() => {
                            setPendingRoutineText(msg.content);
                            setPendingRoutineCategory(activeCategory || "home");
                            setModalOpen(true);
                          }}
                          style={{
                            background: "rgba(255,255,255,0.75)",
                            border: "1px solid rgba(147,197,253,0.3)",
                            borderRadius: "999px",
                            color: BLUE,
                            cursor: "pointer",
                            fontSize: "12px",
                            padding: "8px 12px",
                          }}
                        >
                          + Add to my routine
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div style={{ display: "flex", alignItems: "flex-end", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(14,22,42,0.88)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="16" height="11" viewBox="0 0 60 40" fill="none">
                    <path d="M4,20 A18,18 0 0,1 46,20" stroke={BLUE_LIGHT} strokeWidth="5" strokeLinecap="round"/>
                    <path d="M11,28 A14,14 0 0,0 39,28" stroke="white" strokeWidth="5" strokeLinecap="round"/>
                    <circle cx="4" cy="20" r="5" fill={BLUE_LIGHT}/>
                    <circle cx="46" cy="20" r="5" fill={BLUE_LIGHT}/>
                  </svg>
                </div>
                <div style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.88)", backdropFilter: "blur(16px)", borderRadius: "20px 20px 20px 4px", padding: "14px 18px", display: "flex", gap: "6px" }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ width: "7px", height: "7px", borderRadius: "50%", background: BLUE_LIGHT, animation: `pulse 1.3s ${i * 0.2}s infinite ease-in-out` }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="nav-glass" style={{ padding: "14px 24px" }}>
            <div style={{ maxWidth: "720px", margin: "0 auto", display: "flex", gap: "10px", alignItems: "flex-end" }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Talk to your coach..."
                rows={1}
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.65)",
                  border: "1px solid rgba(147,197,253,0.3)",
                  borderRadius: "14px",
                  padding: "13px 18px",
                  fontSize: "15px",
                  fontFamily: "'DM Sans', sans-serif",
                  color: "#0f172a",
                  resize: "none",
                  lineHeight: 1.5,
                  fontWeight: 300,
                  backdropFilter: "blur(8px)",
                }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                style={{
                  background: input.trim() && !loading ? "#0f172a" : "rgba(147,197,253,0.25)",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  width: "48px",
                  height: "48px",
                  cursor: input.trim() && !loading ? "pointer" : "default",
                  fontSize: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                ↑
              </button>
            </div>
            <p style={{ textAlign: "center", fontSize: "11px", color: "#cbd5e1", marginTop: "10px", fontWeight: 300 }}>
              Not a substitute for medical advice · Available 24/7
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function App() {
 const [screen, setScreen] = useState(() => {
  const savedEmail = localStorage.getItem(STORAGE_KEYS.AUTH_EMAIL);
  const savedUserType = localStorage.getItem(STORAGE_KEYS.USER_TYPE);
  const savedAnswers = loadJSON(STORAGE_KEYS.ONBOARDING, null);
  const savedAssessment = loadJSON(STORAGE_KEYS.ASSESSMENT, null);

  if (savedEmail && savedUserType && savedAnswers && savedAssessment) return "app";
  if (savedEmail && savedUserType && savedAnswers) return "assessment";
  if (savedEmail && savedUserType) return "onboarding";
  if (savedEmail) return "who";
  return "login";
});
  const [userType, setUserType] = useState(() => localStorage.getItem(STORAGE_KEYS.USER_TYPE) || null);
  const [answers, setAnswers] = useState(() => loadJSON(STORAGE_KEYS.ONBOARDING, null));
  const [email, setEmail] = useState(() => localStorage.getItem(STORAGE_KEYS.AUTH_EMAIL) || "");
  const [assessment, setAssessment] = useState(() => loadJSON(STORAGE_KEYS.ASSESSMENT, null));
  const [activeTab, setActiveTab] = useState("dashboard");
  const [chatCategory, setChatCategory] = useState(null);
  const [chatPrompt, setChatPrompt] = useState("");
  const [routines, setRoutines] = useState(() => loadJSON(STORAGE_KEYS.ROUTINES, getDefaultRoutines()));
  const [tracking, setTracking] = useState(() => loadJSON(STORAGE_KEYS.TRACKING, getDefaultTracking()));

  const personalization = useMemo(() => {
    if (assessment?.personalization) return assessment.personalization;
    if (assessment?.featureVector && assessment?.prediction) {
      return buildPersonalizationProfile(assessment.featureVector, assessment.prediction);
    }
    return null;
  }, [assessment]);

  useEffect(() => {
    saveJSON(STORAGE_KEYS.ROUTINES, routines);
  }, [routines]);

  useEffect(() => {
    saveJSON(STORAGE_KEYS.TRACKING, tracking);
  }, [tracking]);

  useEffect(() => {
    if (userType) localStorage.setItem(STORAGE_KEYS.USER_TYPE, userType);
  }, [userType]);

  useEffect(() => {
    if (answers) saveJSON(STORAGE_KEYS.ONBOARDING, answers);
  }, [answers]);

  useEffect(() => {
    if (assessment) saveJSON(STORAGE_KEYS.ASSESSMENT, assessment);
  }, [assessment]);

  function addRoutine(text, category) {
    const newItem = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text,
      createdAt: new Date().toISOString(),
    };

    setRoutines((prev) => ({
      ...prev,
      [category]: [newItem, ...(prev[category] || [])],
    }));
  }

  function deleteRoutine(category, id) {
    setRoutines((prev) => ({
      ...prev,
      [category]: (prev[category] || []).filter((item) => item.id !== id),
    }));
  }

  function handleLogin(nextEmail) {
    const safeEmail = nextEmail?.trim() || "user@example.com";
    setEmail(safeEmail);
    localStorage.setItem(STORAGE_KEYS.AUTH_EMAIL, safeEmail);
    setScreen("who");
  }

  function openCategoryChat(categoryId) {
    setChatCategory(categoryId);
    setChatPrompt("");
    setActiveTab("chat");
    setScreen("app");
  }

  function openPersonalizedRoutine(routine, overridePrompt = "") {
    if (!routine) return;
    setTracking((current) => ({
      ...current,
      routineStarts: [
        {
          at: new Date().toISOString(),
          routineId: routine.id,
          domain: personalization?.primary_domain || null,
        },
        ...current.routineStarts,
      ],
    }));
    setChatCategory(routine.category);
    setChatPrompt(overridePrompt || routine.prompt || "");
    setActiveTab("chat");
    setScreen("app");
  }

  function addCheckIn({ focus, overwhelm }) {
    setTracking((current) => ({
      ...current,
      checkIns: [
        {
          at: new Date().toISOString(),
          focus,
          overwhelm,
        },
        ...current.checkIns,
      ],
    }));
  }

  function trackChatStart({ category, source }) {
    setTracking((current) => ({
      ...current,
      chatStarts: [
        {
          at: new Date().toISOString(),
          category,
          source,
        },
        ...current.chatStarts,
      ],
    }));
  }

  const showTopTabs = screen === "app";

  if (screen === "login") {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (screen === "who") {
    return (
      <WhoAreYouPage
        onSelect={(type) => {
          setUserType(type);
          setScreen("onboarding");
        }}
      />
    );
  }

  if (screen === "onboarding") {
    return (
      <OnboardingPage
        userType={userType}
        onComplete={(nextAnswers) => {
          setAnswers(nextAnswers);
          setScreen("assessment");
        }}
      />
    );
  }

  if (screen === "assessment") {
    return (
      <AssessmentFlow
        userType={userType}
        onComplete={(nextAssessment) => {
          setAssessment(nextAssessment);
          setScreen("app");
          setActiveTab("dashboard");
        }}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      {showTopTabs && (
        <div className="nav-glass" style={{ position: "sticky", top: 0, zIndex: 10, padding: "14px 24px" }}>
          <style>{styles}</style>
          <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "18px" }}>
            <Logo />
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              {[
                { id: "dashboard", label: "Dashboard" },
                { id: "chat", label: "Chat" },
                { id: "routines", label: "My Routines" },
              ].map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (tab.id === "chat") {
                        setChatCategory(null);
                        setChatPrompt("");
                      }
                      setActiveTab(tab.id);
                    }}
                    style={{
                      background: active ? "#0f172a" : "rgba(255,255,255,0.65)",
                      color: active ? "white" : "#64748b",
                      border: active ? "none" : "1px solid rgba(147,197,253,0.3)",
                      borderRadius: "999px",
                      padding: "10px 16px",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === "dashboard" && (
        <DashboardPage
          routines={routines}
          email={email}
          onGoToRoutines={() => setActiveTab("routines")}
          onOpenCategory={openCategoryChat}
          assessment={assessment}
          personalization={personalization}
          tracking={tracking}
          onStartRoutine={openPersonalizedRoutine}
          onAddCheckIn={addCheckIn}
        />
      )}

      {activeTab === "routines" && (
        <MyRoutinesPage
          routines={routines}
          onDeleteRoutine={deleteRoutine}
          onOpenCategory={openCategoryChat}
        />
      )}

      {activeTab === "chat" && (
        <ChatPage
          userType={userType}
          initialCategory={chatCategory}
          initialPrompt={chatPrompt}
          personalization={personalization}
          onTrackChatStart={trackChatStart}
          onSaveRoutine={addRoutine}
        />
      )}
    </div>
  );
}
