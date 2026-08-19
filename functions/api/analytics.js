// Pages Function: /api/analytics
// Proxies Cloudflare GraphQL Analytics API for the admin dashboard

const ZONE_ID = '952356e67f6c3c94dd3be17149902994';

export async function onRequest(context) {
  const { env, request } = context;

  // Access control
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || request.headers.get('X-Admin-Key') || '';
  const expectedKey = env.ADMIN_KEY || 'allsoft2026';
  if (key !== expectedKey) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const token = env.CF_ANALYTICS_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: 'token_not_set' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Build date range: last 30 days
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);

  const query = [
    '{ viewer { zones(filter: {zoneTag: "' + ZONE_ID + '"}) {',
    '  httpRequests1dGroups(limit: 30, filter: {date_geq: "' + start + '", date_leq: "' + end + '"}) {',
    '    dimensions { date }',
    '    sum { requests pageViews bytes }',
    '    uniq { uniques }',
    '  }',
    '} } }'
  ].join('');

  try {
    const resp = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: query })
    });

    const data = await resp.json();

    if (data.errors) {
      return new Response(JSON.stringify({ error: 'graphql_error', details: data.errors }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const groups = (data.data && data.data.viewer && data.data.viewer.zones && data.data.viewer.zones[0] && data.data.viewer.zones[0].httpRequests1dGroups) || [];

    let totalPV = 0, totalReq = 0, totalUniq = 0, totalBytes = 0;
    const daily = groups.map(function(g) {
      return {
        date: g.dimensions.date,
        pv: g.sum.pageViews,
        req: g.sum.requests,
        uniq: g.uniq.uniques,
        bytes: g.sum.bytes
      };
    });

    for (const d of daily) {
      totalPV += d.pv;
      totalReq += d.req;
      totalUniq += d.uniq;
      totalBytes += d.bytes;
    }

    const result = {
      range: { start: start, end: end },
      summary: {
        pageViews: totalPV,
        requests: totalReq,
        uniqueVisitors: totalUniq,
        bandwidth: totalBytes,
        avgPvPerVisitor: totalUniq > 0 ? (totalPV / totalUniq).toFixed(1) : '0'
      },
      daily: daily.sort(function(a, b) { return a.date < b.date ? -1 : 1; })
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'fetch_failed', message: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
