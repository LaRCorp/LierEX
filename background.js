const API_BASE = 'http://127.0.0.1:8765';

function msg(ruText, enText) {
  const lang = (
    (typeof chrome !== 'undefined' && chrome?.i18n?.getUILanguage
      ? chrome.i18n.getUILanguage()
      : 'ru') || 'ru'
  ).toLowerCase();
  return lang.startsWith('ru') ? ruText : enText;
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
      errBody?.error ||
      msg(`Ошибка сервера (${response.status})`, `Server error (${response.status})`);

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
      error: msg(
        'Запустите Lierkour для импорта или используйте Copy / Save JSON.',
        'Start Lierkour to import, or use Copy / Save JSON.'
      ),
    };
  } finally {
    clearTimeout(timeout);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') {
    return false;
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
