const TOKEN_STORAGE_KEY = 'lierex_token';
const SUPPORTED_HOSTS = [
  'kinopoisk.ru',
  'imdb.com',
  'themoviedb.org',
  'letterboxd.com',
  'store.steampowered.com',
  'epicgames.com',
  'gog.com',
  'itch.io',
];

const IS_RU = (
  (typeof chrome !== 'undefined' && chrome?.i18n?.getUILanguage
    ? chrome.i18n.getUILanguage()
    : typeof navigator !== 'undefined'
    ? navigator.language
    : 'ru') || 'ru'
)
  .toLowerCase()
  .startsWith('ru');

function t(ruText, enText) {
  return IS_RU ? ruText : enText;
}

const serverDot = document.getElementById('server-dot');
const toggleSettingsBtn = document.getElementById('toggle-settings-btn');
const tokenPanel = document.getElementById('token-panel');
const tokenLabel = document.querySelector('label[for="token-input"]');
const tokenInput = document.getElementById('token-input');
const saveTokenBtn = document.getElementById('save-token-btn');
const tokenHint = document.getElementById('token-hint');

const loadingState = document.getElementById('loading-state');
const loadingText = document.querySelector('#loading-state .state-text');
const errorState = document.getElementById('error-state');
const errorMessageEl = document.getElementById('error-message');
const previewState = document.getElementById('preview-state');

const posterImg = document.getElementById('poster-img');
const posterFallback = document.getElementById('poster-fallback');
const typeBadge = document.getElementById('type-badge');
const yearBadge = document.getElementById('year-badge');
const mediaTitle = document.getElementById('media-title');
const mediaOriginal = document.getElementById('media-original');
const mediaDetails = document.getElementById('media-details');
const mediaDesc = document.getElementById('media-desc');
const statusLabel = document.querySelector('label[for="status-select"]');
const statusSelect = document.getElementById('status-select');
const importBtn = document.getElementById('import-btn');
const copyJsonBtn = document.getElementById('copy-json-btn');
const downloadJsonBtn = document.getElementById('download-json-btn');
const feedbackBanner = document.getElementById('feedback-banner');

let extractedPayload = null;

const CATEGORY_EN = {
  Фильмы: 'Movie',
  Сериалы: 'Series',
  Мультфильмы: 'Animation',
  Аниме: 'Anime',
  Документальные: 'Documentary',
  Игры: 'Game',
};

const STATUS_OPTIONS = {
  movie: [
    { value: 'want_to_watch', ru: 'В планах', en: 'Watchlist' },
    { value: 'watching', ru: 'Смотрю', en: 'Watching' },
    { value: 'watched', ru: 'Просмотрено', en: 'Watched' },
    { value: 'dropped', ru: 'Брошено', en: 'Dropped' },
  ],
  game: [
    { value: 'want_to_watch', ru: 'В планах (бэклог)', en: 'Backlog' },
    { value: 'watching', ru: 'Играю', en: 'Playing' },
    { value: 'watched', ru: 'Пройдена', en: 'Completed' },
    { value: 'dropped', ru: 'Брошена', en: 'Dropped' },
  ],
};

function applyStaticLocale() {
  document.documentElement.lang = IS_RU ? 'ru' : 'en';
  if (tokenLabel) {
    tokenLabel.textContent = t(
      'Токен доступа (из Настроек Lierkour)',
      'Access token (from Lierkour Settings)'
    );
  }
  tokenInput.placeholder = t('Вставьте X-LierEX-Token...', 'Paste X-LierEX-Token...');
  if (tokenHint) {
    tokenHint.textContent = t(
      'Нужен только для отправки в Lierkour (127.0.0.1:8765). Копирование и экспорт JSON работают автономно.',
      'Only needed to sync with Lierkour desktop app (127.0.0.1:8765). Copy & Save JSON work offline.'
    );
  }
  toggleSettingsBtn.title = t('Настройки токена LierEX', 'LierEX token settings');
  toggleSettingsBtn.setAttribute('aria-label', toggleSettingsBtn.title);
  if (loadingText) {
    loadingText.textContent = t('Анализ страницы...', 'Analyzing page...');
  }
  if (statusLabel) {
    statusLabel.textContent = t('Статус', 'Status');
  }
  posterImg.alt = t('Обложка', 'Poster');
  importBtn.textContent = t('Добавить в Lierkour', 'Add to Lierkour');
  if (copyJsonBtn) {
    copyJsonBtn.textContent = t('Копировать JSON', 'Copy JSON');
  }
  if (downloadJsonBtn) {
    downloadJsonBtn.textContent = t('Скачать .json', 'Save .json');
  }
}

function buildPayloadWithStatus() {
  if (!extractedPayload) return null;
  return {
    ...extractedPayload,
    status: statusSelect.value || 'want_to_watch',
  };
}

function populateStatusOptions(mediaType) {
  const options = mediaType === 'game' ? STATUS_OPTIONS.game : STATUS_OPTIONS.movie;
  statusSelect.replaceChildren();
  for (const opt of options) {
    const el = document.createElement('option');
    el.value = opt.value;
    el.textContent = IS_RU ? opt.ru : opt.en;
    statusSelect.appendChild(el);
  }
  statusSelect.value = 'want_to_watch';
}

function buildPosterQueue(data) {
  const queue = [];
  if (data.poster_url) queue.push(data.poster_url);
  if (Array.isArray(data.poster_candidates)) {
    for (const url of data.poster_candidates) {
      if (url && !queue.includes(url)) {
        queue.push(url);
      }
    }
  }
  return queue;
}

async function getSavedToken() {
  try {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      const stored = await chrome.storage.local.get(TOKEN_STORAGE_KEY);
      const token = String(stored?.[TOKEN_STORAGE_KEY] || '').trim();
      if (token) return token;
    }
  } catch {
    // Fallback to localStorage below
  }

  let legacy = '';
  try {
    legacy = (localStorage.getItem(TOKEN_STORAGE_KEY) || '').trim();
    if (legacy && typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.set({ [TOKEN_STORAGE_KEY]: legacy }).catch(() => {});
    }
  } catch {
    legacy = '';
  }
  return legacy;
}

async function saveToken(value) {
  const trimmed = value.trim();
  try {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      if (trimmed) {
        await chrome.storage.local.set({ [TOKEN_STORAGE_KEY]: trimmed });
      } else {
        await chrome.storage.local.remove(TOKEN_STORAGE_KEY);
      }
    }
  } catch {
    // Continue syncing localStorage fallback
  }
  try {
    if (trimmed) {
      localStorage.setItem(TOKEN_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota / disabled localStorage errors
  }
  return trimmed;
}

function showFeedback(text, variant) {
  feedbackBanner.textContent = text;
  feedbackBanner.className = `feedback feedback--${variant}`;
}

function clearFeedback() {
  feedbackBanner.textContent = '';
  feedbackBanner.className = 'feedback hidden';
}

function showError(message) {
  loadingState.classList.add('hidden');
  previewState.classList.add('hidden');
  errorMessageEl.textContent = message;
  errorState.classList.remove('hidden');
}

function showPreview(data) {
  extractedPayload = data;
  loadingState.classList.add('hidden');
  errorState.classList.add('hidden');

  const isGame = data.type === 'game';
  const rawCategory = data.category || (isGame ? 'Игры' : 'Фильмы');
  typeBadge.textContent = IS_RU
    ? rawCategory
    : CATEGORY_EN[rawCategory] || (isGame ? 'Game' : 'Movie');
  typeBadge.className = `badge ${isGame ? 'badge--game' : 'badge--movie'}`;

  populateStatusOptions(isGame ? 'game' : 'movie');

  if (data.year) {
    yearBadge.textContent = String(data.year);
    yearBadge.classList.remove('hidden');
  } else {
    yearBadge.classList.add('hidden');
  }

  mediaTitle.textContent = data.title;

  if (data.original_title && data.original_title !== data.title) {
    mediaOriginal.textContent = data.original_title;
    mediaOriginal.classList.remove('hidden');
  } else {
    mediaOriginal.classList.add('hidden');
  }

  const detailParts = [];
  if (data.director) {
    detailParts.push(IS_RU ? `Реж.: ${data.director}` : `Dir.: ${data.director}`);
  } else if (isGame && data.country) {
    detailParts.push(data.country);
  }
  if (data.genres) {
    detailParts.push(data.genres);
  }
  if (data.runtime_minutes) {
    detailParts.push(IS_RU ? `${data.runtime_minutes} мин` : `${data.runtime_minutes} min`);
  }
  if (detailParts.length > 0) {
    mediaDetails.textContent = detailParts.join(' · ');
    mediaDetails.classList.remove('hidden');
  } else {
    mediaDetails.classList.add('hidden');
  }

  if (data.description) {
    mediaDesc.textContent = data.description;
    mediaDesc.classList.remove('hidden');
  } else {
    mediaDesc.classList.add('hidden');
  }

  posterFallback.textContent = isGame ? '🎮' : '🎬';
  const posterQueue = buildPosterQueue(data);
  if (posterQueue.length > 0) {
    let candidateIndex = 0;
    posterImg.onload = () => {
      posterImg.classList.remove('hidden');
      posterFallback.classList.add('hidden');
    };
    posterImg.onerror = () => {
      candidateIndex += 1;
      if (candidateIndex < posterQueue.length) {
        posterImg.src = posterQueue[candidateIndex];
      } else {
        posterImg.classList.add('hidden');
        posterFallback.classList.remove('hidden');
      }
    };
    posterImg.src = posterQueue[0];
  } else {
    posterImg.classList.add('hidden');
    posterFallback.classList.remove('hidden');
  }

  previewState.classList.remove('hidden');
}

async function refreshServerStatus() {
  const token = await getSavedToken();
  serverDot.className = 'status-dot status-dot--checking';
  serverDot.title = t('Проверка связи с Lierkour...', 'Checking Lierkour connection...');

  const status = await chrome.runtime.sendMessage({
    type: 'CHECK_SERVER',
    token,
  });

  if (status?.online) {
    serverDot.className = 'status-dot status-dot--online';
    if (!token) {
      serverDot.title = t(
        'Lierkour запущен — вставьте токен',
        'Lierkour is running — paste token'
      );
    } else if (status.authorized) {
      serverDot.title = t('Связь с Lierkour активна', 'Connected to Lierkour');
    } else {
      serverDot.title = t('Неверный токен LierEX', 'Invalid LierEX token');
    }
  } else {
    serverDot.className = 'status-dot status-dot--offline';
    serverDot.title = t(
      'Lierkour не запущен — доступны Copy / Save JSON',
      'Lierkour app offline — Copy / Save JSON ready'
    );
  }
}

toggleSettingsBtn.addEventListener('click', () => {
  tokenPanel.classList.toggle('hidden');
  if (!tokenPanel.classList.contains('hidden')) {
    tokenInput.focus();
  }
});

saveTokenBtn.addEventListener('click', async () => {
  const saved = await saveToken(tokenInput.value);
  if (saved) {
    tokenPanel.classList.add('hidden');
    showFeedback(t('Токен сохранён', 'Token saved'), 'success');
  } else {
    showFeedback(t('Токен очищен', 'Token cleared'), 'warn');
  }
  await refreshServerStatus();
});

tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    saveTokenBtn.click();
  }
});

importBtn.addEventListener('click', async () => {
  if (!extractedPayload) return;

  const token = await getSavedToken();
  if (!token) {
    tokenPanel.classList.remove('hidden');
    tokenInput.focus();
    showFeedback(
      t('Вставьте токен из Настроек Lierkour', 'Paste token from Lierkour Settings'),
      'warn'
    );
    return;
  }

  clearFeedback();
  importBtn.disabled = true;
  const originalLabel = t('Добавить в Lierkour', 'Add to Lierkour');
  importBtn.textContent = t('Отправка...', 'Sending...');

  const payloadWithStatus = buildPayloadWithStatus();
  if (!payloadWithStatus) return;

  const result = await chrome.runtime.sendMessage({
    type: 'IMPORT_MEDIA',
    payload: payloadWithStatus,
    token,
  });

  importBtn.disabled = false;
  importBtn.textContent = originalLabel;

  if (result?.ok) {
    showFeedback(t('Успешно добавлено!', 'Successfully added!'), 'success');
    importBtn.textContent = t('Добавлено ✓', 'Added ✓');
    setTimeout(() => {
      importBtn.textContent = originalLabel;
    }, 2000);
    await refreshServerStatus();
    return;
  }

  if (result?.kind === 'unauthorized') {
    tokenPanel.classList.remove('hidden');
    tokenInput.focus();
    showFeedback(result.error, 'error');
    return;
  }

  if (result?.kind === 'offline') {
    serverDot.className = 'status-dot status-dot--offline';
    showFeedback(
      t(
        'Запустите Lierkour для импорта или используйте Copy / Save JSON.',
        'Start Lierkour to import, or use Copy / Save JSON.'
      ),
      'warn'
    );
    return;
  }

  showFeedback(
    result?.error || t('Не удалось импортировать запись', 'Failed to import entry'),
    'error'
  );
});

if (copyJsonBtn) {
  copyJsonBtn.addEventListener('click', async () => {
    const payload = buildPayloadWithStatus();
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      showFeedback(t('JSON скопирован в буфер обмена', 'JSON copied to clipboard'), 'success');
    } catch {
      showFeedback(t('Не удалось скопировать JSON', 'Could not copy JSON'), 'error');
    }
  });
}

if (downloadJsonBtn) {
  downloadJsonBtn.addEventListener('click', () => {
    const payload = buildPayloadWithStatus();
    if (!payload) return;
    const safeTitle =
      String(payload.title || 'media')
        .replace(/[^\p{L}\p{N}_-]+/gu, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64) || 'media';
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeTitle}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showFeedback(t('JSON-файл сохранён', 'JSON file saved'), 'success');
  });
}

function isSupportedUrl(rawUrl) {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return SUPPORTED_HOSTS.some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

async function extractMediaFromTab(tab) {
  if (!tab?.id) {
    return {
      ok: false,
      error: t('Не найдена активная вкладка.', 'No active browser tab found.'),
    };
  }

  if (!isSupportedUrl(tab.url || '')) {
    return {
      ok: false,
      error: t(
        'Откройте карточку фильма или игры на Кинопоиске, IMDb, TMDb, Letterboxd, Steam, Epic Games, GOG или Itch.io.',
        'Open a movie, series, or game page on Kinopoisk, IMDb, TMDb, Letterboxd, Steam, Epic Games, GOG, or Itch.io.'
      ),
    };
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
    const first = results && results[0];
    if (!first || !first.result) {
      return {
        ok: false,
        error: t('Не удалось получить ответ от страницы.', 'Could not read response from the page.'),
      };
    }
    return first.result;
  } catch (err) {
    return {
      ok: false,
      error: t(
        `Ошибка чтения страницы: ${err?.message || 'нет доступа'}`,
        `Page access error: ${err?.message || 'permission denied'}`
      ),
    };
  }
}

async function init() {
  applyStaticLocale();
  const savedToken = await getSavedToken();
  tokenInput.value = savedToken;

  refreshServerStatus().catch(() => {});

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      showError(t('Не удалось определить активную вкладку.', 'Could not detect active tab.'));
      return;
    }

    const response = await extractMediaFromTab(tab);

    if (response?.ok && response.data) {
      showPreview(response.data);
    } else {
      showError(
        response?.error || t('Не удалось распознать страницу.', 'Could not parse page metadata.')
      );
    }
  } catch (err) {
    showError(
      t(
        `Ошибка инициализации: ${err?.message || 'неизвестная ошибка'}`,
        `Initialization error: ${err?.message || 'unknown error'}`
      )
    );
  }
}

init();
