// Builds the published site into an output directory: copies everything Pages
// should serve, then writes the index pages from the deck files actually present.
// Run: node scripts/build-site.mjs _site
import { readdir, readFile, mkdir, copyFile, writeFile } from "node:fs/promises";
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

const MONTHS = {
  ru: ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"],
  en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
};

const TEXT = {
  ru: {
    lede: "Карточки для заучивания слов. Открывай любую колоду прямо в браузере.",
    empty: "Колод пока нет.",
    back: "← Wortschatz",
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
    telegram: "Telegram:",
    channels: [["https://t.me/EnglishFunnyGerman", "FunnyGerman in English"]],
  },
};

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
  return {
    file,
    year: yy ? `20${yy}` : yearDir ?? "",
    day: Number(dd),
    month: Number(mm),
    channel: CHANNELS[prefix?.toLowerCase()] ?? prefix,
  };
}

function page({ lang, title, css, body }) {
  return `<!doctype html>
<html lang="${lang}">

<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${escape(title)}</title>
  <link rel="stylesheet" href="${css}" />
</head>

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

await mkdir(out, { recursive: true });
await writeFile(path.join(out, ".nojekyll"), "");

// Shared stylesheet.
await mkdir(path.join(out, "assets"), { recursive: true });
await copyFile(path.join(root, "assets/decks.css"), path.join(out, "assets/decks.css"));

const built = [];
for (const { dir, lang, heading } of LANGS) {
  const files = await walk(dir);
  for (const file of files) {
    await mkdir(path.join(out, path.dirname(file)), { recursive: true });
    await copyFile(path.join(root, file), path.join(out, file));
  }

  const decks = files
    .filter((f) => f.endsWith(".html") && !f.endsWith("index.html") && !f.includes("/data/"))
    .map(describe)
    // Newest first.
    .sort((a, b) =>
      `${b.year}-${b.month}-${b.day}`.localeCompare(`${a.year}-${a.month}-${a.day}`, undefined, {
        numeric: true,
      })
    );

  const byYear = new Map();
  for (const deck of decks) {
    if (!byYear.has(deck.year)) byYear.set(deck.year, []);
    byYear.get(deck.year).push(deck);
  }

  let list = `      <p class="status">${escape(TEXT[lang].empty)}</p>`;
  if (decks.length) {
    list = [...byYear]
      .map(([year, group]) => {
        const items = group
          .map((deck) => {
            const month = MONTHS[lang][deck.month - 1];
            const date = month ? `${deck.day} ${month}` : "";
            // Index pages sit inside the language folder, so link relative to it.
            const href = deck.file.slice(dir.length + 1);
            return `          <li>
            <a href="${escape(href)}"><span>${escape(deck.channel)}</span><span class="meta">${escape(date)}</span></a>
          </li>`;
          })
          .join("\n");
        const title = year ? `      <h2>${escape(year)}</h2>\n` : "";
        return `${title}      <ul>\n${items}\n      </ul>`;
      })
      .join("\n");
  }

  await writeFile(
    path.join(out, dir, "index.html"),
    page({
      lang,
      title: `${heading} · Wortschatz`,
      css: "../assets/decks.css",
      body: `    <a class="back" href="../">${escape(TEXT[lang].back)}</a>
    <h1>${escape(heading)}</h1>
    <p class="lede">${escape(TEXT[lang].lede)}</p>

${list}

${footer(lang, "    ")}`,
    })
  );
  built.push(`${dir}: ${decks.length} deck(s)`);
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
    css: "assets/decks.css",
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

console.log(`Built ${out} — ${built.join(", ")}`);
