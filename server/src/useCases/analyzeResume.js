import { extractTextFromPdf } from "../adapters/pdfExtractor.js";
import { analyzeResumeWithAi } from "../adapters/aiAnalyzer.js";
import { buildResumeRejection, isResume } from "./validateResumeText.js";

/**
 * @param {Buffer} pdfBuffer
 */
export async function analyzeResumePdf(pdfBuffer) {
  const text = await extractTextFromPdf(pdfBuffer);
  const validation = await isResume(text);
  if (!validation.isResume) {
    return buildResumeRejection(validation.reason);
  }
  const analysis = await analyzeResumeWithAi(text);
  return { ...analysis, excerpt: text.slice(0, 400) };
}
