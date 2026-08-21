// Builds the static site: copies the deck folders into the output directory and
// generates an index page listing every deck it finds. Run: node scripts/build-index.mjs _site
import { readdir, readFile, mkdir, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";

const out = process.argv[2] ?? "_site";
const root = process.cwd();

const LANGS = {
  "de-ru": "Немецкий → Русский",
  "de-en": "German → English",
};

const escape = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// funnygerman_21_08_26.html → 21.08.26 (used for sorting and as a subtitle)
function deckDate(file) {
  const m = file.match(/(\d{2})_(\d{2})_(\d{2})\.html$/);
  if (!m) return null;
  const [, dd, mm, yy] = m;
  return { label: `${dd}.${mm}.${yy}`, sort: `20${yy}-${mm}-${dd}` };
}

async function collect(dir) {
  let entries;
  try {
    entries = await readdir(path.join(root, dir), { withFileTypes: true });
  } catch {
    return [];
  }
  const decks = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
    const rel = `${dir}/${entry.name}`;
    const html = await readFile(path.join(root, rel), "utf8");
    const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1].trim() || entry.name;
    decks.push({ href: rel, title, date: deckDate(entry.name) });
  }
  // Newest first; undated decks fall back to filename order.
  return decks.sort((a, b) => (b.date?.sort ?? b.href).localeCompare(a.date?.sort ?? a.href));
}

const sections = [];
for (const [dir, heading] of Object.entries(LANGS)) {
  const decks = await collect(dir);
  if (!decks.length) continue;

  await mkdir(path.join(out, dir), { recursive: true });
  for (const deck of decks) await copyFile(path.join(root, deck.href), path.join(out, deck.href));

  const items = decks
    .map(
      (d) => `        <li>
          <a href="${escape(d.href)}">${escape(d.title)}</a>${
            d.date ? `<span class="date">${d.date.label}</span>` : ""
          }
        </li>`
    )
    .join("\n");
  sections.push(`      <h2>${escape(heading)}</h2>
      <ul>
${items}
      </ul>`);
}

const index = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Wortschatz — German vocabulary flashcards</title>
    <style>
      :root { color-scheme: light dark; --fg: #16181d; --muted: #6b7280; --bg: #fbfbfa; --card: #fff; --line: #e6e6e3; }
      @media (prefers-color-scheme: dark) {
        :root { --fg: #eceef2; --muted: #9aa1ad; --bg: #16181d; --card: #1f2229; --line: #2c313a; }
      }
      * { box-sizing: border-box; }
      body {
        margin: 0; padding: 3rem 1.25rem 4rem; background: var(--bg); color: var(--fg);
        font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      main { max-width: 42rem; margin: 0 auto; }
      h1 { font-size: 1.75rem; margin: 0 0 .35rem; }
      h2 { font-size: 1rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 2.5rem 0 .75rem; }
      p.lede { color: var(--muted); margin: 0 0 .5rem; }
      ul { list-style: none; margin: 0; padding: 0; }
      li + li { margin-top: .5rem; }
      li a {
        display: flex; justify-content: space-between; gap: 1rem; align-items: baseline;
        padding: .85rem 1rem; background: var(--card); border: 1px solid var(--line); border-radius: .75rem;
        color: inherit; text-decoration: none;
      }
      li a:hover { border-color: var(--muted); }
      .date { color: var(--muted); font-size: .85rem; white-space: nowrap; }
      footer { margin-top: 3rem; color: var(--muted); font-size: .9rem; }
      footer a { color: inherit; }
    </style>
  </head>
  <body>
    <main>
      <h1>Wortschatz</h1>
      <p class="lede">German vocabulary flashcards you can study in the browser. No app, no accounts.</p>
${sections.join("\n") || "      <p>No decks yet.</p>"}
      <footer>
        Telegram:
        <a href="https://t.me/korotko_de">Коротко о немецком</a> ·
        <a href="https://t.me/EnglishFunnyGerman">FunnyGerman in English</a> ·
        <a href="https://t.me/FunnyGerman">FunnyGerman in Russian</a> ·
        <a href="https://t.me/RandomGerman">Случайные немецкие слова</a>
      </footer>
    </main>
  </body>
</html>
`;

await mkdir(out, { recursive: true });
await writeFile(path.join(out, "index.html"), index);
await writeFile(path.join(out, ".nojekyll"), "");
console.log(`Built ${out} with ${sections.length} section(s).`);
