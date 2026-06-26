// ============================================================
// NEON CHECKERS VR — Holographic Draughts Game
// Built with IWSDK 0.4.x — playable in VR and browser
// ============================================================

import {
  World, createSystem, PanelUI, PanelDocument, UIKitDocument, UIKit,
  BoxGeometry, MeshStandardMaterial, MeshBasicMaterial, Mesh,
  Color, Group, PointLight, DirectionalLight, AmbientLight, FogExp2,
  LineSegments, BufferGeometry, Float32BufferAttribute, LineBasicMaterial,
  SphereGeometry, CylinderGeometry, EdgesGeometry, Object3D,
  Follower, ScreenSpace, InputComponent,
  PlaneGeometry, RingGeometry, TorusGeometry, DoubleSide,
  Vector3, Raycaster, Vector2,
} from '@iwsdk/core';

interface RuntimeInput {
  keyboard?: { getKeyDown(key: string): boolean; getKeyPressed(key: string): boolean; };
  gamepads: Record<'left'|'right', {
    getButtonDown(id: string): boolean; getButtonValue(id: string): number;
    getAxesValues(id: string): { x: number; y: number } | undefined;
  } | undefined>;
}

// ============================================================
// TYPES
// ============================================================
type Screen = 'title'|'modeselect'|'difficulty'|'playing'|'paused'|'gameover'|
  'leaderboard'|'achievements'|'stats'|'settings'|'help'|'skins';
type Mode = 'solo'|'vsai'|'timed'|'blitz'|'daily'|'marathon'|'zen'|'practice';
type PieceColor = 'red'|'black';
type Cell = { piece: PieceColor|null; king: boolean };
type Pos = { r: number; c: number };
type Move = { from: Pos; to: Pos; captures: Pos[] };

const BOARD_SIZE = 8;
const CELL_SIZE = 0.12;
const BOARD_OFFSET = -(BOARD_SIZE * CELL_SIZE) / 2 + CELL_SIZE / 2;
const PIECE_RADIUS = 0.04;
const PIECE_HEIGHT = 0.015;
const BOARD_Y = 0.85;

// ============================================================
// THEMES
// ============================================================
interface Theme { name: string; accent: string; bg: string; fog: string; light: string; dark: string; gridC: string; table: string; }
const THEMES: Theme[] = [
  { name:'Neon Holodeck', accent:'#00ffff', bg:'#000a0f', fog:'#000a0f', light:'#1a2a35', dark:'#0a1520', gridC:'#004455', table:'#003344' },
  { name:'Crimson Grid', accent:'#ff3366', bg:'#0f0005', fog:'#0f0005', light:'#2a1520', dark:'#1a0a10', gridC:'#440022', table:'#330011' },
  { name:'Toxic Neon', accent:'#33ff33', bg:'#000f00', fog:'#000f00', light:'#1a2a1a', dark:'#0a150a', gridC:'#004400', table:'#003300' },
  { name:'Ultra Violet', accent:'#aa55ff', bg:'#05000f', fog:'#05000f', light:'#201a2a', dark:'#100a1a', gridC:'#220044', table:'#110033' },
  { name:'Solar Blaze', accent:'#ff8800', bg:'#0f0500', fog:'#0f0500', light:'#2a1a0a', dark:'#1a0a05', gridC:'#442200', table:'#331100' },
];

// ============================================================
// SKINS
// ============================================================
interface Skin { name: string; redBody: string; redEdge: string; blackBody: string; blackEdge: string; unlock: string; req: (s: Save) => boolean; }
const SKINS: Skin[] = [
  { name:'Classic Neon', redBody:'#ff2244', redEdge:'#ff5566', blackBody:'#111111', blackEdge:'#00ffff', unlock:'Default', req:()=>true },
  { name:'Solar', redBody:'#ff6600', redEdge:'#ff8833', blackBody:'#0a1a30', blackEdge:'#3388ff', unlock:'Win 5 games', req:s=>s.totalWins>=5 },
  { name:'Toxic', redBody:'#00cc44', redEdge:'#33ff66', blackBody:'#330033', blackEdge:'#cc33ff', unlock:'Capture 50 pieces', req:s=>s.totalCaptures>=50 },
  { name:'Frost', redBody:'#2266cc', redEdge:'#55aaff', blackBody:'#220a0a', blackEdge:'#ff4444', unlock:'Win vs Hard AI', req:s=>s.hardWins>=1 },
  { name:'Gold', redBody:'#cc8800', redEdge:'#ffcc00', blackBody:'#1a1a1a', blackEdge:'#cccccc', unlock:'Crown 5 kings', req:s=>s.totalKings>=5 },
  { name:'Void', redBody:'#880088', redEdge:'#cc44cc', blackBody:'#002211', blackEdge:'#00ffaa', unlock:'Play 20 games', req:s=>s.totalGames>=20 },
];

// ============================================================
// ACHIEVEMENTS
// ============================================================
interface Ach { id: string; name: string; desc: string; chk: (s: Save) => boolean; }
const ACHS: Ach[] = [
  { id:'first_game', name:'First Move', desc:'Complete your first game', chk:s=>s.totalGames>=1 },
  { id:'first_win', name:'Victor', desc:'Win your first game', chk:s=>s.totalWins>=1 },
  { id:'ten_games', name:'Regular', desc:'Play 10 games', chk:s=>s.totalGames>=10 },
  { id:'ten_wins', name:'Veteran', desc:'Win 10 games', chk:s=>s.totalWins>=10 },
  { id:'capture_10', name:'Hunter', desc:'Capture 10 pieces total', chk:s=>s.totalCaptures>=10 },
  { id:'capture_50', name:'Predator', desc:'Capture 50 pieces total', chk:s=>s.totalCaptures>=50 },
  { id:'multi_jump', name:'Chain Reaction', desc:'Make a triple jump', chk:s=>s.maxChainJump>=3 },
  { id:'quad_jump', name:'Unstoppable', desc:'Make a quadruple jump', chk:s=>s.maxChainJump>=4 },
  { id:'king_me', name:'Crowned', desc:'Get your first king', chk:s=>s.totalKings>=1 },
  { id:'five_kings', name:'Royal Court', desc:'Crown 5 kings total', chk:s=>s.totalKings>=5 },
  { id:'flawless', name:'Flawless', desc:'Win without losing a piece', chk:s=>s.flawlessWins>=1 },
  { id:'beat_easy', name:'Apprentice', desc:'Beat Easy AI', chk:s=>s.easyWins>=1 },
  { id:'beat_med', name:'Tactician', desc:'Beat Medium AI', chk:s=>s.medWins>=1 },
  { id:'beat_hard', name:'Grandmaster', desc:'Beat Hard AI', chk:s=>s.hardWins>=1 },
  { id:'speed_win', name:'Lightning', desc:'Win in under 2 minutes', chk:s=>s.fastestWin<120 },
  { id:'comeback', name:'Comeback Kid', desc:'Win when down 3+ pieces', chk:s=>s.comebackWins>=1 },
  { id:'sweep', name:'Clean Sweep', desc:'Capture all 12 opponent pieces', chk:s=>s.cleanSweeps>=1 },
  { id:'all_modes', name:'Explorer', desc:'Play all game modes', chk:s=>(s.modesPlayed?.size||0)>=6 },
  { id:'streak_3', name:'Hot Streak', desc:'Win 3 games in a row', chk:s=>s.bestStreak>=3 },
  { id:'streak_5', name:'On Fire', desc:'Win 5 games in a row', chk:s=>s.bestStreak>=5 },
  { id:'timed_win', name:'Time Lord', desc:'Win a timed game', chk:s=>s.timedWins>=1 },
  { id:'king_caps', name:'Royal Executioner', desc:'Capture 10 with kings', chk:s=>s.kingCaptures>=10 },
  { id:'no_kings', name:'Peasant Power', desc:'Win without making kings', chk:s=>s.noKingWins>=1 },
  { id:'fifty_wins', name:'Legend', desc:'Win 50 games', chk:s=>s.totalWins>=50 },
  { id:'perfect', name:'Perfect Game', desc:'Capture all 12 losing none', chk:s=>s.perfectGames>=1 },
];

// ============================================================
// SAVE DATA
// ============================================================
interface Save {
  totalGames: number; totalWins: number; totalCaptures: number;
  maxChainJump: number; flawlessWins: number; cleanSweeps: number;
  easyWins: number; medWins: number; hardWins: number;
  fastestWin: number; comebackWins: number; bestStreak: number;
  currentStreak: number; totalKings: number; kingCaptures: number;
  noKingWins: number; perfectGames: number; timedWins: number;
  modesPlayed: Set<string>; achUnlocked: Set<string>;
  selectedTheme: number; selectedSkin: number;
  sfxOn: boolean; musicOn: boolean;
  highScores: { mode: string; time: number; captures: number; date: string }[];
}
function defaultSave(): Save {
  return { totalGames:0, totalWins:0, totalCaptures:0, maxChainJump:0, flawlessWins:0,
    cleanSweeps:0, easyWins:0, medWins:0, hardWins:0, fastestWin:Infinity,
    comebackWins:0, bestStreak:0, currentStreak:0, totalKings:0, kingCaptures:0,
    noKingWins:0, perfectGames:0, timedWins:0,
    modesPlayed:new Set(), achUnlocked:new Set(),
    selectedTheme:0, selectedSkin:0, sfxOn:true, musicOn:true, highScores:[] };
}
function loadSave(): Save {
  try { const raw = localStorage.getItem('neon-checkers-save');
    if (!raw) return defaultSave(); const j = JSON.parse(raw);
    j.modesPlayed = new Set(j.modesPlayed||[]); j.achUnlocked = new Set(j.achUnlocked||[]);
    if (j.fastestWin==null) j.fastestWin=Infinity; return j;
  } catch { return defaultSave(); }
}
function writeSave(s: Save) {
  const j: Record<string,unknown> = { ...s, modesPlayed:[...s.modesPlayed], achUnlocked:[...s.achUnlocked] };
  localStorage.setItem('neon-checkers-save', JSON.stringify(j));
}

// ============================================================
// AUDIO
// ============================================================
let audioCtx: AudioContext|null = null;
function ensureAudio() { if (!audioCtx) audioCtx = new AudioContext(); return audioCtx; }
function playTone(freq: number, dur: number, vol=0.15, type: OscillatorType='sine') {
  try { const ctx=ensureAudio(), o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type; o.frequency.value=freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+dur);
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime+dur);
  } catch {}
}
const sfxMove = () => playTone(440, 0.1, 0.1, 'triangle');
const sfxCapture = () => { playTone(660, 0.15, 0.15, 'square'); playTone(880, 0.15, 0.12); };
const sfxKing = () => { playTone(523, 0.2, 0.15); playTone(659, 0.2, 0.12); playTone(784, 0.2, 0.1); };
const sfxWin = () => { playTone(523, 0.15, 0.15); playTone(659, 0.15, 0.12); playTone(784, 0.15, 0.1); playTone(1047, 0.3, 0.15); };
const sfxLose = () => { playTone(392, 0.2, 0.12); playTone(330, 0.2, 0.1); playTone(262, 0.3, 0.12); };
const sfxClick = () => playTone(800, 0.05, 0.08, 'triangle');
const sfxSelect = () => playTone(600, 0.08, 0.1, 'triangle');

// ============================================================
// BOARD LOGIC
// ============================================================
function initBoard(): Cell[][] {
  const b: Cell[][] = [];
  for (let r=0; r<8; r++) { b[r]=[]; for (let c=0; c<8; c++) {
    if ((r+c)%2===1) {
      if (r<3) b[r][c]={piece:'black',king:false};
      else if (r>4) b[r][c]={piece:'red',king:false};
      else b[r][c]={piece:null,king:false};
    } else b[r][c]={piece:null,king:false};
  }} return b;
}
function cloneBoard(b: Cell[][]): Cell[][] { return b.map(row=>row.map(c=>({...c}))); }
function countPieces(b: Cell[][], color: PieceColor): number {
  let n=0; for (let r=0;r<8;r++) for (let c=0;c<8;c++) if (b[r][c].piece===color) n++; return n;
}

function getCapturesForPiece(b: Cell[][], r: number, c: number, captured: Pos[]): Move[] {
  const cell=b[r][c]; if (!cell.piece) return [];
  const dirs: number[] = cell.king ? [-1,1] : (cell.piece==='red' ? [-1] : [1]);
  const moves: Move[] = [];
  for (const dr of dirs) for (const dc of [-1,1]) {
    const mr=r+dr, mc=c+dc, lr=r+dr*2, lc=c+dc*2;
    if (lr<0||lr>=8||lc<0||lc>=8) continue;
    if (!b[mr][mc].piece || b[mr][mc].piece===cell.piece) continue;
    if (b[lr][lc].piece) continue;
    if (captured.some(p=>p.r===mr&&p.c===mc)) continue;
    const nc=[...captured,{r:mr,c:mc}];
    const tb=cloneBoard(b); tb[lr][lc]={...tb[r][c]}; tb[r][c]={piece:null,king:false}; tb[mr][mc]={piece:null,king:false};
    if ((cell.piece==='red'&&lr===0)||(cell.piece==='black'&&lr===7)) tb[lr][lc].king=true;
    const further=getCapturesForPiece(tb,lr,lc,nc);
    if (further.length>0) for (const f of further) {
      const allCaps=[...nc,...f.captures.filter(fc=>!nc.some(n2=>n2.r===fc.r&&n2.c===fc.c))];
      moves.push({from:{r,c},to:f.to,captures:allCaps});
    } else moves.push({from:{r,c},to:{r:lr,c:lc},captures:nc});
  }
  return moves;
}

function getMovesForPiece(b: Cell[][], r: number, c: number): Move[] {
  const cell=b[r][c]; if (!cell.piece) return [];
  const moves: Move[] = [];
  const dirs: number[] = cell.king ? [-1,1] : (cell.piece==='red' ? [-1] : [1]);
  for (const dr of dirs) for (const dc of [-1,1]) {
    const nr=r+dr, nc_=c+dc;
    if (nr>=0&&nr<8&&nc_>=0&&nc_<8&&!b[nr][nc_].piece) moves.push({from:{r,c},to:{r:nr,c:nc_},captures:[]});
  }
  moves.push(...getCapturesForPiece(b,r,c,[]));
  return moves;
}

function getAllMoves(b: Cell[][], color: PieceColor): Move[] {
  const moves: Move[] = [];
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) if (b[r][c].piece===color) moves.push(...getMovesForPiece(b,r,c));
  const caps=moves.filter(m=>m.captures.length>0);
  return caps.length>0 ? caps : moves;
}

function executeMove(b: Cell[][], m: Move): Cell[][] {
  const nb=cloneBoard(b);
  nb[m.to.r][m.to.c]={...nb[m.from.r][m.from.c]};
  nb[m.from.r][m.from.c]={piece:null,king:false};
  for (const cap of m.captures) nb[cap.r][cap.c]={piece:null,king:false};
  const p=nb[m.to.r][m.to.c];
  if (p.piece==='red'&&m.to.r===0) p.king=true;
  if (p.piece==='black'&&m.to.r===7) p.king=true;
  return nb;
}

function checkWinnerStatic(b: Cell[][]): PieceColor|null {
  if (countPieces(b,'red')===0) return 'black';
  if (countPieces(b,'black')===0) return 'red';
  return null;
}

// ============================================================
// AI
// ============================================================
function evaluateBoard(b: Cell[][], color: PieceColor): number {
  let score=0;
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const cell=b[r][c]; if (!cell.piece) continue;
    const val=cell.king?3:1; let pos=0;
    if (c>=2&&c<=5) pos+=0.1;
    if (cell.piece==='red') pos+=(7-r)*0.05; else pos+=r*0.05;
    if (cell.piece==='red'&&r===7&&!cell.king) pos+=0.2;
    if (cell.piece==='black'&&r===0&&!cell.king) pos+=0.2;
    if (cell.piece===color) score+=val+pos; else score-=val+pos;
  }
  return score;
}

function minimax(b: Cell[][], depth: number, alpha: number, beta: number, max: boolean, ai: PieceColor): number {
  const w=checkWinnerStatic(b);
  if (w===ai) return 100; if (w&&w!==ai) return -100;
  if (depth===0) return evaluateBoard(b,ai);
  const cur=max?ai:(ai==='red'?'black':'red');
  const moves=getAllMoves(b,cur);
  if (moves.length===0) return max?-100:100;
  if (max) { let mx=-Infinity; for (const m of moves) { mx=Math.max(mx,minimax(executeMove(b,m),depth-1,alpha,beta,false,ai)); alpha=Math.max(alpha,mx); if (beta<=alpha) break; } return mx; }
  else { let mn=Infinity; for (const m of moves) { mn=Math.min(mn,minimax(executeMove(b,m),depth-1,alpha,beta,true,ai)); beta=Math.min(beta,mn); if (beta<=alpha) break; } return mn; }
}

function aiMove(board: Cell[][], diff: number): Move|null {
  const moves=getAllMoves(board,'black');
  if (moves.length===0) return null;
  if (diff===0) return moves[Math.floor(Math.random()*moves.length)];
  const d=diff===1?3:5; let best=moves[0], bestS=-Infinity;
  for (const m of moves) { const s=minimax(executeMove(board,m),d-1,-Infinity,Infinity,false,'black');
    if (s>bestS||(s===bestS&&Math.random()>0.5)) { bestS=s; best=m; } }
  return best;
}

// ============================================================
// GAME STATE (module-level)
// ============================================================
let save = loadSave();
let screen: Screen = 'title';
let mode: Mode = 'solo';
let difficulty = 1;
let board: Cell[][] = initBoard();
let turn: PieceColor = 'red';
let selected: Pos|null = null;
let validMoves: Move[] = [];
let allMoves: Move[] = [];
let gameStartTime = 0;
let gameDuration = 0;
let playerCaptures = 0;
let aiCaptures = 0;
let playerKingsThisGame = 0;
let piecesLost = 0;
let worstDeficit = 0;
let timerSec = 300;
let timerAcc = 0;
let aiThinking = false;
let toastTimer = 0;

// 3D objects
let boardGroup: Group;
let pieceMeshes: (Mesh|null)[][] = [];
let crownMeshes: (Mesh|null)[][] = [];
let highlightMeshes: Mesh[] = [];
let selectedHighlight: Mesh|null = null;

// ============================================================
// PANEL MANAGER
// ============================================================
class Panels {
  docs = new Map<string, UIKitDocument>();
  entities = new Map<string, { entity: any; scr: Screen[] }>();

  setDoc(n: string, d: UIKitDocument) { this.docs.set(n, d); }
  el(p: string, id: string) { return this.docs.get(p)?.getElementById(id) as UIKit.Text|undefined; }
  st(p: string, id: string, t: string) { this.el(p,id)?.setProperties({text:t}); }
  oc(p: string, id: string, fn: ()=>void) { this.el(p,id)?.addEventListener('click', fn); }

  vis() {
    for (const [, info] of this.entities) {
      const show = info.scr.includes(screen);
      if (info.entity?.object3D) info.entity.object3D.visible = show;
    }
  }

  wireTitle() {
    this.oc('title','btn-play',()=>{ sfxClick(); screen='modeselect'; this.vis(); });
    this.oc('title','btn-scores',()=>{ sfxClick(); screen='leaderboard'; this.updLB(); this.vis(); });
    this.oc('title','btn-achievements',()=>{ sfxClick(); screen='achievements'; this.updAch(); this.vis(); });
    this.oc('title','btn-stats',()=>{ sfxClick(); screen='stats'; this.updStats(); this.vis(); });
    this.oc('title','btn-skins',()=>{ sfxClick(); screen='skins'; this.updSkins(); this.vis(); });
    this.oc('title','btn-settings',()=>{ sfxClick(); screen='settings'; this.updSett(); this.vis(); });
    this.oc('title','btn-help',()=>{ sfxClick(); screen='help'; this.vis(); });
  }

  wireMode() {
    const ms: [string,Mode][] = [['btn-solo','solo'],['btn-vsai','vsai'],['btn-timed','timed'],
      ['btn-blitz','blitz'],['btn-daily','daily'],['btn-marathon','marathon'],
      ['btn-zen','zen'],['btn-practice','practice']];
    for (const [b,m] of ms) this.oc('mode',b,()=>{ sfxClick(); mode=m; screen='difficulty'; this.vis(); });
    this.oc('mode','btn-back',()=>{ sfxClick(); screen='title'; this.vis(); });
  }

  wireDiff() {
    this.oc('difficulty','btn-easy',()=>{ sfxClick(); difficulty=0; startGame(); this.vis(); });
    this.oc('difficulty','btn-medium',()=>{ sfxClick(); difficulty=1; startGame(); this.vis(); });
    this.oc('difficulty','btn-hard',()=>{ sfxClick(); difficulty=2; startGame(); this.vis(); });
    this.oc('difficulty','btn-back',()=>{ sfxClick(); screen='modeselect'; this.vis(); });
  }

  wirePause() {
    this.oc('pause','btn-resume',()=>{ sfxClick(); screen='playing'; this.vis(); });
    this.oc('pause','btn-restart',()=>{ sfxClick(); startGame(); this.vis(); });
    this.oc('pause','btn-quit',()=>{ sfxClick(); screen='title'; this.vis(); });
  }

  wireGameover() {
    this.oc('gameover','btn-replay',()=>{ sfxClick(); startGame(); this.vis(); });
    this.oc('gameover','btn-menu',()=>{ sfxClick(); screen='title'; this.vis(); });
  }

  wireSettings() {
    this.oc('settings','btn-sfx',()=>{ sfxClick(); save.sfxOn=!save.sfxOn; writeSave(save); this.updSett(); });
    this.oc('settings','btn-music',()=>{ sfxClick(); save.musicOn=!save.musicOn; writeSave(save); this.updSett(); });
    this.oc('settings','btn-theme-prev',()=>{ sfxClick(); save.selectedTheme=(save.selectedTheme-1+THEMES.length)%THEMES.length; writeSave(save); this.updSett(); });
    this.oc('settings','btn-theme-next',()=>{ sfxClick(); save.selectedTheme=(save.selectedTheme+1)%THEMES.length; writeSave(save); this.updSett(); });
    this.oc('settings','btn-reset',()=>{ sfxClick(); save=defaultSave(); writeSave(save); this.updSett(); });
    this.oc('settings','btn-back',()=>{ sfxClick(); screen='title'; this.vis(); });
  }

  wireHelp() { this.oc('help','btn-back',()=>{ sfxClick(); screen='title'; this.vis(); }); }
  wireAch() { this.oc('achvlist','btn-back',()=>{ sfxClick(); screen='title'; this.vis(); }); }
  wireStats() { this.oc('stats','btn-back',()=>{ sfxClick(); screen='title'; this.vis(); }); }
  wireLB() { this.oc('leaderboard','btn-back',()=>{ sfxClick(); screen='title'; this.vis(); }); }

  wireSkins() {
    for (let i=0;i<SKINS.length;i++) this.oc('skins',`btn-skin-${i}`,()=>{
      sfxClick(); if (SKINS[i].req(save)) { save.selectedSkin=i; writeSave(save); this.updSkins(); syncBoardVisuals(); }
    });
    this.oc('skins','btn-back',()=>{ sfxClick(); screen='title'; this.vis(); });
  }

  updHUD() {
    const elapsed=screen==='playing'?(Date.now()-gameStartTime)/1000:gameDuration;
    const m=Math.floor(elapsed/60), s=Math.floor(elapsed%60);
    const turnStr=turn==='red'?'YOUR TURN':(aiThinking?'AI THINKING...':'AI TURN');
    const diffs=['Easy','Medium','Hard'];
    this.st('hud','turn-display',turnStr);
    this.st('hud','time-display',`${m}:${s<10?'0':''}${s}`);
    this.st('hud','player-count',`You: ${countPieces(board,'red')}`);
    this.st('hud','ai-count',`AI: ${countPieces(board,'black')}`);
    this.st('hud','diff-display',diffs[difficulty]);
    this.st('hud','mode-display',mode.toUpperCase());
    if (mode==='timed'||mode==='blitz') {
      const tm=Math.floor(timerSec/60), ts=Math.floor(timerSec%60);
      this.st('hud','timer-display',`${tm}:${ts<10?'0':''}${ts}`);
    } else this.st('hud','timer-display','');
  }

  updSett() {
    this.st('settings','sfx-status',save.sfxOn?'ON':'OFF');
    this.st('settings','music-status',save.musicOn?'ON':'OFF');
    this.st('settings','theme-name',THEMES[save.selectedTheme].name);
  }

  updAch() {
    checkAchievements();
    for (let i=0;i<ACHS.length;i++) {
      const u=save.achUnlocked.has(ACHS[i].id);
      this.st('achvlist',`ach-${i}`,`${u?'[*]':'[ ]'} ${ACHS[i].name} - ${ACHS[i].desc}`);
    }
    this.st('achvlist','ach-count',`${save.achUnlocked.size}/${ACHS.length} Unlocked`);
  }

  updStats() {
    this.st('stats','stat-games',`Games Played: ${save.totalGames}`);
    this.st('stats','stat-wins',`Wins: ${save.totalWins}`);
    this.st('stats','stat-captures',`Total Captures: ${save.totalCaptures}`);
    this.st('stats','stat-kings',`Kings Crowned: ${save.totalKings}`);
    this.st('stats','stat-streak',`Best Streak: ${save.bestStreak}`);
    this.st('stats','stat-chain',`Best Chain Jump: ${save.maxChainJump}`);
    this.st('stats','stat-fastest',`Fastest Win: ${save.fastestWin===Infinity?'--':Math.floor(save.fastestWin)+'s'}`);
    this.st('stats','stat-flawless',`Flawless Wins: ${save.flawlessWins}`);
    this.st('stats','stat-modes',`Modes Played: ${save.modesPlayed?.size||0}`);
  }

  updSkins() {
    for (let i=0;i<SKINS.length;i++) {
      const u=SKINS[i].req(save), sel=save.selectedSkin===i;
      this.st('skins',`btn-skin-${i}`, u ? `${sel?'>> ':''}${SKINS[i].name}${sel?' <<':''}` : `[LOCKED] ${SKINS[i].unlock}`);
    }
  }

  updLB() {
    const scores=save.highScores.slice(0,10);
    for (let i=0;i<10;i++) {
      if (i<scores.length) { const s=scores[i]; this.st('leaderboard',`score-${i}`,`#${i+1} ${s.mode} - ${s.captures} caps - ${Math.floor(s.time)}s`); }
      else this.st('leaderboard',`score-${i}`,`#${i+1} ---`);
    }
  }

  updGameover(winner: PieceColor|'draw') {
    if (winner==='draw') { this.st('gameover','result-text','DRAW'); this.st('gameover','result-detail','Neither side could win'); }
    else if (winner==='red') { this.st('gameover','result-text','YOU WIN!'); this.st('gameover','result-detail',`Captured ${playerCaptures} pieces in ${Math.floor(gameDuration)}s`); }
    else { this.st('gameover','result-text','AI WINS'); this.st('gameover','result-detail',`AI captured ${aiCaptures} of your pieces`); }
  }

  showToast(msg: string) { toastTimer=3; this.st('toast','toast-text',msg);
    const info=this.entities.get('toast'); if (info?.entity?.object3D) info.entity.object3D.visible=true; }
}
const panels = new Panels();

// ============================================================
// GAME FLOW
// ============================================================
function checkAchievements() {
  for (const a of ACHS) if (!save.achUnlocked.has(a.id)&&a.chk(save)) { save.achUnlocked.add(a.id); panels.showToast(`Achievement: ${a.name}!`); }
  writeSave(save);
}

function startGame() {
  board=initBoard(); turn='red'; selected=null; validMoves=[]; playerCaptures=0; aiCaptures=0;
  playerKingsThisGame=0; piecesLost=0; worstDeficit=0; aiThinking=false;
  gameStartTime=Date.now(); gameDuration=0; timerAcc=0;
  if (mode==='timed') timerSec=300; else if (mode==='blitz') timerSec=120; else timerSec=0;
  allMoves=getAllMoves(board,'red');
  syncBoardVisuals(); clearHighlights(); screen='playing'; panels.vis();
}

function endGame(winner: PieceColor|'draw') {
  gameDuration=(Date.now()-gameStartTime)/1000;
  save.totalGames++; save.modesPlayed.add(mode); save.totalCaptures+=playerCaptures; save.totalKings+=playerKingsThisGame;
  if (winner==='red') {
    save.totalWins++; save.currentStreak++; save.bestStreak=Math.max(save.bestStreak,save.currentStreak);
    if (gameDuration<save.fastestWin) save.fastestWin=gameDuration;
    if (piecesLost===0) save.flawlessWins++;
    if (countPieces(board,'black')===0) save.cleanSweeps++;
    if (piecesLost===0&&countPieces(board,'black')===0) save.perfectGames++;
    if (worstDeficit>=3) save.comebackWins++;
    if (playerKingsThisGame===0) save.noKingWins++;
    if (difficulty===0) save.easyWins++; if (difficulty===1) save.medWins++; if (difficulty===2) save.hardWins++;
    if (mode==='timed'||mode==='blitz') save.timedWins++;
    sfxWin();
    save.highScores.push({mode,time:gameDuration,captures:playerCaptures,date:new Date().toISOString().slice(0,10)});
    save.highScores.sort((a,b)=>b.captures-a.captures||a.time-b.time);
    save.highScores=save.highScores.slice(0,20);
  } else { save.currentStreak=0; if (winner!=='draw') sfxLose(); }
  writeSave(save); checkAchievements(); panels.updGameover(winner); screen='gameover'; panels.vis();
}

function handleCellClick(r: number, c: number) {
  if (screen!=='playing'||turn!=='red'||aiThinking) return;
  const cell=board[r][c];
  if (cell.piece==='red') {
    const pm=allMoves.filter(m=>m.from.r===r&&m.from.c===c);
    if (pm.length>0) { selected={r,c}; validMoves=pm; sfxSelect(); showHighlights(); }
    return;
  }
  if (selected) {
    const move=validMoves.find(m=>m.to.r===r&&m.to.c===c);
    if (move) applyPlayerMove(move);
  }
}

function applyPlayerMove(move: Move) {
  const wasKing=board[move.from.r][move.from.c].king;
  board=executeMove(board,move);
  playerCaptures+=move.captures.length;
  if (move.captures.length>0) {
    save.maxChainJump=Math.max(save.maxChainJump,move.captures.length);
    save.kingCaptures+=(wasKing?move.captures.length:0);
    sfxCapture();
  } else sfxMove();
  if (!wasKing&&board[move.to.r][move.to.c].king) { playerKingsThisGame++; sfxKing(); }
  selected=null; validMoves=[]; clearHighlights(); syncBoardVisuals();
  const w=checkWinnerStatic(board);
  if (w) { endGame(w); return; }
  if (getAllMoves(board,'black').length===0) { endGame('red'); return; }
  turn='black'; allMoves=getAllMoves(board,'black'); doAiTurn();
}

function doAiTurn() {
  aiThinking=true;
  setTimeout(()=>{
    const move=aiMove(board,difficulty);
    if (!move) { endGame('red'); aiThinking=false; return; }
    const wasKing=board[move.from.r][move.from.c].king;
    board=executeMove(board,move);
    aiCaptures+=move.captures.length;
    if (move.captures.length>0) { piecesLost+=move.captures.length; sfxCapture(); } else sfxMove();
    if (!wasKing&&board[move.to.r][move.to.c].king) sfxKing();
    const deficit=countPieces(board,'black')-countPieces(board,'red');
    if (deficit>worstDeficit) worstDeficit=deficit;
    syncBoardVisuals();
    const w=checkWinnerStatic(board);
    if (w) { endGame(w); aiThinking=false; return; }
    if (getAllMoves(board,'red').length===0) { endGame('black'); aiThinking=false; return; }
    turn='red'; allMoves=getAllMoves(board,'red'); aiThinking=false;
  }, 300+Math.random()*400);
}

// ============================================================
// 3D RENDERING
// ============================================================
function cellToWorld(r: number, c: number) {
  return { x: BOARD_OFFSET+c*CELL_SIZE, z: BOARD_OFFSET+r*CELL_SIZE };
}

function getSkinColors(color: PieceColor) {
  const s=SKINS[save.selectedSkin];
  return color==='red' ? {body:s.redBody,edge:s.redEdge} : {body:s.blackBody,edge:s.blackEdge};
}

function createBoardVisuals(scene: Object3D) {
  boardGroup=new Group(); boardGroup.position.set(0,BOARD_Y,-0.5); scene.add(boardGroup);
  const th=THEMES[save.selectedTheme];
  const baseGeo=new BoxGeometry(8*CELL_SIZE+0.04,0.02,8*CELL_SIZE+0.04);
  const baseMesh=new Mesh(baseGeo,new MeshStandardMaterial({color:new Color(th.table),metalness:0.5,roughness:0.3}));
  baseMesh.position.y=-0.01; boardGroup.add(baseMesh);
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const dk=(r+c)%2===1;
    const geo=new BoxGeometry(CELL_SIZE-0.002,0.005,CELL_SIZE-0.002);
    const mat=new MeshStandardMaterial({color:new Color(dk?th.dark:th.light),metalness:0.3,roughness:0.5,
      emissive:new Color(dk?th.dark:th.light),emissiveIntensity:0.15});
    const mesh=new Mesh(geo,mat); const pos=cellToWorld(r,c);
    mesh.position.set(pos.x,0.005,pos.z);
    mesh.userData={boardCell:true,row:r,col:c}; boardGroup.add(mesh);
  }
  const eMat=new MeshStandardMaterial({color:new Color(th.accent),emissive:new Color(th.accent),emissiveIntensity:0.5,metalness:0.8,roughness:0.2});
  const eg1=new BoxGeometry(CELL_SIZE*8+0.01,0.003,0.005);
  for (const z of [-1,1]) { const e=new Mesh(eg1,eMat); e.position.set(0,0.008,z*(CELL_SIZE*4+0.005)); boardGroup.add(e); }
  const eg2=new BoxGeometry(0.005,0.003,CELL_SIZE*8+0.01);
  for (const x of [-1,1]) { const e=new Mesh(eg2,eMat); e.position.set(x*(CELL_SIZE*4+0.005),0.008,0); boardGroup.add(e); }
  pieceMeshes=[]; crownMeshes=[];
  for (let r=0;r<8;r++) { pieceMeshes[r]=[]; crownMeshes[r]=[]; for (let c=0;c<8;c++) { pieceMeshes[r][c]=null; crownMeshes[r][c]=null; } }
}

function syncBoardVisuals() {
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const cell=board[r][c]; const pos=cellToWorld(r,c);
    if (cell.piece) {
      if (!pieceMeshes[r][c]) {
        const sc=getSkinColors(cell.piece);
        const geo=new CylinderGeometry(PIECE_RADIUS,PIECE_RADIUS,PIECE_HEIGHT,24);
        const mat=new MeshStandardMaterial({color:new Color(sc.body),metalness:0.6,roughness:0.2,emissive:new Color(sc.edge),emissiveIntensity:0.3});
        const mesh=new Mesh(geo,mat); mesh.position.set(pos.x,PIECE_HEIGHT/2+0.008,pos.z);
        mesh.userData={isPiece:true,row:r,col:c}; boardGroup.add(mesh); pieceMeshes[r][c]=mesh;
      } else {
        const m=pieceMeshes[r][c]!; m.position.set(pos.x,PIECE_HEIGHT/2+0.008,pos.z);
        const sc=getSkinColors(cell.piece);
        (m.material as MeshStandardMaterial).color.set(sc.body);
        (m.material as MeshStandardMaterial).emissive.set(sc.edge);
        m.userData.row=r; m.userData.col=c;
      }
      if (cell.king&&!crownMeshes[r][c]) {
        const cg=new TorusGeometry(PIECE_RADIUS*0.6,0.003,8,16);
        const cm=new MeshStandardMaterial({color:new Color('#ffcc00'),emissive:new Color('#ffcc00'),emissiveIntensity:0.8,metalness:0.8,roughness:0.1});
        const crown=new Mesh(cg,cm); crown.rotation.x=Math.PI/2;
        crown.position.set(pos.x,PIECE_HEIGHT+0.012,pos.z); boardGroup.add(crown); crownMeshes[r][c]=crown;
      } else if (!cell.king&&crownMeshes[r][c]) { boardGroup.remove(crownMeshes[r][c]!); crownMeshes[r][c]=null; }
      else if (cell.king&&crownMeshes[r][c]) crownMeshes[r][c]!.position.set(pos.x,PIECE_HEIGHT+0.012,pos.z);
    } else {
      if (pieceMeshes[r][c]) { boardGroup.remove(pieceMeshes[r][c]!); pieceMeshes[r][c]=null; }
      if (crownMeshes[r][c]) { boardGroup.remove(crownMeshes[r][c]!); crownMeshes[r][c]=null; }
    }
  }
}

function clearHighlights() {
  for (const h of highlightMeshes) boardGroup.remove(h);
  highlightMeshes=[]; if (selectedHighlight) { boardGroup.remove(selectedHighlight); selectedHighlight=null; }
}

function showHighlights() {
  clearHighlights(); const th=THEMES[save.selectedTheme];
  if (selected) {
    const p=cellToWorld(selected.r,selected.c);
    const rg=new RingGeometry(PIECE_RADIUS-0.005,PIECE_RADIUS+0.005,24);
    const rm=new MeshBasicMaterial({color:new Color('#ffff00'),side:DoubleSide});
    selectedHighlight=new Mesh(rg,rm); selectedHighlight.position.set(p.x,0.012,p.z);
    selectedHighlight.rotation.x=-Math.PI/2; boardGroup.add(selectedHighlight);
  }
  for (let i=0;i<validMoves.length;i++) {
    const vm=validMoves[i]; const p=cellToWorld(vm.to.r,vm.to.c);
    const isCap=vm.captures.length>0;
    const hg=new BoxGeometry(CELL_SIZE-0.01,0.003,CELL_SIZE-0.01);
    const hm=new MeshBasicMaterial({color:new Color(isCap?'#ff4444':th.accent),transparent:true,opacity:0.5});
    const mesh=new Mesh(hg,hm); mesh.position.set(p.x,0.01,p.z);
    mesh.userData={isHighlight:true,moveIdx:i}; boardGroup.add(mesh); highlightMeshes.push(mesh);
  }
}

function createEnvironment(scene: Object3D) {
  const th=THEMES[save.selectedTheme];
  (scene as any).background=new Color(th.bg);
  (scene as any).fog=new FogExp2(new Color(th.fog),0.3);
  scene.add(new AmbientLight(new Color('#ffffff'),0.3));
  const dir=new DirectionalLight(new Color('#ffffff'),0.6); dir.position.set(2,4,2); scene.add(dir);
  const a1=new PointLight(new Color(th.accent),1,5); a1.position.set(-1,2,-1); scene.add(a1);
  const a2=new PointLight(new Color(th.accent),0.5,5); a2.position.set(1,2,1); scene.add(a2);
  const gMat=new LineBasicMaterial({color:new Color(th.gridC),transparent:true,opacity:0.3});
  const gv: number[] = [];
  for (let i=-20;i<=20;i+=0.5) { gv.push(i,0,-20,i,0,20,-20,0,i,20,0,i); }
  const gg=new BufferGeometry(); gg.setAttribute('position',new Float32BufferAttribute(gv,3));
  scene.add(new LineSegments(gg,gMat));
  const pGeo=new CylinderGeometry(0.03,0.03,2,8);
  const pMat=new MeshStandardMaterial({color:new Color(th.accent),emissive:new Color(th.accent),emissiveIntensity:0.5,metalness:0.8,roughness:0.2});
  const bSize=BOARD_SIZE*CELL_SIZE/2+0.08;
  for (const [x,z] of [[-bSize,-bSize],[bSize,-bSize],[-bSize,bSize],[bSize,bSize]]) {
    const p=new Mesh(pGeo,pMat); p.position.set(x,BOARD_Y+0.5,z-0.5); scene.add(p);
  }
}

// ============================================================
// GAME SYSTEM
// ============================================================
export class GameSystem extends createSystem({ panelDocs: { required: [PanelDocument] } }) {
  private wired = new Set<string>();

  init() {
    this.queries.panelDocs.subscribe('qualify', (entity) => {
      const doc = entity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
      if (!doc) return;
      const cfg = entity.getValue(PanelUI, 'config') as string | undefined;
      if (!cfg) return;
      const n = cfg.replace('./ui/', '').replace('.json', '');
      if (this.wired.has(n)) return;
      this.wired.add(n);
      panels.setDoc(n, doc);
      switch (n) {
        case 'title': panels.wireTitle(); break;
        case 'mode': panels.wireMode(); break;
        case 'difficulty': panels.wireDiff(); break;
        case 'pause': panels.wirePause(); break;
        case 'gameover': panels.wireGameover(); break;
        case 'settings': panels.wireSettings(); panels.updSett(); break;
        case 'achvlist': panels.wireAch(); break;
        case 'stats': panels.wireStats(); break;
        case 'skins': panels.wireSkins(); break;
        case 'leaderboard': panels.wireLB(); break;
        case 'help': panels.wireHelp(); break;
      }
      panels.vis();
    });

    createEnvironment(this.scene);
    createBoardVisuals(this.scene);
    syncBoardVisuals();
  }

  update(dt: number) {
    if (screen==='playing'&&(mode==='timed'||mode==='blitz')) {
      timerAcc+=dt; if (timerAcc>=1) { timerAcc-=1; timerSec--; if (timerSec<=0) { endGame('black'); return; } }
    }
    if (screen==='playing') panels.updHUD();
    if (toastTimer>0) { toastTimer-=dt; if (toastTimer<=0) {
      const info=panels.entities.get('toast'); if (info?.entity?.object3D) info.entity.object3D.visible=false;
    }}
    const pulse=Math.sin(Date.now()*0.005)*0.3+0.5;
    for (const h of highlightMeshes) (h.material as MeshBasicMaterial).opacity=pulse;
    if (selectedHighlight) (selectedHighlight.material as MeshBasicMaterial).opacity=pulse;
    const inp=(this.world as any).input as RuntimeInput|undefined;
    if (inp?.keyboard) {
      if (inp.keyboard.getKeyDown('Escape')) {
        if (screen==='playing') { screen='paused'; panels.vis(); }
        else if (screen==='paused') { screen='playing'; panels.vis(); }
      }
      if (inp.keyboard.getKeyDown('KeyR')&&screen==='gameover') { startGame(); panels.vis(); }
      if (inp.keyboard.getKeyDown('KeyM')&&screen==='gameover') { screen='title'; panels.vis(); }
    }
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const container = document.getElementById('app') as HTMLDivElement;
  const world = await World.create(container, {
    xr: { offer: 'once' },
    render: { fov: 70, near: 0.01, far: 200, defaultLighting: false, camera: { position: [0, 1.6, 0], lookAt: [0, BOARD_Y, -0.5] } },
    input: { canvasPointerEvents: true },
    features: { grabbing: false, locomotion: { browserControls: true }, physics: false, spatialUI: true },
  } as any);

  const raycaster = new Raycaster();
  const mouse = new Vector2();
  container.addEventListener('pointerdown', (e: PointerEvent) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });
  container.addEventListener('pointerup', () => {
    raycaster.setFromCamera(mouse, world.camera);
    if (!boardGroup) return;
    const objs = boardGroup.children.filter((c: any) => c.userData?.boardCell || c.userData?.isPiece || c.userData?.isHighlight);
    const hits = raycaster.intersectObjects(objs, false);
    if (hits.length > 0) {
      const hit = hits[0].object;
      if (hit.userData.isHighlight) {
        const move = validMoves[hit.userData.moveIdx];
        if (move) applyPlayerMove(move);
      } else {
        const r = hit.userData.row, c = hit.userData.col;
        if (r !== undefined && c !== undefined) handleCellClick(r, c);
      }
    }
  });

  const cfgs: { config: string; pos: number[]; scale: number; fol: boolean; scr: Screen[] }[] = [
    { config:'./ui/title.json', pos:[0,1.6,-2.5], scale:2.5, fol:false, scr:['title'] },
    { config:'./ui/mode.json', pos:[0,1.6,-2.5], scale:2.5, fol:false, scr:['modeselect'] },
    { config:'./ui/difficulty.json', pos:[0,1.6,-2.5], scale:2.5, fol:false, scr:['difficulty'] },
    { config:'./ui/hud.json', pos:[0,2.0,-2.0], scale:1.8, fol:true, scr:['playing'] },
    { config:'./ui/pause.json', pos:[0,1.6,-2.0], scale:2.5, fol:false, scr:['paused'] },
    { config:'./ui/gameover.json', pos:[0,1.6,-2.5], scale:2.5, fol:false, scr:['gameover'] },
    { config:'./ui/settings.json', pos:[0,1.6,-2.5], scale:2.0, fol:false, scr:['settings'] },
    { config:'./ui/achvlist.json', pos:[0,1.6,-2.5], scale:2.0, fol:false, scr:['achievements'] },
    { config:'./ui/stats.json', pos:[0,1.6,-2.5], scale:2.0, fol:false, scr:['stats'] },
    { config:'./ui/skins.json', pos:[0,1.6,-2.5], scale:2.0, fol:false, scr:['skins'] },
    { config:'./ui/leaderboard.json', pos:[0,1.6,-2.5], scale:2.0, fol:false, scr:['leaderboard'] },
    { config:'./ui/help.json', pos:[0,1.6,-2.5], scale:2.0, fol:false, scr:['help'] },
    { config:'./ui/toast.json', pos:[0,2.3,-2.0], scale:1.5, fol:true, scr:['playing','gameover','title'] },
  ];

  for (const c of cfgs) {
    const entity = world.createTransformEntity();
    entity.addComponent(PanelUI, { config: c.config });
    if (c.fol) {
      entity.addComponent(Follower);
      const off = entity.getVectorView(Follower, 'offsetPosition');
      if (off) { off[0] = c.pos[0]; off[1] = c.pos[1] - 1.6; off[2] = c.pos[2]; }
      entity.addComponent(ScreenSpace);
    }
    if (entity.object3D) {
      entity.object3D.position.set(c.pos[0], c.pos[1], c.pos[2]);
      entity.object3D.scale.setScalar(c.scale);
    }
    const n = c.config.replace('./ui/', '').replace('.json', '');
    panels.entities.set(n, { entity, scr: c.scr });
  }

  world.registerSystem(GameSystem);
  panels.vis();
}

main().catch(console.error);
