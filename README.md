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

Preview locally:

```sh
node scripts/build-site.mjs _site
python3 -m http.server -d _site
```
