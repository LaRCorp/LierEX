# Privacy Policy — LierEX

_Last updated: 2026-11-12_

**LierEX** ("Extract and export media cards to JSON or Lierkour") is an open-source browser extension licensed under GNU GPLv3. Respecting user privacy is core to its design: **LierEX collects zero personal data, zero browsing history, zero analytics, and communicates with zero remote servers.**

## 1. What Data LierEX Reads
- Only when you explicitly click the **LierEX** toolbar icon, the extension uses the temporary `activeTab` and `scripting` permissions to inspect the currently visible page DOM (for example on IMDb, TMDb, Kinopoisk, Letterboxd, Steam, Epic Games Store, GOG, or Itch.io) in order to extract publicly displayed title metadata (title, original title, release year, director/developer, genres, country, runtime, seasons count, summary text, and cover image URL).
- LierEX **does not** run background content scripts across websites, does not track visited URLs, and does not access your browsing history, cookies, passwords, or form inputs.

## 2. How Extracted Data Is Used
- The extracted card is displayed immediately inside the extension popup so you can preview it, choose a status, and:
  - **Copy JSON** to your clipboard, or **Save `.json`** directly to your device (100% offline inside the browser), or
  - optionally send it to your own local **Lierkour** desktop application running exclusively on `http://127.0.0.1:8765`.
- Cover preview images shown inside the popup (`https://...` URLs from the page you opened) are fetched directly by the browser solely for display.

## 3. Local Storage & Authentication Token
- If you connect LierEX to the Lierkour desktop app, the local authentication token (`X-LierEX-Token`) you enter is stored exclusively on your device via `chrome.storage.local`.
- No tokens or user preferences are synchronized externally or sent to third parties.

## 4. Third Parties & Analytics
- **None.** LierEX uses no analytics SDKs, no ad networks, no crash reporting services, and no remote code execution.

## 5. Source Code & Contact
- LierEX repository: https://github.com/LaRCorp/LierEX
- Companion desktop app (Lierkour): https://github.com/LaRCorp/Lierkour
- Issue tracker / support: https://github.com/LaRCorp/LierEX/issues
