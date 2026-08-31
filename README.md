# wortschatz
German vocabulary flashcards you can study in the browser — free decks from my telegram channels. 

No app, no accounts, just flashcards in browser.

## My telegram channels
* [Коротко о немецком](https://t.me/korotko_de)
* [FunnyGerman in English](https://t.me/EnglishFunnyGerman)
* [FunnyGerman in Russian](https://t.me/FunnyGerman)
* [Случайные немецкие слова](https://t.me/RandomGerman)

## Website

The decks are published with GitHub Pages at **https://funnygerman.github.io/wortschatz/**.

Every push to `main` runs [`.github/workflows/pages.yml`](.github/workflows/pages.yml), which
builds the site with `node scripts/build-site.mjs _site` and deploys it. The build copies the
`ru/` and `en/` folders as they are and generates three index pages:

* `index.html` — picks a language
* `ru/index.html`, `en/index.html` — that language's decks, newest first, grouped by year

The indexes are generated from the deck files on disk, so adding a deck under `ru/2026/` — or
starting a whole new `ru/2027/` folder — puts it on the site with no index editing and no
JavaScript in the visitor's browser. Files under `data/` are skipped, and each deck stays at its
own URL, e.g. https://funnygerman.github.io/wortschatz/ru/2026/funnygerman_21_08.html

A deck's label comes from its filename: `korotko_11_08.html` is read as the *Коротко о немецком*
channel, 11 August, with the year taken from the folder. Prefixes are mapped to channel names at
the top of `scripts/build-site.mjs`; an unknown prefix is shown as-is.

## Install it

The site is a progressive web app. On a phone, *Add to home screen* gives it an icon
and its own window; on the desktop, Chrome and Edge offer to install it. Either way the
whole site is saved on the device the first time it is opened — every deck, not only the
ones that were looked at — so it keeps working with no connection at all.

Three files do that, and no deck file has to know about any of them:

* [`manifest.webmanifest`](manifest.webmanifest) — the installed app's name, colours,
  icons and the two language shortcuts. It sits at the site root so its `"./"` scope is
  the whole site.
* [`sw.js`](sw.js) — the service worker, also at the root so it is allowed to control
  everything below it. The build fills in its two placeholders: the list of files to save
  (every page, the stylesheet, the icons and the shared flashcards library — about 112 KB
  plus the library) and a version, which is a hash of exactly those files. A deploy that
  changes nothing keeps the caches visitors already have; any change to any deck retires
  them on their next visit. Anything not on that list — the `tools/` page, a mistyped URL —
  goes to the network first and falls back to a small `offline.html`.
* [`assets/icons/`](assets/icons) — written by `node scripts/make-icons.mjs`, which draws
  the mark and encodes the PNGs itself, so no image tooling is needed. The icons are
  committed; only rerun it if the mark changes.

The manifest link, icons, theme colour and worker registration are added to every page's
`<head>` while the site is built, so a new deck under `ru/2026/` is installable and saved
offline like all the others with nothing added to the deck file.

Preview locally:

```sh
node scripts/build-site.mjs _site
python3 -m http.server -d _site
```

Service workers need `http://localhost` or HTTPS — opening `_site/index.html` as a file
skips the offline part, everything else still works.
