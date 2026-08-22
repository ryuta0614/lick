import type { MockStructuredGenerator } from "@social-growth-os/ai";
import { CTA_TYPES, EMOTIONS, HOOK_TYPES } from "@social-growth-os/shared";

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pick<T>(items: readonly T[], seed: number, salt: number): T {
  const item = items[(seed + salt) % items.length];
  if (item === undefined) throw new Error("pick() called with an empty array");
  return item;
}

function extractQuoted(prompt: string, fallback: string): string {
  const match = prompt.match(/"([^"]{4,120})"/);
  return match?.[1] ?? fallback;
}

/**
 * Deterministic structured-output fixtures for MockAIProvider, keyed by the
 * `operation` name used throughout content-engine. Lets the whole
 * generation pipeline (STEP 4-9) run end-to-end with zero API keys and zero
 * network calls, which is also what automated tests use
 * (CLAUDE.md section 33: "Third-party APIs must be mocked during tests").
 */
export function createDefaultMockGenerators(): Record<string, MockStructuredGenerator> {
  return {
    generate_ideas: ({ prompt }) => {
      const seed = hashString(prompt);
      const topic = extractQuoted(prompt, "the topic");
      const ideas = Array.from({ length: 8 }, (_, i) => ({
        title: `${topic}: ${MOCK_ANGLES[(seed + i) % MOCK_ANGLES.length]}`,
        topic,
        angle: MOCK_ANGLES[(seed + i) % MOCK_ANGLES.length],
        audience: "target audience",
        hookType: pick(HOOK_TYPES, seed, i),
        emotion: pick(EMOTIONS, seed, i * 3),
        contentType: "text",
        whyNow: "Timely given current audience interest.",
        conversionIntent: "soft",
        originalityNotes: "Uses an abstract pattern, not copied from any source post.",
      }));
      return { ideas };
    },

    generate_hooks: ({ prompt }) => {
      const seed = hashString(prompt);
      const ideaTitle = extractQuoted(prompt, "this idea");
      const hooks = Array.from({ length: 5 }, (_, i) => ({
        text: `${MOCK_HOOK_OPENERS[(seed + i) % MOCK_HOOK_OPENERS.length]} ${ideaTitle}`,
        hookType: pick(HOOK_TYPES, seed, i * 2),
      }));
      return { hooks };
    },

    write_post: ({ prompt }) => {
      const seed = hashString(prompt);
      const hookMatch = prompt.match(/opening line[^:]*:\s*"([^"]+)"/i);
      const hookText = hookMatch?.[1] ?? "Here's something most people get wrong.";
      return {
        text: `${hookText}\n\n${MOCK_BODY_LINES[seed % MOCK_BODY_LINES.length]}\n\n${MOCK_CTA_LINES[seed % MOCK_CTA_LINES.length]}`,
        hookType: pick(HOOK_TYPES, seed, 1),
        cta: pick(CTA_TYPES.filter((c) => c !== "none"), seed, 2),
      };
    },

    critique_post: ({ prompt }) => {
      const seed = hashString(prompt);
      const jitter = (salt: number, base: number, spread: number) => base + ((seed + salt) % spread);
      const scores = {
        hook: jitter(1, 6, 4),
        originality: jitter(2, 6, 4),
        usefulness: jitter(3, 6, 4),
        clarity: jitter(4, 6, 4),
        shareability: jitter(5, 6, 4),
        audienceFit: jitter(6, 6, 4),
        specificity: jitter(7, 6, 4),
        conversionPotential: jitter(8, 5, 4),
        brandFit: jitter(9, 7, 3),
        risk: jitter(10, 0, 3),
      };
      return {
        ...scores,
        strengths: ["Clear hook", "On-brand tone"],
        weaknesses: ["Could be more specific"],
        suggestedChanges: ["Add a concrete example or number"],
        qualityScore: 75,
      };
    },

    generate_strategy: ({ prompt }) => {
      const seed = hashString(prompt);
      return {
        recommendedMix: [
          {
            label: MOCK_MIX_LABELS[seed % MOCK_MIX_LABELS.length],
            weight: 0.4,
            rationale: "Reflects the winning patterns listed in the aggregated data above.",
          },
          {
            label: MOCK_MIX_LABELS[(seed + 1) % MOCK_MIX_LABELS.length],
            weight: 0.3,
            rationale: "An adjacent variation on what has worked so far.",
          },
          {
            label: "Exploratory / new angles",
            weight: 0.3,
            rationale: "Keeps exploring rather than only repeating proven patterns.",
          },
        ],
        recommendedTimes: [
          {
            window: MOCK_TIME_WINDOWS[seed % MOCK_TIME_WINDOWS.length],
            rationale: "Derived from the posting-hour aggregates in the data above.",
          },
        ],
        experiments: [
          {
            hypothesis: "Shorter posts may perform better with this audience.",
            variable: "postLength",
            control: "current average length",
            variant: "under 100 characters",
          },
        ],
      };
    },
  };
}

const MOCK_ANGLES = [
  "the biggest misconception",
  "a beginner's first step",
  "what nobody tells you",
  "a contrarian take",
  "a simple 3-step framework",
  "a story from the trenches",
  "the ROI most people miss",
  "why timing matters right now",
];

const MOCK_HOOK_OPENERS = [
  "Everyone gets this wrong:",
  "I used to believe this too, until",
  "Here's a hard truth about",
  "3 things nobody tells you about",
  "Unpopular opinion:",
];

const MOCK_BODY_LINES = [
  "Most people focus on the wrong metric first, and it costs them months.",
  "The real unlock isn't more effort — it's a better starting point.",
  "Once you see this pattern, you can't unsee it in your own work.",
  "Small, consistent changes beat big, occasional ones every time.",
];

const MOCK_CTA_LINES = [
  "What's your experience with this? Reply below.",
  "Save this for later if it was useful.",
  "Follow for more breakdowns like this.",
  "Curious what you'd add — drop a comment.",
];

const MOCK_MIX_LABELS = ["Story-driven posts", "Practical how-to posts", "Contrarian takes", "Quick-win lists"];

const MOCK_TIME_WINDOWS = ["08:00-09:59", "12:00-13:59", "20:00-21:59"];
