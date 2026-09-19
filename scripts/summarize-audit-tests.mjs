import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const auditData = JSON.parse(fs.readFileSync(path.join(__dirname, "audit-results.json"), "utf-8"));

console.log("=== AUDIT SUMMARY ===");
console.log(auditData.counts);

// Group misclassified questions by test_id
const testCounts = {};
function record(list, type) {
  for (const item of list) {
    const tid = item.test_id || "no_test";
    if (!testCounts[tid]) testCounts[tid] = { total: 0, types: {} };
    testCounts[tid].total++;
    testCounts[tid].types[type] = (testCounts[tid].types[type] || 0) + 1;
  }
}

record(auditData.gsWithReasoningSample, "gsWithReasoning");
record(auditData.gsWithEnglishSample, "gsWithEnglish");
record(auditData.gsWithQuantSample, "gsWithQuant");
record(auditData.quantWithReasoningSample, "quantWithReasoning");

console.log("\nTop affected tests in sample:");
const sortedTests = Object.entries(testCounts).sort((a, b) => b[1].total - a[1].total);
console.log(sortedTests.slice(0, 15));
