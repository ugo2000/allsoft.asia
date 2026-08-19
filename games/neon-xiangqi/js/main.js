/* ============================================================
   NEON XIANGQI - UI, rendering, interaction (main.js)
   ============================================================ */
(function () {
  'use strict';

  const T = (k, zh) => (window.AllSoftI18n ? AllSoftI18n.t(k, zh) : zh);

  const XQ = window.XQ;
  const AI = window.AI;
  const Audio3D = window.GameAudio;

  // ---- Layout ----
  const CELL = 62;
  const MARGIN = 46;
  const COLS = XQ.COLS, ROWS = XQ.ROWS;
  const BOARD_W = MARGIN * 2 + (COLS - 1) * CELL;
  const BOARD_H = MARGIN * 2 + (ROWS - 1) * CELL;
  const PIECE_R = CELL * 0.42;

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');

  function setupCanvas() {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = BOARD_W * dpr;
    canvas.height = BOARD_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  setupCanvas();
  window.addEventListener('resize', setupCanvas);

  // ---- State ----
  const state = {
    board: XQ.buildInitialBoard(),
    turn: 'r',
    mode: 'ai',          // 'ai' | '2p'
    difficulty: 'normal', // easy | normal | hard
    humanSide: 'r',      // in AI mode
    selected: null,      // {r,c}
    legal: {},           // key "r,c" -> [[tr,tc],...]
    lastMove: null,
    gameOver: false,
    winner: null,
    anim: null,          // {fr,fc,tr,tc,side,type,start,dur}
    particles: [],
    capturedRed: [],    // pieces RED has captured (Black pieces)
    capturedBlack: [],  // pieces BLACK has captured (Red pieces)
    soundOn: true,
    musicOn: true,
    thinking: false,
    hover: null,
  };

  const key = (r, c) => r + ',' + c;
  const px = (c) => MARGIN + c * CELL;
  const py = (r) => MARGIN + r * CELL;

  // ---- Sound spatialisation helper ----
  function soundPos(r, c) {
    return { nx: (c + 0.5) / COLS, nz: (r + 0.5) / ROWS };
  }

  // ---- Rendering ----
  function drawBoard() {
    ctx.clearRect(0, 0, BOARD_W, BOARD_H);

    // background
    const bg = ctx.createLinearGradient(0, 0, 0, BOARD_H);
    bg.addColorStop(0, 'rgba(10,18,36,0.6)');
    bg.addColorStop(1, 'rgba(4,8,18,0.85)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);

    // faint background dot grid (sci-fi)
    ctx.save();
    ctx.fillStyle = 'rgba(33,230,255,0.05)';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.beginPath();
        ctx.arc(px(c), py(r), 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(29,233,255,0.55)';
    ctx.lineWidth = 1.2;
    ctx.shadowColor = 'rgba(29,233,255,0.6)';
    ctx.shadowBlur = 8;

    // horizontal lines
    for (let r = 0; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(px(0), py(r));
      ctx.lineTo(px(COLS - 1), py(r));
      ctx.stroke();
    }
    // vertical lines (broken at river except outer files)
    for (let c = 0; c < COLS; c++) {
      if (c === 0 || c === COLS - 1) {
        ctx.beginPath();
        ctx.moveTo(px(c), py(0));
        ctx.lineTo(px(c), py(ROWS - 1));
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(px(c), py(0));
        ctx.lineTo(px(c), py(4));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px(c), py(5));
        ctx.lineTo(px(c), py(ROWS - 1));
        ctx.stroke();
      }
    }

    // palace diagonals
    const palace = [
      [[3, 0], [5, 2]], [[5, 0], [3, 2]],
      [[3, 7], [5, 9]], [[5, 7], [3, 9]],
    ];
    for (const [[c1, r1], [c2, r2]] of palace) {
      ctx.beginPath();
      ctx.moveTo(px(c1), py(r1));
      ctx.lineTo(px(c2), py(r2));
      ctx.stroke();
    }
    ctx.restore();

    // river text (bilingual)
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(33,230,255,0.30)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 20px "Microsoft YaHei", sans-serif';
    ctx.fillText('楚 河', px(2), (py(4) + py(5)) / 2 - 12);
    ctx.fillText('漢 界', px(6), (py(4) + py(5)) / 2 - 12);
    ctx.fillStyle = 'rgba(33,230,255,0.20)';
    ctx.font = '10px Orbitron, sans-serif';
    ctx.fillText(T('xq.chuRiver', '楚河'), px(2), (py(4) + py(5)) / 2 + 12);
    ctx.fillText(T('xq.hanFrontier', '汉界'), px(6), (py(4) + py(5)) / 2 + 12);
    ctx.restore();
  }

  function drawHighlights(now) {
    // last move
    if (state.lastMove) {
      const { fr, fc, tr, tc } = state.lastMove;
      ctx.save();
      ctx.fillStyle = 'rgba(255,43,214,0.14)';
      for (const [r, c] of [[fr, fc], [tr, tc]]) {
        ctx.beginPath();
        ctx.arc(px(c), py(r), PIECE_R + 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // check highlight on a general in check
    const checkSide = XQ.isInCheck(state.board, state.turn) ? state.turn : null;
    if (checkSide) {
      const g = XQ.findGeneral(state.board, checkSide);
      if (g) {
        const pulse = 0.5 + 0.5 * Math.sin(now / 180);
        ctx.save();
        ctx.strokeStyle = `rgba(255,59,107,${0.5 + 0.4 * pulse})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(255,59,107,0.9)';
        ctx.shadowBlur = 18 * pulse + 6;
        ctx.beginPath();
        ctx.arc(px(g.c), py(g.r), PIECE_R + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // selection + legal targets
    if (state.selected) {
      const { r, c } = state.selected;
      const x = px(c), y = py(r);
      // breathing effect: the piece's OWN triangle outline breathes.
      // The line frame's brightness (opacity) oscillates dim <-> bright, so it
      // flickers brighter/darker — no extra frame is drawn.
      const pulse = 0.5 + 0.5 * Math.sin(now / 210); // 0..1, ~1.3s cycle (2x faster)

      ctx.save();
      ctx.lineJoin = 'round';
      trianglePath(x, y, PIECE_R, 0);
      ctx.strokeStyle = `rgba(255,43,214,${0.12 + 0.88 * pulse})`;
      ctx.lineWidth = 1.2 + 0.6 * pulse; // thin frame (50% thinner)
      ctx.shadowColor = 'rgba(255,43,214,0.9)';
      ctx.shadowBlur = 5 + 16 * pulse;
      ctx.stroke();
      ctx.restore();

      const targets = state.legal[key(r, c)] || [];
      for (const [tr, tc] of targets) {
        const occupied = state.board[tr][tc];
        ctx.save();
        if (occupied) {
          // capture target: glowing ring drawn AROUND the enemy piece
          ctx.strokeStyle = 'rgba(255,43,214,0.95)';
          ctx.lineWidth = 3;
          ctx.shadowColor = 'rgba(255,43,214,0.95)';
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.arc(px(tc), py(tr), PIECE_R + 5, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // empty destination: bright dot
          ctx.fillStyle = 'rgba(33,230,255,0.85)';
          ctx.shadowColor = 'rgba(33,230,255,0.95)';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(px(tc), py(tr), 6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  // Draw a piece as a glowing neon TRIANGLE (no circle) at pixel (x,y).
  function drawTokenAt(x, y, type, side, rad) {
    const isRed = side === 'r';
    const main = isRed ? '#ff3b6b' : '#21e6ff';
    const glow = isRed ? 'rgba(255,59,107,0.9)' : 'rgba(33,230,255,0.9)';

    const apexY = y - rad * 1.02;
    const baseY = y + rad * 0.80;
    const halfBase = rad * 0.96;

    ctx.save();
    ctx.lineJoin = 'round';

    // outer glow + triangle fill (halo reduced 50% per request)
    ctx.shadowColor = glow;
    ctx.shadowBlur = 9;
    ctx.beginPath();
    ctx.moveTo(x, apexY);
    ctx.lineTo(x + halfBase, baseY);
    ctx.lineTo(x - halfBase, baseY);
    ctx.closePath();
    const grad = ctx.createLinearGradient(x, apexY, x, baseY);
    grad.addColorStop(0, isRed ? 'rgba(90,20,42,0.95)' : 'rgba(14,44,58,0.95)');
    grad.addColorStop(1, isRed ? 'rgba(40,8,20,0.95)' : 'rgba(6,22,32,0.95)');
    ctx.fillStyle = grad;
    ctx.fill();

    // main triangle outline
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = main;
    ctx.beginPath();
    ctx.moveTo(x, apexY);
    ctx.lineTo(x + halfBase, baseY);
    ctx.lineTo(x - halfBase, baseY);
    ctx.closePath();
    ctx.stroke();

    // inner (smaller) triangle accent
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    const ix = x, iay = y - rad * 0.52, iby = y + rad * 0.44, ihb = rad * 0.52;
    ctx.beginPath();
    ctx.moveTo(ix, iay);
    ctx.lineTo(ix + ihb, iby);
    ctx.lineTo(ix - ihb, iby);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Chinese glyph — 楷书 (regular script), thin strokes
    const info = XQ.PIECE_INFO[type];
    ctx.fillStyle = main;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = glow;
    ctx.shadowBlur = 2; // glyph halo also reduced 50%
    ctx.font = `400 ${rad * 0.92}px "KaiTi","STKaiti","Kaiti SC","DFKai-SB","楷体",serif`;
    ctx.fillText(info.cn[side], x, y - rad * 0.08);

    // English label
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(214,244,255,0.92)';
    ctx.font = `600 ${rad * 0.32}px Orbitron, "Segoe UI", sans-serif`;
    ctx.fillText(info.en.toUpperCase(), x, y + rad * 0.46);
    ctx.restore();
  }

  function drawPieceToken(r, c, type, side, scale) {
    drawTokenAt(px(c), py(r), type, side, PIECE_R * (scale || 1));
  }

  // Build a triangle outline path matching the piece's token geometry,
  // optionally expanded by `expand` px so it can frame the piece.
  function trianglePath(x, y, rad, expand) {
    const e = expand || 0;
    const apexY = y - (rad + e) * 1.02;
    const baseY = y + (rad + e) * 0.80;
    const halfBase = (rad + e) * 0.96;
    ctx.beginPath();
    ctx.moveTo(x, apexY);
    ctx.lineTo(x + halfBase, baseY);
    ctx.lineTo(x - halfBase, baseY);
    ctx.closePath();
  }

  function drawPieces() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = state.board[r][c];
        if (!p) continue;
        if (state.anim && state.anim.tr === r && state.anim.tc === c) continue;
        drawPieceToken(r, c, p.type, p.side, 1);
      }
    }
  }

  function drawAnimPiece(now) {
    const a = state.anim;
    if (!a) return;
    const t = Math.min(1, (now - a.start) / a.dur);
    const e = 0.5 - 0.5 * Math.cos(Math.PI * t); // ease in-out
    const x = px(a.fc) + (px(a.tc) - px(a.fc)) * e;
    const y = py(a.fr) + (py(a.tr) - py(a.fr)) * e;
    const rad = PIECE_R * (1 + 0.12 * Math.sin(Math.PI * t));
    drawTokenAt(x, y, a.type, a.side, rad);
    if (t >= 1) state.anim = null;
  }

  // (piece drawing is now handled by drawTokenAt)

  function spawnParticles(r, c, color) {
    const x = px(c), y = py(r);
    for (let i = 0; i < 22; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 4;
      state.particles.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: 1,
        decay: 0.02 + Math.random() * 0.03,
        color,
      });
    }
  }

  function drawParticles() {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.06;
      p.life -= p.decay;
      if (p.life <= 0) { state.particles.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5 * p.life + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function render(now) {
    drawBoard();
    drawPieces();
    drawHighlights(now || 0); // on top of pieces so capture hints stay visible
    drawAnimPiece(now || 0);
    drawParticles();
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  // ---- Game logic ----
  function computeLegalForTurn() {
    state.legal = {};
    const moves = XQ.generateLegalMoves(state.board, state.turn);
    for (const m of moves) {
      const k = key(m.fr, m.fc);
      if (!state.legal[k]) state.legal[k] = [];
      state.legal[k].push([m.tr, m.tc]);
    }
  }

  function selectAt(r, c) {
    const p = state.board[r][c];
    if (p && p.side === state.turn) {
      state.selected = { r, c };
      const s = soundPos(r, c);
      Audio3D.playSelect(s.nx, s.nz);
      return;
    }
    if (state.selected) {
      const targets = state.legal[key(state.selected.r, state.selected.c)] || [];
      const hit = targets.find(([tr, tc]) => tr === r && tc === c);
      if (hit) {
        doMove({ fr: state.selected.r, fc: state.selected.c, tr: r, tc: c });
        return;
      }
    }
    state.selected = null;
  }

  function doMove(move) {
    const moving = state.board[move.fr][move.fc];
    const captured = state.board[move.tr][move.tc];
    const sp = soundPos(move.tr, move.tc);

    state.board = XQ.applyMove(state.board, move);
    state.lastMove = move;
    state.selected = null;
    state.legal = {};

    // animation
    state.anim = {
      fr: move.fr, fc: move.fc, tr: move.tr, tc: move.tc,
      side: moving.side, type: moving.type,
      start: performance.now(), dur: 220,
    };

    if (captured) {
      // record the captured piece into the mover's trophy tray
      if (moving.side === 'r') state.capturedRed.push(captured);
      else state.capturedBlack.push(captured);
      Audio3D.playCapture(sp.nx, sp.nz);
      spawnParticles(move.tr, move.tc, moving.side === 'r' ? '#ff3b6b' : '#21e6ff');
      renderCapturedTrays();
    } else {
      Audio3D.playMove(sp.nx, sp.nz);
    }

    // switch turn
    state.turn = XQ.opponent(state.turn);

    // check / game over
    const status = XQ.getStatus(state.board, state.turn);
    const inCheck = XQ.isInCheck(state.board, state.turn);
    if (inCheck && !status.over) Audio3D.playCheck(sp.nx, sp.nz);

    if (status.over) {
      endGame(status.winner);
      return;
    }

    computeLegalForTurn(); // refresh legal moves for the side to move
    updateStatusUI();
    maybeAITurn();
  }

  function maybeAITurn() {
    if (state.mode !== 'ai') return;
    if (state.gameOver) return;
    if (state.turn === state.humanSide) return; // not AI's turn
    state.thinking = true;
    updateStatusUI();
    // defer so the move animation can play
    setTimeout(() => {
      const move = AI.chooseMove(state.board, state.turn, state.difficulty);
      state.thinking = false;
      if (!move) { // AI has no move -> human wins
        endGame(state.humanSide);
        return;
      }
      doMove(move);
    }, 360);
  }

  function endGame(winner) {
    state.gameOver = true;
    state.winner = winner;
    showBanner(winner);
    // sound from human perspective (AI mode) or just announce in 2P
    if (state.mode === 'ai') {
      if (winner === state.humanSide) Audio3D.playWin();
      else Audio3D.playLose();
    } else {
      Audio3D.playWin();
    }
    updateStatusUI();
  }

  // ---- UI wiring ----
  const turnChip = document.getElementById('turnChip');
  const turnDot = document.getElementById('turnDot');
  const turnText = document.getElementById('turnText');
  const banner = document.getElementById('banner');
  const bannerBig = document.getElementById('bannerBig');
  const bannerSub = document.getElementById('bannerSub');

  function updateStatusUI() {
    const isRed = state.turn === 'r';
    turnDot.className = 'turn-dot ' + (isRed ? 'red' : 'blue');
    let label;
    if (state.thinking) {
      label = state.turn === 'b' ? T('xq.blueThinking', '蓝方核心思考中…') : T('xq.thinking', '思考中…');
    } else if (state.mode === 'ai') {
      label = (state.turn === state.humanSide ? T('xq.yourMove', '轮到你') : 'BLUE CORE')
        + (isRed ? ' (RED)' : ' (BLUE)');
    } else {
      label = isRed ? T('xq.turnRed', '红方走棋') : T('xq.turnBlue', '蓝方走棋');
    }
    turnText.textContent = label;
  }

  function showBanner(winner) {
    let big, sub, cls;
    if (state.mode === 'ai') {
      if (winner === state.humanSide) { big = T('xq.victory', '胜利'); sub = T('xq.youWon', '你击败了蓝方核心'); cls = 'win'; }
      else { big = T('xq.defeat', '失败'); sub = T('xq.bluePrevailed', '蓝方核心获胜'); cls = 'lose'; }
    } else {
      big = winner === 'r' ? T('xq.redWins', '红方获胜') : T('xq.blueWins', '蓝方获胜');
      sub = T('xq.checkmate', '将死 / 无子可走');
      cls = winner === 'r' ? 'win' : 'lose';
    }
    bannerBig.textContent = big;
    bannerSub.textContent = sub;
    banner.className = 'banner show ' + cls;
  }

  function hideBanner() { banner.className = 'banner'; }

  // Buttons
  document.getElementById('btnNew').addEventListener('click', newGame);
  document.getElementById('btnRules').addEventListener('click', () =>
    document.getElementById('rulesModal').classList.add('show'));
  document.getElementById('rulesClose').addEventListener('click', () =>
    document.getElementById('rulesModal').classList.remove('show'));
  document.getElementById('bannerNew').addEventListener('click', newGame);

  const modeBtns = document.querySelectorAll('[data-mode]');
  modeBtns.forEach(b => b.addEventListener('click', () => {
    modeBtns.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    state.mode = b.getAttribute('data-mode');
    document.getElementById('diffRow').style.display = state.mode === 'ai' ? 'flex' : 'none';
    newGame();
  }));

  const diffBtns = document.querySelectorAll('[data-diff]');
  diffBtns.forEach(b => b.addEventListener('click', () => {
    diffBtns.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    state.difficulty = b.getAttribute('data-diff');
  }));

  const soundBtn = document.getElementById('btnSound');
  soundBtn.addEventListener('click', () => {
    state.soundOn = !state.soundOn;
    Audio3D.setEnabled(state.soundOn);
    soundBtn.textContent = state.soundOn ? T('xq.soundOn', '音效：开') : T('xq.soundOff', '音效：关');
    soundBtn.classList.toggle('active', state.soundOn);
    // Sound off silences everything; sound on resumes music if it was enabled.
    if (!state.soundOn) Audio3D.stopMusic();
    else if (state.musicOn) Audio3D.startMusic();
  });

  const musicBtn = document.getElementById('btnMusic');
  musicBtn.addEventListener('click', () => {
    state.musicOn = !state.musicOn;
    if (state.musicOn) {
      Audio3D.start(); // unlock audio on user gesture
      if (!state.soundOn) { // music needs sound on to be audible
        state.soundOn = true;
        Audio3D.setEnabled(true);
        soundBtn.textContent = T('xq.soundOn', '音效：开');
        soundBtn.classList.add('active');
      }
      Audio3D.startMusic();
    } else {
      Audio3D.stopMusic();
    }
    musicBtn.textContent = state.musicOn ? T('xq.musicOn', '音乐：开') : T('xq.musicOff', '音乐：关');
    musicBtn.classList.toggle('active', state.musicOn);
  });

  // Fullscreen toggle for the board area (ESC returns to the default window).
  const fullBtn = document.getElementById('btnFull');
  fullBtn.addEventListener('click', () => {
    const wrap = document.getElementById('boardWrap');
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fsEl) {
      const req = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
      if (req) req.call(wrap);
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
    }
  });
  function syncFullscreenBtn() {
    const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
    fullBtn.textContent = on ? T('xq.exitFull', '退出全屏') : T('xq.fullscreen', '全屏');
    fullBtn.classList.toggle('active', on);
  }
  document.addEventListener('fullscreenchange', syncFullscreenBtn);
  document.addEventListener('webkitfullscreenchange', syncFullscreenBtn);

  function newGame() {
    state.board = XQ.buildInitialBoard();
    state.turn = 'r';
    state.selected = null;
    state.legal = {};
    state.lastMove = null;
    state.gameOver = false;
    state.winner = null;
    state.anim = null;
    state.particles = [];
    state.capturedRed = [];
    state.capturedBlack = [];
    state.thinking = false;
    hideBanner();
    computeLegalForTurn();
    updateStatusUI();
    renderCapturedTrays();
  }

  // ---- Captured-pieces trays ----
  // Top tray shows what BLACK has captured (Red pieces); bottom shows what
  // RED has captured (Black pieces). Icons are small neon triangles.
  function chipHTML(p) {
    const cls = p.side === 'r' ? 'red' : 'blue';
    const info = XQ.PIECE_INFO[p.type];
    const cn = info.cn[p.side];
    const stroke = p.side === 'r' ? '#ff3b6b' : '#21e6ff';
    return `<span class="chip ${cls}" title="${info.en}">`
      + `<svg viewBox="0 0 24 21"><polygon points="12,1 23,20 1,20" fill="rgba(10,18,34,0.6)" stroke="${stroke}" stroke-width="1.4" stroke-linejoin="round"/></svg>`
      + `<span class="gly">${cn}</span></span>`;
  }

  function renderCapturedTrays() {
    const top = document.getElementById('capturedTop');
    const bot = document.getElementById('capturedBottom');
    if (top) top.innerHTML = '<span class="tray-label">'+T('xq.blueCaptures', '蓝方吃子')+'</span>'
      + (state.capturedBlack || []).map(chipHTML).join('');
    if (bot) bot.innerHTML = '<span class="tray-label">'+T('xq.redCaptures', '红方吃子')+'</span>'
      + (state.capturedRed || []).map(chipHTML).join('');
  }

  // ---- Pointer input ----
  function eventToCell(ev) {
    const rect = canvas.getBoundingClientRect();
    const scale = BOARD_W / rect.width;
    const x = (ev.clientX - rect.left) * scale;
    const y = (ev.clientY - rect.top) * scale;
    const c = Math.round((x - MARGIN) / CELL);
    const r = Math.round((y - MARGIN) / CELL);
    if (!XQ.inBoard(r, c)) return null;
    // must be close enough to an intersection
    if (Math.hypot(x - px(c), y - py(r)) > CELL * 0.5) return null;
    return { r, c };
  }

  canvas.addEventListener('pointerdown', (ev) => {
    Audio3D.start(); // unlock audio on first interaction
    if (state.musicOn) Audio3D.startMusic(); // start the Chinese-classical loop
    if (state.gameOver) return;
    if (state.mode === 'ai' && state.turn !== state.humanSide) return;
    const cell = eventToCell(ev);
    if (!cell) { state.selected = null; return; }
    selectAt(cell.r, cell.c);
  });

  // keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') document.getElementById('rulesModal').classList.add('show');
    if (e.key === 'n' || e.key === 'N') newGame();
  });

  // ---- Init ----
  computeLegalForTurn();
  updateStatusUI();
  renderCapturedTrays();
  // start ambient after first interaction (handled in pointerdown / sound toggle)
  soundBtn.addEventListener('click', () => { if (state.soundOn) Audio3D.startAmbient(); });

  // 语言切换后刷新非逐帧文本（状态栏 / 吃子区 / 全屏按钮）
  window.addEventListener('i18n:change', function () {
    try {
      updateStatusUI();
      renderCapturedTrays();
      syncFullscreenBtn();
    } catch (e) {}
  });
})();
