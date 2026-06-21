import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { GoogleGenerativeAI } from '@google/generative-ai';

console.log('GEMINI_API_KEY detected:', !!process.env.GEMINI_API_KEY);

const app = express();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Enable CORS for frontend requests
app.use(cors());
app.use(express.json());

// Set up multer memory storage for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB file size limit
  }
}).single('resume');

// Endpoint to parse resume file (PDF/DOCX) and extract text
app.post('/api/parse-resume', (req, res) => {
  upload(req, res, async (err) => {
    // Handle Multer specific errors (e.g. file size exceeded)
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message || 'Error uploading file.' });
    }

    // Check if file was provided
    if (!req.file) {
      return res.status(400).json({ error: 'No resume file uploaded.' });
    }

    const { buffer, mimetype, originalname } = req.file;
    const lowerName = originalname.toLowerCase();

    try {
      let extractedText = '';

      // Determine parser by file extension or mime type
      if (mimetype === 'application/pdf' || lowerName.endsWith('.pdf')) {
        const data = await pdfParse(buffer);
        extractedText = data.text;
      } else if (
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        lowerName.endsWith('.docx')
      ) {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
      } else {
        return res.status(400).json({ 
          error: 'Unsupported file type. Only PDF and DOCX files are allowed.' 
        });
      }

      // Check if text was successfully extracted
      if (!extractedText || extractedText.trim() === '') {
        return res.status(422).json({ 
          error: 'Failed to extract text. The file might be empty, password-protected, or scanned.' 
        });
      }

      // Return parsed text
      return res.json({ resumeText: extractedText.trim() });

    } catch (parseError) {
      console.error('Parsing error:', parseError);
      return res.status(500).json({ 
        error: `Failed to parse file: ${parseError.message || 'Internal parsing error.'}` 
      });
    }
  });
});

// Endpoint to generate exactly 10 interview questions based on resume and category
app.post('/api/generate-questions', async (req, res) => {
  const { resumeText, category } = req.body;

  // Validate request body
  if (!resumeText || typeof resumeText !== 'string' || resumeText.trim() === '') {
    return res.status(400).json({ error: 'Missing or invalid resumeText.' });
  }

  const allowedCategories = ['Frontend Developer', 'Backend Developer', 'Database', 'HR Interview'];
  if (!category || !allowedCategories.includes(category)) {
    return res.status(400).json({ 
      error: `Invalid or missing category. Must be one of: ${allowedCategories.join(', ')}` 
    });
  }

  // Validate API key configuration
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your-api-key-here' || process.env.GEMINI_API_KEY.trim() === '') {
    return res.status(500).json({ 
      error: 'Gemini API key is not configured. Please add GEMINI_API_KEY to your .env file.' 
    });
  }

  try {
    const prompt = `You are an expert technical recruiter and interviewer.
Your task is to generate exactly 10 interview questions relevant to a candidate's resume and the selected job category.

Job Category: ${category}
Candidate Resume Text:
---
${resumeText}
---

Requirements:
1. Generate exactly 10 distinct, high-quality, relevant interview questions.
2. The questions should evaluate both their technical depth (relevant to the category and resume) and their experience.
3. Respond with a valid JSON object matching the schema below.

Required JSON format:
{
  "questions": [
    "question 1",
    "question 2",
    ...
  ]
}`;

    let responseText;
    try {
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: 'application/json' }
      });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      responseText = response.text();
    } catch (error) {
      if (error.message && (error.message.includes('404') || error.message.includes('not found') || error.message.includes('supported'))) {
        console.log('gemini-1.5-flash not supported or found. Falling back to gemini-2.5-flash...');
        const fallbackModel = genAI.getGenerativeModel({ 
          model: 'gemini-2.5-flash',
          generationConfig: { responseMimeType: 'application/json' }
        });
        const result = await fallbackModel.generateContent(prompt);
        const response = await result.response;
        responseText = response.text();
      } else {
        throw error;
      }
    }

    const parsedData = JSON.parse(responseText.trim());

    if (!parsedData.questions || !Array.isArray(parsedData.questions)) {
      throw new Error('Gemini response did not contain an array of questions.');
    }

    return res.json({ questions: parsedData.questions });

  } catch (error) {
    console.error('Error generating questions:', error);
    return res.status(500).json({ 
      error: `Failed to generate interview questions: ${error.message || 'Internal API error.'}` 
    });
  }
});

// Endpoint to evaluate candidate's answer using Google Gemini API
app.post('/api/evaluate-answer', async (req, res) => {
  const { question, answer, resumeText } = req.body;

  // Validate request body
  if (!question || typeof question !== 'string' || question.trim() === '') {
    return res.status(400).json({ error: 'Missing or invalid question.' });
  }
  if (!answer || typeof answer !== 'string' || answer.trim() === '') {
    return res.status(400).json({ error: 'Missing or invalid answer.' });
  }
  
  // Use optional resume text for context
  const contextResumeText = resumeText && typeof resumeText === 'string' ? resumeText.trim() : 'No resume provided.';

  // Validate API key configuration
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your-api-key-here' || process.env.GEMINI_API_KEY.trim() === '') {
    return res.status(500).json({ 
      error: 'Gemini API key is not configured. Please add GEMINI_API_KEY to your .env file.' 
    });
  }

  try {
    const prompt = `You are an expert technical interviewer and performance coach.
Evaluate the candidate's answer to the following question. Use their resume text for additional context regarding their background.

Resume Context:
---
${contextResumeText}
---

Interview Question:
"${question}"

Candidate's Answer:
"${answer}"

Requirements:
Evaluate the answer and respond with a valid JSON object matching the schema below.
1. Provide a performance score between 0 and 100 representing the accuracy, technical depth, and overall quality of the response.
2. Provide a list of key strengths in the answer.
3. Provide a list of weaknesses or areas where detail was lacking.
4. Provide a list of actionable suggestions for improvement.
5. Provide a brief summary feedback statement.

Required JSON format:
{
  "score": 85,
  "strengths": [
    "strength 1",
    "strength 2"
  ],
  "weaknesses": [
    "weakness 1"
  ],
  "suggestions": [
    "suggestion 1"
  ],
  "feedback": "Overall summary of the candidate's performance."
}`;

    let responseText;
    try {
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: 'application/json' }
      });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      responseText = response.text();
    } catch (error) {
      if (error.message && (error.message.includes('404') || error.message.includes('not found') || error.message.includes('supported'))) {
        console.log('gemini-1.5-flash not supported or found. Falling back to gemini-2.5-flash...');
        const fallbackModel = genAI.getGenerativeModel({ 
          model: 'gemini-2.5-flash',
          generationConfig: { responseMimeType: 'application/json' }
        });
        const result = await fallbackModel.generateContent(prompt);
        const response = await result.response;
        responseText = response.text();
      } else {
        throw error;
      }
    }

    const parsedData = JSON.parse(responseText.trim());

    // Format final structure with default fallbacks
    const evaluation = {
      score: typeof parsedData.score === 'number' ? parsedData.score : 0,
      strengths: Array.isArray(parsedData.strengths) ? parsedData.strengths : [],
      weaknesses: Array.isArray(parsedData.weaknesses) ? parsedData.weaknesses : [],
      suggestions: Array.isArray(parsedData.suggestions) ? parsedData.suggestions : [],
      feedback: typeof parsedData.feedback === 'string' ? parsedData.feedback : 'No feedback summary provided.'
    };

    return res.json(evaluation);

  } catch (error) {
    console.error('Error evaluating answer:', error);
    return res.status(500).json({ 
      error: `Failed to evaluate answer: ${error.message || 'Internal API error.'}` 
    });
  }
});

// Root endpoint for health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'AI Interview Simulator Resume Parser' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
