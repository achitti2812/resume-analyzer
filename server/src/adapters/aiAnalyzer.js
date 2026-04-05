import { AppError } from "../domain/errors.js";
import { normalizeResumeAnalysis } from "../domain/resumeAnalysis.js";
import {
  normalizeJobMatchAnalysis,
  normalizeJobSuggestions,
  normalizeTailoredResume,
} from "../domain/jobMatchAnalysis.js";

const resumeAnalysisPrompt = `You are an expert ATS (applicant tracking system) and resume coach. Analyze the resume text.

Respond with ONLY valid JSON (no markdown fence) in exactly this shape:
{"atsScore": <integer 0-100>, "strengths": ["<bullet>", ...], "missingSkills": ["<skill or keyword gap>", ...]}

Rules:
- atsScore: estimate how well this resume would parse and rank in typical ATS (clear headings, keywords, measurable results, standard section labels). 100 = excellent ATS alignment.
- strengths: 3-6 concrete positives (content, structure, keywords, impact).
- missingSkills: 3-8 items the candidate likely lacks or should add for stronger ATS matches (specific tools, skills, certifications, or keywords common in their implied role). Phrase as short noun phrases.

Be specific to the resume text; do not invent employers or degrees not implied by the text.`;

const jobMatchPrompt = `You are an expert resume screener comparing a candidate resume against a job description.

Respond with ONLY valid JSON (no markdown fence) in exactly this shape:
{"matchPercentage": <integer 0-100>, "matchedSkills": ["<skill>", ...], "missingSkills": ["<skill>", ...], "summary": "<2-3 sentence summary>"}

Rules:
- Compare the resume text directly against the job description.
- matchPercentage must estimate fit for this specific role, not generic ATS quality.
- matchedSkills: 3-8 skills, tools, or requirements clearly supported by the resume.
- missingSkills: 3-8 important skills, tools, or requirements present in the job description but not clearly supported by the resume.
- summary: concise, professional, evidence-based.
- Use only information found in the provided resume text and job description.
- Do not invent experience, employers, projects, certifications, tools, or achievements.`;

const jobSuggestionsPrompt = `You are an expert resume coach improving a resume for a specific job description.

Respond with ONLY valid JSON (no markdown fence) in exactly this shape:
{"improvements": ["<actionable improvement>", ...], "missingSkills": ["<skill>", ...], "interviewPrep": ["<topic to prepare>", ...], "readinessTips": ["<practical tip>", ...]}

Rules:
- improvements: 3-6 concrete resume improvements tailored to the job description.
- missingSkills: 3-8 important JD skills, tools, or keywords not clearly shown in the resume.
- interviewPrep: 3-6 role-specific topics, stories, or concepts the candidate should be ready to discuss.
- readinessTips: 3-6 practical next steps to improve readiness for this role.
- Base every item on the resume text and the job description.
- Do not invent experience, projects, metrics, certifications, or qualifications the resume does not support.
- Keep each item concise and professional.`;

const tailoredResumePrompt = `You are an expert ATS resume writer tailoring a resume to a job description.

Respond with ONLY valid JSON (no markdown fence) in exactly this shape:
{"summary":"<professional summary>", "skills":["<skill>", ...], "experience":["<bullet>", ...], "projects":["<bullet>", ...], "education":["<bullet>", ...]}

Rules:
- Rewrite and reorganize existing resume content to better align with the job description.
- Preserve factual accuracy at all times.
- Do not invent employers, job titles, dates, projects, certifications, tools, achievements, metrics, or responsibilities.
- If the resume does not support a JD requirement, do not imply mastery.
- summary: 2-4 sentences, professional and ATS-friendly.
- skills: only skills clearly supported by the resume and relevant to the JD.
- experience/projects/education: concise bullet lines suitable for a tailored resume draft.
- Prefer strong wording and ordering, but only from supported resume content.`;

function getCleanApiKey(value) {
  const raw = (value || "").trim();
  if (!raw) return null;
  if (raw === "sk-your-key-here" || raw === "your-api-key-here") return null;
  return raw;
}

function getGoogleApiKey() {
  return getCleanApiKey(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
}

function getOpenAiKey() {
  return getCleanApiKey(process.env.OPENAI_API_KEY);
}

/**
 * @param {string} resumeText
 * @returns {Promise<{ atsScore: number; strengths: string[]; missingSkills: string[] }>}
 */
export async function analyzeResumeWithAi(resumeText) {
  return runAiJsonTask({
    systemPrompt: resumeAnalysisPrompt,
    userPrompt: `Resume text:\n\n${resumeText}`,
    normalize: normalizeResumeAnalysis,
  });
}

/**
 * @param {string} resumeText
 * @param {string} jobDescription
 */
export async function analyzeJobMatchWithAi(resumeText, jobDescription) {
  return runAiJsonTask({
    systemPrompt: jobMatchPrompt,
    userPrompt: buildResumeJobInput(resumeText, jobDescription),
    normalize: normalizeJobMatchAnalysis,
  });
}

/**
 * @param {string} resumeText
 * @param {string} jobDescription
 */
export async function analyzeJobSuggestionsWithAi(resumeText, jobDescription) {
  return runAiJsonTask({
    systemPrompt: jobSuggestionsPrompt,
    userPrompt: buildResumeJobInput(resumeText, jobDescription),
    normalize: normalizeJobSuggestions,
  });
}

/**
 * @param {string} resumeText
 * @param {string} jobDescription
 */
export async function generateTailoredResumeWithAi(resumeText, jobDescription) {
  return runAiJsonTask({
    systemPrompt: tailoredResumePrompt,
    userPrompt: buildResumeJobInput(resumeText, jobDescription),
    normalize: normalizeTailoredResume,
  });
}

/**
 * @template T
 * @param {{
 *   systemPrompt: string;
 *   userPrompt: string;
 *   normalize: (parsed: unknown) => T;
 * }} task
 * @returns {Promise<T>}
 */
async function runAiJsonTask(task) {
  const googleKey = getGoogleApiKey();
  if (googleKey) {
    return analyzeWithGemini(googleKey, task.systemPrompt, task.userPrompt, task.normalize);
  }
  const openaiKey = getOpenAiKey();
  if (openaiKey) {
    return analyzeWithOpenAi(openaiKey, task.systemPrompt, task.userPrompt, task.normalize);
  }
  throw new AppError(
    "No AI key configured. In server/.env set GOOGLE_API_KEY from https://aistudio.google.com/apikey (or GEMINI_API_KEY), OR set OPENAI_API_KEY. Then restart: npm run dev",
    503
  );
}

/**
 * @template T
 * @param {unknown} parsed
 * @param {(parsed: unknown) => T} normalize
 */
function finishAnalysis(parsed, normalize) {
  let data;
  try {
    data = JSON.parse(typeof parsed === "string" ? parsed : JSON.stringify(parsed));
  } catch {
    throw new AppError("AI returned non-JSON content.", 502);
  }
  try {
    return normalize(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid analysis from AI.";
    throw new AppError(msg, 502);
  }
}

/**
 * @param {string} apiKey
 * @template T
 * @param {string} apiKey
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {(parsed: unknown) => T} normalize
 */
async function analyzeWithGemini(apiKey, systemPrompt, userPrompt, normalize) {
  const model = (process.env.GOOGLE_AI_MODEL || process.env.GEMINI_MODEL || "gemini-2.0-flash")
    .trim()
    .replace(/^models\//, "");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [
        {
          role: "user",
          parts: [{ text: truncate(userPrompt, 28000) }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    }),
  });

  const rawBody = await res.text().catch(() => "");
  if (!res.ok) {
    throw new AppError(formatGeminiHttpError(res.status, rawBody), 502);
  }

  let data;
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new AppError("Unexpected Google AI response (not JSON).", 502);
  }

  const parts = data?.candidates?.[0]?.content?.parts;
  const text =
    Array.isArray(parts) && parts[0] && typeof parts[0].text === "string" ? parts[0].text : null;
  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason;
    throw new AppError(
      reason
        ? `Google AI blocked or empty response (finishReason: ${reason}). Try another model via GOOGLE_AI_MODEL in .env.`
        : "Unexpected Google AI response shape.",
      502
    );
  }

  return finishAnalysis(text, normalize);
}

/**
 * @template T
 * @param {string} apiKey
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {(parsed: unknown) => T} normalize
 */
async function analyzeWithOpenAi(apiKey, systemPrompt, userPrompt, normalize) {
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: truncate(userPrompt, 28000),
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new AppError(formatOpenAiHttpError(res.status, errText), 502);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw || typeof raw !== "string") {
    throw new AppError("Unexpected AI response shape.", 502);
  }

  return finishAnalysis(raw, normalize);
}

function buildResumeJobInput(resumeText, jobDescription) {
  return `Resume text:\n\n${resumeText}\n\nJob description:\n\n${jobDescription}`;
}

function truncate(s, max) {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n\n[truncated]`;
}

function formatGeminiHttpError(status, bodyText) {
  try {
    const j = JSON.parse(bodyText);
    const err = j?.error;
    const msg = typeof err?.message === "string" ? err.message : "";
    const statusStr = typeof err?.status === "string" ? err.status : "";
    if (msg) {
      if (status === 403 || /API key|PERMISSION_DENIED|invalid/i.test(msg)) {
        return `Google AI: ${msg} — check GOOGLE_API_KEY at https://aistudio.google.com/apikey`;
      }
      if (status === 404 || /not found|NOT_FOUND/i.test(msg + statusStr)) {
        return (
          `Google AI: model not found (${msg || statusStr}). ` +
          `Set GOOGLE_AI_MODEL=gemini-2.0-flash or gemini-1.5-flash in server/.env`
        );
      }
      return `Google AI: ${msg}`;
    }
  } catch {
    /* not JSON */
  }
  return `Google AI request failed (${status}): ${bodyText.slice(0, 400)}`;
}

/** Turn OpenAI error JSON into a short, actionable message for the UI. */
function formatOpenAiHttpError(status, bodyText) {
  try {
    const j = JSON.parse(bodyText);
    const err = j?.error;
    const code = typeof err?.code === "string" ? err.code : "";
    const msg = typeof err?.message === "string" ? err.message : "";

    if (code === "insufficient_quota" || (status === 429 && msg.toLowerCase().includes("quota"))) {
      return (
        "OpenAI quota exceeded (no credits or billing limit). " +
        "Add payment method or credits at https://platform.openai.com/account/billing — " +
        "then check usage: https://platform.openai.com/usage"
      );
    }
    if (code === "rate_limit_exceeded" || (status === 429 && msg.toLowerCase().includes("rate"))) {
      return (
        "OpenAI rate limit hit. Wait a bit and retry, or review limits: " +
        "https://platform.openai.com/account/limits"
      );
    }
    if (code === "invalid_api_key") {
      return "OpenAI rejected the API key. Verify OPENAI_API_KEY in server/.env at https://platform.openai.com/api-keys";
    }
    if (msg) {
      return status >= 400 && status < 500
        ? `OpenAI: ${msg}`
        : `OpenAI error (${status}): ${msg}`;
    }
  } catch {
    /* body not JSON */
  }
  return `AI request failed (${status}): ${bodyText.slice(0, 400)}`;
}
