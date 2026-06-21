import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log('=== RUNNING API PARSING TESTS ===\n');

  // Helper function to send file to the endpoint
  async function testUpload(fileName, mimeType) {
    console.log(`Testing upload of ${fileName} (${mimeType})...`);
    
    try {
      const filePath = path.join(fileName);
      const fileBuffer = fs.readFileSync(filePath);
      
      const formData = new FormData();
      // Create a Blob from the file buffer and append it to the FormData object
      const blob = new Blob([fileBuffer], { type: mimeType });
      formData.append('resume', blob, fileName);

      const response = await fetch('http://localhost:5000/api/parse-resume', {
        method: 'POST',
        body: formData
      });

      console.log(`Response Status: ${response.status} ${response.statusText}`);
      const data = await response.json();
      
      if (response.ok) {
        console.log(`SUCCESS! Extracted Text Length: ${data.resumeText ? data.resumeText.length : 0} characters`);
        console.log('Sample text:', JSON.stringify((data.resumeText || '').substring(0, 150)) + '...');
      } else {
        console.log(`EXPECTED FAILURE/ERROR! Info:`, JSON.stringify(data));
      }
    } catch (err) {
      console.error(`ERROR in request for ${fileName}:`, err.message);
    }
    console.log('-'.repeat(50));
  }

  // 1. Test PDF upload (Expected: Success)
  await testUpload('test.pdf', 'application/pdf');

  // 2. Test DOCX upload (Expected: Success)
  await testUpload('test.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

  // 3. Test unsupported file upload (Expected: 400 Bad Request)
  await testUpload('test.txt', 'text/plain');

  // 4. Test missing file upload (Expected: 400 Bad Request)
  console.log('Testing upload with missing file...');
  try {
    const response = await fetch('http://localhost:5000/api/parse-resume', {
      method: 'POST'
    });
    console.log(`Response Status: ${response.status} ${response.statusText}`);
    const data = await response.json();
    console.log(`Result:`, JSON.stringify(data));
  } catch (err) {
    console.error('ERROR:', err.message);
  }
  console.log('-'.repeat(50));
}

runTests().catch(console.error);
