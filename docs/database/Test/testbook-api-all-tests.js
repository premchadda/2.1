// Testbook API - Fetch All Tests with Details
// This script fetches ALL tests from all sections

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');

// Helper function to make HTTP requests with proper headers
function fetch(urlString) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlString);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://testbook.com',
        'Referer': 'https://testbook.com/',
        'tb-client-id': 'web',
      }
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

// Sleep function to avoid rate limiting
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAllTests() {
  console.log('=== Fetching All Tests from Testbook SSC CGL Test Series ===\n');
  
  const allTests = [];
  
  try {
    // Step 1: Fetch test series details
    console.log('1. Fetching test series details...');
    const projection = encodeURIComponent(JSON.stringify({
      "details": {
        "id": 1, "name": 1, "description": 1,
        "sections": {
          "id": 1, "name": 1, "shortName": 1,
          "subsections": {"id": 1, "name": 1, "paidTestCount": 1, "freeTestCount": 1, "order": 1},
          "paidTestCount": 1, "freeTestCount": 1, "order": 1, "isPro": 1, "superSectionId": 1
        },
        "paidTestCount": 1, "freeTestCount": 1, "slug": 1
      }
    }));
    
    const slugUrl = `https://api.testbook.com/api/v1/test-series/slug?__projection=${projection}&url=ssc-cgl-previous&branchId=&language=English`;
    const slugResult = await fetch(slugUrl);
    const slugData = slugResult.data;
    const details = slugData.data?.details || slugData.details;
    
    if (!details) {
      console.log('Failed to fetch test series details');
      return;
    }
    
    console.log(`Test Series: ${details.name}`);
    console.log(`Total Tests: ${details.paidTestCount + details.freeTestCount}`);
    console.log(`Total Sections: ${details.sections?.length || 0}\n`);
    
    const testSeriesId = details.id;
    
    // Step 2: Fetch tests from each section and subsection
    console.log('2. Fetching tests from all sections...');
    
    for (const section of (details.sections || [])) {
      console.log(`\n--- Section: ${section.name} ---`);
      
      // Fetch tests for the section (without subsection filter)
      const sectionTests = await fetchTestsFromSection(
        testSeriesId, 
        section.id, 
        null, 
        section.name
      );
      allTests.push(...sectionTests);
      
      // Fetch tests from each subsection
      if (section.subsections && section.subsections.length > 0) {
        for (const subsection of section.subsections) {
          console.log(`  Fetching from subsection: ${subsection.name}`);
          const subsecTests = await fetchTestsFromSection(
            testSeriesId, 
            section.id, 
            subsection.id, 
            section.name,
            subsection.name
          );
          allTests.push(...subsecTests);
          await sleep(100); // Small delay to avoid rate limiting
        }
      }
      
      await sleep(200); // Small delay between sections
    }
    
    // Step 3: Remove duplicates (same test might appear in section and subsection queries)
    console.log('\n\n3. Removing duplicate tests...');
    const uniqueTests = [];
    const seenIds = new Set();
    
    for (const test of allTests) {
      if (!seenIds.has(test.id)) {
        seenIds.add(test.id);
        uniqueTests.push(test);
      }
    }
    
    console.log(`Total tests fetched: ${allTests.length}`);
    console.log(`Unique tests: ${uniqueTests.length}`);
    
    // Step 4: Save to JSON file
    const outputData = {
      testSeries: {
        id: testSeriesId,
        name: details.name,
        slug: details.slug,
        totalTests: uniqueTests.length
      },
      sections: details.sections,
      tests: uniqueTests
    };
    
    fs.writeFileSync(
      'testbook-all-tests.json', 
      JSON.stringify(outputData, null, 2)
    );
    console.log('\n4. Saved all tests to: testbook-all-tests.json');
    
    // Step 5: Generate summary
    console.log('\n' + '='.repeat(80));
    console.log('=== SUMMARY ===');
    console.log('='.repeat(80));
    
    // Group by section
    const testsBySection = {};
    uniqueTests.forEach(test => {
      const section = test.sectionName || 'Unknown';
      if (!testsBySection[section]) testsBySection[section] = [];
      testsBySection[section].push(test);
    });
    
    console.log('\nTests by Section:');
    Object.entries(testsBySection)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([section, tests]) => {
        console.log(`  ${section}: ${tests.length} tests`);
      });
    
    // Print first 20 tests as sample
    console.log('\n\nSample Tests (first 20):');
    console.log('-'.repeat(80));
    uniqueTests.slice(0, 20).forEach((test, idx) => {
      console.log(`\n${idx + 1}. ${test.title}`);
      console.log(`   Section: ${test.sectionName}`);
      console.log(`   Subsection: ${test.subsectionName || 'N/A'}`);
      console.log(`   ID: ${test.id}`);
      console.log(`   Questions: ${test.questionCount} | Marks: ${test.totalMark} | Duration: ${test.duration} mins`);
      console.log(`   Free: ${test.isFree ? 'Yes' : 'No'} | Live: ${test.isLive ? 'Yes' : 'No'}`);
      console.log(`   Attempts: ${test.totalAttempts || 'N/A'}`);
    });
    
    console.log(`\n\n... and ${uniqueTests.length - 20} more tests`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function fetchTestsFromSection(testSeriesId, sectionId, subsectionId, sectionName, subsectionName = null) {
  const tests = [];
  const testTypes = ['free', 'paid', 'all'];
  const limit = 50;
  let skip = 0;
  let hasMore = true;
  
  for (const testType of testTypes) {
    skip = 0;
    hasMore = true;
    
    while (hasMore) {
      // Use the exact projection from user's example
      const testProjection = encodeURIComponent(JSON.stringify({
        "tests": {
          "id": 1, "title": 1, "description": 1, "isLive": 1, "availFrom": 1, "availTill": 1,
          "startTime": 1, "endTime": 1, "languages": 1, "pdfLanguages": 1, "questionCount": 1,
          "totalMark": 1, "duration": 1, "totalAttempts": 1, "isFree": 1, "isSolutionPresent": 1,
          "hideMarks": 1, "hasTypingQuestions": 1, "hasDescriptiveQuestions": 1, "hasAccess": 1,
          "target": 1, "testUrl": 1, "primaryTarget": 1, "analysisUrl": 1, "solutionsUrl": 1,
          "statusUrl": 1, "progress": 1, "isPdfAvailable": 1, "isTestAvailable": 1, "isQuiz": 1,
          "pdf": 1, "pdfId": 1, "cutOffs": 1, "isAnalysisGenerated": 1, "analysisAfter": 1,
          "hasSkippableSections": 1, "labelTags": 1, "specificExams": 1
        }
      }));
      
      const testsUrl = `https://api.testbook.com/api/v2/test-series/${testSeriesId}/tests/details?__projection=${testProjection}&testType=${testType}&sectionId=${sectionId}&subSectionId=${subsectionId || ''}&skip=${skip}&limit=${limit}&branchId=&language=English`;
      
      try {
        const result = await fetch(testsUrl);
        const data = result.data;
        
        // Debug: Log structure for first call
        if (skip === 0 && testType === 'free') {
          console.log(`    API Response keys: ${Object.keys(data).join(', ')}`);
          if (data.data) {
            console.log(`    data.data keys: ${Object.keys(data.data).join(', ')}`);
          }
        }
        
        // Handle nested data structure: data.data.tests
        const testData = data.data?.tests || data.tests || [];
        
        if (testData && testData.length > 0) {
          testData.forEach(test => {
            tests.push({
              id: test.id,
              title: test.title,
              description: test.description,
              sectionId: sectionId,
              sectionName: sectionName,
              subsectionId: subsectionId,
              subsectionName: subsectionName,
              questionCount: test.questionCount,
              totalMark: test.totalMark,
              duration: test.duration,
              isFree: test.isFree,
              isLive: test.isLive,
              totalAttempts: test.totalAttempts,
              languages: test.languages,
              availFrom: test.availFrom,
              availTill: test.availTill,
              isPdfAvailable: test.isPdfAvailable,
              testUrl: test.testUrl
            });
          });
          
          if (testData.length < limit) {
            hasMore = false;
          } else {
            skip += limit;
          }
        } else {
          hasMore = false;
        }
      } catch (e) {
        console.log(`    Error: ${e.message}`);
        hasMore = false;
      }
      
      // If we found tests with this testType, no need to try others
      if (tests.length > 0 && skip === 0 && hasMore === false) {
        break;
      }
    }
    
    if (tests.length > 0) {
      break; // Found tests, no need to try other test types
    }
  }
  
  return tests;
}

fetchAllTests();