// Pages Function: /api/visitors
// Returns recent visitor records from D1 (public, no auth)

export async function onRequestGet(context) {
  const { env, request } = context;

  if (!env.VISITORS_DB) {
    return new Response(JSON.stringify({ error: 'db_not_bound' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

  try {
    const result = await env.VISITORS_DB.prepare(
      'SELECT id, ip, country, city, device, browser, os, page, referrer, created_at FROM visitors ORDER BY id DESC LIMIT ?'
    ).bind(limit).all();

    // Aggregate stats
    const stats = { device: {}, country: {}, browser: {}, os: {}, page: {} };
    for (const v of result.results) {
      stats.device[v.device] = (stats.device[v.device] || 0) + 1;
      stats.country[v.country || 'Unknown'] = (stats.country[v.country || 'Unknown'] || 0) + 1;
      stats.browser[v.browser] = (stats.browser[v.browser] || 0) + 1;
      stats.os[v.os] = (stats.os[v.os] || 0) + 1;
      stats.page[v.page] = (stats.page[v.page] || 0) + 1;
    }

    // Mask IP: keep first 2 octets for IPv4, mask second half for IPv6
    const masked = result.results.map(function(v) {
      let maskedIp = v.ip;
      if (v.ip && v.ip.includes('.')) {
        const parts = v.ip.split('.');
        maskedIp = parts[0] + '.' + parts[1] + '.*.*';
      } else if (v.ip && v.ip.includes(':')) {
        const parts = v.ip.split(':');
        maskedIp = parts.slice(0, 2).join(':') + ':****:****';
      }
      return {
        id: v.id,
        ip: maskedIp,
        country: v.country || 'Unknown',
        city: v.city || '',
        device: v.device,
        browser: v.browser,
        os: v.os,
        page: v.page,
        referrer: v.referrer,
        time: v.created_at
      };
    });

    return new Response(JSON.stringify({
      total: result.results.length,
      visitors: masked,
      stats: stats
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
