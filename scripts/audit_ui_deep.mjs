import fs from "fs";
import path from "path";

function getFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  fs.readdirSync(dir).forEach(file => {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) results.push(...getFiles(full));
    else if (full.endsWith(".jsx")) results.push(full);
  });
  return results;
}

const files = [...getFiles("apps/frontend/src"), ...getFiles("apps/admin-panel/src")];
const infiniteSpinnerIssues = [];
const missingToastMutations = [];
const dummyButtonsOrInputs = [];

files.forEach(f => {
  const content = fs.readFileSync(f, "utf8");
  const lines = content.split("\n");

  lines.forEach((line, i) => {
    // 1. Infinite spinner detection
    if (line.includes("setLoading(true)") || line.includes("setSubmitting(true)") || line.includes("setIsSaving(true)") || line.includes("setSaving(true)")) {
      const block = lines.slice(i, Math.min(lines.length, i + 80)).join("\n");
      const hasCatch = block.includes("catch");
      const hasFinally = block.includes("finally");
      const resets = block.includes("Loading(false)") || block.includes("Submitting(false)") || block.includes("Saving(false)");
      if (hasCatch && !hasFinally && !resets) {
        infiniteSpinnerIssues.push({ file: f, line: i + 1, code: line.trim() });
      }
    }

    // 2. Swallowed errors in catch without toast/error state
    if (line.trim().startsWith("catch") || (line.includes("catch (") && line.includes("{"))) {
      const catchBlock = lines.slice(i, Math.min(lines.length, i + 15)).join("\n");
      // If catch block only has console.log or logger.error or nothing
      const hasToast = catchBlock.includes("toast.") || catchBlock.includes("setError") || catchBlock.includes("setErr") || catchBlock.includes("alert(");
      const isConsoleOnly = (catchBlock.includes("console.error") || catchBlock.includes("logger.error")) && !hasToast;
      const isMutation = lines.slice(Math.max(0, i - 25), i).some(l => l.includes(".post(") || l.includes(".put(") || l.includes(".delete(") || l.includes(".patch("));
      if (isConsoleOnly && isMutation) {
        missingToastMutations.push({ file: f, line: i + 1 });
      }
    }

    // 3. Inputs without onChange or readOnly/disabled
    if (line.includes("<input") || line.includes("<textarea")) {
      const tagBlock = lines.slice(i, Math.min(lines.length, i + 12)).join("\n");
      if (tagBlock.includes("value=") && !tagBlock.includes("onChange") && !tagBlock.includes("readOnly") && !tagBlock.includes("disabled") && !tagBlock.includes("defaultValue")) {
        dummyButtonsOrInputs.push({ file: f, line: i + 1, type: "unbound_input" });
      }
    }
  });
});

console.log("=== POTENTIAL INFINITE SPINNERS ===");
console.log(JSON.stringify(infiniteSpinnerIssues, null, 2));

console.log("=== MUTATIONS WITH SWALLOWED ERRORS (NO TOAST/ERROR STATE) ===");
console.log(JSON.stringify(missingToastMutations.slice(0, 30), null, 2));

console.log("=== INPUTS WITH VALUE BUT NO ONCHANGE ===");
console.log(JSON.stringify(dummyButtonsOrInputs, null, 2));
