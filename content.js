(() => {
  const MIN_YEAR = 1888;
  const MAX_YEAR = 2100;

  function cleanText(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function toAbsoluteUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const trimmed = rawUrl.trim();
    if (!trimmed || trimmed.startsWith('data:')) return null;
    try {
      const parsed = new URL(trimmed, window.location.href);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }
      return parsed.href;
    } catch {
      return null;
    }
  }

  function extractYear(text) {
    if (!text) return null;
    const matches = String(text).match(/\b(18[89]\d|19\d\d|20\d\d|2100)\b/g);
    if (!matches) return null;
    for (const candidate of matches) {
      const year = Number.parseInt(candidate, 10);
      if (year >= MIN_YEAR && year <= MAX_YEAR) {
        return year;
      }
    }
    return null;
  }

  function extractDateYear(text) {
    const fourDigit = extractYear(text);
    if (fourDigit) return fourDigit;
    const shortMatch = cleanText(text).match(/\b\d{1,2}[./-]\d{1,2}[./-](\d{2})\b/);
    if (!shortMatch) return null;
    const yy = Number.parseInt(shortMatch[1], 10);
    return yy >= 70 ? 1900 + yy : 2000 + yy;
  }

  function queryText(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const txt = cleanText(el.textContent);
        if (txt) return txt;
      }
    }
    return '';
  }

  function getMetaContent(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      const content = cleanText(el?.getAttribute('content'));
      if (content) return content;
    }
    return '';
  }

  function pickImageUrl(img) {
    if (!img) return null;
    const srcset = img.getAttribute('srcset');
    if (srcset) {
      const candidates = srcset
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const tokens = part.split(/\s+/);
          const url = tokens[0];
          const descriptor = tokens[1] || '';
          const widthMatch = descriptor.match(/^(\d+)w$/);
          const scaleMatch = descriptor.match(/^(\d+(?:\.\d+)?)x$/);
          const score = widthMatch
            ? Number.parseInt(widthMatch[1], 10)
            : scaleMatch
            ? Math.round(Number.parseFloat(scaleMatch[1]) * 400)
            : 0;
          return { url: toAbsoluteUrl(url), score };
        })
        .filter((item) => Boolean(item.url));

      if (candidates.length > 0) {
        // Prefer high-res poster without going excessively huge
        const preferred = candidates
          .filter((c) => c.score <= 1200)
          .sort((a, b) => b.score - a.score);
        if (preferred.length > 0) {
          return preferred[0].url;
        }
        candidates.sort((a, b) => a.score - b.score);
        return candidates[0].url;
      }
    }

    return toAbsoluteUrl(
      img.currentSrc || img.getAttribute('src') || img.getAttribute('data-src')
    );
  }

  function dedupeStrings(values) {
    const result = [];
    const seen = new Set();
    for (const raw of values) {
      const cleaned = cleanText(raw);
      if (!cleaned) continue;
      const lower = cleaned.toLowerCase();
      if (lower === '...' || lower === '—' || lower === '-' || lower === 'неизвестно') {
        continue;
      }
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(cleaned);
      }
    }
    return result;
  }

  function joinUnique(values) {
    return dedupeStrings(values).join(', ');
  }

  function parseDurationMinutes(raw) {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      const rounded = Math.round(raw);
      return rounded > 0 && rounded <= 1440 ? rounded : null;
    }
    const text = cleanText(raw);
    if (!text) return null;

    // ISO 8601 duration: PT2H49M, PT169M, PT1H
    const isoMatch = text.match(/^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)$/i);
    if (isoMatch && (isoMatch[1] || isoMatch[2])) {
      const hours = Number.parseInt(isoMatch[1] || '0', 10);
      const mins = Number.parseInt(isoMatch[2] || '0', 10);
      const total = hours * 60 + mins;
      return total > 0 && total <= 1440 ? total : null;
    }

    // Explicit total minutes, e.g. "169 мин. / 02:49", "136 min", "132 mins", or TMDb "169m"
    const onlyMinMatch = text.match(
      /(?:^|[^\p{L}\d])(\d{1,4})\s*(?:мин(?:ут[аы]?)?|m(?:ins?|inutes?)?)(?=$|[^\p{L}\d])/iu
    );
    const hoursMinMatch = text.match(
      /(?:^|[^\p{L}\d])(\d{1,2})\s*(?:ч(?:ас(?:ов|а)?)?|h(?:rs?|ours?)?)\.?\s*(?:(\d{1,2})\s*(?:мин(?:ут[аы]?)?|m(?:ins?|inutes?)?))?(?=$|[^\p{L}\d])/iu
    );
    if (hoursMinMatch) {
      const hours = Number.parseInt(hoursMinMatch[1] || '0', 10);
      const mins = Number.parseInt(hoursMinMatch[2] || '0', 10);
      const total = hours * 60 + mins;
      if (total > 0 && total <= 1440) {
        return total;
      }
    }
    if (onlyMinMatch) {
      const total = Number.parseInt(onlyMinMatch[1], 10);
      if (total > 0 && total <= 1440) {
        return total;
      }
    }

    return null;
  }

  function extractJsonLdNames(field, personOnly = false) {
    if (!field) return [];
    const list = Array.isArray(field) ? field : [field];
    const names = [];
    for (const entry of list) {
      if (typeof entry === 'string') {
        if (!personOnly) names.push(entry);
      } else if (entry && typeof entry === 'object') {
        if (personOnly && entry['@type'] && String(entry['@type']).toLowerCase() !== 'person') {
          continue;
        }
        if (typeof entry.name === 'string') {
          names.push(entry.name);
        }
      }
    }
    return dedupeStrings(names);
  }

  function inferMovieCategory({ isSeries, genresText, rawHints = '' }) {
    const combined = `${genresText || ''} ${rawHints || ''}`.toLowerCase();
    if (/(?:^|[^\p{L}])(?:аниме|anime)(?=$|[^\p{L}])/iu.test(combined)) {
      return 'Аниме';
    }
    if (/мультфильм|animation|animated/.test(combined) && !isSeries) {
      return 'Мультфильмы';
    }
    if (/документальн|documentary/.test(combined) && !isSeries) {
      return 'Документальные';
    }
    if (isSeries) {
      return 'Сериалы';
    }
    return 'Фильмы';
  }

  function getJsonLdItems() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const items = [];
    for (const script of scripts) {
      try {
        const raw = (script.textContent || '')
          .trim()
          .replace(/^\/\*\s*<!\[CDATA\[\s*\*\/\s*/u, '')
          .replace(/\s*\/\*\s*\]\]>\s*\*\/\s*$/u, '');
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
        while (queue.length > 0) {
          const current = queue.shift();
          if (!current || typeof current !== 'object') continue;
          if (Array.isArray(current['@graph'])) {
            queue.push(...current['@graph']);
          }
          items.push(current);
        }
      } catch {
        // Ignore malformed JSON-LD blocks
      }
    }
    return items;
  }

  function addPosterCandidate(candidates, rawUrl) {
    const normalized = toAbsoluteUrl(rawUrl);
    if (normalized && !normalized.endsWith('.svg') && !candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  }

  function findPrimaryJsonLd(types) {
    const items = getJsonLdItems();
    return items.find((item) => {
      const rawType = item['@type'];
      const list = Array.isArray(rawType) ? rawType : [rawType];
      return list.some((t) => typeof t === 'string' && types.includes(t));
    });
  }

  function findKinopoiskRow(labelRegex) {
    const ignoreLinkTexts = new Set([
      '...',
      'ещё',
      'еще',
      'слова',
      'показать всех',
      'свернуть',
      'все сезоны',
    ]);

    const extractValue = (valueEl) => {
      if (!valueEl) return null;
      const rawLinks = Array.from(valueEl.querySelectorAll('a'))
        .map((a) => cleanText(a.textContent))
        .filter((txt) => txt && !ignoreLinkTexts.has(txt.toLowerCase()));
      const text = cleanText(valueEl.textContent)
        .replace(/,\s*\.\.\..*$/u, '')
        .replace(/(?:^|[^\p{L}])слова$/iu, '')
        .trim();
      return { el: valueEl, links: dedupeStrings(rawLinks), text };
    };

    // 1. Standard modern & classic Kinopoisk info rows
    const rowContainers = document.querySelectorAll(
      '[class*="styles_row"], table.info tr, dl > div'
    );
    for (const row of rowContainers) {
      const labelEl =
        row.querySelector('[class*="styles_title"], th, td.type, dt') ||
        row.firstElementChild;
      if (!labelEl) continue;
      const labelText = cleanText(labelEl.textContent);
      if (!labelText || !labelRegex.test(labelText)) continue;

      const valueEl =
        row.querySelector('[class*="styles_value"], td:nth-of-type(2), dd') ||
        labelEl.nextElementSibling;
      const extracted = extractValue(valueEl);
      if (extracted && (extracted.links.length > 0 || extracted.text)) {
        return extracted;
      }
    }

    // 2. Semantic dt/dd pairs directly under dl
    for (const dt of document.querySelectorAll('dt, th')) {
      if (!labelRegex.test(cleanText(dt.textContent))) continue;
      const extracted = extractValue(dt.nextElementSibling);
      if (extracted && (extracted.links.length > 0 || extracted.text)) {
        return extracted;
      }
    }

    // 3. Fallback: small leaf label element with nextElementSibling value
    const candidates = document.querySelectorAll(
      '[class*="styles_title"], [data-tid] > div:first-child, main div, main span'
    );
    for (const el of candidates) {
      if (el.children.length > 1) continue;
      const labelText = cleanText(el.textContent);
      if (!labelText || labelText.length > 36 || !labelRegex.test(labelText)) continue;
      const sibling = el.nextElementSibling;
      if (!sibling) continue;
      const extracted = extractValue(sibling);
      if (extracted && (extracted.links.length > 0 || extracted.text)) {
        return extracted;
      }
    }

    return null;
  }

  function extractRowList(row) {
    if (!row) return [];
    if (row.links.length > 0) {
      return row.links;
    }
    return dedupeStrings(row.text.split(','));
  }

  function parseKinopoisk() {
    const jsonLd = findPrimaryJsonLd(['Movie', 'TVSeries', 'CreativeWork']);
    const rawH1 = queryText([
      'h1[itemprop="name"]',
      'h1[class*="styles_title"]',
      'h1[data-tid]',
      'main h1',
      'h1',
    ]);

    let yearFromTitle = extractYear(rawH1);
    let title = rawH1
      .replace(/\s*\((?:(?:фильм|сериал|мини-сериал)[^)]*|\d{4}(?:\s*[–-]\s*(?:\d{4}|\.\.\.))?)\)\s*$/i, '')
      .trim();

    if (!title) {
      const ogTitle = getMetaContent(['meta[property="og:title"]', 'meta[name="twitter:title"]']);
      yearFromTitle = yearFromTitle || extractYear(ogTitle);
      title = ogTitle
        .replace(/\s*[—–-]\s*Кинопоиск.*$/i, '')
        .replace(/\s*\(\d{4}[^)]*\)\s*$/i, '')
        .trim();
    }

    if (!title && jsonLd?.name) {
      title = cleanText(jsonLd.name);
    }

    if (!title || title.toLowerCase() === 'кинопоиск') {
      return null;
    }

    let originalTitle = queryText([
      '[class*="styles_originalTitle"]',
      '[itemprop="alternativeHeadline"]',
      '[data-tid="5443406d"]',
    ]);
    if (/^\d+\+$/.test(originalTitle)) {
      originalTitle = '';
    }
    if (!originalTitle && jsonLd?.alternateName) {
      originalTitle = cleanText(jsonLd.alternateName);
    }
    if (originalTitle.toLowerCase() === title.toLowerCase()) {
      originalTitle = '';
    }

    const yearRow = findKinopoiskRow(/^год производства$/i);
    let year =
      extractYear(
        queryText([
          'a[href*="/lists/movies/year--"]',
          'a[href*="year--"]',
          '[class*="styles_year"]',
          '[data-tid="75209b22"]',
        ])
      ) ||
      extractYear(yearRow?.text) ||
      yearFromTitle;

    if (!year && jsonLd?.datePublished) {
      year = extractYear(jsonLd.datePublished);
    }
    if (!year) {
      year = extractYear(document.title);
    }

    const directorRow = findKinopoiskRow(/^режисс[её]р/i);
    let director = joinUnique(extractRowList(directorRow));
    if (!director) {
      const itempropDirectors = Array.from(
        document.querySelectorAll('[itemprop="director"] [itemprop="name"], [itemprop="director"]')
      ).map((el) => el.textContent);
      director = joinUnique(itempropDirectors);
    }
    if (!director) {
      director = joinUnique([
        ...extractJsonLdNames(jsonLd?.director, true),
        ...extractJsonLdNames(jsonLd?.creator, true),
      ]);
    }

    const genreRow = findKinopoiskRow(/^жанр/i);
    let genres = joinUnique(extractRowList(genreRow));
    if (!genres) {
      const itempropGenres = Array.from(document.querySelectorAll('[itemprop="genre"]')).map(
        (el) => el.textContent
      );
      genres = joinUnique(itempropGenres);
    }
    if (!genres) {
      genres = joinUnique(extractJsonLdNames(jsonLd?.genre));
    }

    const countryRow = findKinopoiskRow(/^стран[аы]/i);
    let country = joinUnique(extractRowList(countryRow));
    if (!country) {
      country = joinUnique(extractJsonLdNames(jsonLd?.countryOfOrigin));
    }

    const timeRow = findKinopoiskRow(/^(?:время|длительность)/i);
    const runtimeMinutes =
      parseDurationMinutes(timeRow?.text) ||
      parseDurationMinutes(queryText(['[itemprop="duration"]'])) ||
      parseDurationMinutes(jsonLd?.duration) ||
      parseDurationMinutes(jsonLd?.timeRequired);

    let seasonsTotal = null;
    const seasonsRow = findKinopoiskRow(/^сезон/i);
    const seasonsSources = [
      seasonsRow?.text,
      rawH1,
      document.title,
      queryText(['[class*="styles_seasons"]', '[data-tid*="season"]']),
    ];
    for (const sourceText of seasonsSources) {
      if (!sourceText) continue;
      const rangeMatch = sourceText.match(/\d+\s*[–-]\s*(\d+)\s*сезон/i);
      const countMatch = sourceText.match(/(\d+)\s*сезон/i);
      const parsedCount = Number.parseInt((rangeMatch || countMatch)?.[1] || '', 10);
      if (parsedCount > 0 && parsedCount <= 200) {
        seasonsTotal = parsedCount;
        break;
      }
    }
    if (!seasonsTotal && Number.isFinite(Number(jsonLd?.numberOfSeasons))) {
      const parsed = Math.round(Number(jsonLd.numberOfSeasons));
      if (parsed > 0 && parsed <= 200) {
        seasonsTotal = parsed;
      }
    }

    const ldTypes = Array.isArray(jsonLd?.['@type'])
      ? jsonLd['@type']
      : [jsonLd?.['@type']];
    const isSeries =
      /\/series\//i.test(window.location.pathname) ||
      ldTypes.includes('TVSeries') ||
      (seasonsTotal !== null && seasonsTotal > 0) ||
      /(?:^|[^\p{L}])сериал(?:$|[^\p{L}])/iu.test(rawH1);

    const category = inferMovieCategory({
      isSeries,
      genresText: genres,
      rawHints: `${rawH1} ${document.title}`,
    });

    let description = '';
    const paragraphs = document.querySelectorAll(
      '[class*="styles_synopsis"] p[class*="styles_paragraph"], p[class*="styles_paragraph"], [itemprop="description"]'
    );
    for (const p of paragraphs) {
      const text = cleanText(p.textContent);
      if (text.length > 20) {
        description = text;
        break;
      }
    }
    if (!description && jsonLd?.description) {
      description = cleanText(jsonLd.description);
    }
    if (!description) {
      description = getMetaContent([
        'meta[name="description"]',
        'meta[property="og:description"]',
      ]);
    }

    let posterUrl = null;
    const posterSelectors = [
      '[class*="styles_poster"] img',
      'img.film-poster',
      'img[src*="poster"]',
      'img[src*="avatars.mds.yandex.net/get-kinopoisk-image"]',
    ];
    for (const selector of posterSelectors) {
      const candidates = document.querySelectorAll(selector);
      for (const img of candidates) {
        const w = img.naturalWidth || Number.parseInt(img.getAttribute('width') || '0', 10);
        if (w > 0 && w < 60) continue;
        const url = pickImageUrl(img);
        if (url && !url.endsWith('.svg')) {
          posterUrl = url;
          break;
        }
      }
      if (posterUrl) break;
    }

    if (!posterUrl) {
      const jsonImage = typeof jsonLd?.image === 'string' ? jsonLd.image : jsonLd?.image?.url;
      posterUrl =
        toAbsoluteUrl(jsonImage) ||
        toAbsoluteUrl(getMetaContent(['meta[property="og:image"]']));
    }

    return {
      title,
      original_title: originalTitle,
      year: year ?? null,
      type: 'movie',
      category,
      director,
      genres,
      country,
      runtime_minutes: runtimeMinutes ?? null,
      seasons_total: seasonsTotal ?? null,
      description,
      poster_url: posterUrl,
      source_url: window.location.href,
    };
  }

  function parseImdb() {
    const jsonLd = findPrimaryJsonLd(['Movie', 'TVSeries', 'CreativeWork']);

    let title = queryText([
      'h1[data-testid="hero__pageTitle"] [data-testid="hero__primary-text"]',
      'h1[data-testid="hero__pageTitle"]',
      'h1',
    ]);

    if (!title && jsonLd?.name) {
      title = cleanText(jsonLd.name);
    }
    if (!title) {
      title = getMetaContent(['meta[property="og:title"]'])
        .replace(/\s*\([^)]*\)\s*[⭐★]?.*$/u, '')
        .replace(/\s*-\s*IMDb$/i, '')
        .trim();
    }

    if (!title) {
      return null;
    }

    let originalTitle = '';
    const heroTitleEl = document.querySelector('h1[data-testid="hero__pageTitle"]');
    if (heroTitleEl?.parentElement) {
      const children = heroTitleEl.parentElement.querySelectorAll('div, span');
      for (const child of children) {
        const text = cleanText(child.textContent);
        const match = text.match(/^Original title:\s*(.+)$/i);
        if (match && match[1]) {
          originalTitle = cleanText(match[1]);
          break;
        }
      }
    }
    if (!originalTitle && jsonLd?.name) {
      const ldName = cleanText(jsonLd.name);
      if (ldName && ldName.toLowerCase() !== title.toLowerCase()) {
        originalTitle = ldName;
      }
    }
    if (originalTitle.toLowerCase() === title.toLowerCase()) {
      originalTitle = '';
    }

    const year =
      extractYear(
        queryText([
          'ul[data-testid="hero-title-block__metadata"] a[href*="releaseinfo"]',
          'a[href*="/releaseinfo"]',
          'h1[data-testid="hero__pageTitle"] ~ ul li',
        ])
      ) ||
      extractYear((document.title.match(/\(([^)]+)\)/) || [])[1]) ||
      extractYear(jsonLd?.datePublished) ||
      extractYear(document.title);

    const creditItems = document.querySelectorAll('[data-testid="title-pc-principal-credit"]');
    const domDirectors = [];
    for (const item of creditItems) {
      const labelText = cleanText(
        item.querySelector(
          'span.ipc-metadata-list-item__label, a.ipc-metadata-list-item__label, span, a'
        )?.textContent
      );
      if (/^(?:director|directors|creator|creators|режисс)/i.test(labelText)) {
        const links = item.querySelectorAll(
          'li a.ipc-metadata-list-item__list-content-item, a[href*="/name/"]'
        );
        for (const link of links) {
          domDirectors.push(link.textContent);
        }
      }
    }
    const director = joinUnique(
      domDirectors.length > 0
        ? domDirectors
        : [
            ...extractJsonLdNames(jsonLd?.director, true),
            ...extractJsonLdNames(jsonLd?.creator, true),
          ]
    );

    const domGenres = Array.from(
      document.querySelectorAll('[data-testid="genres"] a, [data-testid="genres"] span.ipc-chip__text')
    ).map((el) => el.textContent);
    const genres = joinUnique(
      domGenres.length > 0 ? domGenres : extractJsonLdNames(jsonLd?.genre)
    );

    const domCountries = Array.from(
      document.querySelectorAll('[data-testid="title-details-origin"] a')
    ).map((el) => el.textContent);
    const country = joinUnique(
      domCountries.length > 0
        ? domCountries
        : extractJsonLdNames(jsonLd?.countryOfOrigin)
    );

    let runtimeMinutes = parseDurationMinutes(
      queryText([
        '[data-testid="title-techspec_runtime"] .ipc-metadata-list-item__content-container',
        '[data-testid="title-techspec_runtime"]',
      ])
    );
    if (!runtimeMinutes) {
      const heroItems = document.querySelectorAll(
        'ul[data-testid="hero-title-block__metadata"] li, h1[data-testid="hero__pageTitle"] ~ ul li'
      );
      for (const li of heroItems) {
        const parsed = parseDurationMinutes(li.textContent);
        if (parsed) {
          runtimeMinutes = parsed;
          break;
        }
      }
    }
    if (!runtimeMinutes) {
      runtimeMinutes = parseDurationMinutes(jsonLd?.duration);
    }

    let seasonsTotal = null;
    const seasonSelectOptions = document.querySelectorAll('select#browse-episodes-season option');
    if (seasonSelectOptions.length > 0) {
      const seasonNums = Array.from(seasonSelectOptions)
        .map((opt) => Number.parseInt(opt.value || opt.textContent || '', 10))
        .filter((n) => Number.isFinite(n) && n > 0 && n <= 200);
      if (seasonNums.length > 0) {
        seasonsTotal = Math.max(...seasonNums);
      }
    }
    if (!seasonsTotal) {
      const seasonsLabel = queryText(['[data-testid="episodes-header"]', '[data-testid="seasons"]']);
      const match = seasonsLabel.match(/(\d+)\s*season/i);
      if (match) {
        const parsed = Number.parseInt(match[1], 10);
        if (parsed > 0 && parsed <= 200) {
          seasonsTotal = parsed;
        }
      }
    }
    if (!seasonsTotal && Number.isFinite(Number(jsonLd?.numberOfSeasons))) {
      const parsed = Math.round(Number(jsonLd.numberOfSeasons));
      if (parsed > 0 && parsed <= 200) {
        seasonsTotal = parsed;
      }
    }

    const ldTypes = Array.isArray(jsonLd?.['@type'])
      ? jsonLd['@type']
      : [jsonLd?.['@type']];
    const isSeries =
      ldTypes.includes('TVSeries') ||
      (seasonsTotal !== null && seasonsTotal > 0) ||
      /TV Series|TV Mini Series/i.test(
        queryText(['ul[data-testid="hero-title-block__metadata"] li']) + ' ' + document.title
      );
    const category = inferMovieCategory({
      isSeries,
      genresText: genres,
      rawHints: document.title,
    });

    const imdbIdMatch = window.location.pathname.match(/\/title\/(tt\d+)/i);
    const imdbId = imdbIdMatch ? imdbIdMatch[1].toLowerCase() : null;

    const description =
      queryText([
        '[data-testid="plot-xl"]',
        '[data-testid="plot-l"]',
        '[data-testid="plot"] [data-testid="plot-xs_to_m"]',
        '[data-testid="plot"]',
      ]) ||
      getMetaContent(['meta[name="description"]', 'meta[property="og:description"]']) ||
      cleanText(jsonLd?.description);

    let posterUrl = null;
    const posterImg =
      document.querySelector('[data-testid="hero-media__poster"] img.ipc-image') ||
      document.querySelector('img.ipc-image');
    if (posterImg) {
      posterUrl = pickImageUrl(posterImg);
    }
    if (!posterUrl) {
      const jsonImage = typeof jsonLd?.image === 'string' ? jsonLd.image : jsonLd?.image?.url;
      posterUrl =
        toAbsoluteUrl(jsonImage) ||
        toAbsoluteUrl(getMetaContent(['meta[property="og:image"]']));
    }

    return {
      title,
      original_title: originalTitle,
      year: year ?? null,
      type: 'movie',
      category,
      director,
      genres,
      country,
      runtime_minutes: runtimeMinutes ?? null,
      seasons_total: seasonsTotal ?? null,
      imdb_id: imdbId,
      description,
      poster_url: posterUrl,
      source_url: window.location.href,
    };
  }

  function parseSteam() {
    let title = queryText(['div.apphub_AppName', '#appHubAppName', 'h1']);
    if (!title) {
      title = getMetaContent(['meta[property="og:title"]'])
        .replace(/^Save \d+% on\s+/i, '')
        .replace(/^Скидка \d+% на\s+/i, '')
        .replace(/\s+(?:on|в)\s+Steam$/i, '')
        .trim();
    }

    if (!title) {
      return null;
    }

    const year =
      extractYear(queryText(['div.release_date div.date', 'div.date'])) ||
      extractYear(getMetaContent(['meta[property="og:release_date"]']));

    // Developers & Publishers map to `country` ("Разработчик / Издатель") in Lierkour games
    const devLinks = Array.from(
      document.querySelectorAll('#developers_list a, a[href*="developer="]')
    ).map((el) => el.textContent);
    const pubLinks = [];
    for (const row of document.querySelectorAll('.dev_row')) {
      const subtitle = cleanText(row.querySelector('.subtitle')?.textContent);
      if (/разработчик|developer/i.test(subtitle)) {
        for (const a of row.querySelectorAll('.summary a')) {
          devLinks.push(a.textContent);
        }
      } else if (/издатель|publisher/i.test(subtitle)) {
        for (const a of row.querySelectorAll('.summary a')) {
          pubLinks.push(a.textContent);
        }
      }
    }
    if (pubLinks.length === 0) {
      for (const a of document.querySelectorAll('a[href*="publisher="]')) {
        pubLinks.push(a.textContent);
      }
    }
    const developerOrPublisher = joinUnique([...devLinks, ...pubLinks]);

    const steamGenreLinks = Array.from(
      document.querySelectorAll(
        '#genresAndManufacturer a[href*="/genre/"], .details_block a[href*="/genre/"]'
      )
    ).map((el) => el.textContent);
    const fallbackTags =
      steamGenreLinks.length > 0
        ? steamGenreLinks
        : Array.from(document.querySelectorAll('.glance_tags a.app_tag'))
            .slice(0, 4)
            .map((el) => el.textContent)
            .filter((txt) => txt && cleanText(txt) !== '+');
    const genres = joinUnique(fallbackTags);

    let description = queryText(['div.game_description_snippet']);
    if (!description) {
      description = getMetaContent(['meta[name="description"]', 'meta[property="og:description"]']);
    }
    if (!description) {
      const aboutText = cleanText(document.querySelector('#game_area_description')?.textContent)
        .replace(/^(?:об этой игре|about this game)\s*/i, '')
        .trim();
      if (aboutText) {
        description = aboutText.slice(0, 600);
      }
    }

    const appIdMatch = window.location.pathname.match(/\/app\/(\d+)/i);
    const appId = appIdMatch ? appIdMatch[1] : null;
    const posterCandidates = [];
    if (appId) {
      posterCandidates.push(
        `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900_2x.jpg`,
        `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`,
        `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900_2x.jpg`,
        `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`
      );
    }

    const headerUrl = pickImageUrl(document.querySelector('img.game_header_image_full'));
    const ogImageUrl = toAbsoluteUrl(getMetaContent(['meta[property="og:image"]']));
    for (const fallbackUrl of [headerUrl, ogImageUrl]) {
      const normalized = toAbsoluteUrl(fallbackUrl);
      if (normalized && !posterCandidates.includes(normalized)) {
        posterCandidates.push(normalized);
      }
    }

    return {
      title,
      original_title: '',
      year: year ?? null,
      type: 'game',
      category: 'Игры',
      genres,
      country: developerOrPublisher,
      platform: 'ПК',
      launcher: 'Steam',
      description,
      poster_url: posterCandidates[0] || null,
      poster_candidates: posterCandidates,
      source_url: window.location.href,
    };
  }

  function parseTmdb() {
    const pathname = window.location.pathname || '';
    const jsonLd = findPrimaryJsonLd(['Movie', 'TVSeries', 'CreativeWork']);
    const isMediaPath = /^\/(?:movie|tv)\/\d+/i.test(pathname);
    if (!isMediaPath && !jsonLd) {
      return null;
    }

    let title = queryText([
      'section.header div.title h2 a',
      'div.title h2 a',
      'section.header h2 a',
      'h1',
    ]).replace(/\s*\(\d{4}\)\s*$/, '').trim();

    if (!title && jsonLd?.name) {
      title = cleanText(jsonLd.name);
    }
    if (!title) {
      title = getMetaContent(['meta[property="og:title"]', 'meta[name="twitter:title"]'])
        .replace(/\s*[—–-]\s*(?:The Movie Database|TMDB).*$/i, '')
        .replace(/\s*\(\d{4}(?:\s*[–-]\s*(?:\d{4})?)?\)\s*$/, '')
        .trim();
    }
    if (!title) {
      return null;
    }

    let year =
      extractYear(
        queryText([
          'span.tag.release_date',
          'div.title span.release_date',
          '.facts span.release',
        ])
      ) ||
      extractYear(getMetaContent(['meta[property="og:title"]'])) ||
      extractYear(jsonLd?.datePublished) ||
      extractYear(document.title);

    let originalTitle = '';
    for (const p of document.querySelectorAll('.facts p, p.wrap')) {
      const txt = cleanText(p.textContent);
      const match = txt.match(/^(?:Original Title|Исходное название)\s+(.+)$/i);
      if (match && match[1]) {
        originalTitle = cleanText(match[1]);
        break;
      }
    }
    if (!originalTitle && jsonLd?.alternateName) {
      originalTitle = cleanText(jsonLd.alternateName);
    }
    if (originalTitle.toLowerCase() === title.toLowerCase()) {
      originalTitle = '';
    }

    const domDirectors = [];
    for (const card of document.querySelectorAll('ol.people li.profile')) {
      const role = cleanText(card.querySelector('p.character')?.textContent);
      if (/director|режисс|creator|создател/i.test(role)) {
        const personName = cleanText(card.querySelector('p:first-child a, a')?.textContent);
        if (personName) domDirectors.push(personName);
      }
    }
    const director = joinUnique(
      domDirectors.length > 0
        ? domDirectors
        : [
            ...extractJsonLdNames(jsonLd?.director, true),
            ...extractJsonLdNames(jsonLd?.creator, true),
          ]
    );

    const domGenres = Array.from(
      document.querySelectorAll('span.genres a, .facts span.genres a')
    ).map((el) => el.textContent);
    const genres = joinUnique(
      domGenres.length > 0 ? domGenres : extractJsonLdNames(jsonLd?.genre)
    );

    let country = '';
    for (const p of document.querySelectorAll('.facts p')) {
      const txt = cleanText(p.textContent);
      const match = txt.match(/^(?:Production Country|Country|Страна производства|Страна)\s+(.+)$/i);
      if (match && match[1]) {
        country = cleanText(match[1]);
        break;
      }
    }
    if (!country) {
      country = joinUnique(extractJsonLdNames(jsonLd?.countryOfOrigin));
    }

    const runtimeMinutes =
      parseDurationMinutes(queryText(['span.runtime', '.facts span.runtime'])) ||
      parseDurationMinutes(jsonLd?.duration);

    let seasonsTotal = null;
    for (const sourceText of [
      queryText(['section.panel.season h2 a', 'section.panel.season h2', 'a[href*="/seasons"]']),
      cleanText(document.querySelector('section.panel.season')?.textContent),
    ]) {
      if (!sourceText) continue;
      const match = sourceText.match(/(?:Season|Сезон)\s*(\d+)|(\d+)\s*(?:Seasons?|Сезон)/i);
      const count = Number.parseInt(match?.[1] || match?.[2] || '', 10);
      if (count > 0 && count <= 200) {
        seasonsTotal = count;
        break;
      }
    }
    if (!seasonsTotal && Number.isFinite(Number(jsonLd?.numberOfSeasons))) {
      const count = Math.round(Number(jsonLd.numberOfSeasons));
      if (count > 0 && count <= 200) {
        seasonsTotal = count;
      }
    }

    const ldTypes = Array.isArray(jsonLd?.['@type'])
      ? jsonLd['@type']
      : [jsonLd?.['@type']];
    const isSeries =
      /^\/tv\//i.test(pathname) ||
      ldTypes.includes('TVSeries') ||
      (seasonsTotal !== null && seasonsTotal > 0);

    const category = inferMovieCategory({
      isSeries,
      genresText: genres,
      rawHints: `${title} ${document.title}`,
    });

    const description =
      queryText(['div.overview p', '.overview p']) ||
      getMetaContent(['meta[name="description"]', 'meta[property="og:description"]']) ||
      cleanText(jsonLd?.description);

    const posterCandidates = [];
    const posterImg =
      document.querySelector('div.poster img.poster') ||
      document.querySelector('img.poster');
    if (posterImg) {
      addPosterCandidate(posterCandidates, pickImageUrl(posterImg));
    }
    const jsonImage = typeof jsonLd?.image === 'string' ? jsonLd.image : jsonLd?.image?.url;
    addPosterCandidate(posterCandidates, jsonImage);
    addPosterCandidate(posterCandidates, getMetaContent(['meta[property="og:image"]']));

    return {
      title,
      original_title: originalTitle,
      year: year ?? null,
      type: 'movie',
      category,
      director,
      genres,
      country,
      runtime_minutes: runtimeMinutes ?? null,
      seasons_total: seasonsTotal ?? null,
      description,
      poster_url: posterCandidates[0] || null,
      poster_candidates: posterCandidates,
      source_url: window.location.href,
    };
  }

  function parseLetterboxd() {
    const pathname = window.location.pathname || '';
    const jsonLd = findPrimaryJsonLd(['Movie', 'TVSeries', 'CreativeWork']);
    if (!/^\/film\/[^/]+/i.test(pathname) && !jsonLd) {
      return null;
    }

    let title = queryText([
      'h1.headline-1',
      'section.film-header-lockup h1',
      'h1[itemprop="name"]',
      'span.name.js-widont',
    ]);
    if (!title && jsonLd?.name) {
      title = cleanText(jsonLd.name);
    }
    if (!title) {
      title = getMetaContent(['meta[property="og:title"]'])
        .replace(/\s*\(\d{4}\)\s*$/, '')
        .trim();
    }
    if (!title) {
      return null;
    }

    let originalTitle = queryText(['h2.originalname']);
    if (!originalTitle && jsonLd?.alternateName) {
      originalTitle = cleanText(jsonLd.alternateName);
    }
    if (originalTitle.toLowerCase() === title.toLowerCase()) {
      originalTitle = '';
    }

    const ldRelease = Array.isArray(jsonLd?.releasedEvent)
      ? jsonLd.releasedEvent[0]?.startDate
      : jsonLd?.datePublished;
    const year =
      extractYear(
        queryText([
          '.releaseyear a',
          'div.metablock a[href*="/year/"]',
          'small.number a',
        ])
      ) ||
      extractYear(ldRelease) ||
      extractYear(getMetaContent(['meta[property="og:title"]'])) ||
      extractYear(document.title);

    const domDirectors = Array.from(
      document.querySelectorAll(
        'a[href*="/director/"] span.prettify, .directorlist a, a[href*="/director/"]'
      )
    ).map((el) => el.textContent);
    const director = joinUnique(
      domDirectors.length > 0
        ? domDirectors
        : extractJsonLdNames(jsonLd?.director, true)
    );

    const domGenres = Array.from(
      document.querySelectorAll(
        '#tab-genres a[href*="/films/genre/"], .text-sluglist a[href*="/films/genre/"]'
      )
    ).map((el) => el.textContent);
    const genres = joinUnique(
      domGenres.length > 0 ? domGenres : extractJsonLdNames(jsonLd?.genre)
    );

    const domCountries = Array.from(
      document.querySelectorAll(
        '#tab-details a[href*="/films/country/"], a[href*="/films/country/"]'
      )
    ).map((el) => el.textContent);
    const country = joinUnique(
      domCountries.length > 0
        ? domCountries
        : extractJsonLdNames(jsonLd?.countryOfOrigin)
    );

    const runtimeMinutes =
      parseDurationMinutes(queryText(['p.text-link.text-footer', 'div.section p.text-footer'])) ||
      parseDurationMinutes(jsonLd?.duration);

    let imdbId = null;
    const imdbLink = document.querySelector(
      'a[data-track-action="IMDb"], a[href*="imdb.com/title/tt"]'
    );
    const imdbHref = imdbLink?.getAttribute('href') || '';
    const imdbMatch = imdbHref.match(/\/title\/(tt\d+)/i);
    if (imdbMatch) {
      imdbId = imdbMatch[1].toLowerCase();
    }

    const description =
      queryText(['div.review.body-text.-prose.collapsible-text p', 'div.truncate p']) ||
      getMetaContent(['meta[name="description"]', 'meta[property="og:description"]']) ||
      cleanText(jsonLd?.description);

    const posterCandidates = [];
    for (const img of document.querySelectorAll(
      'section.poster-list img.image, div.film-poster img.image, div.film-poster img'
    )) {
      const url = pickImageUrl(img);
      if (url && !/empty-poster/i.test(url)) {
        addPosterCandidate(posterCandidates, url);
      }
    }
    const jsonImage = typeof jsonLd?.image === 'string' ? jsonLd.image : jsonLd?.image?.url;
    addPosterCandidate(posterCandidates, jsonImage);
    addPosterCandidate(posterCandidates, getMetaContent(['meta[property="og:image"]']));

    const category = inferMovieCategory({
      isSeries: false,
      genresText: genres,
      rawHints: `${title} ${document.title}`,
    });

    return {
      title,
      original_title: originalTitle,
      year: year ?? null,
      type: 'movie',
      category,
      director,
      genres,
      country,
      runtime_minutes: runtimeMinutes ?? null,
      imdb_id: imdbId,
      description,
      poster_url: posterCandidates[0] || null,
      poster_candidates: posterCandidates,
      source_url: window.location.href,
    };
  }

  function findLabeledSideValue(containerSelector, labelRegex) {
    for (const row of document.querySelectorAll(containerSelector)) {
      const children = row.children;
      if (!children || children.length < 2) continue;
      const labelText = cleanText(children[0].textContent);
      if (labelText && labelText.length <= 36 && labelRegex.test(labelText)) {
        const valEl = children[children.length - 1];
        const links = Array.from(valEl.querySelectorAll('a'))
          .map((a) => cleanText(a.textContent))
          .filter(Boolean);
        return {
          links: dedupeStrings(links),
          text: cleanText(valEl.textContent),
        };
      }
    }
    return null;
  }

  function parseEpicGames() {
    const pathname = window.location.pathname || '';
    const jsonLd = findPrimaryJsonLd(['VideoGame', 'Product', 'SoftwareApplication']);
    if (!/\/(?:p|bundles)\//i.test(pathname) && !jsonLd) {
      return null;
    }

    let title = queryText([
      'h1[data-testid="pdp-title"]',
      'span[data-testid="offer-title-info-title"]',
      'h1',
    ]);
    if (!title && jsonLd?.name) {
      title = cleanText(jsonLd.name);
    }
    if (!title) {
      title = getMetaContent(['meta[property="og:title"]', 'meta[name="twitter:title"]'])
        .replace(/\s*[|—–-]\s*(?:Epic Games Store|Download and Buy Today).*$/i, '')
        .replace(/\s*[|—–-]\s*Epic Games.*$/i, '')
        .trim();
    }
    if (!title) {
      return null;
    }

    const devRow = findLabeledSideValue(
      '[data-testid*="metadata"] > div, aside div',
      /^(?:developer|разработчик)$/i
    );
    const pubRow = findLabeledSideValue(
      '[data-testid*="metadata"] > div, aside div',
      /^(?:publisher|издатель)$/i
    );
    const relRow = findLabeledSideValue(
      '[data-testid*="metadata"] > div, aside div',
      /^(?:release date|initial release|дата выхода|дата релиза)$/i
    );
    const genreRow = findLabeledSideValue(
      '[data-testid*="metadata"] > div, aside div',
      /^(?:genres?|жанр[ы]?)$/i
    );

    const developerOrPublisher = joinUnique([
      ...(devRow ? (devRow.links.length ? devRow.links : [devRow.text]) : []),
      ...(pubRow ? (pubRow.links.length ? pubRow.links : [pubRow.text]) : []),
      ...extractJsonLdNames(jsonLd?.author),
      ...extractJsonLdNames(jsonLd?.publisher),
    ]);

    const year =
      extractDateYear(relRow?.text) ||
      extractDateYear(queryText(['[data-testid*="release"]', 'time'])) ||
      extractDateYear(jsonLd?.releaseDate) ||
      extractDateYear(jsonLd?.datePublished);

    const genreLinks = Array.from(
      document.querySelectorAll('a[href*="/browse?genre="], a[href*="genre="]')
    ).map((el) => el.textContent);
    const genres = joinUnique([
      ...genreLinks,
      ...(genreRow ? (genreRow.links.length ? genreRow.links : genreRow.text.split(',')) : []),
      ...extractJsonLdNames(jsonLd?.genre),
    ]);

    const description =
      queryText(['[data-testid="about-short-description"]']) ||
      getMetaContent(['meta[name="description"]', 'meta[property="og:description"]']) ||
      cleanText(jsonLd?.description);

    const posterCandidates = [];
    const portraitFirst = [];
    const landscapeLater = [];
    for (const img of document.querySelectorAll(
      '[data-testid="pdp-sidebar"] img, aside img, [data-testid="picture"] img'
    )) {
      const url = pickImageUrl(img);
      if (!url) continue;
      const w = img.naturalWidth || 0;
      const h = img.naturalHeight || 0;
      if ((h > 0 && w > 0 && h > w) || /tall|portrait|box|cover/i.test(url)) {
        portraitFirst.push(url);
      } else {
        landscapeLater.push(url);
      }
    }
    const jsonImage = typeof jsonLd?.image === 'string' ? jsonLd.image : jsonLd?.image?.url;
    for (const url of [
      ...portraitFirst,
      ...landscapeLater,
      jsonImage,
      getMetaContent(['meta[property="og:image"]', 'meta[name="twitter:image"]']),
    ]) {
      addPosterCandidate(posterCandidates, url);
    }

    return {
      title,
      original_title: '',
      year: year ?? null,
      type: 'game',
      category: 'Игры',
      genres,
      country: developerOrPublisher,
      platform: 'ПК',
      launcher: 'Epic Games',
      description,
      poster_url: posterCandidates[0] || null,
      poster_candidates: posterCandidates,
      source_url: window.location.href,
    };
  }

  function parseGog() {
    const pathname = window.location.pathname || '';
    const jsonLd = findPrimaryJsonLd(['VideoGame', 'Product']);
    if (!/\/game\//i.test(pathname) && !document.querySelector('h1.productcard-basics__title') && !jsonLd) {
      return null;
    }

    let title = queryText([
      'h1.productcard-basics__title',
      '[selenium-id="productTitle"]',
      'h1',
    ]);
    if (!title && jsonLd?.name) {
      title = cleanText(jsonLd.name);
    }
    if (!title) {
      title = getMetaContent(['meta[property="og:title"]'])
        .replace(/\s+(?:on|в)\s+GOG\.com$/i, '')
        .trim();
    }
    if (!title) {
      return null;
    }

    const findGogRow = (labelRegex) => {
      for (const row of document.querySelectorAll('.details__row, .table__row')) {
        const labelEl = row.querySelector('.details__category, .table__row-label');
        const valueEl = row.querySelector('.details__content, .table__row-content');
        if (!labelEl || !valueEl) continue;
        if (labelRegex.test(cleanText(labelEl.textContent))) {
          const links = Array.from(valueEl.querySelectorAll('a'))
            .map((a) => cleanText(a.textContent))
            .filter(Boolean);
          return {
            links: dedupeStrings(links),
            text: cleanText(valueEl.textContent),
          };
        }
      }
      return null;
    };

    const companyRow = findGogRow(/company|developer|publisher|компани|разработчик|издатель/i);
    const genreRow = findGogRow(/genre|tags|жанр|тег/i);
    const releaseRow = findGogRow(/release date|дата выхода/i);

    const domCompanies = Array.from(
      document.querySelectorAll(
        '.productcard-basics__company a, a[href*="/games?developers="], a[href*="/games?publishers="]'
      )
    ).map((el) => el.textContent);
    const developerOrPublisher = joinUnique([
      ...(companyRow ? (companyRow.links.length ? companyRow.links : companyRow.text.split('/')) : []),
      ...domCompanies,
      ...extractJsonLdNames(jsonLd?.author),
      ...extractJsonLdNames(jsonLd?.publisher),
    ]);

    const domGenres = Array.from(
      document.querySelectorAll(
        '.productcard-basics__genre a, a[href*="/games?genres="]'
      )
    ).map((el) => el.textContent);
    const genres = joinUnique([
      ...domGenres,
      ...(genreRow ? (genreRow.links.length ? genreRow.links : genreRow.text.split(',')) : []),
      ...extractJsonLdNames(jsonLd?.genre),
    ]);

    const year =
      extractDateYear(releaseRow?.text) ||
      extractDateYear(queryText(['[selenium-id="releaseDate"]'])) ||
      extractDateYear(jsonLd?.releaseDate) ||
      extractDateYear(jsonLd?.datePublished);

    const description =
      getMetaContent(['meta[name="description"]', 'meta[property="og:description"]']) ||
      cleanText(jsonLd?.description) ||
      queryText(['div.description'])?.slice(0, 600);

    const posterCandidates = [];
    for (const img of document.querySelectorAll(
      'img.productcard-player__cover, img[src*="gog-statics.com"]'
    )) {
      const url = pickImageUrl(img);
      if (!url) continue;
      if (/box_art|product_card|cover/i.test(url) || (img.naturalWidth || 0) >= 120) {
        addPosterCandidate(posterCandidates, url);
      }
    }
    const jsonImage = typeof jsonLd?.image === 'string' ? jsonLd.image : jsonLd?.image?.url;
    addPosterCandidate(posterCandidates, jsonImage);
    addPosterCandidate(posterCandidates, getMetaContent(['meta[property="og:image"]']));

    return {
      title,
      original_title: '',
      year: year ?? null,
      type: 'game',
      category: 'Игры',
      genres,
      country: developerOrPublisher,
      platform: 'ПК',
      launcher: 'GOG',
      description,
      poster_url: posterCandidates[0] || null,
      poster_candidates: posterCandidates,
      source_url: window.location.href,
    };
  }

  function parseItch() {
    const jsonLd = findPrimaryJsonLd(['VideoGame', 'Product', 'SoftwareApplication']);
    const ogType = getMetaContent(['meta[property="og:type"]']).toLowerCase();
    const hasGameDom = Boolean(
      document.querySelector('.game_info_panel_widget, h1.game_title, div.game_header')
    );
    if (!hasGameDom && !ogType.includes('game') && !jsonLd) {
      return null;
    }

    let title = queryText(['h1.game_title', 'h1[itemprop="name"]', 'div.header h1']);
    if (!title && jsonLd?.name) {
      title = cleanText(jsonLd.name);
    }
    if (!title) {
      title = getMetaContent(['meta[property="og:title"]'])
        .replace(/\s+by\s+[^|—-]+$/i, '')
        .trim();
    }
    if (!title) {
      return null;
    }

    const findItchRow = (labelRegex) => {
      for (const tr of document.querySelectorAll('.game_info_panel_widget tr')) {
        const cells = tr.querySelectorAll('td');
        if (cells.length < 2) continue;
        if (labelRegex.test(cleanText(cells[0].textContent))) {
          const valCell = cells[1];
          const links = Array.from(valCell.querySelectorAll('a'))
            .map((a) => cleanText(a.textContent))
            .filter(Boolean);
          const abbrTitle = cleanText(valCell.querySelector('abbr')?.getAttribute('title'));
          return {
            links: dedupeStrings(links),
            text: cleanText(valCell.textContent),
            titleAttr: abbrTitle,
          };
        }
      }
      return null;
    };

    const authorRow = findItchRow(/^(?:author|authors|developer|creator|автор|разработчик)/i);
    const genreRow = findItchRow(/^(?:genre|genres|жанр)/i);
    const tagsRow = findItchRow(/^(?:tags|теги)/i);
    const releaseRow = findItchRow(/^(?:release date|published|updated|дата выхода)/i);

    const domAuthors = Array.from(
      document.querySelectorAll('.game_author a, a.author_link, [itemprop="author"]')
    ).map((el) => el.textContent);
    const developerOrPublisher = joinUnique([
      ...(authorRow ? (authorRow.links.length ? authorRow.links : [authorRow.text]) : []),
      ...domAuthors,
      ...extractJsonLdNames(jsonLd?.author),
    ]);

    const genreList = genreRow
      ? genreRow.links.length
        ? genreRow.links
        : genreRow.text.split(',')
      : [];
    const tagList =
      genreList.length > 0
        ? genreList
        : tagsRow
        ? tagsRow.links.slice(0, 4)
        : [];
    const genres = joinUnique([
      ...tagList,
      ...extractJsonLdNames(jsonLd?.genre),
    ]);

    const year =
      extractDateYear(releaseRow?.titleAttr) ||
      extractDateYear(releaseRow?.text) ||
      extractDateYear(jsonLd?.datePublished);

    const description =
      queryText(['.formatted_description p', 'div.game_description']) ||
      getMetaContent(['meta[name="description"]', 'meta[property="og:description"]']) ||
      cleanText(jsonLd?.description);

    const posterCandidates = [];
    for (const img of document.querySelectorAll(
      '.game_cover img, img.cover_image, div.header img'
    )) {
      addPosterCandidate(posterCandidates, pickImageUrl(img));
    }
    const jsonImage = typeof jsonLd?.image === 'string' ? jsonLd.image : jsonLd?.image?.url;
    addPosterCandidate(posterCandidates, jsonImage);
    addPosterCandidate(posterCandidates, getMetaContent(['meta[property="og:image"]']));

    return {
      title,
      original_title: '',
      year: year ?? null,
      type: 'game',
      category: 'Игры',
      genres,
      country: developerOrPublisher,
      platform: 'ПК',
      launcher: 'Itch.io',
      description,
      poster_url: posterCandidates[0] || null,
      poster_candidates: posterCandidates,
      source_url: window.location.href,
    };
  }

  function getMsg(ruText, enText) {
    const lang = (
      (typeof chrome !== 'undefined' && chrome?.i18n?.getUILanguage
        ? chrome.i18n.getUILanguage()
        : typeof navigator !== 'undefined'
        ? navigator.language
        : 'ru') || 'ru'
    ).toLowerCase();
    return lang.startsWith('ru') ? ruText : enText;
  }

  function extractMediaData() {
    const host = window.location.hostname.toLowerCase();

    let data = null;
    if (host === 'kinopoisk.ru' || host.endsWith('.kinopoisk.ru')) {
      data = parseKinopoisk();
    } else if (host === 'imdb.com' || host.endsWith('.imdb.com')) {
      data = parseImdb();
    } else if (host === 'themoviedb.org' || host.endsWith('.themoviedb.org')) {
      data = parseTmdb();
    } else if (host === 'letterboxd.com' || host.endsWith('.letterboxd.com')) {
      data = parseLetterboxd();
    } else if (
      host === 'store.steampowered.com' ||
      host.endsWith('.store.steampowered.com')
    ) {
      data = parseSteam();
    } else if (host === 'epicgames.com' || host.endsWith('.epicgames.com')) {
      data = parseEpicGames();
    } else if (host === 'gog.com' || host.endsWith('.gog.com')) {
      data = parseGog();
    } else if (host === 'itch.io' || host.endsWith('.itch.io')) {
      data = parseItch();
    } else {
      return {
        ok: false,
        error: getMsg(
          'Откройте карточку на Кинопоиске, IMDb, TMDb, Letterboxd, Steam, Epic Games, GOG или Itch.io.',
          'Open a movie, series, or game page on Kinopoisk, IMDb, TMDb, Letterboxd, Steam, Epic Games, GOG, or Itch.io.'
        ),
      };
    }

    if (!data || !data.title) {
      return {
        ok: false,
        error: getMsg(
          'Не удалось извлечь данные со страницы. Убедитесь, что открыта карточка фильма, сериала или игры.',
          'Could not extract media metadata. Make sure a movie, series, or game page is open.'
        ),
      };
    }

    return { ok: true, data };
  }

  // Optional direct helper kept alongside the adapters for standalone usage.
  async function sendToLierkour(payload, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['X-LierEX-Token'] = token;
    }
    const response = await fetch('http://127.0.0.1:8765/api/import', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return response;
  }

  // Expose cleanly without throwing on repeated script injections.
  window.__lierexExtractMedia = extractMediaData;
  window.__lierexSendToLierkour = sendToLierkour;

  return extractMediaData();
})();
