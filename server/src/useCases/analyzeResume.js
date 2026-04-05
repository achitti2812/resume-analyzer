import { extractTextFromPdf } from "../adapters/pdfExtractor.js";
import { analyzeResumeWithAi } from "../adapters/aiAnalyzer.js";

/**
 * @param {Buffer} pdfBuffer
 */
export async function analyzeResumePdf(pdfBuffer) {
  const text = await extractTextFromPdf(pdfBuffer);
  const analysis = await analyzeResumeWithAi(text);
  return { ...analysis, excerpt: text.slice(0, 400) };
}
