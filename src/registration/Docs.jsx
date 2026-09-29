import docs from "./api-docs.json";
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(https?:\/\/[^\s<]+[^\s<.,)])/g, (m) => (m.includes("<a") ? m : `<a href="${m}">${m}</a>`));
// Enough Markdown for API.md: headings, paragraphs, lists, tables and fenced code.
function render(md) {
  const out = [];
  const lines = md.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const code = [];
      while (++i < lines.length && !lines[i].startsWith("```")) code.push(lines[i]);
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
    } else if (/^#{1,3} /.test(line)) {
      const level = line.match(/^#+/)[0].length;
      out.push(`<h${level}>${inline(line.replace(/^#+ /, ""))}</h${level}>`);
    } else if (line.startsWith("|")) {
      const rows = [line];
      while (i + 1 < lines.length && lines[i + 1].startsWith("|")) rows.push(lines[++i]);
      const cells = (r) => r.split("|").slice(1, -1).map((c) => c.trim());
      const [head, , ...body] = rows;
      out.push(`<table><thead><tr>${cells(head).map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body
        .map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`);
    } else if (/^\d+\. |^- /.test(line)) {
      const items = [line];
      while (i + 1 < lines.length && /^\d+\. |^- /.test(lines[i + 1])) items.push(lines[++i]);
      const tag = /^\d/.test(line) ? "ol" : "ul";
      out.push(`<${tag}>${items.map((t) => `<li>${inline(t.replace(/^(\d+\. |- )/, ""))}</li>`).join("")}</${tag}>`);
    } else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  return out.join("\n");
}
export default function Docs() {
  return (
    <div className="reg-app reg-docs-page">
      <header className="reg-header">
        <a className="reg-brand" href={`${base}/`}>
          <span className="reg-brand-mark"><img src={`${base}/assets/brand/castle-icon.png`} alt="" /></span>
          <strong>Kuriake Castle</strong>
        </a>
        <div className="reg-header-right"><a className="reg-text" href={`${base}/admin/`}>Office ↗</a></div>
      </header>
      <main className="reg-docs" dangerouslySetInnerHTML={{ __html: render(docs.markdown) }} />
    </div>
  );
}
