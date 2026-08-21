# wortschatz
German vocabulary flashcards you can study in the browser — free decks from my telegram channels. 

No app, no accounts, just flashcards in browser.

## My telegram channels
* [Коротко о немецком](https://t.me/korotko_de)
* [FunnyGerman in English](https://t.me/EnglishFunnyGerman)
* [FunnyGerman in Russian](https://t.me/FunnyGerman)
* [Случайные немецкие слова](https://t.me/RandomGerman)

## Website

The decks are published with GitHub Pages straight from `main`, at
**https://funnygerman.github.io/wortschatz/**. There is no build step — the files are
served exactly as committed.

* `index.html` — picks a language
* `ru/index.html`, `en/index.html` — list that language's decks, newest first, grouped by year
* each deck stays at its own path, e.g.
  https://funnygerman.github.io/wortschatz/ru/2026/funnygerman_21_08.html

The language indexes build their list at page load from the repository tree (via the
GitHub API), so adding a deck under `ru/2026/` — or starting a whole new `ru/2027/`
folder — puts it on the site with no index editing. Files under `data/` are skipped.

A deck's label comes from its filename: `korotko_11_08.html` is read as the *Коротко о
немецком* channel, 11 August, with the year taken from the folder. Prefixes are mapped to
channel names in `assets/decks.js`; an unknown prefix is shown as-is.

The empty `.nojekyll` file tells Pages to serve the files as-is instead of running them
through Jekyll.
