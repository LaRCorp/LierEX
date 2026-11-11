const API_BASE = 'http://127.0.0.1:8765';
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

function msg(ruText, enText) {
  const lang = (
    (typeof chrome !== 'undefined' && chrome?.i18n?.getUILanguage
      ? chrome.i18n.getUILanguage()
      : 'ru') || 'ru'
  ).toLowerCase();
  return lang.startsWith('ru') ? ruText : enText;
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

async function extractFromTab(tabId, url) {
  if (!tabId) {
    return {
      ok: false,
      error: msg('Не найдена активная вкладка.', 'No active browser tab found.'),
    };
  }

  if (!isSupportedUrl(url)) {
    return {
      ok: false,
      error: msg(
        'Поддерживаются Кинопоиск, IMDb, TMDb, Letterboxd, Steam, Epic Games, GOG и Itch.io.',
        'Supported sites: Kinopoisk, IMDb, TMDb, Letterboxd, Steam, Epic Games, GOG, and Itch.io.'
      ),
    };
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });

    const first = results && results[0];
    if (!first || !first.result) {
      return {
        ok: false,
        error: msg(
          'Не удалось получить ответ от страницы.',
          'Could not read response from the page.'
        ),
      };
    }

    return first.result;
  } catch (err) {
    return {
      ok: false,
      error: msg(
        `Ошибка чтения страницы: ${err?.message || 'нет доступа'}`,
        `Page access error: ${err?.message || 'permission denied'}`
      ),
    };
  }
}

async function checkServerHealth(token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const headers = {};
    if (token) {
      headers['X-LierEX-Token'] = token;
    }
    const response = await fetch(`${API_BASE}/api/health`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      return { online: false, authorized: false };
    }

    const body = await response.json().catch(() => ({}));
    return {
      online: true,
      authorized: Boolean(body?.authorized),
    };
  } catch {
    return { online: false, authorized: false };
  } finally {
    clearTimeout(timeout);
  }
}

async function importToLierkour(payload, token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['X-LierEX-Token'] = token;
    }

    const response = await fetch(`${API_BASE}/api/import`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (response.status === 200) {
      const body = await response.json().catch(() => ({}));
      return { ok: true, result: body };
    }

    const errBody = await response.json().catch(() => ({}));
    const serverMsg =
      errBody?.error || msg(`Ошибка сервера (${response.status})`, `Server error (${response.status})`);

    if (response.status === 401) {
      return {
        ok: false,
        kind: 'unauthorized',
        error: msg(
          'Неверный или пустой токен. Скопируйте токен из Настроек Lierkour.',
          'Invalid or missing token. Copy X-LierEX-Token from Lierkour Settings.'
        ),
      };
    }

    return {
      ok: false,
      kind: 'server',
      error: serverMsg,
    };
  } catch {
    return {
      ok: false,
      kind: 'offline',
      error: msg('Запустите Lierkour для импорта', 'Start Lierkour to import'),
    };
  } finally {
    clearTimeout(timeout);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') {
    return false;
  }

  if (message.type === 'EXTRACT_MEDIA') {
    extractFromTab(message.tabId, message.url).then(sendResponse);
    return true;
  }

  if (message.type === 'CHECK_SERVER') {
    checkServerHealth(message.token || '').then(sendResponse);
    return true;
  }

  if (message.type === 'IMPORT_MEDIA') {
    importToLierkour(message.payload, message.token || '').then(sendResponse);
    return true;
  }

  return false;
});

