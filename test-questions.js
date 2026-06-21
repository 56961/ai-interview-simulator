import fs from 'fs';
import dotenv from 'dotenv';

// Load env variables locally to help describe status
dotenv.config();

async function runQuestionsTest() {
  console.log('=== RUNNING INTERVIEW QUESTIONS GENERATOR TEST ===\n');

  // Step 1: Parse the resume first
  console.log('Step 1: Extracting resumeText from test.pdf...');
  let resumeText = '';
  try {
    const fileBuffer = fs.readFileSync('test.pdf');
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    formData.append('resume', blob, 'test.pdf');

    const parseResponse = await fetch('http://localhost:5000/api/parse-resume', {
      method: 'POST',
      body: formData
    });

    if (!parseResponse.ok) {
      const errorData = await parseResponse.json();
      throw new Error(`Parse failed: ${JSON.stringify(errorData)}`);
    }

    const parseResult = await parseResponse.json();
    resumeText = parseResult.resumeText;
    console.log(`Resume parsed successfully. Length: ${resumeText.length} characters.\n`);
  } catch (err) {
    console.error('Failed to parse resume:', err.message);
    process.exit(1);
  }

  // Step 2: Request interview questions
  const testCategory = 'Frontend Developer';
  console.log(`Step 2: Sending resumeText to /api/generate-questions with category "${testCategory}"...`);
  
  try {
    const questionsResponse = await fetch('http://localhost:5000/api/generate-questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        resumeText: resumeText,
        category: testCategory
      })
    });

    console.log(`Response Status: ${questionsResponse.status} ${questionsResponse.statusText}`);
    const data = await questionsResponse.json();

    if (questionsResponse.ok) {
      console.log('\nSUCCESS! Generated Questions:');
      data.questions.forEach((q, idx) => {
        console.log(`${idx + 1}. ${q}`);
      });
    } else {
      console.log('\nFAILED/EXPECTED ERROR:');
      console.log(JSON.stringify(data, null, 2));
      if (data.error && data.error.includes('API key')) {
        console.log('\nNOTE: This is expected because you must set a valid GEMINI_API_KEY in backend/.env.');
      }
    }
  } catch (err) {
    console.error('Error in request:', err.message);
  }
  
  console.log('\n' + '='.repeat(60));
}

runQuestionsTest().catch(console.error);
