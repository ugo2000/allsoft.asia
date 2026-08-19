// Pages Function: /api/track
// Records a visitor hit to D1 database

function parseUA(ua) {
  // Device type
  let device = 'Desktop';
  if (/Mobile|Android|iPhone/i.test(ua)) device = 'Mobile';
  else if (/iPad|Tablet/i.test(ua)) device = 'Tablet';

  // Browser
  let browser = 'Other';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';

  // OS
  let os = 'Other';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return { device, browser, os };
}

export async function onRequestPost(context) {
  const { env, request } = context;

  if (!env.VISITORS_DB) {
    return new Response(JSON.stringify({ ok: false, error: 'db_not_bound' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const ua = request.headers.get('User-Agent') || '';
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Real-IP') || '';
    const country = request.headers.get('CF-IPCountry') || '';
    const city = request.headers.get('CF-IPCity') || '';
    const { device, browser, os } = parseUA(ua);

    const page = body.page || '';
    const referrer = body.referrer || request.headers.get('Referer') || '';

    await env.VISITORS_DB.prepare(
      'INSERT INTO visitors (ip, country, city, device, browser, os, page, referrer, ua) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(ip, country, city, device, browser, os, page, referrer, ua).run();

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle CORS preflight
export function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
