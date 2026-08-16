import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Stack-based parser matching Python's logic
function parseLine(text) {
  const rstripped = text.replace(/[\r\n]+$/, '');
  if (!rstripped.trim()) return null;
  
  const lstripped = rstripped.trimStart();
  if (lstripped.length === 0 || /^[\s│─├└]+$/.test(rstripped)) {
    return null;
  }
  
  const match = rstripped.match(/^([ │]*)?([├└]──\s*)?(.*)$/);
  if (!match) return null;
  
  const prefix = match[1] || '';
  const marker = match[2] || '';
  const label = match[3].trim();
  
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
    
    const isHeader = parsed.type === "header";
    if (isHeader) {
      while (stack.length > 0 && stack[stack.length - 1].col >= parsed.col) {
        stack.pop();
      }
    } else {
      while (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top.isHeader) break;
        if (top.col >= parsed.col) {
          stack.pop();
        } else {
          break;
        }
      }
    }
    
    const parentNode = stack[stack.length - 1].node;
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

const fileContent = fs.readFileSync(path.join(__dirname, "../docs/reference-data/Master Syllabus.txt"), "utf8");
const rawTree = buildTree(fileContent.split('\n'));

function findNodeByName(node, targetName) {
  if (node.name.toLowerCase() === targetName.toLowerCase()) {
    return node;
  }
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeByName(child, targetName);
      if (found) return found;
    }
  }
  return null;
}

rawTree.children = rawTree.children.filter(c => c.name !== "SSC + Railway Master Syllabus");

const physicsNode = findNodeByName(rawTree, "physics");
console.log("physicsNode found:", physicsNode);
console.log("BEFORE GROUPING:");
console.log(`Physics children count: ${physicsNode?.children?.length}`);
if (physicsNode && physicsNode.children) {
  physicsNode.children.forEach(c => console.log(`- ${c.name} (${c.children.length} children)`));
}

// Grouping
let currentPhysicsUnit = null;
const childrenToKeep = [];

console.log("\nRAW TREE CHILDREN NAMES:");
rawTree.children.forEach(c => {
  const nameLower = c.name.toLowerCase();
  const matchesUnit = nameLower.startsWith("unit ") && !nameLower.includes("chemistry") && !nameLower.includes("biology");
  const matchesChapter = nameLower.startsWith("chapter ") && currentPhysicsUnit;
  console.log(`- "${c.name}" -> matchesUnit: ${matchesUnit}, matchesChapter: ${matchesChapter}`);
  
  if (matchesUnit) {
    currentPhysicsUnit = c;
    physicsNode.children.push(c);
  } else if (matchesChapter) {
    currentPhysicsUnit.children.push(c);
  } else {
    childrenToKeep.push(c);
  }
});

console.log("\nAFTER GROUPING:");
console.log(`Physics children count: ${physicsNode?.children?.length}`);
if (physicsNode && physicsNode.children) {
  physicsNode.children.forEach(c => {
    console.log(`- ${c.name} (${c.children.length} children)`);
  });
}
