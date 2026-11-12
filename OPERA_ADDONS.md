# Publishing LierEX to Opera Add-ons (`addons.opera.com`)

Checklist and copy-paste metadata prepared specifically against **Opera Add-ons Acceptance Criteria**.

---

## 1. Technical Compliance Summary (`v1.2.0`)

- **Manifest V3 (`manifest.json`):** No deprecated MV2 keys, no top-level `"developer"` key (prevents Chromium unrecognized-key warning), valid `"author"` and `"homepage_url"`.
- **Single Purpose ("One Goal Policy"):** Extract and export movie, series, and video game metadata cards from supported catalog pages (to JSON or Lierkour desktop app).
- **Minimal Permissions:**
  - `activeTab` + `scripting` (runs strictly on-click on the current tab; **zero permanent `<all_urls>` or remote website host permissions**).
  - `storage` (stores only the optional local `X-LierEX-Token`).
  - `host_permissions`: strictly `["http://127.0.0.1:8765/*"]` (local loopback only, authenticated via header token).
- **Standalone Utility Without External Desktop App:** Popup opens straight to the extracted metadata card (token box stays collapsed under `⚙`), offering working **Copy JSON** and **Save .json** buttons even when Lierkour is not installed or running.
- **Unobfuscated Vanilla JS & Icons:** Zero minification, zero `eval`, zero `innerHTML`, zero remote code; non-interlaced RGBA PNG icons at `16×16`, `32×32`, `48×48`, `64×64`, and `128×128`.

---

## 2. Package & Assets Ready for Submission

Run from the `LierEX` directory to validate and generate the upload archive:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/package-opera.ps1
```

Outputs and assets:
- **Upload ZIP package:** `dist/LierEX-opera-v1.2.0.zip` (contains only runtime extension files + `LICENSE`, POSIX `/` entry paths, clean root `manifest.json`).
- **Store Screenshots (`612×408` PNG, non-interlaced):**
  - `store-assets/screenshot-movie-612x408.png`
  - `store-assets/screenshot-game-612x408.png`
- **Privacy Policy URL (after pushing to `main`):**
  `https://github.com/LaRCorp/LierEX/blob/main/PRIVACY.md`

---

## 3. Store Form Fields (Copy & Paste)

- **Name:** `LierEX`
- **Version:** `1.2.0`
- **Category:** `Productivity` (or `Fun`)
- **Homepage / Source Code URL:** `https://github.com/LaRCorp/LierEX`
- **Support URL:** `https://github.com/LaRCorp/LierEX/issues`
- **Privacy Policy URL:** `https://github.com/LaRCorp/LierEX/blob/main/PRIVACY.md`

### Summary (110 chars, EN)
```text
Extract movie, series & game metadata from IMDb, TMDb, Kinopoisk, Steam, Epic, GOG & more to JSON or Lierkour.
```

### Summary (108 chars, RU)
```text
Извлечение метаданных фильмов, сериалов и игр (Кинопоиск, IMDb, TMDb, Steam, GOG, Epic) в JSON или Lierkour.
```

### Full Description (EN)
```text
LierEX extracts clean, structured metadata cards from movie, TV series, and video game pages in one click.

How to use:
1. Open a movie, TV series, or video game page on a supported site:
   • Movies & Series: IMDb, TMDb (The Movie Database), Letterboxd, Kinopoisk
   • Video Games: Steam, Epic Games Store, GOG, Itch.io
2. Click the LierEX icon on your toolbar.
3. Preview the extracted details (title, original title, release year, director/creator or developer/publisher, genres, country, runtime/seasons, description, and poster) and choose a status (Watchlist/Backlog, Watching/Playing, Watched/Completed, or Dropped).
4. Export immediately:
   • Copy JSON — copies the structured card JSON to your clipboard (works completely offline).
   • Save .json — downloads a clean .json metadata file to your computer (works completely offline).
   • Add to Lierkour — optionally sends the card over localhost (127.0.0.1:8765) directly into your local Lierkour desktop library when authenticated with your X-LierEX-Token (accessible via the gear icon).

Permissions & Privacy:
• activeTab & scripting: used strictly when you click the toolbar icon to read metadata from the currently open tab. No background scripts run automatically on websites.
• storage: stores your optional local X-LierEX-Token inside chrome.storage.local.
• http://127.0.0.1:8765/*: used exclusively to check and communicate with your local Lierkour desktop app if you choose to sync locally. No data is ever sent to remote servers.
```

### Reviewer / Moderator Notes (Paste in Submission Comments)
```text
LierEX has a single purpose: extracting structured movie/series/game metadata cards from supported catalog pages for instant JSON export or optional local import into the open-source desktop app Lierkour (https://github.com/LaRCorp/Lierkour).

Quick standalone test (no external app required):
1. Open any movie or game page, for example:
   - https://www.imdb.com/title/tt0133093/
   - https://www.themoviedb.org/movie/157336-interstellar
   - https://store.steampowered.com/app/292030/The_Witcher_3_Wild_Hunt/
2. Click the LierEX toolbar icon.
3. Confirm the popup renders the extracted metadata card, cover preview, and status selector.
4. Click "Copy JSON" or "Save .json" to verify full standalone browser functionality without any external companion app installed.

Permission & Localhost notes:
- No permanent website host permissions are requested; DOM parsing uses `activeTab` + `scripting` solely upon popup click.
- The only host permission (`http://127.0.0.1:8765/*`) checks `/api/health` locally and optionally posts `/api/import` authenticated via the user-entered `X-LierEX-Token` header.
- Source code is completely unminified Vanilla JS/HTML/CSS (see https://github.com/LaRCorp/LierEX).
```
