/* ============================================================
   NEON XIANGQI - AI Opponent
   Iterative-deepening minimax with alpha-beta pruning,
   material + positional evaluation, and a hard time budget so
   the browser UI never freezes. Plays as the `side` passed in.
   ============================================================ */
(function (global) {
  'use strict';

  const XQ = global.XQ || (typeof require !== 'undefined' ? require('./game.js') : null);

  const now = () =>
    (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();

  // Material values (Red's perspective; positive favours Red).
  const VALUE = { G: 6000, R: 600, C: 300, H: 270, A: 120, E: 120, S: 30 };

  function positional(p, r, c) {
    const side = p.side;
    const adv = side === 'r' ? (9 - r) : r; // how far advanced toward enemy
    let bonus = 0;
    switch (p.type) {
      case 'S': {
        const crossed = side === 'r' ? r < 5 : r > 4;
        if (crossed) {
          bonus += 40;
          bonus += [0, 8, 16, 8, 0, 8, 16, 8, 0][c] || 0;
        } else bonus += 4;
        break;
      }
      case 'H': {
        const center = 4 - Math.abs(c - 4);
        bonus += center * 4 + Math.min(adv, 4) * 3;
        break;
      }
      case 'R': {
        const center = 4 - Math.abs(c - 4);
        bonus += center * 3 + Math.min(adv, 5) * 2;
        break;
      }
      case 'C': {
        const center = 4 - Math.abs(c - 4);
        bonus += center * 2 + Math.min(adv, 4);
        break;
      }
      case 'A':
      case 'E':
        bonus += (side === 'r' ? r : 9 - r) > 1 ? 6 : -4;
        break;
    }
    return bonus;
  }

  function evaluate(b) {
    let score = 0;
    for (let r = 0; r < XQ.ROWS; r++) {
      for (let c = 0; c < XQ.COLS; c++) {
        const p = b[r][c];
        if (!p) continue;
        const v = VALUE[p.type] + positional(p, r, c);
        score += p.side === 'r' ? v : -v;
      }
    }
    return score; // Red's perspective
  }

  function captureScore(b, m) {
    const t = b[m.tr][m.tc];
    return t ? (VALUE[t.type] || 0) : 0;
  }

  const TIMEOUT = { __timeout: true };

  function search(b, side, depth, alpha, beta, deadline, start) {
    if (now() - start > deadline) throw TIMEOUT;
    const opp = XQ.opponent(side);
    const moves = XQ.generateLegalMoves(b, side);
    if (moves.length === 0) {
      return { score: side === 'r' ? -100000 - depth : 100000 + depth, move: null };
    }
    if (depth === 0) {
      const e = evaluate(b);
      return { score: side === 'r' ? e : -e, move: null };
    }
    moves.sort((m1, m2) => captureScore(b, m2) - captureScore(b, m1));

    let best = moves[0];
    let bestScore = -Infinity;
    for (const m of moves) {
      const nb = XQ.applyMove(b, m);
      const sub = search(nb, opp, depth - 1, -beta, -alpha, deadline, start);
      const sc = -sub.score;
      if (sc > bestScore) { bestScore = sc; best = m; }
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) break;
    }
    return { score: bestScore, move: best };
  }

  // difficulty -> { maxDepth, budgetMs }
  const CONFIG = {
    easy:   { maxDepth: 2, budget: 250 },
    normal: { maxDepth: 3, budget: 700 },
    hard:   { maxDepth: 5, budget: 1700 },
  };

  function chooseMove(b, side, difficulty) {
    const cfg = CONFIG[difficulty] || CONFIG.normal;
    const start = now();
    let bestMove = null;
    let bestScore = -Infinity;
    for (let d = 1; d <= cfg.maxDepth; d++) {
      try {
        const res = search(b, side, d, -Infinity, Infinity, cfg.budget, start);
        if (res.move) { bestMove = res.move; bestScore = res.score; }
        // if a full depth finished comfortably under budget, keep going deeper
      } catch (e) {
        if (e === TIMEOUT) break; // use the last completed depth
        throw e;
      }
      if (now() - start > cfg.budget) break;
    }
    return bestMove;
  }

  const AI = { chooseMove, evaluate, CONFIG };
  global.AI = AI;
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
})(typeof window !== 'undefined' ? window : globalThis);
