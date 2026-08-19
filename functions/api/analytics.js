// Pages Function: /api/analytics
// 从 D1 访客表计算流量概览，不再依赖 Cloudflare GraphQL API token

export async function onRequestGet(context) {
  const { env } = context;

  if (!env.VISITORS_DB) {
    return new Response(JSON.stringify({ error: 'db_not_bound' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // 最近 30 天汇总
    const summaryStmt = env.VISITORS_DB.prepare(
      "SELECT COUNT(*) as pv, COUNT(DISTINCT ip) as uv FROM visitors WHERE created_at >= datetime('now', '-30 days')"
    );
    const summaryRow = await summaryStmt.first();

    // 每日明细
    const dailyStmt = env.VISITORS_DB.prepare(
      "SELECT DATE(created_at) as date, COUNT(*) as pv, COUNT(DISTINCT ip) as uniq " +
      "FROM visitors WHERE created_at >= datetime('now', '-30 days') " +
      "GROUP BY DATE(created_at) ORDER BY date"
    );
    const dailyResult = await dailyStmt.all();

    const totalPV = summaryRow.pv || 0;
    const totalUniq = summaryRow.uv || 0;
    const totalReq = totalPV; // D1 每条记录 = 一次页面访问

    const daily = (dailyResult.results || []).map(function(r) {
      return {
        date: r.date,
        pv: r.pv,
        req: r.pv,
        uniq: r.uniq,
        bytes: 0
      };
    });

    // 填充没有访客的日期（让柱状图连续）
    const dateSet = {};
    daily.forEach(function(d) { dateSet[d.date] = d; });
    const filled = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const dt = new Date(now.getTime() - i * 86400000);
      const ds = dt.toISOString().slice(0, 10);
      if (dateSet[ds]) {
        filled.push(dateSet[ds]);
      } else {
        filled.push({ date: ds, pv: 0, req: 0, uniq: 0, bytes: 0 });
      }
    }

    const result = {
      range: {
        start: filled.length > 0 ? filled[0].date : '',
        end: filled.length > 0 ? filled[filled.length - 1].date : ''
      },
      summary: {
        pageViews: totalPV,
        requests: totalReq,
        uniqueVisitors: totalUniq,
        bandwidth: 0,
        avgPvPerVisitor: totalUniq > 0 ? (totalPV / totalUniq).toFixed(1) : '0'
      },
      daily: filled
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'db_error', message: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
