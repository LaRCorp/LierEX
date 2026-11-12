<div align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="LierEX Logo" />
  <h1>LierEX v1.2</h1>
  <p><strong>Браузерное расширение для извлечения карточек фильмов, сериалов и видеоигр в JSON или локальную библиотеку Lierkour</strong></p>

  <p>
    <a href="https://github.com/LaRCorp/LierEX/releases"><img src="https://img.shields.io/badge/version-1.2.0-6366f1?style=flat-square" alt="Version 1.2.0" /></a>
    <img src="https://img.shields.io/badge/Manifest-V3-0ea5e9?style=flat-square" alt="Manifest V3" />
    <img src="https://img.shields.io/badge/Vanilla_JS-Zero_Build-f59e0b?style=flat-square" alt="Vanilla JS" />
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPLv3-10b981?style=flat-square" alt="GPLv3 License" /></a>
    <a href="https://github.com/LaRCorp/Lierkour"><img src="https://img.shields.io/badge/Companion-Lierkour_v2.1%2B-8b5cf6?style=flat-square" alt="Lierkour v2.1+" /></a>
  </p>
</div>

**LierEX** — лёгкое браузерное расширение (Manifest V3) без сборщиков и внешних зависимостей. По клику на иконку оно извлекает структурированные метаданные и обложки со страниц популярных кинобаз и игровых магазинов, позволяет выбрать статус и **экспортировать карточку в JSON (буфер обмена / файл)** либо в один клик отправить её в настольное приложение **[Lierkour](https://github.com/LaRCorp/Lierkour)** по локальному HTTP-мосту `http://127.0.0.1:8765`.

---

## Поддерживаемые площадки (8 сервисов)

### 🎬 Кино, сериалы и аниме (`type: "movie"`)

| Площадка | Домен | Что извлекается |
| --- | --- | --- |
| **Кинопоиск** | `kinopoisk.ru` | Название, оригинальное название, год, режиссёр, жанры, страна, длительность, число сезонов, постер, описание |
| **IMDb** | `imdb.com` | Название, IMDb ID (`tt...`), год, режиссёр, жанры, страна, длительность, сезоны, постер, описание |
| **TMDb** | `themoviedb.org` | Фильмы (`/movie/`) и сериалы (`/tv/`), оригинальное название, режиссёр/создатель, жанры, длительность (`169m`), сезоны, постер |
| **Letterboxd** | `letterboxd.com` | Название, оригинальное название, год, режиссёр, жанры, страна, длительность, ссылка на IMDb ID, постер |

### 🎮 Видеоигры (`type: "game"`)

| Площадка | Домен | Лаунчер в Lierkour | Что извлекается |
| --- | --- | --- | --- |
| **Steam** | `store.steampowered.com` | `Steam` | Название, разработчик/издатель, жанры и теги, год, описание, вертикальный постер (`600x900` или авто-рамка на стороне Lierkour) |
| **Epic Games Store** | `epicgames.com` | `Epic Games` | Название, разработчик/издатель, жанры, год, описание, приоритет вертикальных обложек |
| **GOG** | `gog.com` | `GOG` | Название, компания, жанры/теги, дата релиза, описание, обложка игры |
| **Itch.io** | `itch.io` | `Itch.io` | Название, автор, жанр/теги, дата выхода, описание, обложка (профили авторов корректно отсеиваются) |

---

## Основные возможности

- **Автономный экспорт JSON (без установки Lierkour):** кнопки **Копировать JSON** (`Copy JSON`) и **Скачать `.json`** (`Save .json`) сразу сохраняют готовую структурированную карточку с выбранным статусом.
- **Прямой импорт в Lierkour:**
  - Фильмы / сериалы / аниме: `В планах`, `Смотрю`, `Просмотрено`, `Брошено`.
  - Игры: `В планах`, `Играю`, `Пройдена`, `Брошена`.
- **Обработка игровых обложек:** передача массива кандидатов постера в Lierkour, где горизонтальные баннеры игр (Steam / Epic / Itch / GOG) аккуратно оформляются под единый вертикальный формат `600×900`.
- **Автолокализация интерфейса (RU / EN):** язык popup-окна и системных сообщений подстраивается под язык браузера (`_locales/en` и `_locales/ru`).
- **Минимальные разрешения и приватность (см. [PRIVACY.md](PRIVACY.md)):**
  - Только `activeTab`, `scripting`, `storage` — **никаких постоянных разрешений для сторонних сайтов и `<all_urls>`**.
  - Единственный host-доступ — локальный `http://127.0.0.1:8765/*` с авторизацией токеном `X-LierEX-Token`.
  - Парсинг запускается исключительно при нажатии пользователя на иконку расширения; без телеметрии и удалённого кода.

---

## Установка с GitHub (Opera / Opera GX / Edge / Chrome / Яндекс / Brave)

1. Скачайте архив из **[Releases LierEX](https://github.com/LaRCorp/LierEX/releases)** (или `Code → Download ZIP`) и распакуйте его в постоянную папку (внутри должен лежать `manifest.json`).
2. Откройте страницу расширений в браузере:
   - Opera / Opera GX: `opera://extensions/`
   - Microsoft Edge: `edge://extensions/`
   - Google Chrome: `chrome://extensions/`
   - Яндекс.Браузер: `browser://extensions/`
3. Включите **Режим разработчика** (Developer mode).
4. Нажмите **Загрузить распакованное расширение** (Load unpacked) и выберите папку с `manifest.json`.
5. Закрепите иконку **LierEX** на панели браузера.

---

## Подключение к Lierkour (опционально)

1. Установите и запустите **[Lierkour (v2.1+)](https://github.com/LaRCorp/Lierkour/releases)**.
2. Откройте в Lierkour вкладку **Настройки** → блок **«Связь с браузерным расширением LierEX»** и скопируйте `X-LierEX-Token`.
3. Нажмите иконку **LierEX** в браузере → **⚙** → вставьте токен → **OK** (хранится локально в `chrome.storage.local`).
4. Откройте карточку фильма, сериала или игры, выберите статус и нажмите **Добавить в Lierkour**.

---

## Публикация в Opera Add-ons

- Руководство и готовые тексты формы публикации: [OPERA_ADDONS.md](OPERA_ADDONS.md)
- Политика конфиденциальности: [PRIVACY.md](PRIVACY.md)
- Сборка чистого архива `.zip` с проверками:
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts/package-opera.ps1
  ```

---

## Лицензия

Распространяется под лицензией **GNU General Public License v3.0 (GPLv3)** — см. [LICENSE](LICENSE).

Связанный репозиторий: **[LaRCorp/Lierkour](https://github.com/LaRCorp/Lierkour)**
