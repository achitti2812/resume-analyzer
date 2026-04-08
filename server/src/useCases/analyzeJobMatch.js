import {
  analyzeJobMatchWithAi,
  analyzeJobSuggestionsWithAi,
  generateTailoredResumeWithAi,
} from "../adapters/aiAnalyzer.js";
import { AppError } from "../domain/errors.js";
import {
  buildInvalidJdResponse,
  isValidJD,
} from "./validateJobDescription.js";
import { buildResumeRejection, isResume } from "./validateResumeText.js";

/**
 * @param {string} resumeText
 * @param {string} jobDescription
 */
export async function analyzeJobMatch(resumeText, jobDescription) {
  return analyzeJobTextInput(resumeText, jobDescription, analyzeJobMatchWithAi);
}

/**
 * @template T
 * @param {string} resumeText
 * @param {string} jobDescription
 * @param {(resumeText: string, jobDescription: string) => Promise<T>} handler
 * @returns {Promise<T>}
 */
async function analyzeJobTextInput(resumeText, jobDescription, handler) {
  const cleanResume = normalizeTextInput(resumeText, "resumeText");
  const cleanJobDescription = normalizeTextInput(jobDescription, "jobDescription");
  const jdValidation = isValidJD(cleanJobDescription);
  if (!jdValidation.isValidJD) {
    return buildInvalidJdResponse();
  }
  const validation = await isResume(cleanResume);
  if (!validation.isResume) {
    return buildResumeRejection(validation.reason);
  }
  try {
    return await handler(cleanResume, cleanJobDescription);
  } catch (error) {
    if (
      error instanceof AppError &&
      error.message === "Insufficient job description to perform analysis."
    ) {
      return buildInvalidJdResponse();
    }
    throw error;
  }
}

/**
 * @param {string} resumeText
 * @param {string} jobDescription
 */
export async function analyzeJobSuggestions(resumeText, jobDescription) {
  return analyzeJobTextInput(resumeText, jobDescription, analyzeJobSuggestionsWithAi);
}

/**
 * @param {string} resumeText
 * @param {string} jobDescription
 */
export async function generateTailoredResume(resumeText, jobDescription) {
  return analyzeJobTextInput(resumeText, jobDescription, generateTailoredResumeWithAi);
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 */
function normalizeTextInput(value, fieldName) {
  if (typeof value !== "string") {
    throw new AppError(`Missing string field \`${fieldName}\`.`, 400);
  }

  const cleaned = value.trim();
  if (!cleaned) {
    throw new AppError(`Field \`${fieldName}\` cannot be empty.`, 400);
  }
  if (cleaned.length < 40) {
    throw new AppError(`Field \`${fieldName}\` is too short for reliable analysis.`, 400);
  }

  return cleaned;
}
