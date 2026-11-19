const normalize = value => value.trim().normalize("NFC").toLowerCase();
const withoutExtension = path => path.replace(/\.md$/i, "");
const basename = path => path.split("/").at(-1);

export function readNote(path, body) {
  const frontmatter = body.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const aliasSection = frontmatter?.[1].match(/^aliases:[ \t]*\r?\n((?:[ \t]+-[ \t]+[^\r\n]+\r?\n?)*)/m);
  const aliases = (aliasSection?.[1] ?? "").split(/\r?\n/).filter(Boolean)
    .map(line => line.replace(/^\s*-\s+/, "").trim().replace(/^(["'])(.*)\1$/, "$2"));
  const content = body.slice(frontmatter?.[0].length ?? 0);
  const ignored = /^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\2[ 	]*\r?$|(?![\s\S]))|`+[^`\n]+`+/gm;
  const visible = content.replace(ignored, match => match.replace(/[^\r\n]/g, " "));
  const headings = [...visible.matchAll(/^ {0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*\r?$/gm)]
    .map(match => normalize(match[1]));
  const links = [...visible.matchAll(/(?<![\\!])\[\[([^\]|#\r\n]*)(?:#([^\]|\r\n]+))?(?:\|([^\]\r\n]+))?\]\]/g)]
    .map(match => ({
      original: match[0], target: match[1], heading: match[2], label: match[3],
      offset: match.index + (frontmatter?.[0].length ?? 0),
    }));
  return { path, body, title: withoutExtension(basename(path)), aliases, headings, links };
}

export function inspect(notes) {
  const edges = [];
  const issues = [];
  for (const source of notes) {
    for (const link of source.links) {
      const target = normalize(withoutExtension(link.target));
      const direct = target ? notes.filter(note =>
        normalize(withoutExtension(note.path)) === target ||
        normalize(note.title) === target) : [source];
      const hasHeading = note => !link.heading || note.headings.includes(normalize(link.heading));
      if (direct.length === 1 && hasHeading(direct[0])) {
        edges.push({ source: source.path, target: direct[0].path });
        continue;
      }
      const candidates = (direct.length ? direct : notes.filter(note =>
        note.aliases.some(alias => normalize(alias) === target))).filter(hasHeading);
      const reason = direct.length > 1 ? "同名笔记" : direct.length ? "标题不存在" : "目标笔记不存在";
      issues.push({ source, link, candidates, reason });
    }
  }
  const connected = new Set(edges.flatMap(edge => [edge.source, edge.target]));
  return { edges, issues, orphans: notes.filter(note => !connected.has(note.path)) };
}

export function replacement(link, note) {
  const heading = link.heading ? "#" + link.heading : "";
  const label = link.label ? "|" + link.label : "";
  return "[[" + withoutExtension(note.path) + heading + label + "]]";
}

export function applyRepairs(source, repairs) {
  let body = source.body;
  const ordered = [...repairs].sort((left, right) => right.link.offset - left.link.offset);
  for (const { link, text } of ordered) {
    body = body.slice(0, link.offset) + text + body.slice(link.offset + link.original.length);
  }
  return body;
}
