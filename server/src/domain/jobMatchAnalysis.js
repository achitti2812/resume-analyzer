/**
 * @param {unknown} parsed
 * @returns {{ matchPercentage: number; matchedSkills: string[]; missingSkills: string[]; summary: string }}
 */
export function normalizeJobMatchAnalysis(parsed) {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Job match payload is not an object.");
  }

  const p = /** @type {Record<string, unknown>} */ (parsed);
  const matchNum = Number(p.matchPercentage ?? p.match_percentage);
  const matchedSkills = pickStringArray(p.matchedSkills ?? p.matched_skills);
  const missingSkills = pickStringArray(p.missingSkills ?? p.missing_skills);
  const summary = pickString(p.summary);

  if (!Number.isFinite(matchNum) || matchNum < 0 || matchNum > 100) {
    throw new Error("Invalid match percentage from AI.");
  }
  if (!summary) {
    throw new Error("Missing summary from AI.");
  }

  return {
    matchPercentage: Math.round(matchNum),
    matchedSkills,
    missingSkills,
    summary,
  };
}

/**
 * @param {unknown} parsed
 * @returns {{ improvements: string[]; missingSkills: string[]; interviewPrep: string[]; readinessTips: string[] }}
 */
export function normalizeJobSuggestions(parsed) {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Suggestions payload is not an object.");
  }

  const p = /** @type {Record<string, unknown>} */ (parsed);

  return {
    improvements: pickStringArray(p.improvements),
    missingSkills: pickStringArray(p.missingSkills ?? p.missing_skills),
    interviewPrep: pickStringArray(p.interviewPrep ?? p.interview_prep),
    readinessTips: pickStringArray(p.readinessTips ?? p.readiness_tips),
  };
}

/**
 * @param {unknown} parsed
 * @returns {{ summary: string; skills: string[]; experience: string[]; projects: string[]; education: string[] }}
 */
export function normalizeTailoredResume(parsed) {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Tailored resume payload is not an object.");
  }

  const p = /** @type {Record<string, unknown>} */ (parsed);
  const summary = pickString(p.summary);

  if (!summary) {
    throw new Error("Missing tailored resume summary from AI.");
  }

  return {
    summary,
    skills: pickStringArray(p.skills),
    experience: pickStringArray(p.experience),
    projects: pickStringArray(p.projects),
    education: pickStringArray(p.education),
  };
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function pickString(v) {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * @param {unknown} v
 * @returns {string[]}
 */
function pickStringArray(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim());
}
