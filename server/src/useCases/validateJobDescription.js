const jobKeywords = [
  "responsibilities",
  "requirements",
  "qualifications",
  "experience",
  "skills",
  "role",
  "position",
  "candidate",
  "job",
  "work",
  "develop",
  "build",
  "design",
  "manage",
  "engineer",
  "developer",
  "analyst",
];

const genericInstructionPatterns = [
  /write\s+me\s+a\s+job\s+description/i,
  /generate\s+a\s+job\s+description/i,
  /this\s+is\s+for\s+testing/i,
  /sample\s+job\s+description/i,
  /use\s+any\s+job\s+description/i,
  /lorem\s+ipsum/i,
];

/**
 * @param {string} text
 * @returns {{ isValidJD: boolean; message?: string }}
 */
export function isValidJD(text) {
  const normalized = text.trim();
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;

  if (wordCount < 40) {
    return invalid();
  }

  const lower = normalized.toLowerCase();
  const keywordHits = jobKeywords.filter((keyword) => lower.includes(keyword)).length;
  const hasBulletLikeStructure = /[-•*]\s+\w+/.test(normalized);
  const hasActionVerb = /\b(build|design|develop|manage|lead|analyze|support|implement|collaborate)\b/i.test(
    normalized
  );

  if (genericInstructionPatterns.some((pattern) => pattern.test(normalized))) {
    return invalid();
  }

  if (keywordHits < 2 && !hasBulletLikeStructure && !hasActionVerb) {
    return invalid();
  }

  return { isValidJD: true };
}

export function buildInvalidJdResponse() {
  return {
    isValidJD: false,
    message: "Invalid job description. Please provide a proper job description.",
  };
}

function invalid() {
  return buildInvalidJdResponse();
}
