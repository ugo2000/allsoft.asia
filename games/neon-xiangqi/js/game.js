/* ============================================================
   NEON XIANGQI - Core Rules Engine
   Pure logic, no DOM. Works in browser (window.XQ) and Node.
   ============================================================ */
(function (global) {
  'use strict';

  const COLS = 9;
  const ROWS = 10;

  // Bilingual piece metadata. cn = Chinese glyph, en = English label.
  const PIECE_INFO = {
    G: { cn: { r: '帅', b: '将' }, en: 'General'  },
    A: { cn: { r: '仕', b: '士' }, en: 'Advisor'  },
    E: { cn: { r: '相', b: '象' }, en: 'Elephant' },
    H: { cn: { r: '马', b: '马' }, en: 'Horse'    },
    R: { cn: { r: '车', b: '車' }, en: 'Chariot'  },
    C: { cn: { r: '炮', b: '砲' }, en: 'Cannon'   },
    S: { cn: { r: '兵', b: '卒' }, en: 'Soldier'  },
  };

  function inBoard(r, c) {
    return r >= 0 && r < ROWS && c >= 0 && c < COLS;
  }

  function opponent(side) {
    return side === 'r' ? 'b' : 'r';
  }

  function buildInitialBoard() {
    const b = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    const back = ['R', 'H', 'E', 'A', 'G', 'A', 'E', 'H', 'R'];
    for (let c = 0; c < COLS; c++) {
      b[0][c] = { type: back[c], side: 'b' };
      b[9][c] = { type: back[c], side: 'r' };
    }
    b[2][1] = { type: 'C', side: 'b' };
    b[2][7] = { type: 'C', side: 'b' };
    b[7][1] = { type: 'C', side: 'r' };
    b[7][7] = { type: 'C', side: 'r' };
    for (const c of [0, 2, 4, 6, 8]) {
      b[3][c] = { type: 'S', side: 'b' };
      b[6][c] = { type: 'S', side: 'r' };
    }
    return b;
  }

  function cloneBoard(b) {
    return b.map(row => row.map(c => (c ? { type: c.type, side: c.side } : null)));
  }

  function inPalace(side, r, c) {
    if (c < 3 || c > 5) return false;
    if (side === 'r') return r >= 7 && r <= 9;
    return r >= 0 && r <= 2;
  }

  // An elephant can never leave its own half of the board.
  function ownSideRow(side, r) {
    return side === 'r' ? r >= 5 : r <= 4;
  }

  function findGeneral(b, side) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = b[r][c];
        if (p && p.type === 'G' && p.side === side) return { r, c };
      }
    }
    return null;
  }

  // Pseudo-legal target squares for the piece at (r,c).
  // Path logic only; does NOT verify that the resulting position is legal.
  function generatePseudoMoves(b, r, c) {
    const p = b[r][c];
    if (!p) return [];
    const side = p.side;
    const moves = [];
    const tryPush = (tr, tc) => {
      if (!inBoard(tr, tc)) return;
      const t = b[tr][tc];
      if (t && t.side === side) return;
      moves.push([tr, tc]);
    };

    switch (p.type) {
      case 'R': {
        for (const [sr, sc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          let rr = r + sr, cc = c + sc;
          while (inBoard(rr, cc)) {
            if (!b[rr][cc]) moves.push([rr, cc]);
            else { if (b[rr][cc].side !== side) moves.push([rr, cc]); break; }
            rr += sr; cc += sc;
          }
        }
        break;
      }
      case 'C': {
        for (const [sr, sc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          let rr = r + sr, cc = c + sc, jumped = false;
          while (inBoard(rr, cc)) {
            if (!jumped) {
              if (!b[rr][cc]) moves.push([rr, cc]);
              else jumped = true; // first piece becomes the screen
            } else {
              if (b[rr][cc]) {
                if (b[rr][cc].side !== side) moves.push([rr, cc]);
                break;
              }
            }
            rr += sr; cc += sc;
          }
        }
        break;
      }
      case 'H': {
        const cand = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];
        for (const [dr, dc] of cand) {
          const tr = r + dr, tc = c + dc;
          if (!inBoard(tr, tc)) continue;
          if (b[tr][tc] && b[tr][tc].side === side) continue;
          let lr, lc;
          if (Math.abs(dr) === 2) { lr = r + dr / 2; lc = c; }
          else { lr = r; lc = c + dc / 2; }
          if (b[lr][lc]) continue; // horse leg blocked
          moves.push([tr, tc]);
        }
        break;
      }
      case 'E': {
        const cand = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
        for (const [dr, dc] of cand) {
          const tr = r + dr, tc = c + dc;
          if (!inBoard(tr, tc)) continue;
          if (!ownSideRow(side, tr)) continue;
          const er = r + dr / 2, ec = c + dc / 2;
          if (b[er][ec]) continue; // elephant eye blocked
          const t = b[tr][tc];
          if (t && t.side === side) continue;
          moves.push([tr, tc]);
        }
        break;
      }
      case 'A': {
        const cand = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (const [dr, dc] of cand) {
          const tr = r + dr, tc = c + dc;
          if (!inBoard(tr, tc)) continue;
          if (!inPalace(side, tr, tc)) continue;
          const t = b[tr][tc];
          if (t && t.side === side) continue;
          moves.push([tr, tc]);
        }
        break;
      }
      case 'G': {
        const cand = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dr, dc] of cand) {
          const tr = r + dr, tc = c + dc;
          if (!inBoard(tr, tc)) continue;
          if (!inPalace(side, tr, tc)) continue;
          const t = b[tr][tc];
          if (t && t.side === side) continue;
          moves.push([tr, tc]);
        }
        // Flying general: the General may capture the ENEMY GENERAL along an
        // open file (no intervening piece). It may NOT capture any other piece.
        for (const dir of [-1, 1]) {
          let rr = r + dir;
          while (inBoard(rr, c)) {
            const p = b[rr][c];
            if (p) {
              if (p.side !== side && p.type === 'G') moves.push([rr, c]);
              break; // first piece blocks the file either way
            }
            rr += dir;
          }
        }
        break;
      }
      case 'S': {
        const fwd = side === 'r' ? -1 : 1; // red advances upward (decreasing row)
        const fr0 = r + fwd;
        if (inBoard(fr0, c) && !(b[fr0][c] && b[fr0][c].side === side)) moves.push([fr0, c]);
        const crossed = side === 'r' ? r < 5 : r > 4;
        if (crossed) {
          for (const dc of [-1, 1]) {
            const tc = c + dc;
            if (inBoard(r, tc) && !(b[r][tc] && b[r][tc].side === side)) moves.push([r, tc]);
          }
        }
        break;
      }
    }
    return moves;
  }

  // Is square (tr,tc) attacked by any piece of side `bySide`?
  function isSquareAttacked(b, tr, tc, bySide) {
    // Orthogonal rays: chariot + general (incl. flying general).
    const ortho = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [sr, sc] of ortho) {
      let rr = tr + sr, cc = tc + sc, dist = 1;
      while (inBoard(rr, cc)) {
        const p = b[rr][cc];
        if (p) {
          if (p.side === bySide) {
            if (p.type === 'R') return true;
            if (p.type === 'G') {
              if (sc !== 0) { if (dist === 1) return true; } // horizontal: only adjacent
              else return true; // vertical: flying general
            }
          }
          break; // any piece blocks the ray
        }
        rr += sr; cc += sc; dist++;
      }
    }
    // Cannon: exactly one screen, then an enemy cannon.
    for (const [sr, sc] of ortho) {
      let rr = tr + sr, cc = tc + sc, screens = 0;
      while (inBoard(rr, cc)) {
        const p = b[rr][cc];
        if (p) {
          screens++;
          if (screens === 2) {
            if (p.side === bySide && p.type === 'C') return true;
            break;
          }
          if (screens > 2) break;
        }
        rr += sr; cc += sc;
      }
    }
    // Horse: 8 possible attackers, each with a leg check.
    const hk = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];
    for (const [dr, dc] of hk) {
      const hr = tr + dr, hc = tc + dc;
      if (!inBoard(hr, hc)) continue;
      const p = b[hr][hc];
      if (!p || p.side !== bySide || p.type !== 'H') continue;
      let lr, lc;
      if (Math.abs(dr) === 2) { lr = hr - dr / 2; lc = hc; }
      else { lr = hr; lc = hc - dc / 2; }
      if (!b[lr][lc]) return true; // leg empty -> attacks
    }
    // Elephant: 2-step diagonal, eye empty, must stay on its side.
    for (const [dr, dc] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) {
      const er = tr + dr, ec = tc + dc;
      if (!inBoard(er, ec)) continue;
      const p = b[er][ec];
      if (!p || p.side !== bySide || p.type !== 'E') continue;
      const mr = tr + dr / 2, mc = tc + dc / 2;
      if (!b[mr][mc] && ownSideRow(bySide, er)) return true;
    }
    // Advisor: 1-step diagonal inside its palace.
    for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ar = tr + dr, ac = tc + dc;
      if (!inBoard(ar, ac)) continue;
      const p = b[ar][ac];
      if (p && p.side === bySide && p.type === 'A' && inPalace(bySide, ar, ac)) return true;
    }
    // Soldier: forward, and sideways after crossing the river.
    const fwd = bySide === 'r' ? -1 : 1;
    const sf = tr - fwd; // soldier one step behind target (forward attack)
    if (inBoard(sf, tc)) {
      const p = b[sf][tc];
      if (p && p.side === bySide && p.type === 'S') return true;
    }
    const crossed = bySide === 'r' ? tr < 5 : tr > 4; // target already on bySide's attack side
    if (crossed) {
      for (const dc of [-1, 1]) {
        const sc = tc + dc;
        if (!inBoard(tr, sc)) continue;
        const p = b[tr][sc];
        if (p && p.side === bySide && p.type === 'S') return true;
      }
    }
    return false;
  }

  function isInCheck(b, side) {
    const g = findGeneral(b, side);
    if (!g) return true; // no general => effectively lost
    return isSquareAttacked(b, g.r, g.c, opponent(side));
  }

  function applyMove(b, move) {
    const nb = cloneBoard(b);
    const p = nb[move.fr][move.fc];
    nb[move.tr][move.tc] = p;
    nb[move.fr][move.fc] = null;
    return nb;
  }

  // All fully-legal moves for `side` (removes moves leaving own general in check).
  // A move that captures the enemy general is legal ONLY if it does NOT leave the
  // mover's own general in check — exactly like any other move. The game then ends
  // on the following getStatus() call (the opponent has no general). This must NOT
  // be special-cased: allowing a "general capture" that exposes your own general
  // is an illegal move and caused false/abnormal victories.
  function generateLegalMoves(b, side) {
    const out = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = b[r][c];
        if (!p || p.side !== side) continue;
        const targets = generatePseudoMoves(b, r, c);
        for (const [tr, tc] of targets) {
          const nb = applyMove(b, { fr: r, fc: c, tr, tc });
          if (!isInCheck(nb, side)) out.push({ fr: r, fc: c, tr, tc });
        }
      }
    }
    return out;
  }

  // Game status for the side that must now move (`sideToMove`).
  // returns { over, winner }  winner is 'r' | 'b' (the side that just moved & won)
  function getStatus(b, sideToMove) {
    // If the side to move has no general, it was captured -> it lost.
    const moverGeneral = findGeneral(b, sideToMove);
    if (!moverGeneral) return { over: true, winner: opponent(sideToMove) };
    // If the side to move has no legal moves, it is checkmated/stalemated -> it lost.
    const moves = generateLegalMoves(b, sideToMove);
    if (moves.length === 0) {
      // In Xiangqi both checkmate and stalemate are a loss for the side to move.
      return { over: true, winner: opponent(sideToMove) };
    }
    return { over: false, winner: null };
  }

  const XQ = {
    COLS, ROWS, PIECE_INFO,
    inBoard, opponent,
    buildInitialBoard, cloneBoard, inPalace, ownSideRow, findGeneral,
    generatePseudoMoves, isSquareAttacked, isInCheck,
    applyMove, generateLegalMoves, getStatus,
  };

  global.XQ = XQ;
  if (typeof module !== 'undefined' && module.exports) module.exports = XQ;
})(typeof window !== 'undefined' ? window : globalThis);
