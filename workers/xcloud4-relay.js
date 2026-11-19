/* SPDX-License-Identifier: GPL-3.0-only */
/* Cloudflare Worker CORS Relay for XCloud4 static hosting (proxies strictly allowlisted Microsoft/Xbox Cloud Gaming hosts). */

const ALLOWED_EXACT_HOSTS = new Set([
  'login.microsoftonline.com',
  'login.live.com',
  'user.auth.xboxlive.com',
  'xsts.auth.xboxlive.com',
  'contentaccess.exp.xboxservices.com',
  'catalog.gamepass.com',
  'displaycatalog.mp.microsoft.com',
]);

const ALLOWED_GSSV_HOST_RE = /^([a-z0-9-]+\.)+gssv-play-prod\.xboxlive\.com$/i;

const FORWARDED_REQ_HEADERS = [
  'authorization',
  'content-type',
  'accept',
  'accept-language',
  'x-xbl-contract-version',
  'x-gssv-client',
  'x-ms-device-info',
  'x-forwarded-for',
  'ms-cv',
];

export function isAllowedTargetUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password || parsed.port) return null;
    const host = parsed.hostname.toLowerCase();
    if (!ALLOWED_EXACT_HOSTS.has(host) && !ALLOWED_GSSV_HOST_RE.test(host)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Relay-Target',
    'Cache-Control': 'no-store',
    ...extra,
  };
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: corsHeaders({ 'Content-Type': 'application/json; charset=utf-8' }),
  });
}

export default {
  async fetch(request) {
    const reqUrl = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method === 'GET' && (reqUrl.pathname === '/' || reqUrl.pathname === '/health')) {
      return jsonResponse({ ok: true, mode: 'xbox-cors-relay', service: 'XCloud4 Relay' });
    }

    if (reqUrl.pathname === '/proxy' && request.method === 'POST') {
      let envelope;
      try {
        envelope = await request.json();
      } catch {
        return jsonResponse({ error: 'Invalid JSON proxy envelope' }, 400);
      }

      const target = isAllowedTargetUrl(envelope?.url);
      if (!target) {
        return jsonResponse({ error: 'Blocked target host (only Microsoft & Xbox Cloud Gaming hosts allowed)' }, 403);
      }

      const method = String(envelope?.method || 'GET').toUpperCase();
      if (!['GET', 'POST', 'DELETE'].includes(method)) {
        return jsonResponse({ error: 'Unsupported method' }, 405);
      }

      const headers = new Headers();
      if (envelope?.headers && typeof envelope.headers === 'object') {
        for (const [k, v] of Object.entries(envelope.headers)) {
          if (FORWARDED_REQ_HEADERS.includes(k.toLowerCase()) && typeof v === 'string') {
            headers.set(k, v);
          }
        }
      }
      if (!headers.has('User-Agent')) {
        headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36');
      }

      const init = { method, headers };
      if (method === 'POST' && typeof envelope?.body === 'string') {
        init.body = envelope.body;
      }

      try {
        const upstream = await fetch(target.toString(), init);
        const nullBodyStatus = upstream.status === 204 || upstream.status === 205 || upstream.status === 304;
        const outBody = nullBodyStatus ? null : await upstream.arrayBuffer();
        const outHeaders = new Headers(corsHeaders());
        const ctype = upstream.headers.get('content-type');
        if (ctype && !nullBodyStatus) outHeaders.set('Content-Type', ctype);
        return new Response(outBody, { status: upstream.status, headers: outHeaders });
      } catch (err) {
        return jsonResponse({ error: err?.message || 'Upstream Xbox request failed' }, 502);
      }
    }

    return jsonResponse({ error: 'Not found' }, 404);
  },
};
