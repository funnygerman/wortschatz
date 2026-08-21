// Lists the decks in one language folder by reading the repository tree from the
// GitHub API, so a new deck file — or a whole new year folder — shows up without
// anyone editing an index page. Used by ru/index.html and en/index.html.
const REPO = "funnygerman/wortschatz";
const BRANCH = "main";
const TREE_URL = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`;

// Filename prefix → the channel a deck came from.
const CHANNELS = {
  funnygerman: "FunnyGerman",
  korotko: "Коротко о немецком",
  randomgerman: "Случайные немецкие слова",
};

const MONTHS_RU = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];

async function fetchTree() {
  // One API call serves every index on the site; cache it for the tab's lifetime
  // so clicking between languages doesn't spend another request.
  const cached = sessionStorage.getItem("deck-tree");
  if (cached) return JSON.parse(cached);

  const res = await fetch(TREE_URL);
  if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
  const { tree } = await res.json();
  const paths = tree.filter((n) => n.type === "blob").map((n) => n.path);
  try {
    sessionStorage.setItem("deck-tree", JSON.stringify(paths));
  } catch {
    // Private mode or a full quota — not worth failing the page over.
  }
  return paths;
}

// "ru/2026/korotko_11_08.html" → { year, month, day, channel }
function describe(path) {
  const name = path.split("/").pop().replace(/\.html$/, "");
  const yearDir = path.split("/").find((seg) => /^\d{4}$/.test(seg));
  const [prefix, dd, mm, yy] = name.split("_");
  const year = yy ? `20${yy}` : yearDir;
  return {
    path,
    year: year ?? "",
    day: Number(dd),
    month: Number(mm),
    channel: CHANNELS[prefix?.toLowerCase()] ?? prefix,
  };
}

export async function renderDecks({ dir, lang, into, status }) {
  const months = lang === "ru" ? MONTHS_RU : MONTHS_EN;
  let paths;
  try {
    paths = await fetchTree();
  } catch (err) {
    status.textContent =
      lang === "ru"
        ? "Не удалось загрузить список колод. Открой репозиторий на GitHub."
        : "Could not load the deck list. Browse the repository on GitHub instead.";
    console.error(err);
    return;
  }

  const decks = paths
    .filter(
      (p) =>
        p.startsWith(`${dir}/`) &&
        p.endsWith(".html") &&
        !p.endsWith("index.html") &&
        !p.includes("/data/")
    )
    .map(describe)
    // Newest first.
    .sort((a, b) => `${b.year}-${b.month}-${b.day}`.localeCompare(`${a.year}-${a.month}-${a.day}`, undefined, { numeric: true }));

  if (!decks.length) {
    status.textContent = lang === "ru" ? "Колод пока нет." : "No decks yet.";
    return;
  }

  status.remove();
  const byYear = new Map();
  for (const deck of decks) {
    if (!byYear.has(deck.year)) byYear.set(deck.year, []);
    byYear.get(deck.year).push(deck);
  }

  for (const [year, group] of byYear) {
    if (year) {
      const heading = document.createElement("h2");
      heading.textContent = year;
      into.append(heading);
    }
    const list = document.createElement("ul");
    for (const deck of group) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      // Index pages live inside the language folder, so link relative to it.
      link.href = deck.path.slice(dir.length + 1);
      link.append(Object.assign(document.createElement("span"), { textContent: deck.channel }));
      const date = months[deck.month - 1] ? `${deck.day} ${months[deck.month - 1]}` : "";
      link.append(Object.assign(document.createElement("span"), { className: "meta", textContent: date }));
      item.append(link);
      list.append(item);
    }
    into.append(list);
  }
}
