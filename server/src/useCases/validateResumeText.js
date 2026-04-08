import { classifyResumeTextWithAi } from "../adapters/aiAnalyzer.js";

const resumeKeywords = [
  "experience",
  "education",
  "skills",
  "projects",
  "work",
  "summary",
  "resume",
];

const nonResumeKeywordGroups = [
  {
    label: "a flight itinerary",
    terms: ["flight", "booking", "passenger", "pnr", "itinerary", "boarding"],
  },
  {
    label: "an invoice or receipt",
    terms: ["invoice", "receipt", "bill to", "payment due", "subtotal", "tax invoice"],
  },
  {
    label: "a travel confirmation document",
    terms: ["departure", "arrival", "terminal", "seat", "check-in", "confirmation number"],
  },
];

/**
 * @param {string} text
 * @returns {Promise<{ isResume: boolean; reason: string }>}
 */
export async function isResume(text) {
  const normalizedText = normalizeText(text);
  const resumeHits = countMatches(normalizedText, resumeKeywords);
  const nonResumeMatches = nonResumeKeywordGroups
    .map((group) => ({
      ...group,
      hits: countMatches(normalizedText, group.terms),
    }))
    .filter((group) => group.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  const strongestNonResume = nonResumeMatches[0];
  const hasContactSignals =
    /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(text) ||
    /\b(?:\+?\d[\d\s().-]{7,}\d)\b/.test(text) ||
    /\blinkedin\.com\b/i.test(text);
  const hasStrongResumeStructure =
    resumeHits >= 3 || (resumeHits >= 2 && hasContactSignals) || /\bemployment\b/i.test(text);

  if (strongestNonResume && strongestNonResume.hits >= 3 && resumeHits <= 1 && !hasContactSignals) {
    return {
      isResume: false,
      reason: `The uploaded file appears to be ${strongestNonResume.label}, not a professional resume.`,
    };
  }

  if (hasStrongResumeStructure && (!strongestNonResume || strongestNonResume.hits <= 1)) {
    return {
      isResume: true,
      reason: "The uploaded file has the structure of a professional resume.",
    };
  }

  return classifyResumeTextWithAi(text);
}

/**
 * @param {string} reason
 */
export function buildResumeRejection(reason) {
  return {
    isResume: false,
    message: `${reason} No analysis performed.`,
  };
}

/**
 * @param {string} text
 */
function normalizeText(text) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * @param {string} text
 * @param {string[]} terms
 */
function countMatches(text, terms) {
  return terms.reduce((count, term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    return count + (new RegExp(`\\b${escaped}\\b`, "gi").test(text) ? 1 : 0);
  }, 0);
}
