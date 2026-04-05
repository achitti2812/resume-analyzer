/**
 * @param {unknown} parsed
 * @returns {{ atsScore: number; strengths: string[]; missingSkills: string[] }}
 */
export function normalizeResumeAnalysis(parsed) {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Analysis payload is not an object.");
  }
  const p = /** @type {Record<string, unknown>} */ (parsed);

  const rawAts = p.atsScore ?? p.ats_score;
  const legacyScore = p.score;
  const atsNum =
    rawAts !== undefined && rawAts !== null
      ? Number(rawAts)
      : legacyScore !== undefined && legacyScore !== null
        ? Number(legacyScore)
        : NaN;

  const strengths = pickStringArray(p.strengths);
  const missingRaw = p.missingSkills ?? p.missing_skills;
  const missingSkills = Array.isArray(missingRaw) ? pickStringArray(missingRaw) : [];

  if (!Number.isFinite(atsNum) || atsNum < 0 || atsNum > 100) {
    throw new Error("Invalid ATS score from AI.");
  }

  return {
    atsScore: Math.round(atsNum),
    strengths,
    missingSkills,
  };
}

/**
 * @param {unknown} v
 * @returns {string[]}
 */
function pickStringArray(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim());
}
