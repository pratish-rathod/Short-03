// Books Are Slow — paper-and-clay stop-motion reel, 1080x1920, with synced foley sound design (no voice, no music).
// Drawing units: 180 x 320 (1 unit = 6 px). Table line at y=246.
const { useComposition, CompositionStage, Captions, Easing, useTweaks, TweaksPanel, TweakSection, TweakToggle, TweakSlider } = window;

const FONT = '"Source Serif 4", Georgia, serif';
const C = {
  paper: '#f3f2f2', card: '#f8f4f4', wall: '#eae9e9', ink: '#201e1d', ink2: '#2d2b2b', ink7: '#605d5d',
  mute: '#7d7979', line: '#bab6b6', line2: '#d7d3d3', table: '#e3dfdc', tableD: '#d4cfcb',
  cyan: '#0088b0', cyan7: '#006786', cyan2: '#cbeeff', screen: '#e9f8ff',
  mag: '#d6006c', mag3: '#ffc0d0', yel: '#edbb00', yelD: '#b88f00', sticky: '#f4d766',
  kraft: '#c9a46a', kraftD: '#9f7d48',
};

// Shot list — t0 is the shot's start on the original timing track (seconds). Names must match OM_SCENES.
// The SFX cue sheet in tools/make_sfx.py uses the same times; rerun it after retiming.
const SHOT_T0 = [
  ['01 Hook', 0], ['02 Ten-minute video', 4.22], ['03 Up to speed', 9.38], ['04a Makes sense', 13.21],
  ['04b Cannot teach it', 16.33], ['05 A book', 19.03], ['06a Same idea', 20.76], ['06b Example', 23.28],
  ['06c Work through', 25.65], ['07 Building on', 28.05], ['08 Starting over', 33.57], ['09 Scrolling', 37.31],
  ['10 Take longer', 40.19], ['11 Learn AI', 45.49], ['12 First book', 48.57], ['13 Second book', 54.09],
  ['14 Return to it', 59.45], ['15 Expert advice', 65.34], ['16 Launch event', 68.62],
];
const VO_END = 72.76;
const SHOT_DUR = SHOT_T0.map(([, t], i) => (i + 1 < SHOT_T0.length ? SHOT_T0[i + 1][1] : VO_END) - t);
const SFX_TAIL = 1; // each SFX clip also covers the shot's 1s hold so tails ring out

// ---------- motion ----------
const cl = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, k) => a + (b - a) * k;
const MOTION = {
  enter: (u, a, b) => Easing.easeOutCubic(cl((u - a) / (b - a))),
  draw: (u, a, b) => Easing.easeInOutSine(cl((u - a) / (b - a))),
  pop: (u, a, b) => Easing.easeOutBack(cl((u - a) / (b - a))),
};
const hh = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
const JIT = { F: 0, amp: 1 };
const jit = (id) => {
  const a = JIT.amp; if (!a) return [0, 0, 0];
  return [(hh(JIT.F, id) - .5) * .45 * a, (hh(JIT.F, id + 17) - .5) * .45 * a, (hh(JIT.F, id + 33) - .5) * .7 * a];
};

// ---------- primitives ----------
function P({ id = 0, x = 0, y = 0, r = 0, s = 1, sx, sy, o = 1, f, children }) {
  const [dx, dy, dr] = jit(id);
  return (
    <g transform={`translate(${x + dx} ${y + dy}) rotate(${r + dr}) scale(${sx ?? s} ${sy ?? s})`} opacity={o} filter={f ? 'url(#ps)' : undefined}>
      {children}
    </g>
  );
}
const Tx = ({ x = 0, y = 0, s = 10, w = 400, it, fill = C.ink, a = 'middle', children }) => (
  <text x={x} y={y} fontSize={s} fontWeight={w} fontStyle={it ? 'italic' : 'normal'} fill={fill} textAnchor={a} fontFamily={FONT}>{children}</text>
);
const Cam = ({ s = 1, cx = 90, cy = 160, dx = 0, dy = 0, children }) => (
  <g>{children}</g>
);
const Clay = ({ d, w = 4 }) => (
  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} stroke={C.yelD} strokeWidth={w + 1.1} />
    <path d={d} stroke={C.yel} strokeWidth={w} />
  </g>
);
const Draw = ({ d, k, stroke = C.ink, w = 1, dash }) => k <= 0 ? null : (
  <path d={d} pathLength={1} strokeDasharray={dash ? undefined : '1 1'} strokeDashoffset={1 - k} stroke={stroke} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
);

// backgrounds overdraw the frame so they still reach the edges after the SAFE scale
const BX = -20, BW = 220, BY = -30, BH = 380;
function Room({ warm = 0 }) {
  return (
    <g>
      <rect x={BX} y={BY} width={BW} height={247 - BY} fill={C.paper} />
      <rect x={BX} y={BY} width={BW} height={247 - BY} fill="url(#wallG)" />
      <rect x={BX} y={246} width={BW} height={BY + BH - 246} fill="url(#tableG)" />
      <line x1={BX} y1={246} x2={BX + BW} y2={246} stroke={C.tableD} strokeWidth={.6} />
      {warm > 0 && <rect x={BX} y={BY} width={BW} height={BH} fill={C.yel} opacity={.07 * warm} />}
    </g>
  );
}
const Top = () => (<g><rect x={BX} y={BY} width={BW} height={BH} fill={C.table} /><rect x={BX} y={BY} width={BW} height={BH} fill="url(#vig)" /></g>);

function TextBars({ x, y, w, n, gap = 7, seed = 1 }) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const ww = w * (i % 5 === 4 ? .55 : .8 + hh(seed, i) * .2);
    out.push(<rect key={i} x={x} y={y + i * gap} width={ww} height={1} rx={.4} fill={C.line} />);
  }
  return <g>{out}</g>;
}
function BookSide({ w, h, cover = C.ink, pages = C.card, lift = 0 }) {
  const ls = [];
  for (let i = 1; i < 4; i++) { const yy = -h + 2.5 + i * (h - 5) / 4; ls.push(<line key={i} x1={4} y1={yy} x2={w - 1.5} y2={yy} stroke={C.line2} strokeWidth={.4} />); }
  return (
    <g>
      <rect x={0} y={-2.6} width={w} height={2.6} rx={1} fill={cover} />
      <rect x={2} y={-h + 2.4} width={w - 2.5} height={h - 4.8} fill={pages} />
      {ls}
      <rect x={0} y={-h} width={3.4} height={h} rx={1.5} fill={cover} />
      <g transform={`rotate(${-lift} 1.6 ${-h + 1.3})`}><rect x={0} y={-h} width={w} height={2.6} rx={1} fill={cover} /></g>
    </g>
  );
}
function Spread({ x, y, w, h, bars = true, skipL = 0, skipR = 0 }) {
  const m = x + w / 2, n = Math.floor((h - 22) / 7);
  return (
    <g>
      <rect x={x - 4} y={y - 3} width={w + 8} height={h + 7} rx={2.5} fill={C.ink} />
      <path d={`M${m} ${y + 3} Q${x + w / 4} ${y - 3} ${x} ${y + 1} L${x} ${y + h} Q${x + w / 4} ${y + h - 5} ${m} ${y + h + 2} Z`} fill={C.card} />
      <path d={`M${m} ${y + 3} Q${x + 3 * w / 4} ${y - 3} ${x + w} ${y + 1} L${x + w} ${y + h} Q${x + 3 * w / 4} ${y + h - 5} ${m} ${y + h + 2} Z`} fill={C.card} />
      <line x1={m} y1={y + 3} x2={m} y2={y + h + 2} stroke={C.line} strokeWidth={.6} />
      {bars && <TextBars x={x + 9} y={y + 14 + skipL * 7} w={w / 2 - 18} n={n - skipL} seed={2} />}
      {bars && <TextBars x={m + 9} y={y + 14 + skipR * 7} w={w / 2 - 18} n={n - skipR} seed={5} />}
    </g>
  );
}
function LowBook({ dy = 0 }) {
  const p = (d) => d.replace(/(-?\d+(\.\d+)?) (-?\d+(\.\d+)?)/g, (_, a, __, b) => `${a} ${+b + dy}`);
  return (
    <g>
      <path d={p('M24 198 L90 188 L156 198 L162 244 L90 236 L18 244 Z')} fill={C.ink} />
      <path d={p('M28 200 L90 192 L90 234 L22 240 Z')} fill={C.card} />
      <path d={p('M152 200 L90 192 L90 234 L158 240 Z')} fill={C.card} />
      <path d={p('M34 206 L84 199 M33 213 L84 206 M32 220 L84 213 M96 199 L146 206 M96 206 L147 213 M96 213 L148 220')} stroke={C.line2} strokeWidth={.8} />
    </g>
  );
}
function Phone({ w, h, children }) {
  return (
    <g>
      <rect x={0} y={0} width={w} height={h} rx={7} fill={C.card} stroke={C.ink} strokeWidth={.9} />
      <rect x={4} y={9} width={w - 8} height={h - 18} rx={2.5} fill={C.screen} />
      <line x1={w / 2 - 5} y1={4.6} x2={w / 2 + 5} y2={4.6} stroke={C.ink} strokeWidth={.9} strokeLinecap="round" />
      {children}
    </g>
  );
}
function Bulb({ lit }) {
  return (
    <g>
      {lit && <path d="M0 -17 V-22 M-13 -9 L-17 -13 M13 -9 L17 -13 M-16 2 H-22 M16 2 H22" stroke={C.yelD} strokeWidth={1.2} strokeLinecap="round" />}
      <circle cx={0} cy={0} r={10} fill={lit ? C.yel : C.card} stroke={lit ? C.yelD : C.ink} strokeWidth={.8} />
      {lit && <ellipse cx={-3.5} cy={-4} rx={3} ry={2} fill="#fff" opacity={.5} />}
      <rect x={-4.5} y={9} width={9} height={6} rx={1} fill={C.line} stroke={C.ink} strokeWidth={.5} />
    </g>
  );
}

// ---------- faces ----------
function Face({ face, look, ery }) {
  const o = look * 2.4, m = look * 2;
  const st = { stroke: C.ink, strokeWidth: .9, strokeLinecap: 'round', fill: 'none' };
  const dots = (ry = ery, rx = 1.15) => <g fill={C.ink}><ellipse cx={-3 + o} cy={-40} rx={rx} ry={ry} /><ellipse cx={3 + o} cy={-40} rx={rx} ry={ry} /></g>;
  const arcs = <g {...st}>{[-3, 3].map(e => <path key={e} d={`M${e + o - 1.5} -39.5 Q${e + o} -41.8 ${e + o + 1.5} -39.5`} />)}</g>;
  const lids = <g {...st}>{[-3, 3].map(e => <path key={e} d={`M${e + o - 1.5} -40.2 H${e + o + 1.5}`} />)}</g>;
  const brows = (lIn, lOut, rIn, rOut) => <g {...st}>
    <path d={`M${-5.2 + o} ${lOut} L${-1.4 + o} ${lIn}`} /><path d={`M${5.2 + o} ${rOut} L${1.4 + o} ${rIn}`} /></g>;
  const blush = <g fill={C.mag3} opacity={.8}><ellipse cx={-5.6 + o * .6} cy={-36.6} rx={1.8} ry={1} /><ellipse cx={5.6 + o * .6} cy={-36.6} rx={1.8} ry={1} /></g>;
  const mouth = (d, fill) => <path d={d} stroke={C.ink} strokeWidth={.9} strokeLinecap="round" strokeLinejoin="round" fill={fill || 'none'} />;
  const sweat = <path d="M8.6 -46 q1.6 2.6 0 3.6 q-1.6 -1 0 -3.6 Z" fill={C.cyan2} stroke={C.cyan7} strokeWidth={.4} />;
  switch (face) {
    case 'smile': return <g>{dots()}{mouth(`M${-2.4 + m} -35.6 Q${m} -33.6 ${2.4 + m} -35.6`)}</g>;
    case 'grin': return <g>{arcs}{blush}{mouth(`M${-3 + m} -36 Q${m} -31.8 ${3 + m} -36 Z`, C.ink)}</g>;
    case 'proud': return <g>{arcs}{blush}{brows(-44.6, -44.2, -44.6, -44.2)}{mouth(`M${-2.8 + m} -35.8 Q${m} -33 ${2.8 + m} -35.8`)}</g>;
    case 'content': return <g>{arcs}{blush}{mouth(`M${-1.8 + m} -35.4 Q${m} -34 ${1.8 + m} -35.4`)}</g>;
    case 'curious': return <g>{dots()}{brows(-44, -44, -45.6, -45)}<ellipse cx={1 + m} cy={-35} rx={.9} ry={1.1} fill={C.ink} /></g>;
    case 'surprised': return <g>{dots(1.5, 1.35)}{brows(-45.8, -45.2, -45.8, -45.2)}<ellipse cx={m} cy={-34.6} rx={1.5} ry={1.9} fill={C.ink} /></g>;
    case 'focused': return <g>{dots(Math.min(ery, .95))}{brows(-43.6, -44, -43.6, -44)}{mouth(`M${-1.4 + m} -35.2 H${1.4 + m}`)}</g>;
    case 'confused': return <g>{dots()}{brows(-44.2, -43.4, -45.4, -46)}{mouth(`M${-2.4 + m} -35 q1.2 -1 2.4 0 t2.4 0`)}{sweat}</g>;
    case 'sad': return <g>{dots(Math.min(ery, 1))}{brows(-45.2, -43.6, -45.2, -43.6)}{mouth(`M${-2.4 + m} -34.4 Q${m} -36.4 ${2.4 + m} -34.4`)}</g>;
    case 'glazed': return <g>{lids}{dots(.45)}<ellipse cx={m} cy={-35} rx={1} ry={.7} fill={C.ink} /></g>;
    case 'mad': return <g>{dots()}{brows(-42.4, -44.2, -42.4, -44.2)}{mouth(`M${-2.4 + m} -34.6 Q${m} -36.4 ${2.4 + m} -34.6`)}</g>;
    case 'furious': return <g>{dots()}{brows(-42, -44.4, -42, -44.4)}{mouth(`M${-2.6 + m} -34.4 Q${m} -37 ${2.6 + m} -34.4`)}
      <path d="M-12 -50 l-3 -3 M-9 -53 l-1 -4 M12 -50 l3 -3 M9 -53 l1 -4" stroke={C.mag} strokeWidth={.9} strokeLinecap="round" fill="none" /></g>;
    default: return dots();
  }
}

// ---------- the Reader (clay figure) ----------
const POSES = {
  down: [[-11, -19, -13, -11], [11, -19, 13, -11]],
  up: [[-13, -34, -15, -43], [13, -34, 15, -43]],
  think: [[-11, -19, -13, -11], [13, -27, 4, -32]],
  point: [[-11, -19, -13, -11], [16, -28, 24, -31]],
  pointL: [[-16, -28, -24, -31], [11, -19, 13, -11]],
  pat: [[-17, -25, -24, -25], [11, -19, 13, -11]],
  thumb: [[-11, -19, -13, -11], [15, -28, 15, -36]],
  wave: [[-11, -19, -13, -11], [15, -35, 16, -45]],
  waveB: [[-11, -19, -13, -11], [18, -33, 25, -40]],
  shrug: [[-17, -24, -19, -32], [17, -24, 19, -32]],
  read: [[-5, -20, 2, -20], [7, -19, 12, -20]],
  chalk: [[-11, -19, -13, -11], [16, -33, 23, -41]],
  surf: [[-15, -28, -22, -30], [15, -28, 22, -25]],
  head: [[-14, -36, -8, -46], [14, -36, 8, -46]],
  fists: [[-15, -21, -14, -14], [15, -21, 14, -14]],
};
function Reader({ id = 900, x, y, s = 1, pose = 'down', pose2, k = 0, look = 0, sit = false, eyes = 1, sq = 0, book = false, mad = 0, face }) {
  const A = POSES[pose], B = POSES[pose2 || pose];
  const arm = (i) => A[i].map((v, j) => lerp(v, B[i][j], k));
  const l = arm(0), r = arm(1), lift = sit ? 7 : 0;
  const legs = sit ? ['M-3 -9 L9 -9 L10 -2', 'M3 -9 L14 -9 L15 -2'] : ['M-4.5 -9 L-5 -1', 'M4.5 -9 L5 -1'];
  const ery = Math.max(.25, 1.15 * eyes);
  return (
    <P id={id} x={x} y={y} s={s}>
      <ellipse cx={sit ? 4 : 0} cy={0} rx={11} ry={1.8} fill={C.ink} opacity={.14} />
      <g transform={`translate(0 ${lift}) scale(${1 + sq * .08} ${1 - sq * .1})`}>
        {legs.map((d, i) => <Clay key={i} d={d} w={4.4} />)}
        <rect x={-9} y={-31} width={18} height={24} rx={8.5} fill={C.yel} stroke={C.yelD} strokeWidth={.9} />
        <Clay d={`M-8 -26 L${l[0]} ${l[1]} L${l[2]} ${l[3]}`} w={3.8} />
        <Clay d={`M8 -26 L${r[0]} ${r[1]} L${r[2]} ${r[3]}`} w={3.8} />
        {book && <g><rect x={0} y={-28} width={14} height={9} fill={C.card} stroke={C.ink} strokeWidth={.5} /><line x1={7} y1={-28} x2={7} y2={-19} stroke={C.ink} strokeWidth={.5} /></g>}
        <circle cx={0} cy={-39.5} r={8.6} fill={C.yel} stroke={C.yelD} strokeWidth={.9} />
        <ellipse cx={-3.2} cy={-43.2} rx={2.6} ry={1.5} fill="#fff" opacity={.35} />
        <Face face={face || (mad > 1 ? 'furious' : mad > 0 ? 'mad' : 'neutral')} look={look} ery={ery} />
      </g>
    </P>
  );
}

// ---------- shots (u = track-time, stepped) ----------
function S01({ u }) {
  const k = MOTION.draw(u, 0.19, 3.65);
  const ts = u - 0.85;
  const sw = u < 0.85 ? 0.8 * Math.sin(u * 3) : 5 * Math.sin(ts * 4.6) * Math.exp(-ts * 1.1);
  return (
    <Cam s={lerp(1, 1.05, MOTION.draw(u, 0, 4.22))} cy={190}>
      <Room />
      <P id={1} x={90} y={-2} r={sw}>
        <line x1={0} y1={-40} x2={0} y2={62} stroke={C.mag} strokeWidth={.9} />
        <P id={2} y={60} f>
          <rect x={-66} y={0} width={132} height={40} rx={2} fill={C.card} />
          <circle cx={0} cy={5} r={1.5} fill={C.table} stroke={C.line} strokeWidth={.4} />
          <Tx y={28} s={15} w={600}>Books are slow.</Tx>
        </P>
      </P>
      <P id={3} x={54} y={246} f><BookSide w={112} h={28} lift={62 * k} /></P>
      <Reader x={30} y={246} look={u < 2.25 ? 1 : 0} pose={u < 3.65 ? 'down' : 'point'} face={u < 1.56 ? 'curious' : 'smile'} />
    </Cam>
  );
}
function S02({ u }) {
  const ph = MOTION.enter(u, 6.52, 6.95), bub = MOTION.pop(u, 7.41, 7.75);
  const look = u < 5.17 ? .6 : u < 6.52 ? 0 : u < 7.41 ? -1 : u < 8.72 ? 1 : -1;
  const dot = u < 8.42 ? -1 : Math.floor((u - 8.42) * 6) % 3;
  return (
    <Cam s={lerp(1, 1.03, MOTION.draw(u, 4.22, 9.38))}>
      <Room />
      {ph > 0 && <P id={10} x={lerp(-80, 16, ph)} y={128} r={-3} f>
        <Phone w={62} h={118}>
          <path d="M25 44 L41 54 L25 64 Z" fill={C.cyan} />
          <rect x={9} y={92} width={44} height={2.4} rx={1.2} fill={C.cyan2} />
          <rect x={9} y={92} width={9} height={2.4} rx={1.2} fill={C.cyan} />
          <Tx x={31} y={86} s={9} w={600}>10:00</Tx>
        </Phone>
      </P>}
      {bub > 0 && <P id={11} x={118} y={193} s={bub} f>
        <path d="M-34 -56 H34 a6 6 0 0 1 6 6 V-20 a6 6 0 0 1 -6 6 H6 L0 0 L-6 -14 H-34 a6 6 0 0 1 -6 -6 V-50 a6 6 0 0 1 6 -6 Z" fill={C.card} />
        <Tx x={0} y={-35} s={11} it>Explain it.</Tx>
        {[-10, 0, 10].map((cx, i) => <circle key={i} cx={cx} cy={-24} r={1.8} fill={i === dot ? C.ink : C.line} />)}
      </P>}
      <Reader x={118} y={246} look={look} pose="think" face={u < 6.52 ? 'smile' : u < 7.41 ? 'curious' : 'focused'} />
    </Cam>
  );
}
function S03({ u, F }) {
  const bubOut = 1 - MOTION.enter(u, 9.38, 9.55);
  const chip = MOTION.pop(u, 10.39, 10.65);
  const fill = u < 10.6 ? 0 : MOTION.draw(u, 10.6, 12.9);
  const playing = u >= 10.6 && u < 12.9;
  const secs = Math.round(600 * (1 - fill));
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const step = MOTION.enter(u, 10.45, 10.85);
  const done = u >= 12.9;
  return (
    <g>
      <Room />
      <P id={20} x={16} y={128} r={-3} f>
        <Phone w={62} h={118}>
          {playing ? <g fill={C.cyan}><path d="M20 44 L31 54 L20 64 Z" /><path d="M31 44 L42 54 L31 64 Z" /></g>
            : done ? <path d="M22 54 L28 60 L41 46" stroke={C.cyan} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            : <path d="M25 44 L41 54 L25 64 Z" fill={C.cyan} />}
          {playing && [0, 1, 2].map(i => <line key={i} x1={10 + ((F * 5 + i * 15) % 42)} y1={30 + i * 26} x2={16 + ((F * 5 + i * 15) % 42)} y2={30 + i * 26} stroke={C.cyan2} strokeWidth={1.2} strokeLinecap="round" />)}
          <rect x={9} y={92} width={44} height={2.4} rx={1.2} fill={C.cyan2} />
          <rect x={9} y={92} width={9 + 35 * fill} height={2.4} rx={1.2} fill={C.cyan} />
          <Tx x={31} y={86} s={9} w={600}>{clock}</Tx>
          {chip > 0 && <g transform={`translate(46 20) scale(${chip})`}>
            <rect x={-10} y={-6} width={20} height={12} rx={6} fill={C.cyan} />
            <Tx y={3.4} s={8} w={600} fill={C.card}>2×</Tx>
          </g>}
        </Phone>
      </P>
      {bubOut > 0 && <P id={21} x={118} y={193} s={bubOut} f>
        <path d="M-34 -56 H34 a6 6 0 0 1 6 6 V-20 a6 6 0 0 1 -6 6 H6 L0 0 L-6 -14 H-34 a6 6 0 0 1 -6 -6 V-50 a6 6 0 0 1 6 -6 Z" fill={C.card} />
        <Tx x={0} y={-35} s={11} it>Explain it.</Tx>
      </P>}
      <Reader x={lerp(118, 100, step)} y={246 - (step > 0 && step < 1 && F % 2 ? 1.2 : 0)} look={-1}
        pose={u < 9.5 ? 'think' : u < 10.39 ? 'thumb' : done ? 'thumb' : 'down'} eyes={playing ? 1.25 : 1} face={u < 9.5 ? 'focused' : u < 10.39 ? 'smile' : done ? 'grin' : 'surprised'} />
    </g>
  );
}
function S04a({ u }) {
  const tick = MOTION.draw(u, 14.13, 14.4), on = u >= 15.47, lab = MOTION.pop(u, 15.47, 15.72);
  return (
    <Cam s={lerp(1, 1.04, MOTION.draw(u, 13.21, 16.33))} cy={200}>
      <Room />
      <P id={30} x={22} y={182} r={-6} f>
        <Phone w={38} h={64}><Draw d="M10 32 L17 39 L29 23" k={tick} stroke={C.cyan} w={2.6} /></Phone>
      </P>
      {lab > 0 && <P id={31} x={96} y={108} r={-3} s={lab} f>
        <rect x={-46} y={-16} width={92} height={26} rx={2} fill={C.card} />
        <Tx y={2} s={15} it>makes sense</Tx>
      </P>}
      <P id={32} x={100} y={176}><Bulb lit={on} /></P>
      <Reader x={100} y={246} look={u < 15.2 ? -1 : 0} pose={on ? 'thumb' : 'down'} face={on ? 'grin' : u < 14.13 ? 'focused' : 'smile'} />
    </Cam>
  );
}
function S04b({ u }) {
  const bub = MOTION.pop(u, 16.6, 16.9);
  const scrib = MOTION.draw(u, 17.44, 18.3);
  const q = MOTION.pop(u, 17.95, 18.2);
  const lit = u < 18.36 || (u >= 18.45 && u < 18.55);
  const done = u >= 18.55;
  return (
    <g>
      <Room />
      {bub > 0 && <P id={40} x={58} y={188} s={bub} f>
        <path d="M0 -92 H96 a6 6 0 0 1 6 6 V-44 a6 6 0 0 1 -6 6 H18 L2 0 L8 -38 H0 a6 6 0 0 1 -6 -6 V-86 a6 6 0 0 1 6 -6 Z" fill={C.card} />
        <Tx x={8} y={-74} s={11} it a="start">So, it works like…</Tx>
        <Draw d="M10 -56 c5 -9 9 9 14 0 s7 -11 11 2 s-9 7 -3 -6 s11 4 13 -2 s6 -9 9 4 s-7 6 -2 -7 s9 2 11 5 s4 -8 9 -3 s-5 7 0 2 s6 -4 9 1" k={scrib} stroke={C.ink2} w={1.1} />
      </P>}
      <P id={41} x={142} y={246} f>
        <rect x={-8} y={-3} width={16} height={3} rx={1} fill={C.kraftD} />
        <rect x={-7} y={-26} width={14} height={23} rx={6} fill={C.card} />
        <circle cx={0} cy={-33} r={7} fill={C.card} />
        <circle cx={-2.4 - (done ? 0 : 1)} cy={-33} r={.9} fill={C.ink} />
        <circle cx={2.4 - (done ? 0 : 1)} cy={-33} r={.9} fill={C.ink} />
      </P>
      {q > 0 && <P id={42} x={142} y={196} s={q}><Tx y={0} s={20} w={600} fill={C.mag}>?</Tx></P>}
      <P id={43} x={50} y={180}><Bulb lit={lit} /></P>
      <Reader x={50} y={246} look={1} pose={u < 16.45 ? 'thumb' : done ? 'shrug' : 'point'} eyes={done ? .5 : 1} face={u < 16.45 ? 'grin' : u < 17.44 ? 'smile' : done ? 'sad' : 'confused'} />
    </g>
  );
}
function S05({ u }) {
  const inK = MOTION.enter(u, 19.85, 20.2);
  const bx = u < 19.85 ? lerp(200, 170, MOTION.enter(u, 19.15, 19.45)) : lerp(170, 62, inK) + (u >= 20.28 ? 1 : 0);
  const on = u >= 20.4, g = cl((u - 20.2) / .4), puff = u >= 20.2 && g < 1 ? Math.sin(Math.PI * g) : 0;
  return (
    <g>
      <Room warm={on ? 1 : 0} />
      <P id={50} x={144} y={246}>
        {on && <path d="M-6 -118 L-58 0 L40 0 L10 -116 Z" fill={C.yel} opacity={.22} />}
        <rect x={-11} y={-3} width={22} height={3} rx={1} fill={C.ink} />
        <path d="M0 -3 L-4 -110" stroke={C.ink} strokeWidth={1.4} />
        <path d="M-16 -104 L-2 -126 L10 -116 L-4 -96 Z" fill={C.ink} />
        {on && <ellipse cx={-9} cy={-100} rx={4} ry={2} fill={C.yel} />}
      </P>
      <P id={51} x={bx} y={246} f><BookSide w={100} h={32} /></P>
      {puff > 0 && [[60, 243, 4], [53, 238, 3], [58, 232, 2.4], [163, 242, 3.2], [168, 236, 2.2]].map(([x, y, r], i) => (
        <circle key={i} cx={x - g * (i < 3 ? 6 : -6)} cy={y - g * 4} r={r * (0.6 + puff)} fill={C.card} stroke={C.line} strokeWidth={.4} opacity={1 - g * .5} />
      ))}
      <Reader x={30} y={246} look={u < 19.15 ? 0 : 1} pose={u < 20.25 ? 'down' : 'up'} sq={u >= 19.3 && u < 19.8 ? 1 : 0} face={u < 19.85 ? 'sad' : u < 20.4 ? 'surprised' : 'grin'} />
    </g>
  );
}
function S06a({ u }) {
  const th = lerp(160, 25, MOTION.draw(u, 21.03, 22.77)) * Math.PI / 180;
  const fx = 118, fy = 190, L = 58, W = 9;
  const ex = fx + L * Math.cos(th), ey = fy + L * Math.sin(th) * .6;
  const nx = -Math.sin(th) * W, ny = Math.cos(th) * W * .6;
  return (
    <Cam s={lerp(1, 1.03, MOTION.draw(u, 20.76, 23.28))}>
      <Top />
      <rect x={0} y={0} width={180} height={320} fill="url(#lampG)" opacity={.9} transform={`translate(${-(th - 1.6) * 30} 0)`} />
      <P id={60} x={0} y={0} f><Spread x={22} y={80} w={136} h={152} skipL={3} /></P>
      <Tx x={55} y={104} s={11} it>one idea</Tx>
      <path d={`M${fx - 4} ${fy} L${ex + nx} ${ey + ny} L${ex - nx} ${ey - ny} L${fx + 4} ${fy} Z`} fill={C.ink} opacity={.16} />
      <Reader x={fx} y={fy} s={.62} pose="think" look={.3} face={u < 22 ? 'focused' : 'content'} />
    </Cam>
  );
}
function S06b({ u }) {
  const k = u < 24.2 ? MOTION.draw(u, 23.4, 23.76) : 1 - MOTION.draw(u, 24.67, 25.01);
  const sx = Math.cos(Math.PI * k), lift = 3 * Math.sin(Math.PI * k);
  const x = 14, y = 96, w = 152, h = 130, m = 90;
  const page = `M${m} ${y + 3} Q${x + 3 * w / 4} ${y - 3} ${x + w} ${y + 1} L${x + w} ${y + h} Q${x + 3 * w / 4} ${y + h - 5} ${m} ${y + h + 2} Z`;
  return (
    <Cam s={lerp(1, 1.03, MOTION.draw(u, 23.28, 25.65))}>
      <Top />
      <P id={70} x={0} y={0} f>
        <Spread x={x} y={y} w={w} h={h} skipR={2} />
        <Tx x={128} y={116} s={10} it>example</Tx>
        <g transform={`translate(${m} ${-lift}) scale(${sx} 1) translate(${-m} 0)`}>
          <path d={page} fill={Math.abs(sx) < .35 ? C.line2 : C.card} stroke={C.line} strokeWidth={.3} />
          {sx > 0 ? <g><TextBars x={m + 9} y={y + 28} w={w / 2 - 18} n={13} seed={8} /><Tx x={128} y={116} s={10} it>explanation</Tx></g>
            : <TextBars x={m + 9} y={y + 14} w={w / 2 - 18} n={15} seed={9} />}
        </g>
      </P>
    </Cam>
  );
}
const PAGE_TEXT = [
  'A model answers what it is asked.', 'Reliability comes from what surrounds',
  'it: the context you give it, what it', 'can retrieve, and how you check the',
  'result. Retrieval narrows the question', 'before the model ever sees it, which',
  'is why the index often matters more', 'than the prompt itself. Evaluation',
  'is what closes the loop.',
];
function S06c({ u }) {
  const ly = -80 + 4 * 13;
  const ul = MOTION.draw(u, 25.85, 27.3), strike = MOTION.draw(u, 27.47, 27.6);
  let tx, ty;
  if (u < 25.85) { const e = MOTION.enter(u, 25.65, 25.85); tx = lerp(120, -64, e); ty = lerp(80, ly + 1.5, e); }
  else if (u < 27.35) { tx = -64 + 124 * ul; ty = ly + 1.5; }
  else if (u < 27.75) { const e = MOTION.enter(u, 27.35, 27.47); tx = lerp(60, -80, e) + 8 * strike; ty = lerp(ly + 1.5, ly - 3, e) - 4 * strike; }
  else { const e = MOTION.enter(u, 27.75, 28.05); tx = lerp(-72, 120, e); ty = lerp(ly - 7, 110, e); }
  return (
    <Cam s={lerp(1, 1.05, MOTION.draw(u, 25.65, 28.05))} cy={150}>
      <Top />
      <P id={80} x={90} y={150} r={-2} f>
        <rect x={-86} y={-106} width={172} height={200} fill={C.card} />
        {PAGE_TEXT.map((t, i) => <Tx key={i} x={-64} y={-80 + i * 13} s={7} a="start" fill={C.ink2}>{t}</Tx>)}
        {ul > 0 && <line x1={-64} y1={ly + 2} x2={-64 + 124 * ul} y2={ly + 2} stroke={C.ink2} strokeWidth={1.1} strokeLinecap="round" />}
        <Tx x={-76} y={ly} s={11} fill={C.ink2}>?</Tx>
        {strike > 0 && <line x1={-81} y1={ly + 1} x2={-81 + 10 * strike} y2={ly - 9 * strike} stroke={C.ink2} strokeWidth={1} />}
        {u >= 27.7 && <Tx x={-76} y={ly + 17} s={13} w={600} fill={C.ink2}>!</Tx>}
        <g transform={`translate(${tx} ${ty}) rotate(-35)`}>
          <path d="M0 0 L7 -2.3 L7 2.3 Z" fill="#e8d3ad" />
          <path d="M0 0 L2.4 -.8 L2.4 .8 Z" fill={C.ink} />
          <rect x={7} y={-2.3} width={64} height={4.6} fill={C.yel} stroke={C.yelD} strokeWidth={.4} />
          <rect x={71} y={-2.4} width={6} height={4.8} fill={C.line} />
          <rect x={77} y={-2.3} width={6} height={4.6} rx={1.2} fill={C.mag3} />
        </g>
      </P>
    </Cam>
  );
}
const LAYERS = ['prompting', 'retrieval', 'workflows', 'evaluation', 'harnesses'];
function S07({ u }) {
  const W = 38, H = 22, X0 = 14;
  const lands = [0, 28.64, 29.6, 30.58];
  const cx = (i) => X0 + i * W + W / 2, top = (i) => 246 - H * (i + 1);
  let cur = 0, h = 1;
  for (let i = 1; i < 4; i++) if (u >= lands[i] + .12) { cur = i; h = MOTION.enter(u, lands[i] + .12, lands[i] + .42); }
  const prev = Math.max(0, cur - 1);
  const rx = cur === 0 ? cx(0) : lerp(cx(prev), cx(cur), h);
  const ry = cur === 0 ? top(0) : lerp(top(prev), top(cur), h) - 14 * Math.sin(Math.PI * h);
  const landed = cur > 0 && h >= 1 && u < lands[cur] + .55;
  const pts = [0, 1, 2, 3].map(i => [X0 + i * W + 7, top(i) - 1]);
  const tk = MOTION.draw(u, 31.35, 32.6);
  const lit = (i) => tk >= i / 3 - .001 && u >= 31.35;
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
  return (
    <g>
      <Room />
      {[0, 1, 2, 3].map(i => {
        const p = i === 0 ? 1 : cl((u - (lands[i] - .33)) / .33);
        if (p <= 0) return null;
        const dy = -200 * (1 - p * p), sq = i > 0 && u >= lands[i] && u < lands[i] + .09;
        return (
          <P key={i} id={90 + i} x={X0 + i * W} y={dy} sy={sq ? .94 : 1} f>
            {Array.from({ length: i + 1 }, (_, j) => (
              <g key={j} transform={`translate(0 ${246 - H * j})`}><BookSide w={W - 1} h={H} cover={j === i ? C.ink : C.ink7} /></g>
            ))}
            <Tx x={W / 2} y={246 - H * i - 5} s={7.5} w={600}>{'Ch ' + (i + 1)}</Tx>
          </P>
        );
      })}
      <Draw d={d} k={tk} stroke={C.mag} w={1.3} />
      {pts.map(([x, y], i) => lit(i) && (
        <P key={i} id={95 + i} x={x} y={y}><circle r={3.2} fill={C.sticky} stroke={C.yelD} strokeWidth={.6} /></P>
      ))}
      {u >= 31.35 && <P id={99} x={90} y={96} f>
        <rect x={-58} y={-14} width={116} height={24} rx={2} fill={C.card} />
        <Tx y={2} s={11} it>each idea builds on the last</Tx>
      </P>}
      <Reader x={rx} y={ry} s={.72} look={u >= 31.35 ? -1 : 1}
        pose={u >= 33.13 ? 'up' : u >= 31.35 ? 'pointL' : 'down'} sq={landed ? 1 : 0}
        face={u < 31.35 ? 'focused' : u < 33.13 ? 'smile' : 'grin'} />
    </g>
  );
}
const TOWERS = [
  [[-14, -7, 28, 7], [-12, -14, 26, 7], [-15, -21, 28, 7], [-11, -28, 24, 7]],
  [[-21, -8, 12, 8], [-6, -8, 12, 8], [9, -8, 12, 8], [-14, -16, 12, 8], [1, -16, 12, 8], [-6, -24, 12, 8]],
  [[-17, -20, 5, 20], [-2.5, -20, 5, 20], [12, -20, 5, 20], [-19, -24, 38, 4], [-9, -44, 5, 20], [4, -44, 5, 20], [-11, -48, 22, 4]],
];
function S08({ u, F }) {
  const topple = [33.98, 35.05, 36.91], appear = [33.57, 34.55, 35.6];
  let ti = 0; for (let i = 0; i < 3; i++) if (u >= appear[i]) ti = i;
  const tt = topple[ti], a = appear[ti], arrow = MOTION.draw(u, a, a + .4);
  return (
    <Cam s={lerp(1, 1.04, MOTION.draw(u, 33.57, 37.31))} cy={180}>
      <Room />
      <P id={100} x={46} y={50} f>
        <Phone w={92} h={196}>
          <Draw d="M52 77.6 A12 12 0 1 1 40 77.6" k={arrow} stroke={C.cyan7} w={1.8} />
          {arrow > .95 && <path d="M42.6 76.1 L40.4 82.1 L35.9 75.2 Z" fill={C.cyan7} stroke={C.cyan7} strokeWidth={.6} strokeLinejoin="round" />}
          <Tx x={46} y={120} s={9} it fill={C.cyan7}>start over</Tx>
          <g transform="translate(46 178)">
            {TOWERS[ti].map(([x, y, w, h], i) => {
              const p = MOTION.enter(u, tt + i * .05, tt + i * .05 + .35);
              const ang = p * (55 + i * 9) * (i % 2 ? 1 : -1) + p * 20;
              const dx = p * (6 + i * 4), dy = p * (-y - h);
              return <rect key={ti + '-' + i} x={x} y={y} width={w} height={h} fill={C.card} stroke={C.ink} strokeWidth={.6}
                transform={`translate(${dx} ${dy}) rotate(${ang} ${x + w / 2} ${y + h / 2})`} />;
            })}
          </g>
          <line x1={8} y1={178} x2={84} y2={178} stroke={C.line} strokeWidth={.6} />
        </Phone>
      </P>
      {u >= 35.05 && <P id={101} x={33} y={186} s={.8}>
        <Draw d="M-9 0 c2 -7 7 -7 8 -2 s6 -6 8 0 s5 5 1 6 s-3 5 -7 2 s-6 3 -8 -1 s-4 -4 -2 -5" k={MOTION.draw(u, 35.05, 35.4)} stroke={C.ink} w={1} />
      </P>}
      <Reader x={22} y={246 - (F % 2 && u >= 36.91 ? 1 : 0)} s={.8} look={1}
        pose={u < 33.98 ? 'down' : u < 35.05 ? 'fists' : 'head'}
        sq={[33.98, 35.05, 36.91].some(t => u >= t && u < t + .17) ? 1 : 0}
        mad={u < 33.98 ? 0 : u < 35.05 ? 1 : 2} face={u < 33.98 ? 'focused' : undefined} />
    </Cam>
  );
}
function S09({ u }) {
  const off = u < 37.93 ? 0 : (u - 37.93) * 64;
  const cards = [];
  for (let i = -2; i < 11; i++) {
    const y = i * 38 - (off % 38);
    cards.push(<g key={i + Math.floor(off / 38)}>
      <rect x={67} y={y + 4} width={46} height={30} rx={2} fill={C.screen} stroke={C.line} strokeWidth={.5} />
      <path d={`M86 ${y + 13} L96 ${y + 19} L86 ${y + 25} Z`} fill={C.cyan} />
    </g>);
  }
  return (
    <g>
      <Room />
      <P id={110} x={0} y={0}>
        <rect x={62} y={-30} width={56} height={380} fill={C.card} stroke={C.line} strokeWidth={.5} />
        {cards}
      </P>
      <P id={111} x={0} y={0}><rect x={52} y={70} width={76} height={160} rx={11} fill="none" stroke={C.ink} strokeWidth={3.4} /></P>
      <Reader x={26} y={246} sit look={1} eyes={.4} sq={.3} face={'glazed'} />
    </g>
  );
}
function S10({ u }) {
  const sink = MOTION.enter(u, 40.83, 41.4);
  const seated = sink > .5;
  const rx = lerp(104, 82, sink), ry = lerp(246, 224, sink);
  const sand = cl(.1 * MOTION.draw(u, 41.5, 42.78) + .9 * MOTION.draw(u, 42.78, 45.4));
  const m = .08 + .25 * MOTION.draw(u, 41, 43.61) + .67 * MOTION.draw(u, 43.61, 44.76);
  const top = MOTION.pop(u, 44.76, 45.05);
  return (
    <Cam s={lerp(1, 1.04, MOTION.draw(u, 40.19, 45.49))} cy={200}>
      <Room warm={1} />
      <P id={120} x={18} y={52} f>
        <rect x={0} y={0} width={14} height={96} rx={7} fill={C.card} />
        <rect x={2} y={2 + 92 * (1 - m)} width={10} height={92 * m} rx={5} fill={C.yel} />
        <Tx x={7} y={110} s={8} it>understood</Tx>
        {top > 0 && <path d="M1 -9 L6 -4 L14 -14" stroke={C.cyan} strokeWidth={2} fill="none" strokeLinecap="round" transform={`scale(${top})`} />}
      </P>
      <P id={121} x={144} y={202} f>
        <rect x={-15} y={-54} width={30} height={3} rx={1} fill={C.kraftD} />
        <rect x={-15} y={-3} width={30} height={3} rx={1} fill={C.kraftD} />
        <path d="M-12 -51 H12 L0 -27 L12 -3 H-12 L0 -27 Z" fill={C.card} stroke={C.line} strokeWidth={.5} />
        <path d={`M${-10 * (1 - sand)} ${-27 - 20 * (1 - sand)} H${10 * (1 - sand)} L0 -27 Z`} fill={C.sticky} />
        <path d={`M-10 -3 H10 L0 ${-3 - 16 * sand} Z`} fill={C.sticky} />
        {sand > 0 && sand < 1 && <line x1={0} y1={-27} x2={0} y2={-4} stroke={C.yelD} strokeWidth={.5} />}
      </P>
      <P id={122} x={52} y={224} f>
        <rect x={0} y={-74} width={16} height={74} rx={2} fill={C.ink} />
        <rect x={3} y={-72} width={10} height={2.5} fill={C.card} />
      </P>
      <P id={123} x={52} y={246} f><BookSide w={82} h={12} cover={C.ink2} /></P>
      <P id={124} x={57} y={234} f><BookSide w={74} h={10} cover={C.ink7} /></P>
      <Reader x={rx} y={ry} sit={seated} pose={u < 41.2 ? 'down' : 'read'} book={u >= 41.2} look={seated ? .5 : -1} eyes={u > 44 ? .6 : 1} face={u < 41.2 ? 'smile' : u < 43.61 ? 'focused' : u < 44.76 ? 'content' : 'proud'} />
    </Cam>
  );
}
function S11({ u }) {
  const pop = MOTION.pop(u, 46.69, 48.21);
  const Lz = [[50, [120, 160]], [90, [96, 138, 176]], [130, [116, 156]]];
  const links = [];
  for (let a = 0; a < 2; a++) for (const y1 of Lz[a][1]) for (const y2 of Lz[a + 1][1])
    links.push(<line key={a + '-' + y1 + '-' + y2} x1={Lz[a][0]} y1={y1 - 214} x2={Lz[a + 1][0]} y2={y2 - 214} stroke={C.ink} strokeWidth={.6} />);
  return (
    <Cam s={lerp(1, 1.06, MOTION.draw(u, 45.49, 48.57))} cy={200}>
      <Room />
      <P id={130} x={0} y={0} f><LowBook /></P>
      {pop > 0 && <P id={131} x={0} y={214} sx={1} sy={pop}>
        {links}
        {Lz.map(([x, ys]) => ys.map(y => <g key={x + '-' + y}>
          <line x1={x} y1={y - 214} x2={x} y2={0} stroke={C.mute} strokeWidth={.5} strokeDasharray="1.5 2" />
          <circle cx={x} cy={y - 214} r={6} fill={C.sticky} stroke={C.yelD} strokeWidth={.7} />
        </g>))}
      </P>}
      <Reader x={146} y={228} s={.55} look={-1} pose={u < 48.21 ? 'down' : 'up'} face={u < 46.69 ? 'curious' : u < 47.3 ? 'surprised' : 'grin'} />
    </Cam>
  );
}
function S12({ u, F }) {
  const w = MOTION.enter(u, 48.7, 50.3);
  const walking = w > 0 && w < 1;
  const patting = u >= 53.22 && u < 53.7;
  const st = u < 53.61 ? 0 : 1 + .5 * (1 - MOTION.enter(u, 53.61, 53.78));
  return (
    <Cam s={lerp(1, 1.05, MOTION.draw(u, 48.57, 54.09))} cx={86} cy={170}>
      <Room />
      <P id={140} x={44} y={246} f>
        <rect x={0} y={-150} width={84} height={150} rx={2.5} fill={C.ink} />
        <rect x={6} y={-150} width={1.2} height={150} fill={C.ink7} />
        <Tx x={45} y={-108} s={12.5} w={600} fill={C.card}>Building</Tx>
        <Tx x={45} y={-93} s={12.5} w={600} fill={C.card}>LLMs for</Tx>
        <Tx x={45} y={-78} s={12.5} w={600} fill={C.card}>Production</Tx>
      </P>
      {st > 0 && <P id={141} x={126} y={100} r={12} s={st} f>
        <circle cx={0} cy={0} r={17} fill={C.yel} />
        <Tx y={-1} s={8.5} w={600}>10,000+</Tx>
        <Tx y={8.5} s={7.5}>copies</Tx>
      </P>}
      <Reader x={lerp(205, 148, w)} y={246 - (walking && F % 2 ? 1.2 : 0)} look={-1} pose={patting ? (F % 2 ? 'pat' : 'pointL') : 'down'} face={u < 53.22 ? 'smile' : u < 53.61 ? 'proud' : 'grin'} />
    </Cam>
  );
}
function S13({ u }) {
  const px = lerp(-110, 22, MOTION.enter(u, 54.33, 54.85));
  const t0 = 55.28, dt = (58.94 - 55.28) / 19;
  const n = u < t0 ? 0 : Math.min(19, Math.floor((u - t0) / dt) + 1);
  const day = 1 + n;
  const fly = [];
  for (let j = Math.max(1, n - 2); j <= n; j++) {
    const tau = u - (t0 + (j - 1) * dt);
    if (tau < 0 || tau > .5) continue;
    const dir = j % 2 ? 1 : -1;
    fly.push(<g key={j} transform={`translate(${148 + dir * 40 * tau} ${118 - 70 * tau + 90 * tau * tau}) rotate(${dir * 260 * tau})`} opacity={1 - tau * 2}>
      <rect x={-22} y={-15} width={44} height={40} fill={C.card} stroke={C.line} strokeWidth={.4} />
      <Tx y={16} s={22} w={600}>{j}</Tx>
    </g>);
  }
  const dp = u >= 58.94 ? MOTION.pop(u, 58.94, 59.2) : 1;
  return (
    <Cam s={lerp(1, 1.04, MOTION.draw(u, 54.09, 59.45))} cy={180}>
      <Room />
      <P id={150} x={px} y={246} f>
        <rect x={0} y={-96} width={96} height={96} rx={2.5} fill={C.kraft} stroke={C.kraftD} strokeWidth={.6} />
        <line x1={48} y1={-96} x2={48} y2={0} stroke={C.mag} strokeWidth={1.1} />
        <line x1={0} y1={-48} x2={96} y2={-48} stroke={C.mag} strokeWidth={1.1} />
        <path d="M48 -96 q-14 -14 -18 -2 q2 8 18 2 q14 -14 18 -2 q-2 8 -18 2 M48 -96 L42 -86 M48 -96 L54 -86" stroke={C.mag} strokeWidth={1.1} fill="none" />
        <P id={151} x={48} y={-24} r={-4}>
          <rect x={-42} y={-13} width={84} height={26} fill={C.card} />
          <Tx y={-2} s={9.5} w={600}>AI Engineering</Tx>
          <Tx y={9} s={9.5} w={600}>for Production</Tx>
        </P>
      </P>
      <P id={152} x={126} y={90} f>
        <rect x={0} y={0} width={44} height={54} fill={C.card} />
        <rect x={0} y={0} width={44} height={13} fill={C.ink} />
        <Tx x={22} y={9.5} s={8} w={600} fill={C.card}>OCT</Tx>
        <g transform={`translate(22 36) scale(${dp}) translate(-22 -36)`}><Tx x={22} y={44} s={24} w={600}>{day}</Tx></g>
      </P>
      {fly}
      <Reader x={150} y={246} s={.7} look={u < 55.28 ? -1 : 0} pose={u < 58.94 ? 'down' : 'up'} face={u < 55.28 ? 'curious' : u < 58.94 ? 'smile' : 'grin'} />
    </Cam>
  );
}
function S14({ u }) {
  const tabs = [[38, 'day 1', 61.17], [64, 'day 3', 61.94], [100, 'day 9', 63.03], [126, 'day 30', 64.64]];
  const turn = tabs.some(([, , t]) => u >= t + .2 && u < t + .5);
  return (
    <Cam s={lerp(1, 1.04, MOTION.draw(u, 59.45, 65.34))}>
      <Top />
      <P id={160} x={0} y={0} f>
        {tabs.map(([x, lab, t], i) => {
          const g = MOTION.enter(u, t, t + .25); if (g <= 0) return null;
          const hgt = 22 * g;
          return <g key={i}><rect x={x} y={110 - hgt} width={22} height={hgt + 6} rx={1} fill={C.sticky} />
            {g > .8 && <Tx x={x + 11} y={110 - hgt + 8} s={7} w={600}>{lab}</Tx>}</g>;
        })}
        <Spread x={22} y={112} w={136} h={108} />
        <path d="M90 112 Q95 170 91 222 Q88 242 92 262 M92 262 L87 268 M92 262 L97 267" stroke={C.mag} strokeWidth={2} fill="none" strokeLinecap="round" />
      </P>
      <Reader x={50} y={200} s={.5} sit pose={turn ? 'pointL' : 'read'} book={!turn} look={.5} face={turn ? 'smile' : 'content'} />
    </Cam>
  );
}
function S15({ u }) {
  const snaps = LAYERS.map((_, i) => 66.58 + i * .167);
  const bowIn = u >= 67.5, bow = lerp(1.7, 1, MOTION.pop(u, 68.06, 68.35));
  return (
    <Cam s={lerp(1, 1.05, MOTION.draw(u, 65.34, 68.62))} cy={200}>
      <Room />
      <P id={170} x={28} y={246} f>
        <BookSide w={124} h={24} cover={C.kraft} />
        <line x1={62} y1={-24} x2={62} y2={0} stroke={C.mag} strokeWidth={1.1} />
      </P>
      {LAYERS.map((t, i) => {
        if (u < snaps[i]) return null;
        const rest = 206 - 16 * i, y = u < snaps[i] + .083 ? rest - 8 : rest;
        return <P key={i} id={171 + i} x={50} y={y} f>
          <rect x={0} y={0} width={80} height={16} rx={2} fill={C.card} />
          <Tx x={40} y={11} s={9}>{t}</Tx>
        </P>;
      })}
      {bowIn && <P id={177} x={90} y={141} s={bow}>
        <path d="M0 0 q-14 -14 -18 -2 q2 8 18 2 q14 -14 18 -2 q-2 8 -18 2 M0 0 L-10 3 M0 0 L10 3" stroke={C.mag} strokeWidth={1.2 / bow} fill="none" strokeLinecap="round" />
      </P>}
      <Reader x={162} y={246} s={.62} look={-1} pose={u < 68.06 ? 'down' : 'up'} face={u < 68.06 ? 'curious' : 'proud'} />
    </Cam>
  );
}
function S16({ u, F }) {
  const card = MOTION.pop(u, 69.87, 70.54);
  const waving = u >= 71.12;
  const waveB = waving && Math.floor(F / 3) % 2 === 1;
  return (
    <Cam s={lerp(1, 1.04, MOTION.draw(u, 68.62, 73.97))} cy={180}>
      <Room />
      <P id={180} x={0} y={0} f><LowBook dy={8} /></P>
      {card > 0 && <P id={181} x={92} y={202} sx={1} sy={card}>
        <line x1={0} y1={0} x2={0} y2={-22} stroke={C.mag} strokeWidth={1.1} />
        <P id={182} x={0} y={-22} r={-4} f>
          <rect x={-56} y={-92} width={112} height={92} rx={2} fill={C.card} />
          <Tx y={-62} s={16} w={600}>Launch event</Tx>
          <Tx y={-40} s={14}>Oct 20</Tx>
          <Tx y={-18} s={12} it fill={C.cyan7}>link in bio</Tx>
        </P>
      </P>}
      <Reader x={140} y={240} s={.6} look={0} pose={waving ? (waveB ? 'waveB' : 'wave') : 'down'} face={waving ? 'grin' : 'smile'} />
    </Cam>
  );
}
const SHOT_C = [S01, S02, S03, S04a, S04b, S05, S06a, S06b, S06c, S07, S08, S09, S10, S11, S12, S13, S14, S15, S16];
const SHOT_FPS = { 12: 8 };
const SAFE = 0.88;
const TABLE_Y = 160 + (246 - 160) * SAFE;
const TOP_SHOTS = [6, 7, 8, 16]; // shot 10 holds on threes

const CAPS = [
  [0.19, 'Books are slow,'], [1.56, 'and this is exactly why I use them.'], [4.34, 'I know that sounds a bit strange'],
  [5.77, 'when you can watch a ten-minute video'], [7.28, 'or ask an AI to explain something.'], [9.5, 'I use those too.'],
  [10.39, 'If I want to get up to speed quickly,'], [12.16, 'I’ll watch a video.'], [13.33, 'But sometimes I finish an explanation,'],
  [15.47, 'makes sense,'], [16.45, 'and then I realize'], [17.44, 'I couldn’t teach it myself.'], [19.15, 'That’s when I like having a book.'],
  [20.76, 'I can stay with the same idea for a while,'], [23.4, 'read the example,'], [24.46, 'go back to the explanation,'],
  [25.65, 'and work through the part I didn’t understand.'], [28.05, 'And because the author builds on what came before,'],
  [31.35, 'I can follow how the ideas connect.'], [33.69, 'I’m not starting over with a different explanation'],
  [36.34, 'every few minutes.'], [37.43, 'I’m not just scrolling through tons of TikTok.'],
  [40.31, 'So I’m quite happy for learning to take a little longer'], [43.36, 'if I understand it better afterwards,'],
  [45.61, 'and that’s exactly why I still use them to learn AI.'], [48.69, 'That’s also what we wanted to give readers'],
  [50.98, 'with ‘Building LLMs for Production’,'], [53.06, 'our first book,'], [54.21, 'and now with our second book,'],
  [56.1, '‘AI Engineering for Production’,'], [57.92, 'coming October twentieth.'], [59.57, 'Something you can take your time with,'],
  [61.94, 'work through, and return to'], [63.69, 'whenever you need it'], [65.46, 'with actual expert AI engineering advice.'],
  [68.74, 'We’re also hosting a launch event,'], [70.7, 'and you can join in with the link in my bio.'],
];

function Film({ tw, onBlocked }) {
  const { T, CUES, time, playing } = useComposition();
  const vrefs = React.useRef([]);

  // each scene's SFX clip plays from its cue, through the 1s hold after the shot
  React.useEffect(() => {
    SHOT_T0.forEach(([nm], i) => {
      const v = vrefs.current[i]; if (!v) return;
      const rel = time - CUES[nm], d = SHOT_DUR[i] + SFX_TAIL;
      const active = rel >= 0 && rel < d;
      const target = Math.max(0, Math.min(rel, d));
      if (active) window.__basSFX = v;
      if (playing && active) {
        if (Math.abs(v.currentTime - target) > .25) v.currentTime = target;
        if (v.paused) v.play().then(() => onBlocked(false)).catch(() => onBlocked(true));
      } else {
        if (!v.paused) v.pause();
        if (Math.abs(v.currentTime - target) > .04) v.currentTime = target;
      }
    });
  }, [time, playing]);

  // audio time -> authored time (identical unless sections are reordered)
  const A = (abs) => {
    let i = 0; while (i + 1 < SHOT_T0.length && abs >= SHOT_T0[i + 1][1]) i++;
    return CUES[SHOT_T0[i][0]] + (abs - SHOT_T0[i][1]);
  };
  let idx = 0;
  for (let i = 0; i < SHOT_T0.length; i++) if (T >= CUES[SHOT_T0[i][0]]) idx = i;
  const [name, t0] = SHOT_T0[idx];
  const fps = SHOT_FPS[idx] || 12;
  const rel = Math.max(0, T - CUES[name]);
  const relQ = Math.min(SHOT_DUR[idx], tw.stopMotion ? Math.floor(rel * fps + 1e-6) / fps : rel);
  const F = Math.floor(T * fps + 1e-6);
  JIT.F = F; JIT.amp = tw.stopMotion ? tw.boil : 0;
  const Shot = SHOT_C[idx];
  const flick = tw.stopMotion ? .015 * tw.boil * hh(F, 999) : 0;

  return (
    <div style={{ position: 'absolute', inset: 0, background: C.paper, overflow: 'hidden' }} data-screen-label={`t=${Math.floor(time)}s · ${name}`}>
      <svg viewBox="0 0 180 320" width="1080" height="1920" style={{ position: 'absolute', inset: 0, display: 'block' }}>
        <defs>
          <filter id="ps" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx=".5" dy=".9" stdDeviation=".55" floodColor={C.ink} floodOpacity=".26" />
          </filter>
          <linearGradient id="wallG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.ink} stopOpacity=".05" /><stop offset=".6" stopColor={C.ink} stopOpacity="0" /><stop offset="1" stopColor={C.ink} stopOpacity=".04" />
          </linearGradient>
          <linearGradient id="tableG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.table} /><stop offset="1" stopColor={C.tableD} />
          </linearGradient>
          <radialGradient id="vig" cx=".5" cy=".45" r=".62">
            <stop offset=".55" stopColor={C.ink} stopOpacity="0" /><stop offset="1" stopColor={C.ink} stopOpacity=".14" />
          </radialGradient>
          <radialGradient id="lampG" cx=".6" cy=".3" r=".6">
            <stop offset="0" stopColor={C.yel} stopOpacity=".16" /><stop offset="1" stopColor={C.yel} stopOpacity="0" />
          </radialGradient>
          <pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="4" height="4" fill={C.mag} opacity=".12" /><line x1="0" y1="0" x2="0" y2="4" stroke={C.mag} strokeWidth=".5" opacity=".5" />
          </pattern>
        </defs>
        {TOP_SHOTS.includes(idx) ? <rect x={0} y={0} width={180} height={320} fill={C.table} /> : <g>
          <rect x={0} y={0} width={180} height={320} fill={C.paper} />
          <rect x={0} y={TABLE_Y} width={180} height={320 - TABLE_Y} fill={C.table} />
          <line x1={0} y1={TABLE_Y} x2={180} y2={TABLE_Y} stroke={C.tableD} strokeWidth={.6} />
        </g>}
        <g transform={`translate(90 160) scale(${SAFE}) translate(-90 -160)`}><Shot u={t0 + relQ} F={F} /></g>
        {flick > 0 && <rect x={0} y={0} width={180} height={320} fill={C.ink} opacity={flick} />}
        {tw.safeZones && <g>
          <rect x={0} y={0} width={180} height={32} fill="url(#hatch)" />
          <rect x={0} y={256} width={180} height={64} fill="url(#hatch)" />
          <rect x={158} y={150} width={22} height={106} fill="url(#hatch)" />
        </g>}
      </svg>
      {tw.captions && <Captions items={CAPS.map(([at, text], i) => ({ at: A(at), until: i + 1 < CAPS.length ? A(CAPS[i + 1][0]) : A(VO_END) + 5, text }))}
        style={{ bottom: '21.5%', left: '9%', right: '12%', font: `600 50px ${FONT}`, color: C.ink, textShadow: 'none', lineHeight: 1.2, textWrap: 'balance' }} />}
      {SHOT_T0.map(([nm], i) => (
        <video key={i} ref={(el) => { vrefs.current[i] = el; }} src={`audio/sfx-${String(i + 1).padStart(2, '0')}.wav`} preload="auto" playsInline
          data-om-exportable-video-play-start={String(CUES[nm])} data-om-exportable-video-play-end={String(CUES[nm] + SHOT_DUR[i] + SFX_TAIL)}
          style={{ position: 'absolute', left: 0, top: 0, width: 2, height: 2, opacity: 0, pointerEvents: 'none' }} />
      ))}
    </div>
  );
}

function BooksAreSlow() {
  const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS);
  const [blocked, setBlocked] = React.useState(false);
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#d7d3d3' }}>
      <CompositionStage width={1080} height={1920} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg={C.paper}>
        <Film tw={t} onBlocked={setBlocked} />
      </CompositionStage>
      {blocked && <button onClick={() => { const v = window.__basSFX; if (v) v.play().then(() => setBlocked(false)).catch(() => {}); }}
        style={{ position: 'fixed', top: 12, left: 12, zIndex: 50, font: `600 14px ${FONT}`, color: C.card, background: C.cyan, border: 0, borderRadius: 2, padding: '8px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        Turn on sound
      </button>}
      <TweaksPanel>
        <TweakSection label="Playback" />
        <TweakToggle label="Motion editor" value={t.motionEditor} onChange={(v) => setTweak('motionEditor', v)} />
        <TweakSection label="Stop-motion" />
        <TweakToggle label="Shoot on twos (12 fps)" value={t.stopMotion} onChange={(v) => setTweak('stopMotion', v)} />
        <TweakSlider label="Hand-placed jitter" value={t.boil} min={0} max={2} step={0.1} onChange={(v) => setTweak('boil', v)} />
        <TweakSection label="Overlays" />
        <TweakToggle label="Burned-in captions" value={t.captions} onChange={(v) => setTweak('captions', v)} />
        <TweakToggle label="Reels UI zones" value={t.safeZones} onChange={(v) => setTweak('safeZones', v)} />
      </TweaksPanel>
    </div>
  );
}
window.BooksAreSlow = BooksAreSlow;
