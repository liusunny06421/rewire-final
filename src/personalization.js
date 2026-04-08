const CATEGORY_ORDERS = {
  attention: ["work", "home", "food", "social"],
  working_memory: ["home", "work", "food", "social"],
  impulse_control: ["social", "food", "home", "work"],
};

const DOMAIN_LIBRARY = {
  attention: {
    label: "focus support",
    headline: "Let's make today easier to focus.",
    explanation: "We'll start with tools that reduce distraction and make task initiation easier.",
    chatContext: {
      primaryChallenge: "attention",
      likelyFriction: "task initiation, distractibility, incomplete tasks",
      style: "short, concrete, low-overwhelm",
    },
    routine: {
      id: "focus-reset",
      title: "3-Step Work Reset",
      rationale: "A short reset helps you start before distractions multiply.",
      estimatedTime: "4 min",
      stepsCount: 3,
      category: "work",
      cta: "Start a focus reset",
      prompt: "Help me do the 3-Step Work Reset so I can start the task I'm avoiding.",
    },
    chatStarters: [
      "Help me start the task I'm avoiding.",
      "Break today into 3 doable steps.",
      "Help me reset when I get distracted.",
    ],
    tools: [
      {
        id: "guided-routine-builder",
        title: "Guided routine builder",
        description: "Turn one hard moment into a short repeatable reset.",
        actionLabel: "Build a reset",
        action: "start_routine",
      },
      {
        id: "ai-coach-chat",
        title: "AI coach chat",
        description: "Get direct help with task starts and distraction spirals.",
        actionLabel: "Open coach",
        action: "open_chat",
      },
    ],
    progressMetricLabel: "successful starts",
    progressAdjustment: "Keep the reset short and use it before the hardest task of the day.",
  },
  working_memory: {
    label: "mental load support",
    headline: "Let's reduce mental load.",
    explanation: "We'll help you hold less in your head and make your next steps visible.",
    chatContext: {
      primaryChallenge: "working memory",
      likelyFriction: "forgetting steps, losing track of plans, hidden next actions",
      style: "structured, visible, checklist-based",
    },
    routine: {
      id: "visual-daily-plan",
      title: "Visual Daily Plan",
      rationale: "Externalizing today's plan reduces the need to keep every step in your head.",
      estimatedTime: "5 min",
      stepsCount: 4,
      category: "home",
      cta: "Build today's plan",
      prompt: "Help me build a Visual Daily Plan with a short list of visible next steps.",
    },
    chatStarters: [
      "Help me make today's plan visible.",
      "Turn this messy to-do list into 3 next steps.",
      "Create a reminder plan I can actually follow.",
    ],
    tools: [
      {
        id: "guided-routine-builder",
        title: "Guided routine builder",
        description: "Create a visual sequence you can follow without re-deciding.",
        actionLabel: "Build a plan",
        action: "start_routine",
      },
      {
        id: "reminders-setup",
        title: "Reminders setup",
        description: "Add lightweight prompts so fewer steps live in your head.",
        actionLabel: "Set reminders",
        action: "open_chat",
      },
    ],
    progressMetricLabel: "visible plans created",
    progressAdjustment: "If the list is growing, shrink the plan back to only the next three steps.",
  },
  impulse_control: {
    label: "pause support",
    headline: "Let's create more pause before overwhelm.",
    explanation: "We'll focus on routines that make decisions easier and reduce reactive moments.",
    chatContext: {
      primaryChallenge: "impulse control",
      likelyFriction: "reactive choices, fast emotional escalation, hard-to-stop loops",
      style: "grounding, calm, low-friction",
    },
    routine: {
      id: "pause-before-reacting",
      title: "Pause Before Reacting",
      rationale: "A short pause routine can lower the chance of reacting on autopilot.",
      estimatedTime: "3 min",
      stepsCount: 3,
      category: "social",
      cta: "Set up a calm routine",
      prompt: "Walk me through the Pause Before Reacting routine before I answer or decide anything.",
    },
    chatStarters: [
      "Help me slow down before I respond.",
      "Give me a reset for when I feel activated.",
      "Help me make this decision with less overwhelm.",
    ],
    tools: [
      {
        id: "ai-coach-chat",
        title: "AI coach chat",
        description: "Get support in the moment before stress turns reactive.",
        actionLabel: "Talk it through",
        action: "open_chat",
      },
      {
        id: "quick-check-in",
        title: "Quick check-in",
        description: "Track focus and overwhelm so the app can adapt support over time.",
        actionLabel: "Check in",
        action: "open_check_in",
      },
    ],
    progressMetricLabel: "paused moments",
    progressAdjustment: "Use the pause routine before the situations that usually escalate fastest.",
  },
};

export function getDomainScores(featureVector) {
  return [
    {
      id: "attention",
      label: "Attention",
      score: Math.round(
        clamp((1 - featureVector.cpt_hit_rate) * 35 + featureVector.sr_inattention_score * 4, 8, 95)
      ),
      text: "Task consistency and self-reported attention strain both came through strongly.",
    },
    {
      id: "working_memory",
      label: "Working memory",
      score: Math.round(clamp((12 - featureVector.ds_total_score) * 4, 8, 95)),
      text: "Remembering and manipulating information in sequence looks effortful right now.",
    },
    {
      id: "impulse_control",
      label: "Impulse control",
      score: Math.round(
        clamp(
          featureVector.cpt_false_alarm_rate * 45 +
            featureVector.dd_pct_immediate_choice * 28 +
            featureVector.sr_hyperactivity_score * 3,
          8,
          95
        )
      ),
      text: "Quick-action choices and restless behavior suggest a meaningful impulsivity signal.",
    },
  ].sort((a, b) => b.score - a.score);
}

export function buildPersonalizationProfile(featureVector, prediction) {
  const domains = getDomainScores(featureVector);
  const primaryDomain = domains[0].id;
  const secondaryDomain = domains[1].id;
  const domainConfig = DOMAIN_LIBRARY[primaryDomain];
  const topScore = domains[0].score;
  const probability = prediction.probability || 0;

  let supportIntensity = "low";
  if (probability >= 0.72 || topScore >= 72) {
    supportIntensity = "high";
  } else if (probability >= 0.48 || topScore >= 52) {
    supportIntensity = "medium";
  }

  let coachingStyle = "structured";
  if (primaryDomain === "attention") {
    coachingStyle = supportIntensity === "high" ? "gentle" : "direct";
  }
  if (primaryDomain === "impulse_control") {
    coachingStyle = supportIntensity === "high" ? "gentle" : "direct";
  }

  return {
    primary_domain: primaryDomain,
    secondary_domain: secondaryDomain,
    support_intensity: supportIntensity,
    coaching_style: coachingStyle,
    recommended_category_order: CATEGORY_ORDERS[primaryDomain],
    recommended_first_routine: domainConfig.routine.id,
    recommended_chat_starters: domainConfig.chatStarters.slice(0, 3),
    recommended_tools: domainConfig.tools.slice(0, primaryDomain === "attention" ? 2 : 2),
    hero: {
      headline: domainConfig.headline,
      explanation: domainConfig.explanation,
      cta: domainConfig.routine.cta,
    },
    summary: {
      top_support_area: DOMAIN_LIBRARY[primaryDomain].label,
      secondary_support_area: DOMAIN_LIBRARY[secondaryDomain].label,
      adaptation:
        primaryDomain === "attention"
          ? "Rewire will prioritize shorter routines, visible first steps, and distraction-reducing coaching."
          : primaryDomain === "working_memory"
            ? "Rewire will prioritize visual plans, reminders, and fewer things to keep in your head at once."
            : "Rewire will prioritize pause routines, calmer decision support, and lower-friction check-ins before overwhelm builds.",
    },
    routine: domainConfig.routine,
    chat_context: domainConfig.chatContext,
    progress_metric_label: domainConfig.progressMetricLabel,
    suggested_adjustment: domainConfig.progressAdjustment,
    domains,
  };
}

export function getDomainLabel(domainId) {
  return DOMAIN_LIBRARY[domainId]?.label || domainId;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
