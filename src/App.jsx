import { useMemo, useState, useRef, useEffect } from "react";
import "./App.css";

const categories = [
  "Frontend Developer",
  "Backend Developer",
  "Database",
  "HR Interview",
];

const API_BASE = "http://localhost:5000/api";

function ResumeUpload({ onUpload, isParsing, hasResume, error }) {
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const validTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  const handleFile = (file) => {
    if (!file) return;
    if (!validTypes.includes(file.type)) {
      setFileName("Unsupported file type. Use PDF or DOCX.");
      return;
    }
    setFileName(file.name);
    if (onUpload) onUpload(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    handleFile(file);
  };

  const onSelect = (e) => {
    const file = e.target.files && e.target.files[0];
    handleFile(file);
  };

  return (
    <div className="resume-upload glass-panel" aria-hidden="false">
      <div
        className={`dropzone ${dragOver ? "dragover" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current && inputRef.current.click()}
      >
        <svg className="resume-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2v10" stroke="#c7d2fe" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 15V7a2 2 0 0 0-2-2h-6" stroke="#c7d2fe" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 21H7a2 2 0 0 1-2-2V7" stroke="#c7d2fe" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 16l-4 4-4-4" stroke="#c7d2fe" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <div className="drop-content">
          <div className="drop-title">Upload Resume</div>
          <div className="drop-sub">Drag & drop a PDF or DOCX, or click to browse</div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf, .docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden-file"
          onChange={onSelect}
        />
      </div>

      <div className="file-info">
        {fileName && <div className="file-name">{fileName}</div>}
        {isParsing && <div className="success-msg" style={{ color: "#818cf8" }}>Parsing resume...</div>}
        {hasResume && !isParsing && <div className="success-msg">Resume uploaded successfully</div>}
        {error && <div className="error-msg" style={{ color: "#f87171", fontSize: "0.875rem", marginTop: "0.5rem" }}>{error}</div>}
      </div>
    </div>
  );
}

function App() {
  const [questions, setQuestions] = useState([]);
  const [resumeText, setResumeText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [error, setError] = useState("");

  const [category, setCategory] = useState(categories[0]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [answers, setAnswers] = useState([]);
  const [results, setResults] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [completed, setCompleted] = useState(false);

  const totalQuestions = questions.length || 1;
  const currentQuestion = questions[currentQuestionIndex] || "";
  const progressPercent = questions.length
    ? Math.round(((currentQuestionIndex + 1) / questions.length) * 100)
    : 0;
  const completedResults = results.filter(Boolean);
  const answeredQuestions = answers.filter((value) => value && value.trim()).length;
  const currentScore = submitted && results[currentQuestionIndex] ? results[currentQuestionIndex].score : 0;
  const averageScore = completedResults.length
    ? Math.round(completedResults.reduce((sum, item) => sum + item.score, 0) / completedResults.length)
    : 0;

  const aggregatedStrengths = Array.from(new Set(completedResults.flatMap((item) => item.strengths)));
  const aggregatedWeaknesses = Array.from(new Set(completedResults.flatMap((item) => item.weaknesses)));
  const finalScore = completedResults.length
    ? Math.round(completedResults.reduce((sum, item) => sum + item.score, 0) / (questions.length || 1))
    : 0;
  const completionPercent = questions.length
    ? Math.round((answeredQuestions / questions.length) * 100)
    : 0;

  const handleResumeUpload = async (file) => {
    setIsParsing(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("resume", file);

      const response = await fetch(`${API_BASE}/parse-resume`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to parse resume.");
      }

      const data = await response.json();
      setResumeText(data.resumeText);
    } catch (err) {
      console.error(err);
      setUploadError(err.message || "Failed to upload and parse resume.");
    } finally {
      setIsParsing(false);
    }
  };

  const generateQuestions = async (text, cat) => {
    setIsGenerating(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: text, category: cat }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to generate questions.");
      }

      const data = await response.json();
      if (data.questions && Array.isArray(data.questions)) {
        setQuestions(data.questions);
        setCurrentQuestionIndex(0);
        setAnswers(Array(data.questions.length).fill(""));
        setResults(Array(data.questions.length).fill(null));
        setSubmitted(false);
        setCompleted(false);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to generate questions.");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (resumeText && category) {
      generateQuestions(resumeText, category);
    }
  }, [resumeText, category]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!currentAnswer.trim() || questions.length === 0) return;

    setIsEvaluating(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/evaluate-answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentQuestion,
          answer: currentAnswer,
          resumeText: resumeText || "",
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to evaluate answer.");
      }

      const evaluation = await response.json();

      setResults((prev) => {
        const next = [...prev];
        next[currentQuestionIndex] = evaluation;
        return next;
      });
      setAnswers((prev) => {
        const next = [...prev];
        next[currentQuestionIndex] = currentAnswer;
        return next;
      });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to evaluate answer.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex >= questions.length - 1) {
      setCompleted(true);
      return;
    }
    const nextIndex = currentQuestionIndex + 1;
    setCurrentQuestionIndex(nextIndex);
    setCurrentAnswer(answers[nextIndex] || "");
    setSubmitted(results[nextIndex] !== null);
  };

  const handleCategoryChange = (event) => {
    setCategory(event.target.value);
  };

  if (completed) {
    return (
      <div className="app-shell">
        <div className="dashboard-view">
          <ResumeUpload
            onUpload={handleResumeUpload}
            isParsing={isParsing}
            hasResume={!!resumeText}
            error={uploadError}
          />
          <section className="hero-panel glass-panel">
            <div className="hero-chip">Interview Summary</div>
            <h1>Final Interview Results</h1>
            <p>Review your overall performance and discover strengths, weaknesses, and a score breakdown.</p>
          </section>

          <section className="summary-panel glass-panel">
            <div className="summary-grid">
              <div className="summary-card">
                <span>Total Questions</span>
                <strong>{questions.length}</strong>
              </div>
              <div className="summary-card">
                <span>Answered Questions</span>
                <strong>{answeredQuestions}</strong>
              </div>
              <div className="summary-card">
                <span>Final Score</span>
                <strong>{finalScore}</strong>
              </div>
              <div className="summary-card">
                <span>Completion</span>
                <strong>{completionPercent}%</strong>
              </div>
            </div>

            <div className="summary-detail">
              <div>
                <h3>Strengths</h3>
                <ul>
                  {aggregatedStrengths.length > 0 ? (
                    aggregatedStrengths.map((item, index) => <li key={index}>{item}</li>)
                  ) : (
                    <li>No strengths captured.</li>
                  )}
                </ul>
              </div>
              <div>
                <h3>Weaknesses</h3>
                <ul>
                  {aggregatedWeaknesses.length > 0 ? (
                    aggregatedWeaknesses.map((item, index) => <li key={index}>{item}</li>)
                  ) : (
                    <li>No weaknesses captured.</li>
                  )}
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="dashboard-view">
        <ResumeUpload
          onUpload={handleResumeUpload}
          isParsing={isParsing}
          hasResume={!!resumeText}
          error={uploadError}
        />
        <section className="hero-panel glass-panel">
          <div className="hero-chip">Premium AI SaaS</div>
          <h1>AI Interview Simulator</h1>
          <p>Practice high-impact interview answers with instant scoring, strengths analysis, and expert suggestions.</p>
        </section>

        {error && (
          <div className="error-banner glass-panel" style={{ color: "#f87171", padding: "1rem", marginBottom: "1.5rem", borderLeft: "4px solid #ef4444", background: "rgba(239, 68, 68, 0.1)" }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="cards-grid">
          <div className="dashboard-cards">
            <div className="score-card glass-panel">
              <p className="eyebrow">Score Dashboard</p>
              <div className="score-values">
                <div>
                  <span>Current Score</span>
                  <strong>{currentScore}</strong>
                </div>
                <div>
                  <span>Average Score</span>
                  <strong>{averageScore}</strong>
                </div>
              </div>
              <div className="metric-note">Progress updates as you submit each answer.</div>
            </div>

            <div className="progress-card glass-panel">
              <p className="eyebrow">Interview Progress</p>
              <div className="progress-label">
                <span>{progressPercent}% complete</span>
                <span>
                  {questions.length 
                    ? `Question ${currentQuestionIndex + 1} of ${questions.length}` 
                    : "No questions loaded"}
                </span>
              </div>
              <div className="progress-track interview-progress">
                <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </div>

          <form className="control-panel glass-panel" onSubmit={handleSubmit}>
            <div className="question-header">
              <div>
                <p className="question-counter">
                  {questions.length 
                    ? `Question ${currentQuestionIndex + 1} of ${questions.length}` 
                    : "Upload Resume to Begin"}
                </p>
                <h2 className="question-title">Interview Prompt</h2>
              </div>
              <div className="panel-metric">
                <span>Category</span>
                <strong>{category}</strong>
              </div>
            </div>

            <label className="label-inline" htmlFor="category">Interview Category</label>
            <select 
              id="category" 
              value={category} 
              onChange={handleCategoryChange} 
              className="category-select"
              disabled={isGenerating || isEvaluating}
            >
              {categories.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <div className="question-card">
              <div className="question-label">Current Question</div>
              <p className="question-text">
                {isGenerating 
                  ? "Generating questions using Gemini..." 
                  : (questions.length > 0 
                      ? currentQuestion 
                      : "Please upload your resume to generate personalized interview questions.")}
              </p>
            </div>

            <label className="textarea-label" htmlFor="answer">Your Answer</label>
            <textarea
              id="answer"
              value={currentAnswer}
              onChange={(event) => setCurrentAnswer(event.target.value)}
              placeholder={questions.length > 0 ? "Type your response here..." : "Resume required to generate questions..."}
              className="answer-area"
              disabled={questions.length === 0 || isEvaluating || isGenerating}
            />

            <div className="form-actions">
              <button 
                type="submit" 
                className="submit-button" 
                disabled={questions.length === 0 || isEvaluating || isGenerating || !currentAnswer.trim()}
              >
                {isEvaluating ? "Evaluating your answer..." : (submitted ? "Update Answer" : "Submit Answer")}
              </button>
              <button 
                type="button" 
                className="next-button" 
                onClick={handleNextQuestion} 
                disabled={!submitted || isEvaluating || isGenerating}
              >
                {currentQuestionIndex === questions.length - 1 ? "Finish Interview" : "Next Question"}
              </button>
            </div>
          </form>

          {submitted && results[currentQuestionIndex] && (
            <section className="feedback-panel glass-panel">
              <div className="feedback-header">
                <div>
                  <p className="eyebrow">Feedback Summary</p>
                  <h2>Performance Scorecard</h2>
                </div>
                <div className="score-chip">
                  <span>Score</span>
                  <strong>{results[currentQuestionIndex].score}</strong>
                </div>
              </div>

              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${results[currentQuestionIndex].score}%` }} />
              </div>

              <div className="feedback-grid">
                <div className="feedback-block">
                  <h3>Strengths</h3>
                  <ul>
                    {results[currentQuestionIndex].strengths.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="feedback-block">
                  <h3>Weaknesses</h3>
                  <ul>
                    {results[currentQuestionIndex].weaknesses.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="suggestions-block">
                <h3>Suggestions</h3>
                <ul>
                  {results[currentQuestionIndex].suggestions.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="feedback-summary">
                <p>{results[currentQuestionIndex].feedback}</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
