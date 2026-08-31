// Builds the published site into an output directory: copies everything Pages
// should serve, then writes the index pages from the deck files actually present.
// Every page also gets the PWA head (manifest, icons, worker registration) and
// the site ships a service worker, so the decks install and work offline.
// Run: node scripts/build-site.mjs _site
import { readdir, readFile, mkdir, copyFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const out = process.argv[2] ?? "_site";
const root = process.cwd();

const LANGS = [
  { dir: "ru", lang: "ru", heading: "Немецкий → Русский" },
  { dir: "en", lang: "en", heading: "German → English" },
];

// Filename prefix → the channel a deck came from.
const CHANNELS = {
  funnygerman: "FunnyGerman",
  korotko: "Коротко о немецком",
  randomgerman: "Случайные немецкие слова",
};

// Pages that are not a dated deck — they live at the language folder's root and
// carry no date in the filename. Keyed by filename, labelled per language.
const PAGES = {
  vocabulary: { ru: "Весь словарь", en: "Full vocabulary" },
};

const MONTHS = {
  ru: ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"],
  en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
};

const TEXT = {
  ru: {
    lede: "Карточки для заучивания слов. Открывай любую колоду прямо в браузере.",
    empty: "Колод пока нет.",
    back: "← Wortschatz",
    pages: "Все слова",
    telegram: "Телеграм:",
    channels: [
      ["https://t.me/korotko_de", "Коротко о немецком"],
      ["https://t.me/FunnyGerman", "FunnyGerman"],
      ["https://t.me/RandomGerman", "Случайные немецкие слова"],
    ],
  },
  en: {
    lede: "Vocabulary flashcards. Open any deck straight in the browser.",
    empty: "No decks yet.",
    back: "← Wortschatz",
    pages: "All words",
    telegram: "Telegram:",
    channels: [["https://t.me/EnglishFunnyGerman", "FunnyGerman in English"]],
  },
};

// The site's ink colour, for the browser chrome around an installed window.
const THEME = { light: "#fbfbfa", dark: "#16181d" };

// The flashcards library the decks import. Picked up from the deck files rather
// than pinned here, so a version bump needs no change in this script.
const VENDOR_URL = /https:\/\/[\w.-]+\/flashcards\/[\w./-]+\.(?:js|css)/g;

const escape = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Every file under dir, recursively, as paths relative to the repo root.
async function walk(dir) {
  let entries;
  try {
    entries = await readdir(path.join(root, dir), { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await walk(rel)));
    else files.push(rel);
  }
  return files;
}

// "ru/2026/korotko_11_08.html" → { year, month, day, channel }
function describe(file) {
  const name = path.basename(file, ".html");
  const yearDir = file.split("/").find((seg) => /^\d{4}$/.test(seg));
  const [prefix, dd, mm, yy] = name.split("_");
  const day = Number(dd);
  const month = Number(mm);
  return {
    file,
    name,
    year: yy ? `20${yy}` : yearDir ?? "",
    day,
    month,
    dated: Number.isInteger(day) && Number.isInteger(month),
    channel: CHANNELS[prefix?.toLowerCase()] ?? prefix,
  };
}

// How to climb from a file back to the site root: "ru/2026/deck.html" → "../../".
const upTo = (file) => "../".repeat(file.split("/").length - 1) || "./";

// The head every page shares: what to install, what it looks like installed, and
// the worker that saves it for offline. `up` is that page's path to the root.
function pwaHead(up) {
  return `  <link rel="manifest" href="${up}manifest.webmanifest" />
  <link rel="icon" href="${up}assets/icons/icon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="${up}assets/icons/apple-touch-icon-180.png" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-title" content="Wortschatz" />
  <meta name="theme-color" content="${THEME.light}" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="${THEME.dark}" media="(prefers-color-scheme: dark)" />
  <script>
    // Saves the site for offline use; harmless if it fails, the page still works.
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      addEventListener("load", () => {
        navigator.serviceWorker
          .register("${up}sw.js", { scope: "${up}", updateViaCache: "none" })
          .catch(() => {});
      });
    }
  </script>
`;
}

// Deck pages are written by hand and know nothing about any of this, so the head
// is added on the way out. A page without a </head> is copied through untouched.
function withPwaHead(html, file) {
  const close = html.search(/<\/head>/i);
  if (close < 0) return html;
  return html.slice(0, close) + pwaHead(upTo(file)) + html.slice(close);
}

function page({ lang, title, up, body }) {
  return `<!doctype html>
<html lang="${lang}">

<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${escape(title)}</title>
  <link rel="stylesheet" href="${up}assets/decks.css" />
${pwaHead(up)}</head>

<body>
  <main>
${body}
  </main>
</body>

</html>
`;
}

function footer(lang, indent) {
  const t = TEXT[lang];
  const links = t.channels
    .map(([href, name]) => `${indent}  <a href="${href}">${escape(name)}</a>`)
    .join(" ·\n");
  return `${indent}<footer>\n${indent}  ${t.telegram}\n${links}\n${indent}</footer>`;
}

// What the worker saves on install: { url } is how the browser will ask for it,
// { file } is where it landed in the output. Directory URLs are what the site
// actually links to, so those are what get cached.
const precache = [];
const vendor = new Set();

// Copies one file into the output, adding the PWA head if it is a page.
async function publish(file, { cache = false } = {}) {
  await mkdir(path.join(out, path.dirname(file)), { recursive: true });
  if (file.endsWith(".html")) {
    const html = await readFile(path.join(root, file), "utf8");
    for (const url of html.match(VENDOR_URL) ?? []) vendor.add(url);
    await writeFile(path.join(out, file), withPwaHead(html, file));
  } else {
    await copyFile(path.join(root, file), path.join(out, file));
  }
  if (cache) precache.push({ url: file, file });
}

await mkdir(out, { recursive: true });
await writeFile(path.join(out, ".nojekyll"), "");

// Stylesheet and icons.
for (const file of await walk("assets")) await publish(file, { cache: true });

// What makes it installable. Both sit at the site root: the manifest so its
// "./" scope is the site, the worker so it is allowed to control all of it.
await copyFile(path.join(root, "manifest.webmanifest"), path.join(out, "manifest.webmanifest"));
precache.push({ url: "manifest.webmanifest", file: "manifest.webmanifest" });

// Deck authoring tools (not linked from the picker, but published for
// convenience). Not worth saving offline — they are only used while writing decks.
for (const file of await walk("tools")) await publish(file);

const built = [];
for (const { dir, lang, heading } of LANGS) {
  const files = await walk(dir);
  for (const file of files) {
    // Decks and the vocabulary page are the site's point: save all of them.
    await publish(file, { cache: file.endsWith(".html") && !file.includes("/data/") });
  }

  const entries = files
    .filter((f) => f.endsWith(".html") && !f.endsWith("index.html") && !f.includes("/data/"))
    .map(describe);

  // A page with no date in its filename — the whole-vocabulary deck — is not part
  // of the dated run; it goes in its own group at the top.
  const pages = entries.filter((e) => !e.dated);
  const decks = entries
    .filter((e) => e.dated)
    // Newest first.
    .sort((a, b) =>
      `${b.year}-${b.month}-${b.day}`.localeCompare(`${a.year}-${a.month}-${a.day}`, undefined, {
        numeric: true,
      })
    );

  const groups = new Map();
  if (pages.length) groups.set(TEXT[lang].pages, pages);
  for (const deck of decks) {
    if (!groups.has(deck.year)) groups.set(deck.year, []);
    groups.get(deck.year).push(deck);
  }

  let list = `      <p class="status">${escape(TEXT[lang].empty)}</p>`;
  if (entries.length) {
    list = [...groups]
      .map(([heading, group]) => {
        const items = group
          .map((entry) => {
            const month = MONTHS[lang][entry.month - 1];
            const date = entry.dated && month ? `${entry.day} ${month}` : "";
            const label = entry.dated
              ? entry.channel
              : PAGES[entry.name]?.[lang] ?? entry.name;
            // Index pages sit inside the language folder, so link relative to it.
            const href = entry.file.slice(dir.length + 1);
            const meta = date ? `<span class="meta">${escape(date)}</span>` : "";
            return `          <li>
            <a href="${escape(href)}"><span>${escape(label)}</span>${meta}</a>
          </li>`;
          })
          .join("\n");
        const title = heading ? `      <h2>${escape(heading)}</h2>\n` : "";
        return `${title}      <ul>\n${items}\n      </ul>`;
      })
      .join("\n");
  }

  await writeFile(
    path.join(out, dir, "index.html"),
    page({
      lang,
      title: `${heading} · Wortschatz`,
      up: "../",
      body: `    <a class="back" href="../">${escape(TEXT[lang].back)}</a>
    <h1>${escape(heading)}</h1>
    <p class="lede">${escape(TEXT[lang].lede)}</p>

${list}

${footer(lang, "    ")}`,
    })
  );
  // The picker links to "ru/", not "ru/index.html" — cache it under that URL.
  precache.push({ url: `${dir}/`, file: `${dir}/index.html` });
  built.push(`${dir}: ${decks.length} deck(s), ${pages.length} page(s)`);
}

const picker = LANGS.map(
  ({ dir, heading }) =>
    `        <li>
          <a href="${dir}/"><span>${escape(heading)}</span><span class="meta">${dir}</span></a>
        </li>`
).join("\n");

await writeFile(
  path.join(out, "index.html"),
  page({
    lang: "en",
    title: "Wortschatz — German vocabulary flashcards",
    up: "./",
    body: `    <h1>Wortschatz</h1>
    <p class="lede">German vocabulary flashcards you can study in the browser. No app, no accounts.</p>

      <ul>
${picker}
      </ul>

    <footer>
      Telegram:
      <a href="https://t.me/korotko_de">Коротко о немецком</a> ·
      <a href="https://t.me/EnglishFunnyGerman">FunnyGerman in English</a> ·
      <a href="https://t.me/FunnyGerman">FunnyGerman in Russian</a> ·
      <a href="https://t.me/RandomGerman">Случайные немецкие слова</a>
    </footer>`,
  })
);
precache.push({ url: "./", file: "index.html" });

// Shown when a page that was never visited is opened with no connection.
await writeFile(
  path.join(out, "offline.html"),
  page({
    lang: "en",
    title: "Offline · Wortschatz",
    up: "./",
    body: `    <h1>Offline</h1>
    <p class="lede">Эта страница ещё не сохранена на устройстве. Открой её один раз с интернетом — дальше она работает и без него.</p>
    <p class="lede">This page isn’t saved on your device yet. Open it once with a connection and it will work without one afterwards.</p>

      <ul>
        <li>
          <a href="./"><span>Wortschatz</span></a>
        </li>
      </ul>`,
  })
);
precache.push({ url: "offline.html", file: "offline.html" });

// The worker, with the file list and a version baked in. The version is a hash of
// everything precached, so an unchanged deploy keeps the caches it already has and
// any change to any deck retires them.
precache.sort((a, b) => a.url.localeCompare(b.url));
const version = createHash("sha256");
for (const entry of precache) {
  version.update(entry.url);
  version.update(await readFile(path.join(out, entry.file)));
}
const worker = await readFile(path.join(root, "sw.js"), "utf8");
version.update(worker);
await writeFile(
  path.join(out, "sw.js"),
  worker
    .replace("__VERSION__", version.digest("hex").slice(0, 12))
    .replace("__ASSETS__", JSON.stringify(precache.map((entry) => entry.url), null, 2))
    .replace("__VENDOR__", JSON.stringify([...vendor].sort(), null, 2))
);

console.log(
  `Built ${out} — ${built.join(", ")}; ${precache.length} file(s) precached, ` +
    `${vendor.size} vendor file(s)`
);
