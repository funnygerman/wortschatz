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
builds the site with `node scripts/build-index.mjs _site` and deploys it. The index page is
generated from the deck files, so adding a new `.html` deck under `de-ru/` or `de-en/` is enough —
it shows up on the site automatically (newest first, using the deck's `<title>`).

Preview locally:

```sh
node scripts/build-index.mjs _site
python3 -m http.server -d _site
```
