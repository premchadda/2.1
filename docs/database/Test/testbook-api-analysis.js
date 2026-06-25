// Testbook API Analysis Script
// This script fetches all test types from the SSC CGL test series page

const https = require('https');
const http = require('http');
const { URL } = require('url');

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

async function analyzeTestbookAPI() {
  console.log('=== Testbook API Analysis for SSC CGL Test Series ===\n');
  
  try {
    // Step 1: Fetch test series details using the slug API (user's first example URL)
    console.log('1. Fetching test series details from slug API...');
    // This is the projection URL from user's example
    const projection = encodeURIComponent(JSON.stringify({
      "details": {
        "id": 1, "name": 1, "description": 1,
        "features": {"title": 1, "subtitle": 1, "iconUrl": 1, "clientToShow": 1},
        "icon": 1, "colourHex": 1, "showSyllabus": 1, "faqs": 1, "menus": 1, "updatedOn": 1,
        "seo": {"ogProperties": 1, "isHindiPresent": 1, "metaTitle": 1, "metaDescription": 1, "metaKeywords": 1},
        "sections": {
          "id": 1, "name": 1, "shortName": 1,
          "subsections": {"id": 1, "name": 1, "paidTestCount": 1, "freeTestCount": 1, "order": 1},
          "paidTestCount": 1, "freeTestCount": 1, "order": 1, "isPro": 1, "superSectionId": 1
        },
        "branches": {"label": 1, "values": {"id": 1, "name": 1}},
        "paidTestCount": 1, "freeTestCount": 1, "canPurchaseThrough": 1, "slug": 1, "slugUrl": 1,
        "isFree": 1, "totalAttempts": 1,
        "target": {"_id": 1, "title": 1, "isPrimary": 1, "slug": 1},
        "targetGroup": {"_id": 1, "title": 1, "isPrimary": 1, "slug": 1},
        "targetSuperGroup": {"_id": 1, "title": 1, "isPrimary": 1, "slug": 1},
        "languages": 1
      }
    }));
    
    const slugUrl = `https://api.testbook.com/api/v1/test-series/slug?__projection=${projection}&url=ssc-cgl-previous&branchId=&language=English`;
    console.log('URL:', slugUrl.substring(0, 100) + '...');
    const slugResult = await fetch(slugUrl);
    console.log('Status:', slugResult.status);
    const slugData = slugResult.data;
    
    // Debug: log the raw response structure
    console.log('\n--- Raw Response Keys ---');
    console.log('Keys:', Object.keys(slugData));
    if (slugData.data) {
      console.log('slugData.data keys:', Object.keys(slugData.data));
    }
    console.log('Full response (first 2000 chars):', JSON.stringify(slugData).substring(0, 2000));
    
    console.log('\n--- Test Series Details ---');
    // The data is nested under slugData.data.details
    const details = slugData.data?.details || slugData.details;
    if (details) {
      console.log('ID:', details.id);
      console.log('Name:', details.name);
      console.log('Slug:', details.slug);
      console.log('Slug URL:', details.slugUrl);
      console.log('Total Free Tests:', details.freeTestCount);
      console.log('Total Paid Tests:', details.paidTestCount);
      console.log('Is Free:', details.isFree);
      
      // Extract sections (test types)
      if (details.sections && details.sections.length > 0) {
        console.log('\n--- Test Sections (Types) ---');
        details.sections.forEach((section, idx) => {
          console.log(`\n[Section ${idx + 1}]`);
          console.log('  ID:', section.id);
          console.log('  Name:', section.name);
          console.log('  Short Name:', section.shortName);
          console.log('  Free Tests:', section.freeTestCount);
          console.log('  Paid Tests:', section.paidTestCount);
          console.log('  Order:', section.order);
          console.log('  Is Pro:', section.isPro);
          console.log('  Super Section ID:', section.superSectionId);
          
          if (section.subsections && section.subsections.length > 0) {
            console.log('  Subsections:');
            section.subsections.forEach((sub, subIdx) => {
              console.log(`    [${subIdx + 1}] ${sub.name} (ID: ${sub.id})`);
              console.log(`        Free: ${sub.freeTestCount}, Paid: ${sub.paidTestCount}`);
            });
          }
        });
      }
      
      // Extract super sections
      if (details.superSections && details.superSections.length > 0) {
        console.log('\n--- Super Sections ---');
        details.superSections.forEach((ss, idx) => {
          console.log(`[${idx + 1}] ${ss.name} (ID: ${ss.id}, Is Pro: ${ss.isPro})`);
        });
      }
      
      // Extract branches
      if (details.branches && details.branches.length > 0) {
        console.log('\n--- Branches ---');
        details.branches.forEach((branch, idx) => {
          console.log(`[${idx + 1}] ${branch.label}`);
          if (branch.values) {
            branch.values.forEach(v => {
              console.log(`    - ${v.name} (ID: ${v.id})`);
            });
          }
        });
      }
      
      // Step 2: Fetch sample tests from a few sections using the v2 API
      console.log('\n\n2. Fetching sample tests from sections...');
      const testSeriesId = details.id;
      
      // Test types to fetch
      const testTypes = ['free', 'paid', 'all'];
      const limit = 5;
      
      // Only fetch from first 3 sections as samples
      const sampleSections = (details.sections || []).slice(0, 3);
      
      for (const section of sampleSections) {
        console.log(`\n=== Sample Tests for Section: ${section.name} ===`);
        
        for (const testType of testTypes) {
          const testsUrl = `https://api.testbook.com/api/v2/test-series/${testSeriesId}/tests/details?testType=${testType}&sectionId=${section.id}&subSectionId=&skip=0&limit=${limit}&branchId=&language=English`;
          
          try {
            const testsResult = await fetch(testsUrl);
            const testsData = testsResult.data;
            if (testsData.tests && testsData.tests.length > 0) {
              console.log(`\n  ${testType.toUpperCase()} Tests (${testsData.tests.length} of ${testsData.total || 'unknown'}):`);
              testsData.tests.forEach((test, idx) => {
                console.log(`    [${idx + 1}] ${test.title}`);
                console.log(`        ID: ${test.id}`);
                console.log(`        Questions: ${test.questionCount}, Marks: ${test.totalMark}, Duration: ${test.duration} mins`);
                console.log(`        Is Free: ${test.isFree}, Is Live: ${test.isLive}`);
              });
              break;
            }
          } catch (e) {
            console.log(`  Error fetching ${testType} tests:`, e.message);
          }
        }
      }
    }
    
    // Summary with all test types found
    console.log('\n\n' + '='.repeat(80));
    console.log('=== COMPLETE SUMMARY OF ALL TEST TYPES FROM TESTBOOK SSC CGL ===');
    console.log('='.repeat(80));
    
    if (details && details.sections) {
      console.log(`\n📊 Test Series: ${details.name}`);
      console.log(`🆔 Series ID: ${details.id}`);
      console.log(`📝 Total Paid Tests: ${details.paidTestCount}`);
      console.log(`🆓 Total Free Tests: ${details.freeTestCount}`);
      
      console.log('\n\n📋 ALL TEST TYPES (SECTIONS):');
      console.log('-'.repeat(80));
      
      // Group sections by super section
      const groupedSections = {};
      details.sections.forEach(section => {
        const key = section.isPro ? 'PYP (Previous Year Papers)' : 'Mock & Practice Tests';
        if (!groupedSections[key]) groupedSections[key] = [];
        groupedSections[key].push(section);
      });
      
      Object.entries(groupedSections).forEach(([group, sections]) => {
        console.log(`\n🔷 ${group.toUpperCase()}`);
        console.log('-'.repeat(60));
        
        sections.forEach((section, idx) => {
          console.log(`\n  ${idx + 1}. ${section.name}`);
          console.log(`     Short Name: ${section.shortName || 'N/A'}`);
          console.log(`     Section ID: ${section.id}`);
          console.log(`     Free Tests: ${section.freeTestCount} | Paid Tests: ${section.paidTestCount}`);
          console.log(`     Is Pro: ${section.isPro ? '✅ Yes' : '❌ No'}`);
          
          if (section.subsections && section.subsections.length > 0) {
            console.log(`     Subsections (${section.subsections.length}):`);
            section.subsections.forEach((sub, subIdx) => {
              console.log(`       ${subIdx + 1}. ${sub.name}`);
              console.log(`          ID: ${sub.id} | Free: ${sub.freeTestCount} | Paid: ${sub.paidTestCount}`);
            });
          }
        });
      });
      
      // Summary statistics
      console.log('\n\n📈 TEST TYPE STATISTICS:');
      console.log('-'.repeat(60));
      const testTypeStats = {
        totalSections: details.sections.length,
        totalSubsections: 0,
        proSections: 0,
        mockTestSections: 0,
        totalTests: details.paidTestCount + details.freeTestCount
      };
      
      details.sections.forEach(section => {
        testTypeStats.totalSubsections += (section.subsections || []).length;
        if (section.isPro) testTypeStats.proSections++;
        else testTypeStats.mockTestSections++;
      });
      
      console.log(`  Total Sections: ${testTypeStats.totalSections}`);
      console.log(`  Total Subsections: ${testTypeStats.totalSubsections}`);
      console.log(`  Pro Sections (PYP): ${testTypeStats.proSections}`);
      console.log(`  Mock/Practice Sections: ${testTypeStats.mockTestSections}`);
      console.log(`  Total Tests: ${testTypeStats.totalTests}`);
      
      // List unique test categories
      console.log('\n\n🏷️ UNIQUE TEST CATEGORIES FOUND:');
      console.log('-'.repeat(60));
      const categories = new Set();
      details.sections.forEach(section => {
        // Extract category from section name
        const name = section.name;
        if (name.includes('Full Test')) categories.add('Full Test');
        if (name.includes('Sectional Test')) categories.add('Sectional Test');
        if (name.includes('Chapter Test')) categories.add('Chapter Test');
        if (name.includes('Module Test')) categories.add('Module Test');
        if (name.includes('PYP') || name.includes('PYQ')) categories.add('Previous Year Papers (PYP/PYQ)');
        if (name.includes('Advanced Test')) categories.add('Advanced Test');
        if (name.includes('Live Test')) categories.add('Live Test');
        if (name.includes('Marathon')) categories.add('Marathon Test');
        if (name.includes('Current Affairs')) categories.add('Current Affairs');
        if (name.includes('AI-Generated')) categories.add('AI-Generated Test');
        if (name.includes('Most Saved')) categories.add('Most Saved Questions');
        if (name.includes('Most Difficult')) categories.add('Most Difficult Questions');
        if (name.includes('Bouncer')) categories.add('Bouncer Test');
        if (name.includes('Similar PYP')) categories.add('Similar PYP');
      });
      
      Array.from(categories).forEach((cat, idx) => {
        console.log(`  ${idx + 1}. ${cat}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

analyzeTestbookAPI();