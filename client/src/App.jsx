import { useCallback, useEffect, useState } from "react";

/** Same origin in dev (Vite proxies /api and /upload). Set VITE_API_URL when API is on another host. */
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function Spinner() {
  return <span className="spinner" aria-hidden />;
}

function ActionButton({
  actionId,
  label,
  description,
  onClick,
  disabled,
  loading,
  loadingLabel,
  variant,
  openActionInfo,
  setOpenActionInfo,
  buttonType = "button",
}) {
  const isInfoOpen = openActionInfo === actionId;

  const toggleInfo = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      setOpenActionInfo((current) => (current === actionId ? null : actionId));
    },
    [actionId, setOpenActionInfo]
  );

  return (
    <div className={`action-item${isInfoOpen ? " action-item--info-open" : ""}`}>
      <div className="action-control">
        <button
          type={buttonType}
          onClick={onClick}
          disabled={disabled}
          className={`btn ${variant === "primary" ? "btn--primary" : "btn--ghost"}`}
          title={description}
        >
          {loading ? (
            <>
              <Spinner />
              {loadingLabel}
            </>
          ) : (
            label
          )}
        </button>
        <button
          type="button"
          className="info-trigger"
          aria-label={`About ${label}`}
          aria-expanded={isInfoOpen}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={toggleInfo}
        >
          i
        </button>
      </div>
      <span className="action-tooltip" role="tooltip">
        {description}
      </span>
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [loadingAnalyze, setLoadingAnalyze] = useState(false);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingTailoredResume, setLoadingTailoredResume] = useState(false);
  const [error, setError] = useState(null);
  const [extractedText, setExtractedText] = useState(null);
  const [result, setResult] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [suggestionsResult, setSuggestionsResult] = useState(null);
  const [tailoredResumeResult, setTailoredResumeResult] = useState(null);
  const [resumeValidationMessage, setResumeValidationMessage] = useState(null);
  const [jobDescriptionValidationMessage, setJobDescriptionValidationMessage] = useState(null);
  const [openActionInfo, setOpenActionInfo] = useState(null);

  const busy =
    loadingUpload ||
    loadingAnalyze ||
    loadingMatch ||
    loadingSuggestions ||
    loadingTailoredResume;

  const onFile = useCallback((e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setError(null);
    setResult(null);
    setExtractedText(null);
    setMatchResult(null);
    setSuggestionsResult(null);
    setTailoredResumeResult(null);
    setResumeValidationMessage(null);
    setJobDescriptionValidationMessage(null);
    setOpenActionInfo(null);
  }, []);

  const onJobDescriptionChange = useCallback((e) => {
    setJobDescription(e.target.value);
    setError(null);
    setJobDescriptionValidationMessage(null);
  }, []);

  useEffect(() => {
    if (!openActionInfo) return undefined;

    function handleDocumentClick(event) {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(".action-item")) {
        setOpenActionInfo(null);
      }
    }

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [openActionInfo]);

  const uploadPdf = useCallback(async () => {
    if (!file) {
      setError("Choose a PDF first.");
      return;
    }
    setLoadingUpload(true);
    setError(null);
    setResumeValidationMessage(null);
    setJobDescriptionValidationMessage(null);
    setExtractedText(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Upload failed (${res.status})`);
      }
      if (typeof data.text !== "string") {
        throw new Error("Server did not return text.");
      }
      setExtractedText(data.text);
      return data.text;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      throw e;
    } finally {
      setLoadingUpload(false);
    }
  }, [file]);

  const analyze = useCallback(async () => {
    if (!file) {
      setError("Choose a PDF first.");
      return;
    }
    setLoadingAnalyze(true);
    setError(null);
    setResult(null);
    setMatchResult(null);
    setSuggestionsResult(null);
    setTailoredResumeResult(null);
    setResumeValidationMessage(null);
    setJobDescriptionValidationMessage(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(formatApiErrorMessage(data.error, res.status));
      }
      if (isResumeRejectedResponse(data)) {
        applyResumeRejection(data.message, {
          setResumeValidationMessage,
          setResult,
          setMatchResult,
          setSuggestionsResult,
          setTailoredResumeResult,
        });
        return;
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoadingAnalyze(false);
    }
  }, [file]);

  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();
      analyze();
    },
    [analyze]
  );

  const ensureResumeText = useCallback(async () => {
    if (!file) {
      setError("Choose a PDF first.");
      throw new Error("Choose a PDF first.");
    }
    if (!jobDescription.trim()) {
      setError("Paste a job description to use this action.");
      throw new Error("Paste a job description to use this action.");
    }
    if (extractedText) {
      return extractedText;
    }
    return uploadPdf();
  }, [extractedText, file, jobDescription, uploadPdf]);

  const postJobAnalysis = useCallback(async (path) => {
    const resumeText = await ensureResumeText();
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeText,
        jobDescription: jobDescription.trim(),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(formatApiErrorMessage(data.error, res.status));
    }
    return data;
  }, [ensureResumeText, jobDescription]);

  const matchResumeToJob = useCallback(async () => {
    setLoadingMatch(true);
    setError(null);
    setResult(null);
    setMatchResult(null);
    setSuggestionsResult(null);
    setTailoredResumeResult(null);
    setResumeValidationMessage(null);
    setJobDescriptionValidationMessage(null);
    try {
      const data = await postJobAnalysis("/api/match-jd");
      if (isInvalidJdResponse(data)) {
        applyJobDescriptionRejection(data.message, {
          setJobDescriptionValidationMessage,
          setResult,
          setMatchResult,
          setSuggestionsResult,
          setTailoredResumeResult,
          setResumeValidationMessage,
        });
        return;
      }
      if (isResumeRejectedResponse(data)) {
        applyResumeRejection(data.message, {
          setResumeValidationMessage,
          setResult,
          setMatchResult,
          setSuggestionsResult,
          setTailoredResumeResult,
        });
        return;
      }
      setMatchResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoadingMatch(false);
    }
  }, [postJobAnalysis]);

  const suggestImprovements = useCallback(async () => {
    setLoadingSuggestions(true);
    setError(null);
    setResult(null);
    setMatchResult(null);
    setSuggestionsResult(null);
    setTailoredResumeResult(null);
    setResumeValidationMessage(null);
    setJobDescriptionValidationMessage(null);
    try {
      const data = await postJobAnalysis("/api/jd-suggestions");
      if (isInvalidJdResponse(data)) {
        applyJobDescriptionRejection(data.message, {
          setJobDescriptionValidationMessage,
          setResult,
          setMatchResult,
          setSuggestionsResult,
          setTailoredResumeResult,
          setResumeValidationMessage,
        });
        return;
      }
      if (isResumeRejectedResponse(data)) {
        applyResumeRejection(data.message, {
          setResumeValidationMessage,
          setResult,
          setMatchResult,
          setSuggestionsResult,
          setTailoredResumeResult,
        });
        return;
      }
      setSuggestionsResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoadingSuggestions(false);
    }
  }, [postJobAnalysis]);

  const generateTailoredResume = useCallback(async () => {
    setLoadingTailoredResume(true);
    setError(null);
    setResult(null);
    setMatchResult(null);
    setSuggestionsResult(null);
    setTailoredResumeResult(null);
    setResumeValidationMessage(null);
    setJobDescriptionValidationMessage(null);
    try {
      const data = await postJobAnalysis("/api/tailored-resume");
      if (isInvalidJdResponse(data)) {
        applyJobDescriptionRejection(data.message, {
          setJobDescriptionValidationMessage,
          setResult,
          setMatchResult,
          setSuggestionsResult,
          setTailoredResumeResult,
          setResumeValidationMessage,
        });
        return;
      }
      if (isResumeRejectedResponse(data)) {
        applyResumeRejection(data.message, {
          setResumeValidationMessage,
          setResult,
          setMatchResult,
          setSuggestionsResult,
          setTailoredResumeResult,
        });
        return;
      }
      setTailoredResumeResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoadingTailoredResume(false);
    }
  }, [postJobAnalysis]);

  const showResults =
    extractedText != null ||
    result ||
    matchResult ||
    suggestionsResult ||
    tailoredResumeResult ||
    resumeValidationMessage ||
    jobDescriptionValidationMessage;

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Resume Analyzer</h1>
        <p className="app-lede">
          Upload a PDF resume. Extract text instantly or run a full AI review for ATS-style
          feedback.
        </p>
      </header>

      <section className="card" aria-labelledby="upload-heading" aria-busy={busy}>
        <div className="card__head">
          <div>
            <h2 id="upload-heading" className="card__title">
              Upload
            </h2>
            <p className="card__subtitle">PDF only, up to 5 MB (server limit).</p>
          </div>
        </div>
        <form onSubmit={onSubmit}>
          <label className="form-label" htmlFor="resume-file">
            PDF file
          </label>
          <input
            id="resume-file"
            type="file"
            accept=".pdf,application/pdf"
            onChange={onFile}
            className="file-field"
          />
          {file && (
            <p className="file-meta">
              Selected: <strong>{file.name}</strong>
            </p>
          )}
          <label className="form-label form-label--spaced" htmlFor="job-description">
            Job description
          </label>
          <textarea
            id="job-description"
            value={jobDescription}
            onChange={onJobDescriptionChange}
            rows={8}
            placeholder="Paste the target job description here for match scoring, suggestions, and tailored resume generation."
            className="text-area-field"
          />
          <div className="btn-row">
            <ActionButton
              actionId="extract"
              label="Extract text"
              description="Pulls readable text from the uploaded PDF so you can preview what the system sees."
              onClick={uploadPdf}
              disabled={busy || !file}
              loading={loadingUpload}
              loadingLabel="Extracting…"
              variant="ghost"
              openActionInfo={openActionInfo}
              setOpenActionInfo={setOpenActionInfo}
            />
            <ActionButton
              actionId="analyze"
              label="Analyze with AI"
              description="Reviews the resume for ATS fit, strengths, and likely missing skills."
              buttonType="submit"
              disabled={busy || !file}
              loading={loadingAnalyze}
              loadingLabel="Analyzing…"
              variant="primary"
              openActionInfo={openActionInfo}
              setOpenActionInfo={setOpenActionInfo}
            />
          </div>
          <div className="btn-row btn-row--secondary">
            <ActionButton
              actionId="match"
              label="Match Resume with JD"
              description="Compares the resume against the pasted job description and shows fit score plus JD-aligned skills."
              onClick={matchResumeToJob}
              disabled={busy || !file}
              loading={loadingMatch}
              loadingLabel="Matching…"
              variant="ghost"
              openActionInfo={openActionInfo}
              setOpenActionInfo={setOpenActionInfo}
            />
            <ActionButton
              actionId="suggest"
              label="Suggest Improvements"
              description="Suggests resume improvements, missing skills, interview prep, and readiness tips from the JD."
              onClick={suggestImprovements}
              disabled={busy || !file}
              loading={loadingSuggestions}
              loadingLabel="Generating suggestions…"
              variant="ghost"
              openActionInfo={openActionInfo}
              setOpenActionInfo={setOpenActionInfo}
            />
            <ActionButton
              actionId="tailor"
              label="Generate Tailored Resume"
              description="Builds an ATS-friendly resume draft using only the uploaded resume content and the JD."
              onClick={generateTailoredResume}
              disabled={busy || !file}
              loading={loadingTailoredResume}
              loadingLabel="Drafting tailored resume…"
              variant="ghost"
              openActionInfo={openActionInfo}
              setOpenActionInfo={setOpenActionInfo}
            />
          </div>
          {error && (
            <p className="alert--error" role="alert">
              {error}
            </p>
          )}
        </form>
      </section>

      {showResults && (
        <div className="result-stack">
          {resumeValidationMessage ? (
            <ResumeValidationCard message={resumeValidationMessage} />
          ) : null}
          {jobDescriptionValidationMessage ? (
            <JobDescriptionValidationCard message={jobDescriptionValidationMessage} />
          ) : null}

          {!resumeValidationMessage && !jobDescriptionValidationMessage && extractedText != null && (
            <article className="card">
              <div className="card__head">
                <div>
                  <h2 className="card__title">Extracted text</h2>
                  <p className="card__subtitle">Raw output from POST /upload</p>
                </div>
              </div>
              <pre className="text-preview">{extractedText}</pre>
            </article>
          )}

          {!resumeValidationMessage && !jobDescriptionValidationMessage && result && (
            <Results data={result} />
          )}

          {!resumeValidationMessage && !jobDescriptionValidationMessage && loadingMatch && (
            <LoadingCard title="Resume vs JD match" body="Scoring fit and extracting matched skills…" />
          )}
          {!resumeValidationMessage && !jobDescriptionValidationMessage && matchResult && (
            <JobMatchResults data={matchResult} />
          )}

          {!resumeValidationMessage && !jobDescriptionValidationMessage && loadingSuggestions && (
            <LoadingCard
              title="JD-based suggestions"
              body="Generating improvement ideas, missing skills, and interview prep…"
            />
          )}
          {!resumeValidationMessage && !jobDescriptionValidationMessage && suggestionsResult && (
            <SuggestionsResults data={suggestionsResult} />
          )}

          {!resumeValidationMessage && !jobDescriptionValidationMessage && loadingTailoredResume && (
            <LoadingCard
              title="Tailored resume"
              body="Building an ATS-friendly tailored resume draft from your existing resume…"
            />
          )}
          {!resumeValidationMessage && !jobDescriptionValidationMessage && tailoredResumeResult && (
            <TailoredResumeResults data={tailoredResumeResult} />
          )}
        </div>
      )}
    </div>
  );
}

function Results({ data }) {
  const atsScore =
    typeof data.atsScore === "number"
      ? data.atsScore
      : typeof data.score === "number"
        ? data.score
        : null;
  const { strengths, missingSkills, excerpt } = data;
  const band =
    atsScore == null
      ? "—"
      : atsScore >= 75
        ? "strong ATS fit"
        : atsScore >= 55
          ? "moderate ATS fit"
          : "needs ATS tuning";

  return (
    <>
      <article className="card card--ats">
        <div className="ats-badge" aria-label={`ATS score ${atsScore ?? "unknown"}`}>
          <span className="ats-badge__num">{atsScore ?? "—"}</span>
          <span className="ats-badge__label">ATS</span>
        </div>
        <div className="min-w-0">
          <h2 className="card__title card__title--inline">Score & fit</h2>
          <p className="ats-band">{band}</p>
          <p className="card__subtitle card__subtitle--flush">
            Estimated parsing and keyword alignment vs typical applicant tracking systems.
          </p>
        </div>
      </article>

      <div className="result-grid">
        <article className="card">
          <h2 className="card__title card__title--block">Strengths</h2>
          <ul className="list-clean">
            {(strengths || []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </article>
        <article className="card">
          <h2 className="card__title card__title--block">Missing skills</h2>
          <ul className="list-clean list-clean--gap">
            {(missingSkills || []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </article>
      </div>

      {excerpt ? (
        <article className="card">
          <details className="details-card">
            <summary>Extracted text preview</summary>
            <pre className="text-preview text-preview--sm">{excerpt}</pre>
          </details>
        </article>
      ) : null}
    </>
  );
}

function LoadingCard({ title, body }) {
  return (
    <article className="card">
      <div className="card__head">
        <div>
          <h2 className="card__title">{title}</h2>
          <p className="card__subtitle">{body}</p>
        </div>
        <Spinner />
      </div>
    </article>
  );
}

function JobMatchResults({ data }) {
  const matchPercentage =
    typeof data.matchPercentage === "number" ? data.matchPercentage : null;

  return (
    <>
      <article className="card card--ats">
        <div className="ats-badge" aria-label={`Match percentage ${matchPercentage ?? "unknown"}`}>
          <span className="ats-badge__num">{matchPercentage ?? "—"}</span>
          <span className="ats-badge__label">Match</span>
        </div>
        <div className="min-w-0">
          <h2 className="card__title card__title--inline">Resume vs JD</h2>
          <p className="ats-band">
            {matchPercentage == null
              ? "fit unavailable"
              : matchPercentage >= 75
                ? "strong role alignment"
                : matchPercentage >= 55
                  ? "moderate role alignment"
                  : "limited role alignment"}
          </p>
          <p className="card__subtitle card__subtitle--flush">{data.summary}</p>
        </div>
      </article>

      <div className="result-grid">
        <article className="card">
          <h2 className="card__title card__title--block">Matched skills</h2>
          <ul className="list-clean">
            {(data.matchedSkills || []).map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="card">
          <h2 className="card__title card__title--block">Missing skills</h2>
          <ul className="list-clean list-clean--gap">
            {(data.missingSkills || []).map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </article>
      </div>
    </>
  );
}

function SuggestionsResults({ data }) {
  return (
    <div className="result-grid">
      <article className="card">
        <h2 className="card__title card__title--block">Improvements</h2>
        <ul className="list-clean">
          {(data.improvements || []).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </article>
      <article className="card">
        <h2 className="card__title card__title--block">Interview prep</h2>
        <ul className="list-clean">
          {(data.interviewPrep || []).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </article>
      <article className="card">
        <h2 className="card__title card__title--block">Missing skills</h2>
        <ul className="list-clean list-clean--gap">
          {(data.missingSkills || []).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </article>
      <article className="card">
        <h2 className="card__title card__title--block">Readiness tips</h2>
        <ul className="list-clean">
          {(data.readinessTips || []).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </article>
    </div>
  );
}

function TailoredResumeResults({ data }) {
  return (
    <article className="card">
      <div className="card__head">
        <div>
          <h2 className="card__title">Tailored resume draft</h2>
          <p className="card__subtitle">
            ATS-oriented rewrite based on your uploaded resume and pasted job description.
          </p>
        </div>
      </div>

      <div className="structured-stack">
        <ResumeSection title="Summary" items={data.summary ? [data.summary] : []} />
        <ResumeSection title="Skills" items={data.skills || []} />
        <ResumeSection title="Experience" items={data.experience || []} />
        <ResumeSection title="Projects" items={data.projects || []} />
        <ResumeSection title="Education" items={data.education || []} />
      </div>
    </article>
  );
}

function ResumeValidationCard({ message }) {
  return (
    <article className="card card--rejection">
      <div className="card__head">
        <div>
          <h2 className="card__title">Invalid resume upload</h2>
          <p className="card__subtitle card__subtitle--flush">{message}</p>
        </div>
      </div>
    </article>
  );
}

function JobDescriptionValidationCard({ message }) {
  return (
    <article className="card card--rejection">
      <div className="card__head">
        <div>
          <h2 className="card__title">Invalid job description</h2>
          <p className="card__subtitle card__subtitle--flush">{message}</p>
        </div>
      </div>
    </article>
  );
}

function ResumeSection({ title, items }) {
  if (!items?.length) return null;

  return (
    <section className="structured-section">
      <h3 className="structured-title">{title}</h3>
      <ul className="list-clean">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function formatApiErrorMessage(message, status) {
  let text =
    typeof message === "string" && message.trim() ? message.trim() : `Request failed (${status})`;
  if (
    text.includes("API key") ||
    text.includes("GOOGLE_API_KEY") ||
    text.includes("OPENAI_API_KEY") ||
    text.includes("No AI key")
  ) {
    text += " (Backend: edit server/.env, then restart the API server.)";
  }
  return text;
}

function isResumeRejectedResponse(data) {
  return data?.isResume === false && typeof data?.message === "string";
}

function isInvalidJdResponse(data) {
  return data?.isValidJD === false && typeof data?.message === "string";
}

function applyResumeRejection(message, setters) {
  setters.setResumeValidationMessage(message);
  setters.setJobDescriptionValidationMessage?.(null);
  setters.setResult(null);
  setters.setMatchResult(null);
  setters.setSuggestionsResult(null);
  setters.setTailoredResumeResult(null);
}

function applyJobDescriptionRejection(message, setters) {
  setters.setJobDescriptionValidationMessage(message);
  setters.setResumeValidationMessage(null);
  setters.setResult(null);
  setters.setMatchResult(null);
  setters.setSuggestionsResult(null);
  setters.setTailoredResumeResult(null);
}
