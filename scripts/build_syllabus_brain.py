import re
import json
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(SCRIPT_DIR, "..", "docs", "reference-data", "Master Syllabus.txt")
OUT = os.path.join(SCRIPT_DIR, "..", "docs", "visuals", "syllabus-brain.html")

BOX = "─│├└┐┘┌┤┬┴┼"

def parse_line(text):
    text = text.rstrip("\n")
    if not text.strip():
        return None
    # connector-only line (only spaces, pipes, box dashes)
    stripped = text.lstrip(" " + "│" + "─")
    if not stripped or all(c in "─│" for c in stripped):
        return None
    has_marker = bool(re.search(r"[├└]", text))
    if has_marker:
        m = re.search(r"[├└]", text)
        col = m.start()
        label = re.sub(r"^[ │]*[├└]──\s*", "", text).strip()
        if not label:
            return None
        return ("marker", col, label)
    else:
        m = re.search(r"[^\s│─]", text)
        if not m:
            return None
        col = m.start()
        label = text[col:].strip()
        if not label:
            return None
        return ("header", col, label)

def build_tree(lines):
    root = None
    stack = []  # (col, is_header, node)
    for raw in lines:
        parsed = parse_line(raw)
        if not parsed:
            continue
        kind, col, label = parsed
        if root is None:
            # first content line = absolute root
            root = {"name": label, "children": []}
            stack.append((-10**9, False, root))
            continue
        # find parent
        if kind == "header":
            while stack and stack[-1][0] >= col:
                stack.pop()
            parent = stack[-1][2]
        else:
            # marker: never pop header nodes; pop non-headers while col >= current
            while stack:
                top = stack[-1]
                if top[1]:  # header -> keep as parent
                    break
                if top[0] >= col:
                    stack.pop()
                else:
                    break
            parent = stack[-1][2]
        # merge with existing same-named child of parent
        existing = None
        for c in parent["children"]:
            if c["name"] == label:
                existing = c
                break
        if existing:
            node = existing
        else:
            node = {"name": label, "children": []}
            parent["children"].append(node)
        stack.append((col, kind == "header", node))
    return root

def count_nodes(node):
    return 1 + sum(count_nodes(c) for c in node.get("children", []))

def main():
    with open(SRC, encoding="utf-8") as f:
        lines = f.readlines()
    tree = build_tree(lines)
    n = count_nodes(tree)
    print(f"Parsed {n} nodes; top-level branches: {len(tree['children'])}")
    html = HTML_TEMPLATE.replace("/*TREE_JSON*/", json.dumps(tree, ensure_ascii=False))
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Wrote {OUT}")

HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SSC + Railway Master Syllabus — Mind Map</title>
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
<style>
  :root { --bg:#0f1220; --panel:#171b2e; --ink:#e8ebf7; --muted:#9aa3c7; }
  * { box-sizing: border-box; }
  html,body { margin:0; height:100%; font-family: "Segoe UI", system-ui, sans-serif; background:var(--bg); color:var(--ink); }
  header { padding:10px 16px; display:flex; gap:12px; align-items:center; background:var(--panel); border-bottom:1px solid #262b45; flex-wrap:wrap; }
  header h1 { font-size:16px; margin:0; font-weight:600; }
  .hint { color:var(--muted); font-size:12px; }
  button { background:#222a47; color:var(--ink); border:1px solid #343c63; border-radius:6px; padding:5px 10px; cursor:pointer; font-size:12px; }
  button:hover { background:#2c355c; }
  #chart { width:100vw; height:calc(100vh - 52px); display:block; cursor:grab; }
  .node rect { stroke-width:1.4px; rx:4; ry:4; }
  .node text { font-size:12px; fill:var(--ink); paint-order:stroke; stroke:var(--bg); stroke-width:3px; }
  .link { fill:none; stroke:#39406b; stroke-opacity:.45; }
  .node.collapsed rect { stroke-dasharray: 3 2; }
  .search { background:#222a47; border:1px solid #343c63; border-radius:6px; padding:5px 10px; color:var(--ink); font-size:12px; }
</style>
</head>
<body>
<header>
  <h1>🧠 SSC + Railway Master Syllabus</h1>
  <span class="hint">Scroll = zoom · drag = pan · click a node = collapse/expand · double-click = focus</span>
  <input id="search" class="search" placeholder="Search topic…" size="22">
  <button id="expand">Expand all</button>
  <button id="collapse">Collapse deep</button>
  <button id="reset">Reset view</button>
</header>
<svg id="chart"></svg>
<script>
const data = /*TREE_JSON*/;

const svg = d3.select("#chart");
const g = svg.append("g");
const linkG = g.append("g");
const nodeG = g.append("g");

const zoom = d3.zoom().scaleExtent([0.05, 3]).on("zoom", (e) => g.attr("transform", e.transform));
svg.call(zoom);

const root = d3.hierarchy(data);
const dx = 26;
const dy = 240;

const tree = d3.tree().nodeSize([dx, dy]);

const palette = ["#ff6b6b","#feca57","#1dd1a1","#54a0ff","#5f27cd","#ff9ff3","#00d2d3","#ee5253","#48dbfb","#10ac84"];

root.x0 = 0;
root.y0 = 0;

// initial collapse: keep top 2 levels expanded
root.descendants().forEach(d => {
  d._initColor = palette[Math.min(d.depth, palette.length-1)];
  if (d.depth > 2 && d.children) { d._children = d.children; d.children = null; }
});

function diagonal(s, t) {
  return `M${s.y},${s.x}C${(s.y+t.y)/2},${s.x} ${(s.y+t.y)/2},${t.x} ${t.y},${t.x}`;
}

function update(source) {
  tree(root);
  const nodes = root.descendants().reverse();
  const links = root.links();

  const width = window.innerWidth;
  let x0 = Infinity, x1 = -Infinity;
  root.each(d => { if (d.x > x1) x1 = d.x; if (d.x < x0) x0 = d.x; });

  const transition = svg.transition().duration(350);

  const node = nodeG.selectAll("g.node")
    .data(nodes, d => d.id || (d.id = ++idCounter));

  const nodeEnter = node.enter().append("g")
    .attr("class", d => "node" + (d._children ? " collapsed" : ""))
    .attr("transform", `translate(${source.y0},${source.x0})`)
    .on("click", (e, d) => { toggle(d); update(d); })
    .on("dblclick", (e, d) => focus(d));

  nodeEnter.append("rect")
    .attr("x", -6).attr("y", -10)
    .attr("height", 20)
    .attr("width", d => Math.max(40, d.data.name.length * 7.0 + 14))
    .attr("rx", 4).attr("ry", 4)
    .attr("fill", d => d._initColor)
    .attr("fill-opacity", 0.16)
    .attr("stroke", d => d._initColor);

  nodeEnter.append("text")
    .attr("dy", "0.32em")
    .attr("x", d => 6)
    .attr("text-anchor", "start")
    .text(d => d.data.name)
    .clone(true).lower()
    .attr("stroke", "var(--bg)");

  const nodeUpdate = nodeEnter.merge(node);
  nodeUpdate.transition(transition)
    .attr("class", d => "node" + (d._children ? " collapsed" : ""))
    .attr("transform", d => `translate(${d.y},${d.x})`);

  const nodeExit = node.exit().transition(transition).remove()
    .attr("transform", `translate(${source.y},${source.x})`)
    .style("opacity", 0);

  const link = linkG.selectAll("path.link")
    .data(links, d => d.target.id);

  const linkEnter = link.enter().append("path")
    .attr("class", "link")
    .attr("d", () => { const o = {x: source.x0, y: source.y0}; return diagonal(o, o); });

  linkEnter.merge(link).transition(transition)
    .attr("d", d => diagonal(d.source, d.target));

  link.exit().transition(transition).remove()
    .attr("d", () => { const o = {x: source.x, y: source.y}; return diagonal(o, o); });

  root.each(d => { d.x0 = d.x; d.y0 = d.y; });
}

let idCounter = 0;
function toggle(d) {
  if (d.children) { d._children = d.children; d.children = null; }
  else if (d._children) { d.children = d._children; d._children = null; }
}
function focus(d) {
  const scale = 1.1;
  svg.transition().duration(500).call(
    zoom.transform,
    d3.zoomIdentity.translate(width/2 - d.y*scale, height/2 - d.x*scale).scale(scale)
  );
}
const width = () => window.innerWidth;
const height = () => window.innerHeight - 52;

document.getElementById("expand").onclick = () => {
  root.each(d => { if (d._children) { d.children = d._children; d._children = null; } });
  update(root);
};
document.getElementById("collapse").onclick = () => {
  root.each(d => { if (d.depth > 2 && d.children) { d._children = d.children; d.children = null; } });
  update(root);
};
document.getElementById("reset").onclick = () => {
  svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
};
document.getElementById("search").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase().trim();
  nodeG.selectAll("g.node").select("rect")
    .attr("stroke-width", d => (!q ? 1.4 : (d.data.name.toLowerCase().includes(q) ? 3 : 1.4))
    .attr("stroke", d => (!q ? d._initColor : (d.data.name.toLowerCase().includes(q) ? "#fff" : d._initColor)));
});

update(root);
// center initially
svg.call(zoom.transform, d3.zoomIdentity.translate(80, height()/2));
</script>
</body>
</html>
"""

if __name__ == "__main__":
    main()
