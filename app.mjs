import { applyRepairs, inspect, readNote, replacement } from "./linter.mjs";

const status = document.querySelector("#status");
const graph = document.querySelector("#graph");
const details = document.querySelector("#details");
const issuesRoot = document.querySelector("#issues");
const fixturePaths = [
  "Inbox.md", "Finance/2025-Annual-Budget.md", "Project.md", "Unlinked.md",
];
let loadId = 0;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function showGraph(notes, edges) {
  graph.replaceChildren();
  details.textContent = "选择一个节点查看链接与反向链接。";
  if (!notes.length) return;

  const visible = notes.slice(0, 40);
  const width = Math.max(340, Math.min(1600, 120 + visible.length * 42));
  const height = Math.max(215, Math.min(670, 150 + visible.length * 24));
  const layer = element("div", "", "graph-inner");
  layer.style.width = width + "px";
  layer.style.height = height + "px";
  const positions = new Map(visible.map((note, index) => {
    const angle = (index / visible.length) * 2 * Math.PI - Math.PI / 2;
    return [note.path, {
      x: width / 2 + (width / 2 - 68) * Math.cos(angle),
      y: height / 2 + (height / 2 - 24) * Math.sin(angle),
    }];
  }));

  for (const edge of edges) {
    const start = positions.get(edge.source);
    const end = positions.get(edge.target);
    if (!start || !end) continue;
    const line = element("div", "", "edge");
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    line.style.left = start.x + "px";
    line.style.top = start.y + "px";
    line.style.width = Math.hypot(dx, dy) + "px";
    line.style.transform = "rotate(" + Math.atan2(dy, dx) + "rad)";
    layer.append(line);
  }

  for (const note of visible) {
    const { x, y } = positions.get(note.path);
    const node = element("button", note.title, "node");
    node.title = note.path;
    node.setAttribute("aria-label", note.path);
    node.setAttribute("aria-pressed", "false");
    node.style.left = x + "px";
    node.style.top = y + "px";
    node.onclick = () => {
      layer.querySelector('[aria-pressed="true"]')?.setAttribute("aria-pressed", "false");
      node.setAttribute("aria-pressed", "true");
      const outgoing = new Set(edges.filter(edge => edge.source === note.path).map(edge => edge.target));
      const incoming = new Set(edges.filter(edge => edge.target === note.path).map(edge => edge.source));
      details.textContent = [
        note.path, "链接到：" + ([...outgoing].join("、") || "无"),
        "反向链接：" + ([...incoming].join("、") || "无"),
      ].join("\n");
    };
    layer.append(node);
  }
  graph.append(layer);
}

function downloadNote(source, repairs) {
  const blob = new Blob([applyRepairs(source, repairs)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = element("a");
  link.href = url;
  link.download = source.path.split("/").at(-1);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showIssues(issues, orphans) {
  issuesRoot.replaceChildren();
  const bySource = Map.groupBy(issues, issue => issue.source);
  for (const [source, sourceIssues] of bySource) {
    const section = element("div", "", "issue");
    const approved = new Map();
    const download = element("button", "下载修复副本");
    download.disabled = true;
    download.onclick = () => downloadNote(source, approved.values());

    section.append(element("strong", source.path));
    for (const { link, candidates, reason } of sourceIssues) {
      const row = element("div");
      const preview = element("p");
      row.append(element("p", reason + " · " + link.original));
      if (candidates.length) {
        const actions = element("div", "", "actions");
        const undo = element("button", "撤回");
        undo.disabled = true;
        undo.onclick = () => {
          approved.delete(link.offset);
          preview.textContent = "";
          undo.disabled = true;
          download.disabled = !approved.size;
        };

        for (const candidate of candidates) {
          const text = replacement(link, candidate);
          const button = element("button", "采用 " + text);
          button.onclick = () => {
            approved.set(link.offset, { link, text });
            preview.textContent = link.original + " → " + text;
            undo.disabled = false;
            download.disabled = false;
          };
          actions.append(button);
        }
        actions.append(undo);
        row.append(actions, preview);
      }
      section.append(row);
    }
    if (sourceIssues.some(issue => issue.candidates.length)) section.append(download);
    issuesRoot.append(section);
  }
  if (!issues.length) issuesRoot.append(element("p", "没有发现断链或有歧义的链接。"));
  if (orphans.length) {
    const orphanDetails = element("details");
    orphanDetails.append(element("summary", "无已解析连接的笔记（" + orphans.length + "）"));
    const list = element("ul");
    for (const note of orphans) list.append(element("li", note.path));
    orphanDetails.append(list);
    issuesRoot.append(orphanDetails);
  }
}

function render(notes) {
  const { edges, issues, orphans } = inspect(notes);
  status.textContent = notes.length + " 篇笔记 · " + edges.length + " 条已解析链接 · " +
    issues.length + " 条待检查链接" + (notes.length > 40 ? " · 图中显示前 40 篇" : "");
  showGraph(notes, edges);
  showIssues(issues, orphans);
}

async function loadNotes(loader) {
  const id = ++loadId;
  status.textContent = "正在读取笔记…";
  try {
    const notes = await loader();
    if (id === loadId) render(notes);
  } catch {
    if (id === loadId) status.textContent = "读取笔记失败，请重新选择文件夹或重试示例。";
  }
}

document.querySelector("#demo").onclick = () => loadNotes(() =>
  Promise.all(fixturePaths.map(async path => {
    const response = await fetch("examples/" + path);
    if (!response.ok) throw new Error("Example file unavailable");
    return readNote(path, await response.text());
  }))
);

document.querySelector("#files").onchange = event => {
  const input = event.currentTarget;
  const files = [...input.files].filter(file => /\.md$/i.test(file.name));
  input.value = "";
  loadNotes(() => Promise.all(files.map(async file => {
    const relative = file.webkitRelativePath.split("/").slice(1).join("/") || file.name;
    return readNote(relative, await file.text());
  })));
};
