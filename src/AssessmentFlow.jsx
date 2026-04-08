import { useEffect, useMemo, useRef, useState } from "react";
import modelMetadata from "../model/adhd_model_metadata.json";
import { buildPersonalizationProfile, getDomainScores } from "./personalization.js";

const BLUE = "#2563eb";
const BLUE_MID = "#60a5fa";
const BLUE_LIGHT = "#93c5fd";

const SECTION_STYLES = `
  .assessment-shell {
    min-height: 100vh;
    font-family: 'DM Sans', system-ui, sans-serif;
    background:
      radial-gradient(circle at top left, rgba(147,197,253,0.4), transparent 30%),
      radial-gradient(circle at bottom right, rgba(96,165,250,0.22), transparent 35%),
      #f7f9fc;
    color: #0f172a;
  }

  .assessment-grid {
    display: grid;
    grid-template-columns: 0.95fr 1.05fr;
    gap: 18px;
  }

  .assessment-card {
    background: rgba(255,255,255,0.72);
    border: 1px solid rgba(255,255,255,0.88);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    border-radius: 24px;
    box-shadow: 0 18px 60px rgba(37,99,235,0.08);
  }

  .assessment-option {
    transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
    cursor: pointer;
  }

  .assessment-option:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 28px rgba(37,99,235,0.12);
  }

  .assessment-button {
    border: none;
    border-radius: 16px;
    cursor: pointer;
    font-family: inherit;
    transition: transform 0.12s ease, opacity 0.18s ease;
  }

  .assessment-button:hover {
    opacity: 0.92;
  }

  .assessment-button:active {
    transform: scale(0.985);
  }

  @media (max-width: 920px) {
    .assessment-grid {
      grid-template-columns: 1fr;
    }
  }
`;

const CORE_SELF_REPORT = [
  {
    id: "sr_q2_forgets_daily",
    question: "How often do everyday tasks or errands slip your mind?",
    domain: "inattention",
  },
  {
    id: "sr_q3_easily_distracted",
    question: "How often are you pulled off track by nearby distractions?",
    domain: "inattention",
  },
  {
    id: "sr_q4_avoids_effort",
    question: "How often do long, effortful tasks feel almost physically hard to start?",
    domain: "inattention",
  },
  {
    id: "sr_q6_fidgets",
    question: "How often do you fidget, squirm, or need to keep moving?",
    domain: "hyper",
  },
  {
    id: "sr_q9_interrupts",
    question: "How often do you jump in before someone else is done speaking?",
    domain: "hyper",
  },
  {
    id: "sr_q10_acts_impulsive",
    question: "How often do you act quickly and regret it a moment later?",
    domain: "hyper",
  },
];

const FOLLOW_UP_INATTENTION = [
  {
    id: "sr_q1_loses_things",
    question: "How often do important things go missing when you need them?",
    domain: "inattention",
  },
  {
    id: "sr_q5_careless_errors",
    question: "How often do you make careless mistakes on familiar tasks?",
    domain: "inattention",
  },
];

const FOLLOW_UP_HYPER = [
  {
    id: "sr_q7_leaves_seat",
    question: "How often do you feel restless enough to get up when you meant to stay put?",
    domain: "hyper",
  },
  {
    id: "sr_q8_talks_excessive",
    question: "How often do you end up talking more or faster than you intended?",
    domain: "hyper",
  },
];

const RESPONSE_OPTIONS = [
  { value: 0, label: "Rarely", detail: "Almost never or only in unusual situations" },
  { value: 1, label: "Sometimes", detail: "Shows up occasionally but not most days" },
  { value: 2, label: "Often", detail: "Happens regularly enough to get in the way" },
  { value: 3, label: "Very often", detail: "A strong, repeated pattern" },
];

const CPT_SEQUENCE = ["B", "X", "A", "X", "M", "X", "Q", "L", "X", "A", "X", "R", "X", "T", "A", "X", "X", "P", "X", "C", "A", "X", "N", "X"];

const DIGIT_ROUNDS = {
  forward: [
    [3, 8, 1],
    [5, 2, 9, 4],
    [7, 1, 6, 3, 8],
    [9, 4, 2, 7, 5, 1],
  ],
  backward: [
    [4, 1],
    [8, 3, 6],
    [7, 2, 9, 5],
    [6, 1, 8, 4, 2],
  ],
};

const DELAY_CHOICES = [
  { immediate: 10, delayed: 25, days: 7 },
  { immediate: 20, delayed: 45, days: 14 },
  { immediate: 15, delayed: 50, days: 30 },
  { immediate: 30, delayed: 60, days: 21 },
  { immediate: 40, delayed: 80, days: 45 },
  { immediate: 25, delayed: 70, days: 60 },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function normalizeGender(value) {
  if (value === "man") return 1;
  if (value === "woman") return 0;
  return 0.5;
}

function getSelfReportQuestions(coreAnswers) {
  const core = [...CORE_SELF_REPORT];

  if (coreAnswers.length < CORE_SELF_REPORT.length) {
    return core;
  }

  const inattentionScore = coreAnswers
    .filter((question) => question.domain === "inattention")
    .reduce((sum, question) => sum + (question.answer ?? 0), 0);
  const hyperScore = coreAnswers
    .filter((question) => question.domain === "hyper")
    .reduce((sum, question) => sum + (question.answer ?? 0), 0);

  return inattentionScore >= hyperScore
    ? [...core, ...FOLLOW_UP_INATTENTION, ...FOLLOW_UP_HYPER]
    : [...core, ...FOLLOW_UP_HYPER, ...FOLLOW_UP_INATTENTION];
}

function predictFromFeatureVector(featureVector) {
  const values = modelMetadata.feature_cols.map((featureName, index) => {
    const value = featureVector[featureName];
    return Number.isFinite(value) ? value : modelMetadata.imputer_statistics[index];
  });

  const scaled = values.map((value, index) => {
    const scale = modelMetadata.scaler_scale[index] || 1;
    return (value - modelMetadata.scaler_mean[index]) / scale;
  });

  const logit = scaled.reduce(
    (sum, value, index) => sum + value * modelMetadata.coefficients[index],
    modelMetadata.intercept
  );
  const probability = sigmoid(logit);

  return {
    probability,
    prediction: probability >= modelMetadata.threshold ? 1 : 0,
  };
}

function buildFeatureVector(assessment) {
  const selfReportEntries = assessment.selfReport.answers || {};
  const inattentionIds = [
    "sr_q1_loses_things",
    "sr_q2_forgets_daily",
    "sr_q3_easily_distracted",
    "sr_q4_avoids_effort",
    "sr_q5_careless_errors",
  ];
  const hyperIds = [
    "sr_q6_fidgets",
    "sr_q7_leaves_seat",
    "sr_q8_talks_excessive",
    "sr_q9_interrupts",
    "sr_q10_acts_impulsive",
  ];

  const inattentionAnswered = inattentionIds
    .map((id) => selfReportEntries[id])
    .filter((value) => Number.isFinite(value));
  const hyperAnswered = hyperIds
    .map((id) => selfReportEntries[id])
    .filter((value) => Number.isFinite(value));

  const inattentionFallback = inattentionAnswered.length ? mean(inattentionAnswered) : 1.2;
  const hyperFallback = hyperAnswered.length ? mean(hyperAnswered) : 1.2;

  const completedAnswers = Object.fromEntries(
    [...inattentionIds, ...hyperIds].map((id) => [
      id,
      Number.isFinite(selfReportEntries[id])
        ? selfReportEntries[id]
        : id.startsWith("sr_q1") || id.startsWith("sr_q2") || id.startsWith("sr_q3") || id.startsWith("sr_q4") || id.startsWith("sr_q5")
          ? inattentionFallback
          : hyperFallback,
    ])
  );

  const cpt = assessment.cpt;
  const digitSpan = assessment.digitSpan;
  const delayDiscounting = assessment.delayDiscounting;

  const srInattentionScore = inattentionIds.reduce((sum, id) => sum + completedAnswers[id], 0);
  const srHyperScore = hyperIds.reduce((sum, id) => sum + completedAnswers[id], 0);

  return {
    age: Number(assessment.intake.age) || 28,
    gender: normalizeGender(assessment.intake.gender),
    iq_estimate: 100,
    cpt_hit_rate: cpt.hitRate,
    cpt_false_alarm_rate: cpt.falseAlarmRate,
    cpt_rt_mean_ms: cpt.reactionTimeMean,
    cpt_rt_variability_ms: cpt.reactionTimeVariability,
    ds_forward_span: digitSpan.forwardSpan,
    ds_backward_span: digitSpan.backwardSpan,
    ds_total_score: digitSpan.totalScore,
    dd_k_log: delayDiscounting.logK,
    dd_pct_immediate_choice: delayDiscounting.immediateChoiceRate,
    sr_inattention_score: srInattentionScore,
    sr_hyperactivity_score: srHyperScore,
    sr_q1_loses_things: completedAnswers.sr_q1_loses_things,
    sr_q2_forgets_daily: completedAnswers.sr_q2_forgets_daily,
    sr_q3_easily_distracted: completedAnswers.sr_q3_easily_distracted,
    sr_q4_avoids_effort: completedAnswers.sr_q4_avoids_effort,
    sr_q5_careless_errors: completedAnswers.sr_q5_careless_errors,
    sr_q6_fidgets: completedAnswers.sr_q6_fidgets,
    sr_q7_leaves_seat: completedAnswers.sr_q7_leaves_seat,
    sr_q8_talks_excessive: completedAnswers.sr_q8_talks_excessive,
    sr_q9_interrupts: completedAnswers.sr_q9_interrupts,
    sr_q10_acts_impulsive: completedAnswers.sr_q10_acts_impulsive,
    adhd200_inattentive: 16 + srInattentionScore * 2.2,
    adhd200_hyperimpulsive: 14 + srHyperScore * 2.1,
  };
}

function deriveNarrative(prediction, featureVector) {
  const domains = getDomainScores(featureVector);
  return {
    headline:
      prediction.prediction === 1
        ? "Your assessment shows a strong ADHD-like pattern."
        : "Your assessment shows a lighter ADHD-like pattern.",
    subhead:
      prediction.prediction === 1
        ? "This is a personalization signal, not a diagnosis. Rewire can use it to shape coaching and routines."
        : "This is still useful for personalization. Rewire can lean into the areas that felt effortful and keep support targeted.",
    topDomain: domains[0],
    domains,
  };
}

function ProgressBar({ step, total }) {
  return (
    <div style={{ marginBottom: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>
        <span>Assessment flow</span>
        <span>{step} / {total}</span>
      </div>
      <div style={{ height: "8px", background: "rgba(96,165,250,0.15)", borderRadius: "999px", overflow: "hidden" }}>
        <div
          style={{
            width: `${(step / total) * 100}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${BLUE}, ${BLUE_MID})`,
            borderRadius: "999px",
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

function IntakeSection({ userType, value, onChange, onContinue }) {
  const subjectLabel = userType === "parent" ? "your child" : "you";

  const diagnoses = [
    "ADHD",
    "Anxiety",
    "Depression",
    "Autism",
    "Learning difference",
    "None so far",
  ];

  return (
    <div className="assessment-grid">
      <div className="assessment-card" style={{ padding: "28px" }}>
        <p style={{ fontSize: "11px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 700, marginBottom: "12px" }}>
          SECTION 1
        </p>
        <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: "42px", lineHeight: 1.02, fontStyle: "italic", marginBottom: "14px" }}>
          Intake
        </h2>
        <p style={{ color: "#64748b", lineHeight: 1.7, fontSize: "15px" }}>
          We use this short intake to anchor the assessment to the same kinds of phenotypic fields the classifier was trained on.
        </p>
      </div>

      <div className="assessment-card" style={{ padding: "28px" }}>
        <div style={{ display: "grid", gap: "16px" }}>
          <label style={{ display: "grid", gap: "8px" }}>
            <span style={{ fontSize: "13px", color: "#334155", fontWeight: 600 }}>How old is {subjectLabel}?</span>
            <input
              value={value.age}
              onChange={(e) => onChange({ ...value, age: e.target.value })}
              type="number"
              min="4"
              max="90"
              placeholder="Age"
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: "8px" }}>
            <span style={{ fontSize: "13px", color: "#334155", fontWeight: 600 }}>Gender</span>
            <select
              value={value.gender}
              onChange={(e) => onChange({ ...value, gender: e.target.value })}
              style={inputStyle}
            >
              <option value="">Select one</option>
              <option value="woman">Woman / girl</option>
              <option value="man">Man / boy</option>
              <option value="nonbinary">Nonbinary</option>
              <option value="other">Prefer another term</option>
            </select>
          </label>

          <div>
            <p style={{ fontSize: "13px", color: "#334155", fontWeight: 600, marginBottom: "10px" }}>
              Previous diagnoses or evaluations
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              {diagnoses.map((item) => {
                const selected = value.diagnoses.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    className="assessment-option assessment-button"
                    onClick={() =>
                      onChange({
                        ...value,
                        diagnoses: selected
                          ? value.diagnoses.filter((entry) => entry !== item)
                          : item === "None so far"
                            ? ["None so far"]
                            : [...value.diagnoses.filter((entry) => entry !== "None so far"), item],
                      })
                    }
                    style={{
                      background: selected ? "#0f172a" : "rgba(255,255,255,0.75)",
                      color: selected ? "white" : "#334155",
                      padding: "11px 14px",
                      border: `1px solid ${selected ? "transparent" : "rgba(96,165,250,0.24)"}`,
                      borderRadius: "999px",
                      fontSize: "13px",
                    }}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={onContinue}
            className="assessment-button"
            style={{
              marginTop: "8px",
              background: "#0f172a",
              color: "white",
              padding: "16px 18px",
              fontSize: "15px",
              fontWeight: 600,
            }}
          >
            Continue to cognitive tasks
          </button>
        </div>
      </div>
    </div>
  );
}

function CptTask({ value, onComplete }) {
  const [status, setStatus] = useState(value ? "complete" : "intro");
  const [trialIndex, setTrialIndex] = useState(0);
  const [displayLetter, setDisplayLetter] = useState("?");
  const resultsRef = useRef([]);
  const trialStartRef = useRef(0);
  const currentTrialRef = useRef(null);
  const recordedRef = useRef(false);

  useEffect(() => {
    if (status !== "running") return undefined;
    if (trialIndex >= CPT_SEQUENCE.length) {
      const targets = CPT_SEQUENCE.filter((letter, index) => letter === "X" && CPT_SEQUENCE[index - 1] !== "A").length;
      const nonTargets = CPT_SEQUENCE.length - targets;
      const hits = resultsRef.current.filter((trial) => trial.isTarget).length;
      const falseAlarms = resultsRef.current.filter((trial) => !trial.isTarget).length;
      const hitReactionTimes = resultsRef.current.filter((trial) => trial.isTarget).map((trial) => trial.rt);

      onComplete({
        hitRate: Number((hits / Math.max(targets, 1)).toFixed(3)),
        falseAlarmRate: Number((falseAlarms / Math.max(nonTargets, 1)).toFixed(3)),
        reactionTimeMean: Math.round(mean(hitReactionTimes) || 620),
        reactionTimeVariability: Math.round(standardDeviation(hitReactionTimes) || 140),
        hits,
        falseAlarms,
        totalTrials: CPT_SEQUENCE.length,
      });
      setStatus("complete");
      return undefined;
    }

    const letter = CPT_SEQUENCE[trialIndex];
    const isTarget = letter === "X" && CPT_SEQUENCE[trialIndex - 1] !== "A";
    setDisplayLetter(letter);
    currentTrialRef.current = { letter, isTarget };
    recordedRef.current = false;
    trialStartRef.current = performance.now();

    const timer = window.setTimeout(() => {
      setTrialIndex((current) => current + 1);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [onComplete, status, trialIndex]);

  useEffect(() => {
    if (status !== "running") return undefined;

    function handleKeyDown(event) {
      if (event.code === "Space") {
        event.preventDefault();
        registerResponse();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function registerResponse() {
    if (status !== "running" || recordedRef.current || !currentTrialRef.current) return;
    recordedRef.current = true;
    resultsRef.current.push({
      isTarget: currentTrialRef.current.isTarget,
      rt: Math.max(150, performance.now() - trialStartRef.current),
    });
  }

  if (status === "complete" && value) {
    return (
      <TaskSummary
        title="Continuous Performance Test complete"
        metrics={[
          { label: "Hit rate", value: `${Math.round(value.hitRate * 100)}%` },
          { label: "False alarms", value: `${Math.round(value.falseAlarmRate * 100)}%` },
          { label: "RT variability", value: `${value.reactionTimeVariability} ms` },
        ]}
      />
    );
  }

  if (status === "intro") {
    return (
      <TaskIntro
        eyebrow="TASK 1"
        title="Continuous Performance Test"
        body="A letter appears every second. Press space or tap the response button when you see X, except when it comes right after A."
        meta="We use this to estimate sustained attention, inhibitory control, and reaction-time variability."
        actionLabel="Start task"
        onStart={() => setStatus("running")}
      />
    );
  }

  return (
    <div className="assessment-card" style={{ padding: "28px", textAlign: "center" }}>
      <p style={{ fontSize: "11px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 700, marginBottom: "10px" }}>
        TASK 1 IN PROGRESS
      </p>
      <p style={{ color: "#64748b", marginBottom: "12px" }}>Press for X unless it followed A.</p>
      <div
        style={{
          width: "180px",
          height: "180px",
          margin: "0 auto 20px",
          borderRadius: "28px",
          background: "linear-gradient(160deg, rgba(37,99,235,0.12), rgba(147,197,253,0.3))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "72px",
          fontWeight: 700,
          color: "#0f172a",
        }}
      >
        {displayLetter}
      </div>
      <button
        onClick={registerResponse}
        className="assessment-button"
        style={{
          background: "#0f172a",
          color: "white",
          padding: "16px 22px",
          fontSize: "15px",
          fontWeight: 600,
          minWidth: "220px",
        }}
      >
        Tap response
      </button>
      <p style={{ marginTop: "16px", color: "#64748b", fontSize: "13px" }}>
        Trial {trialIndex + 1} of {CPT_SEQUENCE.length}
      </p>
    </div>
  );
}

function DigitSpanTask({ value, onComplete }) {
  const [status, setStatus] = useState(value ? "complete" : "intro");
  const [phase, setPhase] = useState("forward");
  const [roundIndex, setRoundIndex] = useState(0);
  const [displayDigit, setDisplayDigit] = useState(null);
  const [awaitingAnswer, setAwaitingAnswer] = useState(false);
  const [answer, setAnswer] = useState("");
  const resultsRef = useRef({
    forward: [],
    backward: [],
  });

  const activeSequence = DIGIT_ROUNDS[phase][roundIndex];

  useEffect(() => {
    if (status !== "running" || !activeSequence) return undefined;

    setAwaitingAnswer(false);
    setAnswer("");
    setDisplayDigit(null);

    let step = 0;
    const introTimer = window.setTimeout(() => {
      const interval = window.setInterval(() => {
        setDisplayDigit(String(activeSequence[step]));
        step += 1;

        if (step >= activeSequence.length) {
          window.clearInterval(interval);
          window.setTimeout(() => {
            setDisplayDigit(null);
            setAwaitingAnswer(true);
          }, 550);
        }
      }, 700);
    }, 350);

    return () => window.clearTimeout(introTimer);
  }, [activeSequence, status]);

  function submitAnswer() {
    const normalized = answer.replace(/\s+/g, "");
    const expected = (phase === "backward" ? [...activeSequence].reverse() : activeSequence).join("");
    const correct = normalized === expected;

    resultsRef.current[phase].push({
      length: activeSequence.length,
      correct,
    });

    setAwaitingAnswer(false);
    setAnswer("");

    const isLastRound = roundIndex === DIGIT_ROUNDS[phase].length - 1;

    if (phase === "forward" && isLastRound) {
      setPhase("backward");
      setRoundIndex(0);
      return;
    }

    if (phase === "backward" && isLastRound) {
      const forwardSpan = Math.max(
        ...resultsRef.current.forward.filter((item) => item.correct).map((item) => item.length),
        2
      );
      const backwardSpan = Math.max(
        ...resultsRef.current.backward.filter((item) => item.correct).map((item) => item.length),
        1
      );
      const totalScore =
        resultsRef.current.forward.reduce((sum, item) => sum + (item.correct ? item.length : 0), 0) +
        resultsRef.current.backward.reduce((sum, item) => sum + (item.correct ? item.length : 0), 0);

      onComplete({
        forwardSpan,
        backwardSpan,
        totalScore,
      });
      setStatus("complete");
      return;
    }

    setRoundIndex((current) => current + 1);
  }

  if (status === "complete" && value) {
    return (
      <TaskSummary
        title="Digit span complete"
        metrics={[
          { label: "Forward span", value: value.forwardSpan },
          { label: "Backward span", value: value.backwardSpan },
          { label: "Total score", value: value.totalScore },
        ]}
      />
    );
  }

  if (status === "intro") {
    return (
      <TaskIntro
        eyebrow="TASK 2"
        title="Digit Span"
        body="Numbers appear one by one. Repeat them back in the same order for the first half, then in reverse order for the second half."
        meta="This approximates working-memory load and how much information stays online when the sequence gets longer."
        actionLabel="Start task"
        onStart={() => setStatus("running")}
      />
    );
  }

  return (
    <div className="assessment-card" style={{ padding: "28px" }}>
      <p style={{ fontSize: "11px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 700, marginBottom: "12px" }}>
        TASK 2 IN PROGRESS
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
        <h3 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: "30px", fontStyle: "italic", fontWeight: 400 }}>
          {phase === "forward" ? "Forward span" : "Backward span"}
        </h3>
        <span style={{ color: "#64748b", fontSize: "13px" }}>
          Round {roundIndex + 1} / {DIGIT_ROUNDS[phase].length}
        </span>
      </div>

      <div
        style={{
          minHeight: "140px",
          borderRadius: "24px",
          background: "rgba(255,255,255,0.75)",
          border: "1px solid rgba(147,197,253,0.22)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "54px",
          fontWeight: 700,
          marginBottom: "18px",
        }}
      >
        {displayDigit ?? (awaitingAnswer ? "Type it back" : "Get ready")}
      </div>

      {awaitingAnswer && (
        <div style={{ display: "grid", gap: "12px" }}>
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={phase === "backward" ? "Example: 5297" : "Example: 7925"}
            style={inputStyle}
          />
          <button
            onClick={submitAnswer}
            className="assessment-button"
            style={{
              background: "#0f172a",
              color: "white",
              padding: "15px 18px",
              fontWeight: 600,
              fontSize: "15px",
            }}
          >
            Submit answer
          </button>
        </div>
      )}
    </div>
  );
}

function DelayDiscountingTask({ value, onComplete }) {
  const [index, setIndex] = useState(value ? DELAY_CHOICES.length : 0);
  const [responses, setResponses] = useState(value?.choices || []);

  function choose(choice) {
    const nextResponses = [...responses, { ...DELAY_CHOICES[index], choice }];
    setResponses(nextResponses);

    if (index === DELAY_CHOICES.length - 1) {
      const immediateChoices = nextResponses.filter((item) => item.choice === "now");
      const rates = nextResponses.map((item) => {
        const indifferentK = Math.max((item.delayed / item.immediate - 1) / item.days, 0.0001);
        return item.choice === "now" ? indifferentK : indifferentK * 0.45;
      });
      const avgK = mean(rates);

      onComplete({
        immediateChoiceRate: Number((immediateChoices.length / nextResponses.length).toFixed(3)),
        logK: Number(Math.log10(avgK).toFixed(3)),
        choices: nextResponses,
      });
      setIndex(DELAY_CHOICES.length);
      return;
    }

    setIndex((current) => current + 1);
  }

  if (value) {
    return (
      <TaskSummary
        title="Delay discounting complete"
        metrics={[
          { label: "Immediate choices", value: `${Math.round(value.immediateChoiceRate * 100)}%` },
          { label: "Discounting log(k)", value: value.logK },
          { label: "Scenarios", value: value.choices.length },
        ]}
      />
    );
  }

  const current = DELAY_CHOICES[index];

  return (
    <div className="assessment-card" style={{ padding: "28px" }}>
      <p style={{ fontSize: "11px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 700, marginBottom: "12px" }}>
        TASK 3
      </p>
      <h3 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: "34px", fontStyle: "italic", fontWeight: 400, marginBottom: "12px" }}>
        Delay discounting
      </h3>
      <p style={{ color: "#64748b", lineHeight: 1.7, marginBottom: "20px" }}>
        Choose the option that feels more compelling right now. There are no trick questions here.
      </p>

      <div style={{ display: "grid", gap: "12px" }}>
        <button
          onClick={() => choose("now")}
          className="assessment-option assessment-button"
          style={{
            background: "rgba(255,255,255,0.82)",
            border: "1px solid rgba(96,165,250,0.24)",
            padding: "20px",
            textAlign: "left",
          }}
        >
          <span style={{ display: "block", fontSize: "11px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 700, marginBottom: "10px" }}>
            NOW
          </span>
          <span style={{ fontSize: "28px", fontFamily: "'DM Serif Display', Georgia, serif", fontStyle: "italic" }}>
            ${current.immediate} today
          </span>
        </button>

        <button
          onClick={() => choose("later")}
          className="assessment-option assessment-button"
          style={{
            background: "#0f172a",
            color: "white",
            border: "1px solid transparent",
            padding: "20px",
            textAlign: "left",
          }}
        >
          <span style={{ display: "block", fontSize: "11px", letterSpacing: "2px", color: BLUE_LIGHT, fontWeight: 700, marginBottom: "10px" }}>
            LATER
          </span>
          <span style={{ fontSize: "28px", fontFamily: "'DM Serif Display', Georgia, serif", fontStyle: "italic" }}>
            ${current.delayed} in {current.days} days
          </span>
        </button>
      </div>

      <p style={{ marginTop: "18px", color: "#64748b", fontSize: "13px" }}>
        Scenario {index + 1} / {DELAY_CHOICES.length}
      </p>
    </div>
  );
}

function SelfReportSection({ userType, value, onComplete }) {
  const questions = useMemo(() => {
    const coreAnswers = CORE_SELF_REPORT.map((question) => ({
      ...question,
      answer: value.answers[question.id],
    }));
    return getSelfReportQuestions(coreAnswers);
  }, [value.answers]);

  const question = questions[value.step] || null;
  const subjectLabel = userType === "parent" ? "your child" : "you";

  if (!question) {
    return null;
  }

  function answerCurrent(nextValue) {
    const answers = {
      ...value.answers,
      [question.id]: nextValue,
    };

    if (value.step === questions.length - 1) {
      onComplete({
        answers,
        step: questions.length,
      });
      return;
    }

    onComplete({
      answers,
      step: value.step + 1,
    });
  }

  return (
    <div className="assessment-grid">
      <div className="assessment-card" style={{ padding: "28px" }}>
        <p style={{ fontSize: "11px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 700, marginBottom: "12px" }}>
          SECTION 3
        </p>
        <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: "42px", lineHeight: 1.02, fontStyle: "italic", marginBottom: "14px" }}>
          Self-report
        </h2>
        <p style={{ color: "#64748b", lineHeight: 1.7, fontSize: "15px" }}>
          This is a short adaptive checklist. We ask the same 10 feature areas the model expects, but reorder the follow-ups based on how the first answers land.
        </p>
        <div style={{ marginTop: "20px", padding: "18px", borderRadius: "20px", background: "rgba(255,255,255,0.72)" }}>
          <p style={{ color: "#64748b", fontSize: "13px", marginBottom: "6px" }}>Question</p>
          <p style={{ fontSize: "30px", lineHeight: 1.12, fontFamily: "'DM Serif Display', Georgia, serif", fontStyle: "italic" }}>
            {value.step + 1} / {questions.length}
          </p>
        </div>
      </div>

      <div className="assessment-card" style={{ padding: "28px" }}>
        <p style={{ color: "#334155", fontSize: "18px", lineHeight: 1.6, marginBottom: "18px" }}>
          Thinking about {subjectLabel}, how often is this true?
        </p>
        <h3 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: "36px", lineHeight: 1.08, fontStyle: "italic", fontWeight: 400, marginBottom: "22px" }}>
          {question.question}
        </h3>

        <div style={{ display: "grid", gap: "10px" }}>
          {RESPONSE_OPTIONS.map((option) => {
            const selected = value.answers[question.id] === option.value;

            return (
              <button
                key={option.label}
                onClick={() => answerCurrent(option.value)}
                className="assessment-option assessment-button"
                style={{
                  background: selected ? "#0f172a" : "rgba(255,255,255,0.78)",
                  color: selected ? "white" : "#0f172a",
                  border: `1px solid ${selected ? "transparent" : "rgba(96,165,250,0.22)"}`,
                  padding: "18px 20px",
                  textAlign: "left",
                }}
              >
                <span style={{ display: "block", fontSize: "16px", fontWeight: 600, marginBottom: "4px" }}>{option.label}</span>
                <span style={{ display: "block", fontSize: "13px", color: selected ? "rgba(255,255,255,0.74)" : "#64748b" }}>
                  {option.detail}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ResultsSection({ result, onFinish }) {
  const narrative = deriveNarrative(result.prediction, result.featureVector);

  return (
    <div className="assessment-grid">
      <div className="assessment-card" style={{ padding: "28px" }}>
        <p style={{ fontSize: "11px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 700, marginBottom: "12px" }}>
          MODEL RESULT
        </p>
        <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: "44px", lineHeight: 1.02, fontStyle: "italic", marginBottom: "14px" }}>
          {narrative.headline}
        </h2>
        <p style={{ color: "#64748b", lineHeight: 1.7, fontSize: "15px", marginBottom: "22px" }}>
          {narrative.subhead}
        </p>

        <div
          style={{
            borderRadius: "24px",
            padding: "22px",
            background: "linear-gradient(160deg, rgba(15,23,42,0.96), rgba(37,99,235,0.85))",
            color: "white",
            marginBottom: "18px",
          }}
        >
          <p style={{ fontSize: "11px", letterSpacing: "2px", color: "rgba(255,255,255,0.65)", marginBottom: "10px" }}>
            ADHD-LIKE SIGNAL
          </p>
          <p style={{ fontSize: "56px", fontWeight: 700, lineHeight: 1, marginBottom: "8px" }}>
            {Math.round(result.prediction.probability * 100)}%
          </p>
          <p style={{ color: "rgba(255,255,255,0.78)", lineHeight: 1.6 }}>
            Computed in-browser from the trained logistic regression coefficients and the assessment features you just completed.
          </p>
        </div>

        <button
          onClick={onFinish}
          className="assessment-button"
          style={{
            width: "100%",
            background: "#0f172a",
            color: "white",
            padding: "16px 18px",
            fontSize: "15px",
            fontWeight: 600,
          }}
        >
          Open my dashboard
        </button>
      </div>

      <div style={{ display: "grid", gap: "16px" }}>
        {narrative.domains.map((domain) => (
          <div key={domain.id} className="assessment-card" style={{ padding: "22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: "28px", fontStyle: "italic" }}>{domain.label}</p>
              <span style={{ color: BLUE, fontSize: "28px", fontWeight: 700 }}>{domain.score}</span>
            </div>
            <p style={{ color: "#64748b", lineHeight: 1.6 }}>{domain.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskIntro({ eyebrow, title, body, meta, actionLabel, onStart }) {
  return (
    <div className="assessment-grid">
      <div className="assessment-card" style={{ padding: "28px" }}>
        <p style={{ fontSize: "11px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 700, marginBottom: "12px" }}>
          {eyebrow}
        </p>
        <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: "42px", lineHeight: 1.02, fontStyle: "italic", marginBottom: "14px" }}>
          {title}
        </h2>
        <p style={{ color: "#334155", lineHeight: 1.8, fontSize: "16px" }}>{body}</p>
      </div>
      <div className="assessment-card" style={{ padding: "28px" }}>
        <p style={{ color: "#64748b", lineHeight: 1.7, marginBottom: "20px" }}>{meta}</p>
        <button
          onClick={onStart}
          className="assessment-button"
          style={{
            width: "100%",
            background: "#0f172a",
            color: "white",
            padding: "16px 18px",
            fontSize: "15px",
            fontWeight: 600,
          }}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function TaskSummary({ title, metrics }) {
  return (
    <div className="assessment-card" style={{ padding: "24px" }}>
      <h3 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: "32px", fontStyle: "italic", fontWeight: 400, marginBottom: "18px" }}>
        {title}
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" }}>
        {metrics.map((metric) => (
          <div key={metric.label} style={{ borderRadius: "18px", padding: "16px", background: "rgba(255,255,255,0.72)" }}>
            <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>{metric.label}</p>
            <p style={{ fontSize: "26px", color: BLUE, fontWeight: 700 }}>{metric.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle = {
  background: "rgba(255,255,255,0.82)",
  border: "1px solid rgba(96,165,250,0.22)",
  borderRadius: "16px",
  padding: "15px 16px",
  fontSize: "15px",
  color: "#0f172a",
  width: "100%",
};

export default function AssessmentFlow({ userType, onComplete }) {
  const [section, setSection] = useState("intake");
  const [assessment, setAssessment] = useState({
    intake: {
      age: "",
      gender: "",
      diagnoses: [],
    },
    cpt: null,
    digitSpan: null,
    delayDiscounting: null,
    selfReport: {
      answers: {},
      step: 0,
    },
  });

  const totalSteps = 6;
  const currentStep = {
    intake: 1,
    cpt: 2,
    digitSpan: 3,
    delay: 4,
    selfReport: 5,
    results: 6,
  }[section];

  const result = useMemo(() => {
    if (
      !assessment.cpt ||
      !assessment.digitSpan ||
      !assessment.delayDiscounting ||
      Object.keys(assessment.selfReport.answers).length < 10
    ) {
      return null;
    }

    const featureVector = buildFeatureVector(assessment);
    const prediction = predictFromFeatureVector(featureVector);
    const personalization = buildPersonalizationProfile(featureVector, prediction);
    return {
      featureVector,
      prediction,
      personalization,
      completedAt: new Date().toISOString(),
    };
  }, [assessment]);

  function goNext(nextSection) {
    setSection(nextSection);
  }

  return (
    <div className="assessment-shell">
      <style>{SECTION_STYLES}</style>
      <div style={{ maxWidth: "1120px", margin: "0 auto", padding: "42px 24px 72px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "18px", alignItems: "center", marginBottom: "18px" }}>
          <div>
            <p style={{ fontSize: "11px", letterSpacing: "2px", color: BLUE_MID, fontWeight: 700, marginBottom: "8px" }}>
              REWIRE ASSESSMENT
            </p>
            <h1 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: "52px", fontStyle: "italic", fontWeight: 400, lineHeight: 1 }}>
              Personalized intake
            </h1>
          </div>
          <p style={{ maxWidth: "320px", color: "#64748b", lineHeight: 1.7, fontSize: "14px" }}>
            A short intake, three cognitive tasks, and a compact self-report section. The result feeds the same feature columns as the trained ADHD classifier.
          </p>
        </div>

        <ProgressBar step={currentStep} total={totalSteps} />

        {section === "intake" && (
          <IntakeSection
            userType={userType}
            value={assessment.intake}
            onChange={(intake) => setAssessment((current) => ({ ...current, intake }))}
            onContinue={() => goNext("cpt")}
          />
        )}

        {section === "cpt" && (
          <div style={{ display: "grid", gap: "16px" }}>
            <CptTask
              value={assessment.cpt}
              onComplete={(cpt) => {
                setAssessment((current) => ({ ...current, cpt }));
              }}
            />
            {assessment.cpt && (
              <button
                onClick={() => goNext("digitSpan")}
                className="assessment-button"
                style={{
                  background: "#0f172a",
                  color: "white",
                  padding: "15px 18px",
                  fontWeight: 600,
                  fontSize: "15px",
                }}
              >
                Continue to digit span
              </button>
            )}
          </div>
        )}

        {section === "digitSpan" && (
          <div style={{ display: "grid", gap: "16px" }}>
            <DigitSpanTask
              value={assessment.digitSpan}
              onComplete={(digitSpan) => {
                setAssessment((current) => ({ ...current, digitSpan }));
              }}
            />
            {assessment.digitSpan && (
              <button
                onClick={() => goNext("delay")}
                className="assessment-button"
                style={{
                  background: "#0f172a",
                  color: "white",
                  padding: "15px 18px",
                  fontWeight: 600,
                  fontSize: "15px",
                }}
              >
                Continue to reward choices
              </button>
            )}
          </div>
        )}

        {section === "delay" && (
          <div style={{ display: "grid", gap: "16px" }}>
            <DelayDiscountingTask
              value={assessment.delayDiscounting}
              onComplete={(delayDiscounting) => {
                setAssessment((current) => ({ ...current, delayDiscounting }));
              }}
            />
            {assessment.delayDiscounting && (
              <button
                onClick={() => goNext("selfReport")}
                className="assessment-button"
                style={{
                  background: "#0f172a",
                  color: "white",
                  padding: "15px 18px",
                  fontWeight: 600,
                  fontSize: "15px",
                }}
              >
                Continue to self-report
              </button>
            )}
          </div>
        )}

        {section === "selfReport" && (
          <>
            <SelfReportSection
              userType={userType}
              value={assessment.selfReport}
              onComplete={(selfReport) => {
                setAssessment((current) => ({ ...current, selfReport }));
                if (Object.keys(selfReport.answers).length >= 10) {
                  goNext("results");
                }
              }}
            />
          </>
        )}

        {section === "results" && result && (
          <ResultsSection
            result={result}
            onFinish={() => {
              onComplete({
                ...assessment,
                ...result,
              });
            }}
          />
        )}
      </div>
    </div>
  );
}
