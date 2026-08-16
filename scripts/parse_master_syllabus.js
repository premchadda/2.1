import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fileContent = fs.readFileSync(path.join(__dirname, "../docs/reference-data/Master Syllabus.txt"), "utf8");

function parseLine(text) {
  const rstripped = text.replace(/[\r\n]+$/, '');
  if (!rstripped.trim()) return null;
  
  // check connector-only line
  const lstripped = rstripped.trimStart();
  if (lstripped.length === 0 || /^[\s│─├└]+$/.test(rstripped)) {
    return null;
  }
  
  // Find indentation level based on connector structures
  const match = rstripped.match(/^([ │]*)?([├└]──\s*)?(.*)$/);
  if (!match) return null;
  
  const prefix = match[1] || '';
  const marker = match[2] || '';
  const label = match[3].trim();
  
  // The depth is determined by the length of the prefix (each indent is typically 4 spaces/chars)
  // Let's compute col position of the label or the branch marker
  const col = prefix.length;
  const isMarker = marker.length > 0;
  
  return {
    type: isMarker ? "marker" : "header",
    col,
    name: label
  };
}

function buildTree(lines) {
  const root = { name: "Root", children: [] };
  const stack = [{ col: -1000000000, isHeader: false, node: root }];
  
  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    
    // Find parent in the stack using header/marker rules
    const isHeader = parsed.type === "header";
    if (isHeader) {
      while (stack.length > 0 && stack[stack.length - 1].col >= parsed.col) {
        stack.pop();
      }
    } else {
      // marker: never pop header nodes; pop non-headers while col >= current
      while (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top.isHeader) {
          break;
        }
        if (top.col >= parsed.col) {
          stack.pop();
        } else {
          break;
        }
      }
    }
    
    const parentNode = stack[stack.length - 1].node;
    
    // Merge duplicates under the same parent
    let node = parentNode.children.find(c => c.name === parsed.name);
    if (!node) {
      node = { name: parsed.name, children: [] };
      parentNode.children.push(node);
    }
    
    stack.push({
      col: parsed.col,
      isHeader,
      node
    });
  }
  
  return root;
}

const lines = fileContent.split('\n');
const tree = buildTree(lines);

// Write to a temporary JSON file to inspect
fs.writeFileSync(path.join(__dirname, "parsed_syllabus_tree.json"), JSON.stringify(tree, null, 2));

console.log("Parsed syllabus tree saved.");
// Print top level children
console.log("Top-level elements:");
tree.children.forEach(c => {
  console.log(`- ${c.name} (${c.children.length} children)`);
});
