/* ============================================================
   Prairie Village — ART BLOCK
   ------------------------------------------------------------
   Every picture in the game is drawn right here in code, pixel
   by pixel. Nothing is downloaded, so the whole game is still
   just the same handful of files you already uploaded.

   Two ways of drawing are used:

   1. "Pixel strings" — a picture typed out as rows of letters,
      one letter per pixel. K = outline, S = skin, and so on.
      Used for anything where the exact shape matters (him,
      the fences, the signs).

   2. Little drawing routines — code that stamps circles and
      boxes, then traces a dark outline around the result.
      Used for trees, houses, hedges: things that should vary
      a bit from one to the next.

   This block deliberately doesn't know anything about Phaser,
   which is what lets it be tested on its own.
   ============================================================ */

/* ---- a tiny predictable random number generator -------------
   "Seeded" means: same seed in, same numbers out, every time.
   So the grass tufts land in the same spots on every launch. */
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function pick(rnd, lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); }

/* ---- draw a picture that was typed out as rows of letters --- */
function drawPixels(ctx, rows, palette, ox, oy, scale) {
  ox = ox || 0; oy = oy || 0; scale = scale || 1;
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const c = palette[row[x]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    }
  }
}

/* ---- trace a dark outline around whatever has been drawn ----
   This one step is what makes everything look like it belongs
   in the same storybook rather than like floating shapes. */
function outlinePass(ctx, w, h, color) {
  const img = ctx.getImageData(0, 0, w, h);
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = img.data[i * 4 + 3] > 8 ? 1 : 0;
  ctx.fillStyle = color;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid[y * w + x]) continue;
      const up    = y > 0     && solid[(y - 1) * w + x];
      const down  = y < h - 1 && solid[(y + 1) * w + x];
      const left  = x > 0     && solid[y * w + x - 1];
      const right = x < w - 1 && solid[y * w + x + 1];
      if (up || down || left || right) ctx.fillRect(x, y, 1, 1);
    }
  }
}

/* ---- a crisp pixel circle (no blurry edges) ----------------- */
function pixelCircle(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  const r2 = r * r;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r2) ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
}

/* ---- a crisp pixel oval, same idea as the circle above ------ */
function pixelEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
}

/* ---- how big a picture is, once it's just an array of row-strings.
   Rows can be ragged (not all the same length) — a branch reaching
   past the rest of the canopy, say — so this checks every row rather
   than assuming the first one is the widest. ---------------------- */
function gridSize(rows) {
  let w = 0;
  for (const r of rows) if (r.length > w) w = r.length;
  return { w, h: rows.length };
}

/* ============================================================
   THE COLOR SYSTEM
   ------------------------------------------------------------
   Approved Aug 2, alongside the sprites below. Every organic
   picture (trees, bushes, hedges, the oak) and every "built"
   picture (houses, fences, signs, roads, paths) is colored only
   through these six roles — never a one-off hex value:

     K outline   E deep shadow   D dark   M mid   L light   S spark

   Which hex each role points to changes with a six-stage clock
   that's meant to loosely track a real day. The exact colors for
   all six stages are locked — copied verbatim below, not
   re-picked. The hour each stage begins is *not* specified in the
   approved notes, so I've set a plain, even schedule — that part
   is easy to retune (just the STAGE_SCHEDULE hours) without
   touching anything else.
   ============================================================ */
const PALETTE_STAGES = {
  midnight:  { K: '#0a1026', E: '#04060f', D: '#1a2547', M: '#2e3f6e', L: '#55699c', S: '#a0b2d9' },
  earlyDawn: { K: '#241631', E: '#100820', D: '#473060', M: '#6d4f8c', L: '#9c7fc0', S: '#ded0f0' },
  morning:   { K: '#2c3f1e', E: '#17220e', D: '#5d7f3a', M: '#90b164', L: '#cbdb9e', S: '#f7f5dd' },
  midday:    { K: '#234420', E: '#132a10', D: '#4a7a42', M: '#79ad6b', L: '#b9d9a6', S: '#f4f8e6' },
  sunset:    { K: '#4a2410', E: '#2a1206', D: '#8a4a22', M: '#c07a3e', L: '#e8b078', S: '#fbeacb' },
  night:     { K: '#0e1c22', E: '#060e12', D: '#23414b', M: '#3f6571', L: '#7096a1', S: '#b9d5db' }
};

/* The hour each stage begins, evenly spread across the day —
   my assumption, not something the approved notes pinned down. */
const STAGE_SCHEDULE = [
  { hour: 0, stage: 'midnight' },
  { hour: 4, stage: 'earlyDawn' },
  { hour: 7, stage: 'morning' },
  { hour: 10, stage: 'midday' },
  { hour: 16, stage: 'sunset' },
  { hour: 19, stage: 'night' }
];

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r, g, b) {
  const c = v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
function blendHex(a, b, t) {
  const [ar, ag, ab] = hexToRgb(a), [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/* Works out today's six-role palette from a real clock: which stage
   it currently is, and how far into the fade toward the next one.
   Runs once when the game loads, so the world reflects whatever
   time of day it is when he opens the app that session — it doesn't
   keep drifting while he's actively playing. (Making it drift live
   is a nice next step, not done here.) */
function computePalette(date) {
  const hour = date.getHours() + date.getMinutes() / 60;
  let idx = 0;
  for (let i = 0; i < STAGE_SCHEDULE.length; i++) {
    if (hour >= STAGE_SCHEDULE[i].hour) idx = i;
  }
  const cur = STAGE_SCHEDULE[idx];
  const next = STAGE_SCHEDULE[(idx + 1) % STAGE_SCHEDULE.length];
  const nextStart = next.hour > cur.hour ? next.hour : next.hour + 24;
  const t = Math.max(0, Math.min(1, (hour - cur.hour) / (nextStart - cur.hour)));
  const from = PALETTE_STAGES[cur.stage], to = PALETTE_STAGES[next.stage];
  const roles = {};
  ['K', 'E', 'D', 'M', 'L', 'S'].forEach(k => { roles[k] = blendHex(from[k], to[k], t); });
  return roles;
}

/* ============================================================
   HIM
   ------------------------------------------------------------
   32 x 32, drawn three times: facing down (you see his face),
   facing up (you see the back of the cap — this is where the
   backwards brim really shows), and facing left. Facing right
   is the left drawing flipped over.

   K outline   S skin      s skin shadow
   H hair/beard h hair dark
   P cap purple p cap purple dark
   G glasses frame  g lens
   T t-shirt black  t shirt shadow
   C cargo shorts   c shorts shadow
   N sandal         n sandal dark

   Resolved Aug 2: he's colored through the same six roles as
   everything else now, rather than his own 14 literal colors.
   This map says which role each of his 14 letters borrows —
   the shapes/shading above are untouched, only which hex each
   letter resolves to changes (see buildArt(), which turns this
   into an actual K/S/s/... palette from the active this.palette
   before drawing him). Chosen to keep his silhouette reading the
   same way it always has: dark shirt and hair, light skin, with
   the lens as the one small "spark" accent.

   Adjusted Aug 3 after judging him against all six palettes: the
   cap and shorts had been mapped to M — but the grass he stands
   on is an M base, so both vanished into the lawn at every time
   of day (worst at Midnight, where the whole middle of him went
   dark too). They now borrow L, which restores the original
   relationship anyway — his tan shorts always sat close to his
   skin tone, and a light cap over the dark hair band reads as
   "backwards cap" even on the darkest night. */
const HERO_ROLE_MAP = {
  K: 'K', S: 'L', s: 'M',
  H: 'D', h: 'E',
  P: 'L', p: 'D',
  G: 'D', g: 'S',
  T: 'D', t: 'E',
  C: 'L', c: 'D',
  N: 'D', n: 'E'
};

const HERO_DOWN = [
  '................................',
  '................................',
  '................................',
  '...........KKKKKKKKKK...........',
  '..........KPPPPPPPPPpK..........',
  '..........KPPPPPPPPPpK..........',
  '.........KPPPPPPPPPPppK.........',
  '.........KPPPPPPPPPPppK.........',
  '.........KppppppppppppK.........',
  '.........KHHHHHHHHHHHHK.........',
  '..........KSSSSSSSSSsK..........',
  '..........KGGGGSSGGGGK..........',
  '..........KgKggGGggKgK..........',
  '..........KsSSSSSSSssK..........',
  '..........KHHSSSSSSHHK..........',
  '..........KHHHHSSHHhHK..........',
  '..........KHHHHHHHHhhK..........',
  '...........KHHHHHhhhK...........',
  '........KTTTTTTTTTTTTttK........',
  '........KTTTTTTTTTTTTttK........',
  '........KTtTTTTTTTTTTttK........',
  '........KTtTTTTTTTTTTttK........',
  '........KSSTTTTTTTTTtttK........',
  '........KSSTTTTTTTTTtttK........',
  '........KSSTtttTTTTttssK........',
  '..........KCCCCCCCCCcK..........',
  '..........KCcCCCCCCccK..........',
  '..........KCCCCKKCCCcK..........',
  '..........KSSSK..KSssK..........',
  '..........KSSSK..KSssK..........',
  '.........KNNNNK..KNNNNK.........',
  '.........KnnnnK..KnnnnK.........'
];

const HERO_UP = [
  '................................',
  '................................',
  '................................',
  '...........KKKKKKKKKK...........',
  '..........KPPPPPPPPPpK..........',
  '..........KPPPPPPPPPpK..........',
  '.........KPPPPPPPPPPppK.........',
  '.........KPPPPPPPPPPppK.........',
  '.........KPPPPPPPPPPppK.........',
  '.........KPPPPPPPPPPppK.........',
  '.......KPPPPPPPPPPPPPPppK.......',
  '.......KppppppppppppppppK.......',
  '.......KKKKKKKKKKKKKKKKKK.......',
  '..........KHHHHHHHHHhK..........',
  '..........KHHHHHHHHHhK..........',
  '..........KHhHHHHHHhhK..........',
  '..........KHHHHHHHHhhK..........',
  '...........KHHHHHhhhK...........',
  '........KTTTTTTTTTTTTttK........',
  '........KTTTTTTTTTTTTttK........',
  '........KTtTTTTTTTTTTttK........',
  '........KTtTTTTTTTTTTttK........',
  '........KSSTTTTTTTTTtttK........',
  '........KSSTTTTTTTTTtttK........',
  '........KSSTtttTTTTttssK........',
  '..........KCCCCCCCCCcK..........',
  '..........KCcCCCCCCccK..........',
  '..........KCCCCKKCCCcK..........',
  '..........KSSSK..KSssK..........',
  '..........KSSSK..KSssK..........',
  '.........KNNNNK..KNNNNK.........',
  '.........KnnnnK..KnnnnK.........'
];

const HERO_LEFT = [
  '................................',
  '................................',
  '................................',
  '...........KKKKKKKKK............',
  '..........KPPPPPPPPpK...........',
  '..........KPPPPPPPPpK...........',
  '..........KPPPPPPPppK...........',
  '..........KPPPPPPPppK...........',
  '..........KpppppppppK...........',
  '..........KpppppppppPPPPPPpK....',
  '..........KHHHHHHHHHpppppppK....',
  '..........KSSSSSSSHHK...........',
  '..........KGggGSSSHHK...........',
  '..........KsSSSSSHHhK...........',
  '..........KHSSSSHHHhK...........',
  '..........KHHSSHHHHhK...........',
  '..........KHHHHHHHhhK...........',
  '...........KHHHHHhhK............',
  '.........KTTTTTTTTTTttK.........',
  '.........KTTTTTTTTTTttK.........',
  '.........KTtTTTTTTTTttK.........',
  '.........KTtTTTTTTTTttK.........',
  '.........KSSTTTTTTTtttK.........',
  '.........KSSTTTTTTTtttK.........',
  '.........KSSTttTTTttttK.........',
  '..........KCCCCCCCCCcK..........',
  '..........KCcCCCCCCccK..........',
  '..........KCCCCCCCCCcK..........',
  '...........KSSSSSSssK...........',
  '...........KSSSSSSssK...........',
  '..........KNNNNNNNNnK...........',
  '..........KnnnnnnnnnK...........'
];

/* Flip a drawing left-to-right (that's how "facing right" is made). */
function mirrorRows(rows) { return rows.map(r => r.split('').reverse().join('')); }

/* Make a walking frame by lifting one foot a pixel off the ground.
   'l' lifts the left-hand foot, 'r' the right-hand one. Alternating
   between them is the whole walk cycle — small, but the eye reads
   it instantly as walking. */
function liftFoot(rows, side) {
  const H = rows.length, W = rows[0].length;
  const LEG_TOP = 28;
  const grid = rows.map(r => r.split(''));
  const out = rows.map(r => r.split(''));
  const c0 = side === 'l' ? 0 : W >> 1;
  const c1 = side === 'l' ? W >> 1 : W;
  for (let y = LEG_TOP; y < H; y++) {
    for (let x = c0; x < c1; x++) {
      out[y][x] = (y + 1 < H) ? grid[y + 1][x] : '.';
    }
  }
  return out.map(r => r.join(''));
}

/* Build all 12 hero pictures: 4 directions x 3 frames. */
function heroFrames() {
  const base = {
    down: HERO_DOWN,
    up: HERO_UP,
    left: HERO_LEFT,
    right: mirrorRows(HERO_LEFT)
  };
  const frames = [];
  ['down', 'left', 'right', 'up'].forEach(dir => {
    frames.push({ name: dir + '0', rows: base[dir] });
    frames.push({ name: dir + '1', rows: liftFoot(base[dir], 'l') });
    frames.push({ name: dir + '2', rows: liftFoot(base[dir], 'r') });
  });
  return frames;
}

/* ============================================================
   HENRI
   ------------------------------------------------------------
   Small, white coat, black ears, one black eye-patch marking —
   drawn with round shapes rather than typed-out pixels (the same
   trick the trees use), since a dog's silhouette is simple blobs:
   a body, a head, two ears, a tail. Three poses — down, up, left
   (right is just "left" mirrored by Phaser at render time, so
   there's no separate drawing to keep in sync) — each with two
   walking frames (a little hop) and one sitting frame.

   Resolved Aug 2: like everything else, he's colored from the
   active six-role palette rather than his own fixed white/cream
   coat. His "coat" borrows the L (light) role, his belly-shadow
   borrows M (mid), and his ears/eye-patch/nose borrow D (dark) —
   the same light-to-dark relationship he always had, just riding
   on whatever the current time-of-day palette is instead of a
   fixed white. ============================================================ */
const HENRI_W = 26, HENRI_H = 20;

/* Henri, redrawn Aug 3 as hand-pixel letter grids — the same
   treatment as every other living thing in the game. He'd been the
   one creature still drawn by code as smooth ovals, which is why he
   looked soft next to the hand-drawn trees. Six poses; walking
   bounce is the whole drawing lifted one pixel. Same letters as
   the trees: K outline, L coat, M coat shading (kept away from the
   silhouette edge so he can't melt into M-based grass), D for his
   black ears, eye patch and nose, E for the shadow under him. */
const HENRI_LEFT = [
  '..........................',
  '..........................',
  '....KKKK..................',
  '...KLLLLKKK...............',
  '..KLDDLLLDDK..............',
  '..KLDDLLLDDDK.........KK..',
  '.KDLLLLLLLDDK........KLLK.',
  '.KDLLLLLLLDDK........KLLK.',
  '..KLLLLLLLLDK.......KLLK..',
  '..KKLLLLLLLLKKKKKKKKLLLK..',
  '...KLLLLLLLLLLLLLLLLLLLK..',
  '...KKLLLLLLLLLLLLLMMLLK...',
  '....KLLLLLLLLLLLMMMLLK....',
  '....KKLLLLLLLLLMMMLLKK....',
  '.....KLLEELLLLLEELLLK.....',
  '.....KKKLLKKKKKKLLKKK.....',
  '.......KLLK....KLLK.......',
  '.......KLLK....KLLK.......',
  '.......KLLK....KLLK.......',
  '.......KKKK....KKKK.......'
];

const HENRI_LEFT_SIT = [
  '..........................',
  '..........................',
  '.....KKKK.................',
  '....KLLLLKKK..............',
  '...KLDDLLLDDK.............',
  '...KLDDLLLDDDK............',
  '..KDLLLLLLLDDK............',
  '..KDLLLLLLLDDK............',
  '...KLLLLLLLLDK............',
  '....KKLLLLLLKKK...........',
  '.....KLLLLLLLLKK..........',
  '.....KLLLLLLLLLLK.........',
  '.....KLLLLLLLLLLLK........',
  '.....KLLLLLLLLLLLLK.......',
  '.....KLLLKLLLLLMMLKK......',
  '.....KLLLKLLLLLLMLLKKK....',
  '.....KLLLKLLLLLLLLLKLLK...',
  '.....KLLLKKELLLLELKKLLK...',
  '.....KKKKKKKLLLLLKKKKKK...',
  '...........KKKKKK.........'
];

const HENRI_DOWN = [
  '..........................',
  '..........................',
  '........KKKKKK............',
  '......KKLLLLLLKK..........',
  '.....KDLLLLLLLLDK.........',
  '....KDDLLDDLLLLDDK........',
  '....KDDLLDDLLLLDDK........',
  '....KDDLLLLLLLLDDK........',
  '.....KKLLLLLLLLKK.........',
  '......KLLLDDLLLK..........',
  '.....KKLLLLLLLLKK.........',
  '....KKLLLLLLLLLLKK........',
  '....KLLLLLLLLLLLLKK.......',
  '....KLLLLLLLLLLMLLK.......',
  '....KLLLLLLLLLMMLLK.......',
  '.....KLLLLLLLLMLLK........',
  '.....KKLLKKKKLLKKK........',
  '......KLLK..KLLK..........',
  '......KLLK..KLLK..........',
  '......KKKK..KKKK..........'
];

const HENRI_DOWN_SIT = [
  '..........................',
  '..........................',
  '..........................',
  '........KKKKKK............',
  '......KKLLLLLLKK..........',
  '.....KDLLLLLLLLDK.........',
  '....KDDLLDDLLLLDDK........',
  '....KDDLLDDLLLLDDK........',
  '....KDDLLLLLLLLDDK........',
  '.....KKLLLLLLLLKK.........',
  '......KLLLDDLLLK..........',
  '.....KKLLLLLLLLKK.........',
  '....KKLLLLLLLLLLKK........',
  '...KKLLLLLLLLLLLLKK.......',
  '...KLLLLLLLLLLLLMLK.......',
  '...KLLLLLLLLLLLMMLLK......',
  '...KKLLKKLLLLKKLLKKK......',
  '.....KKKKLLLLKKKK.........',
  '........KKKKKK............',
  '..........................'
];

const HENRI_UP = [
  '..........................',
  '..........................',
  '........KKKKKK............',
  '......KKLLLLLLKK..........',
  '.....KDLLLLLLLLDK.........',
  '....KDDLLLLLLLLDDK........',
  '....KDDLLLLLLLLDDK........',
  '....KDDLLLLLLLLDDK........',
  '.....KKLLLLLLLLKK.........',
  '......KLLLLLLLLK..........',
  '.....KKLLLLLLLLKK.........',
  '....KKLLLLLLLLLLKK........',
  '....KLLLLKMMKLLLLKK.......',
  '....KLLLLKMMKLLLMLK.......',
  '....KLLLLLKKLLLLLLK.......',
  '.....KLLLLLLLLMLLK........',
  '.....KKLLKKKKLLKKK........',
  '......KLLK..KLLK..........',
  '......KLLK..KLLK..........',
  '......KKKK..KKKK..........'
];

const HENRI_UP_SIT = [
  '..........................',
  '..........................',
  '..........................',
  '........KKKKKK............',
  '......KKLLLLLLKK..........',
  '.....KDLLLLLLLLDK.........',
  '....KDDLLLLLLLLDDK........',
  '....KDDLLLLLLLLDDK........',
  '....KDDLLLLLLLLDDK........',
  '.....KKLLLLLLLLKK.........',
  '.....KKLLLLLLLLKK.........',
  '....KKLLLLLLLLLLKK........',
  '...KKLLLLKMMKLLLLKK.......',
  '...KLLLLLKMMKLLLLLKK......',
  '...KLLLLLLKKLLLLLMLK......',
  '...KKLLLLLLLLLLLLLLK......',
  '.....KKKKKKKKKKKKKK.......',
  '..........................',
  '..........................',
  '..........................'
];

const HENRI_GRIDS = {
  left: HENRI_LEFT, leftSit: HENRI_LEFT_SIT,
  down: HENRI_DOWN, downSit: HENRI_DOWN_SIT,
  up: HENRI_UP, upSit: HENRI_UP_SIT
};

function drawHenri(ctx, dir, sit, bounce, pal) {
  const rows = HENRI_GRIDS[dir + (sit ? 'Sit' : '')];
  const hp = { K: pal.K, E: pal.E, D: pal.D, M: pal.M, L: pal.L };
  // the trot hop: the whole drawing lifts one pixel
  drawPixels(ctx, rows, hp, 0, bounce ? -1 : 0);
}

/* ============================================================
   GROUND TILES  (16 x 16 each)
   ============================================================ */
function paintTile(ctx, w, h, base, specks, seed) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const rnd = makeRng(seed);
  for (let i = 0; i < 22; i++) {
    ctx.fillStyle = specks[i % specks.length];
    const x = pick(rnd, 0, w - 1), y = pick(rnd, 0, h - 1);
    const sw = rnd() < 0.25 ? 2 : 1;
    ctx.fillRect(x, y, sw, 1);
  }
}

/* Grass, per the approved recipe: an M base, a ~9% speckle of D
   and L (roughly two D specks for every L one), and rare little
   S "spark" crosses — about one per tile, on average. */
function paintGrassRole(ctx, pal, seed) {
  ctx.fillStyle = pal.M;
  ctx.fillRect(0, 0, 16, 16);
  const rnd = makeRng(seed);
  const speckles = Math.round(16 * 16 * 0.09);
  for (let i = 0; i < speckles; i++) {
    ctx.fillStyle = rnd() < (2 / 3) ? pal.D : pal.L;
    ctx.fillRect(pick(rnd, 0, 15), pick(rnd, 0, 15), 1, 1);
  }
  if (rnd() < 0.85) {
    const x = pick(rnd, 2, 13), y = pick(rnd, 2, 13);
    ctx.fillStyle = pal.S;
    ctx.fillRect(x, y, 1, 1);
    ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1);
    ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1);
  }
}

function paintRoad(ctx, pal, seed, withDash) {
  paintTile(ctx, 16, 16, pal.D, [pal.E, pal.M], seed);
  if (withDash) { ctx.fillStyle = pal.S; ctx.fillRect(4, 7, 8, 2); }
}

function paintWalk(ctx, pal, seed) {
  paintTile(ctx, 16, 16, pal.L, [pal.M, pal.D], seed);
  ctx.fillStyle = pal.D;
  ctx.fillRect(0, 0, 16, 1);
  ctx.fillRect(0, 0, 1, 16);
}

/* ============================================================
   FENCES  (16 x 16, made to tile seamlessly end to end)
   ============================================================ */
const FENCE_H = [
  '................',
  '................',
  '.......KK.......',
  '.......WW.......',
  'KKKKKKKKKKKKKKKK',
  'WWWWWWWWWWWWWWWW',
  'wwwwwwwwwwwwwwww',
  '.......WW.......',
  '.......WW.......',
  'KKKKKKKKKKKKKKKK',
  'WWWWWWWWWWWWWWWW',
  'wwwwwwwwwwwwwwww',
  '.......WW.......',
  '.......WW.......',
  '.......KK.......',
  '................'
];

const FENCE_V = [
  '...KWWw.WWwK....',
  '...KWWw.WWwK....',
  '...KKKKKKKKK....',
  '...KWWWWWWWK....',
  '...KwwwwwwwK....',
  '...KWWw.WWwK....',
  '...KWWw.WWwK....',
  '...KWWw.WWwK....',
  '...KWWw.WWwK....',
  '...KKKKKKKKK....',
  '...KWWWWWWWK....',
  '...KwwwwwwwK....',
  '...KWWw.WWwK....',
  '...KWWw.WWwK....',
  '...KWWw.WWwK....',
  '...KWWw.WWwK....'
];

/* ============================================================
   THE HAND-PAINTED SIGN
   ------------------------------------------------------------
   The words themselves aren't painted into the picture — at this
   size real letters would be mush. Instead the board has painted
   brush-strokes on it, and the actual sentence appears in a little
   box at the bottom of the screen when he walks up to it.
   ============================================================ */
const SIGN_ROWS = [
  '..............................',
  '..............................',
  '..KKKKKKKKKKKKKKKKKKKKKKKKKK..',
  '..KWWWWWWWWWWWWWWWWWWWWWWWWK..',
  '..KWRRRRWRRRRRWRRRWRRRRRRWWK..',
  '..KWWWWWWWWWWWWWWWWWWWWWWWWK..',
  '..KWWRRRWRRRRRRWRRRRWRRRWWWK..',
  '..KWWWWWWWWWWWWWWWWWWWWWWWWK..',
  '..KWWWRRRRWRRRWRRRRRWWWWWWWK..',
  '..KWWWWWWWWWWWWWWWWWWWWWWWWK..',
  '..KwwwwwwwwwwwwwwwwwwwwwwwwK..',
  '..KKKKKKKKKKKKKKKKKKKKKKKKKK..',
  '......KPPK..........KPPK......',
  '......KPPK..........KPPK......',
  '......KPPK..........KPPK......',
  '......KPPK..........KPPK......',
  '......KPPK..........KPPK......',
  '......KPPK..........KPPK......',
  '......KPPK..........KPPK......',
  '......KPPK..........KPPK......',
  '......KPPK..........KPPK......',
  '......KPPK..........KPPK......',
  '......KPPK..........KPPK......',
  '......KKKK..........KKKK......',
  '..............................'
];

/* The park's own entrance board — same idea, wider, one post. */
const PARKSIGN_ROWS = [
  '..KKKKKKKKKKKKKKKKKKKKKKKKKKKK..',
  '..KWWWWWWWWWWWWWWWWWWWWWWWWWWK..',
  '..KWRRRRRRWRRRRRWRRRRWRRRRRRWK..',
  '..KWWWWWWWWWWWWWWWWWWWWWWWWWWK..',
  '..KWWRRRRWRRRRRRRWRRRRRWWWWWWK..',
  '..KwwwwwwwwwwwwwwwwwwwwwwwwwwK..',
  '..KKKKKKKKKKKKKKKKKKKKKKKKKKKK..',
  '..............KPPK..............',
  '..............KPPK..............',
  '..............KPPK..............',
  '..............KPPK..............',
  '..............KPPK..............',
  '..............KPPK..............',
  '..............KPPK..............',
  '..............KKKK..............'
];

/* ============================================================
   TREES, BUSH, PINE, HEDGE, THE BIG OAK
   ------------------------------------------------------------
   Approved Aug 2 — see APPROVED_SPRITES.md in the project notes.
   Every one of these is a hand-placed letter grid, exactly like
   him: copied verbatim below, one letter per pixel, never
   redrawn from primitive shapes. Only the six-role palette they're
   painted with changes; the shapes themselves are locked.
   ============================================================ */
const TREE_C_ROWS = [
  '...........KKKK',
  '.........KKMLLMK',
  '........KMLMLLLMKK',
  '.......KMLLSLLMMMMK',
  '......KMLMLLLMMLMMMK',
  '....KKLLLMLMMMMMMMMK',
  '....KMLMEELMMMMMMMMK',
  '...KMMLMMEEMMMMDMMMMK',
  '...KMMMLMMMMMDMMMMMMK',
  '.KKLMMMMLMMMMMDMDMMMK',
  '.KMMMLMMMMMMDMDMDMMMK',
  '.KMMMMMMMMDMDDDDDDDMK',
  '.KMDMMMMMDDDDDDDDDDMK',
  '.KMDMDMMMDDDDDEDDDDK',
  '..KMDMDMDDDDDDEEDDDK',
  '..KMMDMDDDDDDDDEDDK',
  '...KMDDDDDKDDDDDDK',
  '....KKDDDKKKDDDDKK',
  '......KKDK..KDDKK',
  '........KK...KK',
  '.........KEDDK',
  '.........KEDMK',
  '.........KEDMK',
  '.........KEDMK',
  '.........KEDMK',
  '.........KEDMK',
  '.........KEDMK',
  '.........KEDMK',
  '.........KEDMK',
  '.........KEDMK',
  '........KEEDMMK',
  '.......KEEDDMMMK',
  '.......KKKKKKKK'
];

const TREE_A_ROWS = [
  '............KKKK',
  '..........KKMLLMK',
  '.........KMLMLLLMKK.KK',
  '........KMLLLLSLLMKKMMKK',
  '........KMLLMLLLLMMMMMMMK',
  '.......KMLLLLLMLMMMLMMMMMK',
  '.....KKLMLLLLLMMMMMMMMMMKK',
  '.....KMMLMEELMMMMMMMMMMMMK',
  '....KMMLMMMEEMMMMMMMDMMMMMK',
  '...KMMMMLMMMMMMMMMDMMMMMMMMK',
  '..KMLMMMMMMMMMMMMMMDMDMMMMK',
  '.KMMMLLMMMMMMMMMMDMDMDMDMMMK',
  '.KMLMLMMMMMMMMMDMDDDDDDDMMMK',
  '.KMMMMMMMDMMMMMDDDDDDDDDDMMK',
  '..KMMDMMMMMMMDDDDDDDDDDDDMMK',
  '.KMMDMDMMMMMDDDDDDDDDDEDDDMK',
  '.KMMMDMDMMMDDDDDDDDDDDDDDDK',
  '..KMMDMDMDDDDDDDDDEDDDDDDDK',
  '..KMMMDMDDDDDDDDDEEDDDDDDK',
  '...KMDDDDDDDDDDDDDEDDDDDK',
  '....KDDDDDDDKDDDDDDDDDDK',
  '.....KKDDDDKKKDDDDDDDKK',
  '.......KKDDK...KDDDKK',
  '.........KKK....KKK',
  '............KEDDK',
  '............KEDDMK',
  '............KEDDMK',
  '............KEDDMK',
  '............KEDDMK',
  '............KEDDMK',
  '............KEDDMK',
  '............KEDDMK',
  '............KEDDMK',
  '............KEDDMK',
  '............KEDDMK',
  '............KEDDMK',
  '...........KEEDDMMK',
  '..........KEEDDDMMMK',
  '..........KKKKKKKKKK'
];

const TREE_B_ROWS = [
  '..............KKKKK',
  '............KKMLLLMK',
  '...........KMLMLLLLMKKK',
  '.........KKMLLLLSLLMKKMKK',
  '........KMLLLMLLLLLMMMMMMK',
  '.......KMLLLLLLLMLMMMLMMMMK',
  '......KMLMLLLLLLMMMMMMMMMMMK',
  '.....KMLLLMEELLMMMMMMMMMMMMK',
  '....KMMLLMMMEEMMMMMMMMMMMMMMK',
  '...KMMMLMLMMMMMMMMMMMDMMMMMMMK',
  '...KMLMMMMLMMMMMMMMMDMMMMMMMMK',
  '.KKMMLLMMMMMMMMMMMMMMDMDMMMMMK',
  '.KMLMLMMMMMMMMMMMMDMDMDMDMMMMK',
  '.KMMMMMMMMMMMMMMDMDDDDDDDDMMMK',
  '.KMMMMMMDMMMMMMMDDDDDDDDDDDMMMK',
  '.KMMDMMMMMMMMMMDDDDDDDDDDDDDMMK',
  '.KMDMDMMMMMMMMDDDDDDDDDDEDDDDMK',
  '.KMMDMDMMMMMMDDDDDDDDDDDDDDDDMK',
  '..KMDMDMMMMMDDDDDDDDDDDDDDDDDK',
  '..KMMDMDMMMDDDDDDDDDDDDDDDDDDK',
  '...KMMDMDMDDDDDDDDEEDDDDDDDDK',
  '....KMDDDDDDDDDDDDDEEDDDDDDK',
  '.....KDDDDDDDDKDDDDDEDDDDDK',
  '......KKDDDDDKKKDDDDDDDDKK',
  '........KKDDDK..KKDDDDKK',
  '..........KKK.....KKKK',
  '..............KEDDMK',
  '..............KEDDMK',
  '..............KEDDMK',
  '..............KEDDMK',
  '..............KEDDMK',
  '..............KEDDMK',
  '..............KEDDMK',
  '..............KEDDMK',
  '..............KEDDMK',
  '..............KEDDMK',
  '..............KEDDMK',
  '..............KEDDMK',
  '..............KEDDMK',
  '..............KEDDMK',
  '..............KEDDMK',
  '.............KEEDDMMK',
  '............KEEDDDMMMK',
  '............KKKKKKKKKK'
];

const PINE_ROWS = [
  '............KK',
  '...........KLMK',
  '...........KLMDK',
  '..........KLMMDK',
  '..........KLMDDDK',
  '.........KLMMDDDK',
  '.........KMMDDDDDK',
  '........KLMMDDDDDK',
  '.......KLMMMDDDDDDK',
  '......KLMMMDDDDDDDDK',
  '........KMMDDDDDK',
  '.......KLMMDDDDDDK',
  '......KLMMMDDDDDDDK',
  '.....KLMMMDDDDDDDDDK',
  '....KLMMMMDDDDDDDDDDK',
  '...KLMMMMDDDDDDDDDDDDK',
  '......KLMMDDDDDDK',
  '.....KLMMMDDDDDDDK',
  '....KLMMMDDDDDDDDDK',
  '...KLMMMMDDDDDDDDDDK',
  '..KLMMMMMDDDDDDDDDDDK',
  '.KLMMMMMMDDDDDDDDDDDDK',
  'KLMMMMMMMDDEDDDDDDDDDDK',
  '.KKKKKKKKKKEDDKKKKKKKK',
  '..........KEDDK',
  '..........KEDDK',
  '..........KEDDK',
  '..........KEDDK',
  '.........KEEDDDK',
  '.........KKKKKK'
];

const BUSH_ROWS = [
  '......KKKK....KKK',
  '....KKMLLMKKKKMLMKK',
  '...KMLMLLLMMMMLLMMK',
  '..KMLLLSLLMLMMMLMMMK',
  '.KMLLMLLMMMMEMMMMDMK',
  '.KMLLLMMLMMEMMMDMDMMK',
  'KMLMLMMMMMMMMDMDMDMMK',
  'KMMMMLMMMMMDDDDDDDMMK',
  'KMMMMMMMDMDDDDDDDDDMK',
  'KMDMMMMMMDDDDDDEDDDK',
  '.KMDMDMMDDDDDDEEDDDK',
  '.KKMDMDDDDDDDDDEDDKK',
  '...KKDDDDKDDDDDKK',
  '.....KKKKKKKKKK'
];

/* 16x16, tiles seamlessly — repeats as a hedge boundary. */
const HEDGE_ROWS = [
  'MLLLMMDMLLLMMDML',
  'LLLLLMDLLLLLMDLL',
  'MLLLMMDMLLLMMDML',
  'MMLMMDMMMLMMDMML',
  'DMMMDMMDMMMDMMDM',
  'MLLMMDMLLLMMDMLL',
  'LLLLMDMLLLLMDMLL',
  'MLLMMDMMLLMMDMML',
  'MMMDMMDMMMDMMDMM',
  'MDMMMDMMDMMMDMMD',
  'MMDMDMMMMDMDMMMM',
  'DMMMDMDMDMMMDMDM',
  'MDDMDDMDDMDDMDDM',
  'DDDDDDDDDDDDDDDD',
  'EDEDDEDEEDEDDEDE',
  'EEEEEEEEEEEEEEEE'
];

/* ---- THE BIG OAK -------------------------------------------
   Harmon Park's landmark, 124 wide by 152 tall — by far the
   biggest hand-placed grid in the game. The hollow ringed in K
   and E near the base is the future tree-climb entrance. */
const OAK_ROWS = [
  '.',
  '.',
  '....................................KKKK',
  '...................................KLLLLK',
  '..................................KLLLLLLK',
  '.................................KLLLLLLLLK',
  '............................KKKKKLLLLLLLLLLK',
  '.........................KKKLLLLLLLLLLLLLMLMKK.....................KKK..........KKK',
  '.......................KKLLLLLLLLLLLLLLMLMLMLKKKK..............KKKLMLK.......KKMMMKK',
  '.....................KKLLMLLLLLLLLLLLLMLMLMLMLMMMK...........KKLLLMMMLK.....KMMMMMMMKK',
  '....................KLLLLLLLLLMLLLLLLMLMLMLMLMMMMMK.......KKKLLLLMLDLMLK...KMMMMMMMMMMKKKKKKK',
  '...................KLLLLLLLLLLLLLLLLMLMLMLMLMMMMMMMKKKKKKKLLLLLLMLMLMLMLKKKMMMMMMMMMMMMMMMMMMK',
  '..................KLLLLLLLLLLLLLLLLMLMLMLMMMMMMMMMMLLLLLLLLLLLLMLMLMLMMMMKMLMDMMMMMMMMMDMMDMMMK',
  '.................KLLLLLLLLLLLLLLLLMLMLMMMMMMMMMMMMMLLLLLLLLLLLMLMLMLMLMDMKMMMMMMMMMMMMMMMMMMMMK',
  '.................KLLLLLLLLLLLLLLLMLMLMMMMMMMMMMMMLMLLLLLLLLLLMLMLMLMMMMMMDMMMMMMMMMMMMLMMMMMMMMK',
  '.................KLLLLLLLLLLLLMLMLMLMMMMMMMDMMMMMMMLLLLLLLLLMLMLMLDMMMMMMMMMMMMMMMMMMMMMMMMMMMMK',
  '.................KLLLLLLLLLLLMSMLMLMMMMMMMMMMMMMDMMLLLMLLLLMLMLMLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMK',
  '.................KLLLLLLLLLLMLMLMLMMMMMMMMMMMMMMMMMMLLLLLLMLMLMLMMDMMDMMMMMMMMMMMMMMMMMMMMMMMLMMKKKKKKKKK',
  '.................KLLLLLLLLLMLMLMLMMMMMMMDMMMMMMMMMMLLLLMMLMLMLMMMMMMMMMMMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKK',
  '.................KLLLLLLLLMLMLMMMMMMMMMMMMMMMMMMMMMMMLMLMLMLMLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMK',
  '.................KLLLLLLLMLMLMMMMMMMMMMMMMMMMMMMMMMMMMLMLMLMLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMMK',
  '.................KLLLLLLMLMLMDMMMMMMMMMMDMMMMMMMMMDMMLMLMLMLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMK',
  '................KLLLLLLLLMLMMMMMMMMMMMMMMMMMMMMMMMMMMMLMLMLMMMMDMMMMMMMMMMMMMMMMMMMMMMMMMDMMMMMMMMDMDMMMMMMMMMK',
  '................KLLLLLMLMLMLMMMMMMMMMMMMMMMMMMMMMMMMMMMLMLMMMMMMMMMMMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMMMMMMMMMMMMK',
  '...............KLLLLLMLMLMLMMMMMMMMMMMMMMMMMMMMMMMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '...............KLLLLMLMLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMDMK',
  '...............KLLLMLMLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMDMDK',
  '................KLMLMLMMMMMMMMMDMMMMMMMMMMMMMMMDMMMMMMMMMMMMMMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLMMMMMLMDMDMDMK',
  '.................KLMLMLMMMMMMMMMMMMMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMDMDMDK',
  '..................KLDMMMMMMMMMMMMMMMMMMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLMMMMMMMMMMMMMDMMMMDDMDMDMDDK',
  '...................KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMMMMMMMMMMMMMMMMMDMMMMMMMMMMMMMMMMMMMMMMMDMMMMMMMMDMDMDMDDDK',
  '...................KMMMMMMMMMMMMMMMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMMMMDMDMDMDMMDDDDK',
  '...................KMMMMMMMDMMMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLMMMMMMMMMMMMMMDMDMDMDMDDDDDDK',
  '...................KMMMMMMMMMMMMMMMMMMMMMMMMMMMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMMMMMMMMMMMMMMMMMMMDMDLDMDDDDDDDDK',
  '...............KKKKMMMMMMMMMMMMMMMMMMMMMMMMMMMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMDMDMDMDDDDDDDDDK',
  '..............KLLLLMMMMMMMMMMMMMMMMMMMMMMMMMMDMMMMMMDMMMMMMMMMMMMMMDMMMMMMMMMMMMMMMMMMMMMMMMMMMDMDMDMDMDDDDDMDDDDK',
  '.............KLLLLLMMMMMMMMMEEEMMMEEMMMMMMMMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMMMMMMMDMMMDMDMDMDDDDDDDDDDDDK',
  '............KLLLLLLMMMMMMMMMMMMEEEMMMMMMMMMDMMMMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMDMDDDDDDDDDDDDDDDK',
  '..........KKLLLMLLLLMMMMMMMMMMMMMMMMMMMMMMDMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMDMDMDDDDDDDDDDDDDDDK',
  '........KKLLLMLLLMLLLMMMMMMMMMMMMMMMMMMDMDMDMMMMLMMMMMMMMMMMMMMMMMMMDLMMMMMMMMMMMMMMDMMMMDMDMDMDMDDDDDDDDDDDDKK',
  '.......KLLLLLLLLLLLMLLMMMMMMMMMMMMMMMMDMDMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDDMDMDMDDDDDDDDDDDMMMK',
  '......KLLLLLLLMMLLMLMLMMMMMMMMMMMMMMMDMDMDMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMMMMMMMMMMDMDMDMDDDDDDDDDDDDMMDMMK',
  '......KMLLLLLLLLLDLMLMLMMMMMMMMMMMMMDMDMDMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMDMDDDDDDDDDDDDDDDMMMMMMK',
  '......KLLLLLLLLLMLMLMLMLMMMMMMMMMMMDMDMDMDDDMMMMMMMMMMMMMMMMMMMMMMMMMDMMMMMDMMMMMMMMMDMDDDDDDDDDDDDDDDDDMMLMDMMKK',
  '......KLLLLLLMLMLMLMMMMMMMMMMMMMMMDMDMDDDDDMMMMMMMMMMMMMMMMMMMMMMMMMMMELEMMMMMDMDMMMMMDMDDDDDDDDDDDDDDMMMMMMMMLMMKKK',
  '......KLLLLLMLMLMLMMMDMMMMMMMMMMMDMDMDDDMMMMMMMMLMMMMLMMMMMMMMMMMMMMMMMMMEEEMMMDMDMDMDMDMDDDDMMMMLMMMMMMMMMMMMMMMMMMK',
  '......KLLLLLLMLMLMMMMMMMMMMMMMMMMMDMDDMMMMMMEEEMMMEEEMMMMMMMMMMMMMMMMMMMMMMMDMDMDMDMDMDMDDDDMMMMDMMMMMMMMMDMMMMMMMMMMK',
  '.......KLLLMMLMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMEEEMMMEMMMMMMMMMMMMMMMMMMMMMDMDMDMDMDMDMDDDDMMMMMMMMMMMMMMMMMMMMMDMMMMMK',
  '.......KLLLMLMLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMMMMMMMMMMMMMMMMMMDMDMDMDMMMDMDDDDDDMMMMMMMMMMMMMMLMMMMMMMMMMMMMK',
  '.......KLLLLMLMMMMMMMDMDMMMMMMMDMMLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMDMDMDDDMDDDDDDDDMMMMMMMMMMMMMMMMMMMMMMMMMMDMDK',
  '.......KLLLMLMMMMMMMMMMMMMMMMMMMLMMMMMMMMMMMMMMMLMMMMMMMMMMMMMMMMMMMDMDMDMDMDMDDDDDDDDDDMMMMMMMMMMMMMMMMMMMMMMMDMMDMDMK',
  '.......KLLMLMLMMMMLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMDMDMDMDMDDDDDDDDDDDMMMMMMMMMMMMMMMMMMMMMMMMMDMDMDMK',
  '.......KLMLMLMMMMMMMMMMMMMMMMMMMMMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMDMDMDMDDDDDDDDDDDDMMLMMMMMMMMMMMMMMMMMMMMMDMDMDMDDK',
  '......KLMLMLMMDMMMMMMMMMMMMMMMMMMMMMMDMMMMMMMMMMMMMDMMMMMMMMMMMMMMMDMDMDMDMDDDDDDDDDDDDDMMMMMMMMMMMMMMDMMMMMMMMDMDMDMDDDDK',
  '......KMLMLMMMMMMMMMMMMMMMMMMMMMMMMMDMMMMMMMMMMMMMMMMMMMMMMDMMMMMMDMDMDMDDDDDDDDDDDDDDDDMMMMMMMMMMMMMMMMMMMMMMDMDMDMDDDDDDK',
  '.....KMLMLMMMMMMMMMMMMMMMMMMMMMMMMMMMDMMMMMMMMMMMMMDMMMLMMMMMMMMLDMDMDMDDDDDDDDDDDDDDDDDMMMMMMMMMMMMMMMMMMMMMDMDMDMDDDDDDDK',
  '....KMLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMDMMMMMMMMMMMMMMMMMMMMMMMDMDMDMDMDDDDDDDDDDDDDDDDDDMMMMMMMMMMMMMMMMMMMMDMDMDMDDMMDDDDDK',
  '....KMMMDMMMMMLMMMMMMMMMMMMMMMMDMMMDMDMMMMMMMMMMMDMMMMMMMMMMMDMDMDMMMDDDDDDDDDDDDDDDDMMMMMMMMMMMMMMMMMMMMDMDMDMDMDDDDDDDDDDK',
  '...KMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMDMDMMMMDMMMMMMMMMMMMMMEEEMDMEEDMDMDDDDDDDDDDDDDDDMMDMMMMMMMMMMMMMMMDMMMMDMDMDMDDDDDDDDDDDK',
  '...KMMMMMMMMMMMMMMMMMMMMMMMDMDMDMDMDMMMMMMMMMMMMMMMMMMMMMMMEEEMDMDMDDDDMDMDDDDMMMMMMMMMMMMMMMMMMMMMMMMDDMDMDMDMDDDDDDDDDDDDK',
  '....KMMMMMMMMMMMEEEMMMMMMMMMDLDMDMDMMMMMMMMMMMMMMMMMMMMMMMDMDMDMDMDDDDDDDDDDMMMMMMMMMMMMMMMMMMMMMMMMMMDMDMDDDDDDDDDDDDDDDDDK',
  '.....KMMMMMMMMMMMDMEEEMMMMMDMDMDMMMMMMMMMMMMMMMMMMMMMMMMMDMDMDMDMDDDDDDDDDDDMMMMMMMMMMMMMMMMMMMMMMMMMDMDMDDDDDDDDDDDDDDDDDDK',
  '......KMMMMMMMMMMMMMMMMMMMDMDMDMMMMMMMMMMMMMMMMMMMMMMMMMDMDMDMDMDDDDDDDDDDDMMMMMMMMMMMMMMMMMMMMMMMMMDMDMDDDDDDDDDDDDDDDDDDDK',
  '......KMMMMMMMMMMMMMMMMMMDMDMDMMMLMMMMMMMMMMMMMMMMMMMMMDMDMDMDMDDDDDDDDDDDMMMMMMMMMMMMMMMMMMMMMMMMMDMDMDDDDDDDDDDDDDDDDDDDK',
  '......KMMMMMMMMMMMMMMMMMDDDDDDMMMMMMMMMMMMMMMMMMMMMMMMDMDMMMMDDDDDDDDDDDDDMMMMMMMMDMMMMMMMMMMMMMMMDMDMDDDDDDDDDDDDDDDDDDDK',
  '......KMMMMMMMMMMMMMMMMDMDDDDDMMMMMMMDMMMMMMMMMMMMMMMDDDMMMMMMDDDDDDDDDDDDMMMMMMMMMMMMMMMMMMMMMMMDMDMDDDDDDDDDDDDDDDDMDKK',
  '......KMMMMMMMMMMMMMMMDMDMDDMMMMMMMMMMDMMMMMMMMMMMMMMMMMMMMMMMMMDDDDDMDDDMMMMMMMMMMMMMMMMMMMMMMMDMDDDDDDDDDDDDDDDDDDDKK',
  '......KMMMMMMMMMMMMMMDMDMDDMMMMMDMMMMMMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMMMMMMDMDDDDDDDDDDDDDDDDDK',
  '.......KMMMMMMMMMMMMDMDMDDMMMMMMMMMMMMMMDMMMMMMMMMDMMMMMMMMMMMMMMMMMMLMMMMMMMMMMMMMMMMMMMMMMDMMMMMDDDDDDDDDDDDDDDDDDK',
  '.......KMMMMMMMMMMMDMDMDDDMMMMMMMMMMMMMMMMDMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMMMMMMMMMMMMMMMMMDDDDDDDMDDDDDDDDDDK',
  '........KKKMMMMMDMDMDMDMDMMMMMMMMMMMMMMMMMDMMMMMMMMMDMMMLMMMMMMMMMMMMMMMMMMMMMMMMMMMMLMMMMMMMMMMDMDDDDDDDDDDDDDDDDK',
  '...........KKMMDMDMDMDDDMMMMMMMMMMMMMMMMMMMMMMMMDMMDMMMMMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMDMDMDMDDDDDDDDDKKKKK',
  '.............KDMDMDMDDDMMMMMMMMMMMMMMMMMMMMMMMMMMMDMDMMMMMMMMMMMMMMMMMMMMMMDMDMMMMMMMMMMMMLMDMDMDMDDDDDDDDDDDK',
  '..............KDMDMDDDDMMMMMMMMMMMMDMMMMMMMMMMMMMDMDMMMMMMMDMMMMLMMMMMMMMMMMMMMMMMMMMMMMMMMDMDDDMDDDDDDDDDDDDK',
  '...............KKMDDDDMMMMMMMMMMMMMMMMMMMMMMMMDMDMDMDMMMMMMMMMMMMDMMMMMMMMDMMMMMMMMMMMMMMMDMDMDMDDDDDDDDDDDDK',
  '.................KKDDMMMMMMMMMMMMMMMMMMMMMMMMMMDMDMDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDMDMDMDDDDDDDDDDDDK',
  '...................KKMMMMMMMMMDMMMMMMMMMMMMMDMDMDMDMMMMMMMMMMMMMMMMMMMMLDMDMMMMMMMMMMMDMDMDMDMDDDDDDDDDDDDDK',
  '.....................KMMMMMMMMMMMMMMMMMMMMMDMDMDMDMMMMMMMMMMMMMMMMMMMMMDMDMMMMMMMMMMMDMDMDMDMDDDDDDDDDDDDDK',
  '.....................KKDMMMMMMMMMMMMMMMMMMDMDMMMDDDMMMMMMMDMMMMMMMMMDMDMDMMMMMMMMMMMMMDMDMDMDDDDDDDDDDDDDK',
  '.....................KMMMMMMMMDMMMMMMMMMMDMDMDDDDDDMMMMMMMMMMMMMMMMDMDMDMDDMMMMMMMMMMDMDMDDDDDDDDDDDDDDDDK',
  '.....................KMMLMMMMMMMMMMMMMMMDMDMDDDDDDDMMMMMMMMMMMDMMMDMDMDDDDDMMMMMMMDMDMDMDMDDDDDDDDDDDDDDDK',
  '.....................KMMMMMMMMMMMMMMLMMDMDMDDDDDDDMMMMMMMMMMMMMMMDMDMMMDDDDDMMMDMDMDMDMDDDMDDDDDDDDDDDDDDDK',
  '.....................KMMMMMMMMMMMMMMMMDMDMDDDDDDDMMMMMMMMMMDMMMMDMDMMMDDDDDDMMMMDMDMDMDDDDDDDMDDDDDDDDDDMDK',
  '.....................KMMMMMMMDMMMMMMMDMDMDDDDDDDDMMMMMMMMMMMMMMDMDMDDDDDDDDDMMMDMDMDMDDDDDDDDDDDDDDDDDDDDDK',
  '.....................KMMMMMMMMMMMMMMDMDMDDDDDDDDMMMMMMMMMMMMMMDMDMDDDDDDDDDDMMDMDMDMDDDDDDDDDDDDDDDDDDDDDDK',
  '......................KMMMMMMMMMMMMDMDDDDDDDDDDDMMMMMLMMMMMMMDMDMDDDDDDDDDDDMMMDMDMDDDDDDDDDDDDDDDDDDDDDDDK',
  '.......................KKKKMMMMMDMDMDMDDMDDDDDDDMMMMMMDMMMMMDLDMDDDDDMDDDDDDDMDMDMDDDDDDDDDDDDDDDDDDDDDDDK',
  '.........................KDKMMMDMDMDMDDDDDDDDDDMMMMDMMMMMDMDMDDDDDDMDDDDMDDDMDMDMDDDDDDDDDDDDDDDDDDDDDDKK',
  '.........................KDKMMDMDMDMMDDDDDDDDDDMMMMMMMMMDMDMDMDDDDDDDDDDDDDMDDDMDDDDDDDDDDDDDDDDDDDDKKK',
  '.........................KDDKDMDMDMDDDDDDDDDDDMMMMMMMMMDMDMDMDDDDDDDDDDDDDDDMDMDDDDDDDDDDDDDDDDKDDKK',
  '.........................KEDKMDMDMDDDDDMMDDDKMMMMMMMMMDMDMDMDDDDDDDDDDDDDDDMDMDDDDDDDDDDDDDDKKKEKK',
  '..........................KEKDMDMMDDDDDDDDDKKKMMMMMMMDMDMDMDDDDDDDDDDDDDDDMDDDDDDDDDDDDDDDMKDEKK',
  '...........................KKMDMDDDDDDDDDDK...KMMMMMDMDMDMDDDDDDDDDDDDDDDMMDDDDDDDDDDDDDDDKEEK',
  '............................KDMDDDDDDDDDKKK....KMDMDMDMDMDDDDDDDDDDDDDDDKDDDDDDDDDDDDKKKKKEKK',
  '.............................KKDDDDDDDKKDDKK....KMDMDLDMDDMDDDDDDDDDDDDKEKDDDDMDDDDKKDDDEEK',
  '...............................KKDDDDKDDDDDDKK..KKMDMDMDDDDDDDDDDDDMDDKEEEKDDDDDDKKDDDEEKK',
  '.................................KKKKEEDDDDDDDKKKEKMDDDDDDDDDDDDKKKKKKEEEEKDDDDDKDDDDEKK',
  '.....................................KKEDDDDDDDDKKEKDDDDDDDDDDDKEEEEEEEEDEEKKKKKDDDEEK',
  '.......................................KEEDDDDDDDDEEKDDDDDDDDDKEEEEEEEEMDDEDDDDDDEEKK',
  '........................................KKEEDDDDDDDDEKDDMDDDDDKEEEEEEEMMMDDDDDDDEKK',
  '..........................................KKEEDDDDDDDEKDDDDDDKEEDDDDMMMMDDDDDDEEK',
  '............................................KKEEDDDDDEEKKDDKKEEDDDDDMMMMDDDDDEKK',
  '..............................................KKEEDDDEEEEKKEEEEDDDDDMMMMDDDEEK',
  '................................................KKEEDEEEEEEEEEDDDDDDMMMMDEEDK',
  '.................................................KEEEEEEEEEEEDDDDDDMMMMMEDDK',
  '.................................................KEEEEEDDEEDDDDDDDDMMMMMDDDK',
  '................................................KEEEEEDDEDDDDDDDDDMMMMMDDDK',
  '................................................KEEEEEDDEDDDDDDDDDMMMMMDDDK',
  '................................................KEEEEEDDEDDDDDDDDDMMMMMDDDK',
  '................................................KEEEEEDDEDDDDDDDDDMMMMMDDDK',
  '.................................................KEEEEEDEDDDDDDDDDDMMMMMDDDK',
  '.................................................KEEEEEDEDDDDDDDDDDMMMMMDDDK',
  '..................................................KEEEEEEDDDDDDDDDEDMMMMMDDDK',
  '..................................................KEEEEEEDDDDDDDDDEDMMMMMDDDK',
  '..................................................KEEEEEEDDDDDDDDDEDMMMMMDDDK',
  '..................................................KEEEEEEDDDDDDDDDEDMMMMMDDDK',
  '.................................................KEEEEEDEDDDDDDDDDEMMMMMDDDK',
  '.................................................KEEEEEDEDDDDDDDDDEMMMMMDDDK',
  '................................................KEEEEEDDDDDDDDDDDDEMMMMDDDK',
  '................................................KEEEEEDDDDDDDDDDDDEMMMMDDDK',
  '................................................KEEEEEDDDDDDDDDDDDEMMMMDDDK',
  '................................................KEEEEEDDDDDDDDDDDDEMMMMDDDK',
  '................................................KEEEEEDDDDDDDDDDDDEMMMMDDDK',
  '.................................................KEEEEEDDDDDDDDDDDEMMMMMDDDK',
  '.................................................KEEEEEDDDDDEDDDDDEMMMMMDDDK',
  '..................................................KEEEEEDDDDEDDDDDEDMMMMMDDDK',
  '..................................................KEEEEEDDDDEDEDDDDDMMMMMDDDK',
  '..................................................KEEEEEDDDEEEEEEEDDMMMMMDDDK',
  '..................................................KEEEEEDEEEEEEEEEEEMMMMMDDDK',
  '.................................................KEEEEEDEEEEEEKEEEEEEMMMDDDK',
  '.................................................KEEEEEEEEEKKKKKKKEEEEMMDDDK',
  '................................................KEEEEEDEEEKKKKKKKKKEEEMDDDK',
  '................................................KEEEEEEEEKKKKKKKKKKKEEEDDDK',
  '................................................KEEEEEEEEKKKKKKKKKKKEEEDDDK',
  '................................................KEEEEEEEKKKKKKKKKKKKKEEDDDK',
  '.................................................KEEEEEEKKKKKKKKKKKKKEEMDDDK',
  '.................................................KEEEEEEKKKKKKKKKKKKKEEEDDDK',
  '..................................................KEEEEEKKKKKKKKKKKKKEEMMDDDK',
  '..................................................KEEEEEKKKKKKKKKKKKKEEMMDDDK',
  '..................................................KEEEEEEKKKKKKKKKKKEEEMMDDDK',
  '..................................................KEEEEEEKKKKKKKKKKKEEEMMDDDK',
  '...............................................KKKEEEEEEEEKKKKKKKKKEEEMMDDDKKK',
  '............................................KKKDDDEEEEEEEEEKKKKKKKEEEEMMDDDDDDKKK',
  '.........................................KKKDDDDEEEEEDDDEEEEEEKEEEEEEMMMDDDKDDDDDKKK',
  '......................................KKKDDDDDDDEEEEEDDDDEEEEEEEEEEEMMMMDDDDDDDDDDDDKKK',
  '.....................................KDDDDDDDDDEEEEEEDDDDDDEEEEEEEDMMMMMMDDDDDDDDDDDDDDK',
  '......................................KKKKDDDDEEEEEEDDDDDDDDDDEDDDDMMMMMMDDDDDDDDDDKKKK',
  '..........................................KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  '.',
  '.',
  '.',
  '.'
];


/* ---- Prairie Village buildings: typed letter-grid pixel art ----
   Same technique and six-role palette as the trees. Draw with:
   drawPixels(ctx, ROWS, pal)  -- no scale, native pixels. */

const HOUSE_MAIN_ROWS = [
  '.................................................................................................................................................KKKKKKKKKKKKKK',
  '..................................................................................................................................................KLLLLLLLLLLK',
  '..................................................................................................................................................KLMMMMMMMMDK',
  '..................................................................................................................................................KLMMMMMMMMDK',
  '..................................................................................................................................................KLMMMMMMMMDK',
  '..................................................................KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK....KLMMMMMMMMDK',
  '................................................................KKKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKKK..KLMMMMMMMMDK',
  '...............................................................KKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKK.KLMMMMMMMMDK',
  '.............................................................KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKKLMMMMMMMMDK',
  '...........................................................KKKEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEKLMMMMMMMMDK',
  '..........................................................KKMDDDDDDDDDDDDMDDDDDDDDDDDDDDDDDDDDDDDMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKLMMMMMMMMDK',
  '........................................................KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKLMMMMMMMMDK',
  '......................................................KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKLMMMMMMMMDK',
  '.....................................................KKMDMDDDDDDDDDDDDDDDDDDDDDDDDDMDDMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKLMMMMMMMMDK',
  '...................................................KKKDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDKLMMMMMMMMDK',
  '.................................................KKKDDDDDDDDDDDDDDDDDDDDDDDMDDMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKLMMMMMMMMDKK',
  '................................................KKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDMDMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKLMMMMMMMMDKKK',
  '..............................................KKKDDDDDDDDDDDDDDDDDDDDDDDMDDDDDMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKLMMMMMMMMDKDKKK',
  '............................................KKKDDDDDDDDDDDDDDDDDDDDDDMDDDDDDDDDDDDDDDDDDDDDDDDDDDMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKLMMMMMMMMDKDDDKKK',
  '...........................................KKMEEEEDDDDEEEEEDDDDEEEEEDMDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEKLMMMMMMMMDKDDDDEKK',
  '.........................................KKKDDDDDDDMDDDDDDDMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKKKKKKKKKKKDDDDDDKKK',
  '.......................................KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEEEEEEEEEEEEDDDDDDKKK',
  '......................................KKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEEEEEEEEEEEDDDDDDDEKK',
  '....................................KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKK',
  '..................................KKKEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEKKK',
  '.................................KKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKK',
  '...............................KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKK',
  '.............................KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKK',
  '............................KKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKK',
  '..........................KKKDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEKKK',
  '........................KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKK',
  '.......................KKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKK',
  '.....................KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKK',
  '...................KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKK',
  '..................KKMEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDEKK',
  '................KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKK',
  '..............KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKK',
  '.............KKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKK',
  '...........KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKK',
  '.........KKKDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEKKK',
  '........KKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKK',
  '......KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKK',
  '....KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKK',
  '...KKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKK',
  '.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEDK',
  '.......KLEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMDDMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMDDMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMDDMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMDK',
  '.......KLMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMDDMMMMMMMDDMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMDDMMDK',
  '.......KLMMMMMMDDMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMKKKKKKKKKKKKKKKKKKKKKKKKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMDDMMMMMMMKKKKKKKKKKKKKKKKKKKKKKKKMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMDDMMMMMMDDMMMMMMMMDDMMMMKSLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKSLLLLLLLLLKLLLLLLLLLLMKMMMDDMMMDDMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMDDDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMDDMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMDDMMMMMMMMMMMMMMMMMMMDKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMDDMMMMMMMMMMMMMMMMMMDDDMMMMMMMDDMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKDDMMMDDMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMKKKKKKKKKKKKKKKKKKKKKKKKDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLLLLLLLLLLLLLLLLLLLLLLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKKKKKKKKKKKKKKKKKKKKKKKKMMMMMMMMMMMMMMMMDDMMMMMMMDK',
  '.......KLMMMMDDMMMMMMMMMMMMMMMDDMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMDDMDDMMMMMMMMMMMMMLKKKKKKKKKKKKKKKKKKKKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKDDMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMDDDDMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMDDMMMMDDMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMDDMMMMMMMDDMMMMMMMDDKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMDDMMMMMMMMMMMMMMDDMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMDDDMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLLLKLLLLLLLLLLMKMMMMMMMMMMMMDDMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMKMMMMMMMMMMKMMMMMMMMMMMKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMKMMMMMMMMMMKMMMMMMMMMMMKMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMKKKKKKKKKKKKKKKKKKKKKKKKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLDMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMKKKKKKKKKKKKKKKKKKKKKKKKMMMMMMMMMMDDMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMDDDMMMKKKKKKKKKKKKKKKKKKKKKKKKKKMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMKKKKKKKKKKKKKKKKKKKKKKKKKKMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMDK',
  '.......KLMMMMDDDDMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMDDMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMDDMMMMMMMMMMDDMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDESDEKLMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMDDMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMDDMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMDDMMMMMMMDDMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMDDMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMDDMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMDDMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMLKDDEDDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKEEEEEEEEEEEEEEEEEEKLMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMDDMMMMMMMMMMMMDDMMMMMMMMMMMMDK',
  '.......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKKKKKKKKKKKKKKKKKKKKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.......KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  '',
];
// HOUSE_MAIN_ROWS: 207w x 112h

const HOUSE_CROSSGABLE_ROWS = [
  '',
  '...................................................................................................KKKKKKKKKKKK',
  '....................................................................................................KMMMMMMMMK',
  '....................................................................................................KMDDDDDDEK',
  '....................................................................................................KMDDDDDDEK',
  '....................................................................................................KMDDDDDDEK',
  '....................................................................................................KMDDDDDDEK',
  '............................................KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK...KMDDDDDDEK',
  '...........................................KKLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLDKK..KMDDDDDDEK',
  '.........................................KKKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKKKKMDDDDDDEK',
  '........................................KKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDKMDDDDDDEK',
  '......................................KKKDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMKMDDDDDDEK',
  '.....................................KKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKMDDDDDDEK',
  '...................................KKKMMMMMMMMMMMLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKMDDDDDDEK',
  '..................................KKLMMMLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKMDDDDDDEK',
  '................................KKKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKMDDDDDDEK',
  '...............................KKLMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDKMDDDDDDEK',
  '.............................KKKMMMMMMMMMMMMMMMMLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKMDDDDDDEKK',
  '............................KKLMMMMMLMMLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKKKKKKKKKKKKK',
  '..........................KKKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMEEEEEEEEEEEKK',
  '.........................KKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMEEEEEEEEEEMKKK',
  '.......................KKKDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDKK',
  '......................KKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKKK',
  '....................KKKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLDKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDKK',
  '...................KKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLMMDKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKKK',
  '.................KKKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLDDMMDKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDKK',
  '................KKLMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMMKLMMMMMMDKDDDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDDKKK',
  '..............KKKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLMMMMMMMMDKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDKK',
  '.............KKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLMMMMMMMMMMDKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDKK',
  '...........KKKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLDDMMMDDDDMMMDKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKKK',
  '..........KKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLMMMMMMMMMMMMMMDKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDKK',
  '........KKKDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMKLMMMMMMMMMMMMMMMMDKMDDDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDDDDDMMMMDDDKKK',
  '.......KKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLMMMMMMMMMMMMMMMMMMDKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDKK',
  '.....KKKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLDDMMMDDDDMMMDDDDMMMDDKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKKK',
  '....KKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLMMMMMMMMMMMMMMMMMMMMMMDKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDKK',
  '..KKKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLMMMMMMMMMMMMMMMMMMMMMMMMDKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKKK',
  '.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKLMMMMMMMMMMMMMMMMMMMMMMMMMMDKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKLDDMMMDDDDMMMDDDDMMMDDDDMMMDDDKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEK',
  '......KMEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEEEDDDDDDDKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKLDDMMMDDDDMMMDDDDMMMDDDDMMMDDDDMMMDDDDKDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDEEDDDDDDDDEK',
  '......KMDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDEEDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDEEDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKEDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKEEDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKEEDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDDDDDDKKKKKKKKKKDDDDDDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDKMDDDDDDDDDDDKSLLKLLLMKDDDDDDDDDDDEKEEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDKMDDDDDDDDDDDKLLLKLLLMKDDDDDDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDKMDDDDDDDDDDDKLLLKLLLMKDDDDDDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDKKKKKKKKKKKKKKKKKKKKDDDDDDDDDDDDDDDDDDKMDDDDDDDDDDDKLLLKLLLMKDDDDDDDDDDDEKEEDDDDDDDDDDDDDDKKKKKKKKKKKKKKKKKKKKDDDDDDDDEK',
  '......KMDEEDDDKSLLLLLLLKLLLLLLLLMKDDDDDDDDDDEEDDDDDDKMDDDDDDDDDDDKKKKKKKKKKDDDDDDDDDDDEKEEDDDDDDDDDDDDDDKSLLLLLLLKLLLLLLLLMKDDEEDDDDEK',
  '......KMDDDDDDKLLLLLLLLKLLLLLLLLMKDDDDDDDDDDDDDDEEDDKMDDDDDDDDDDDKLLLKLLLMKDDDDDDDDDDDEKEEDDDDDDDDDDDDDDKLLLLLLLLKLLLLLLLLMKDDDDDDDDEK',
  '......KMDDDDDDKLLLLLLLLKLLLLLLLLMKDDDDDDDEEDDDDDDDDDKMDDDDDDDDDDDKLLLKLLLMKDDDDDDDDDDDEKEEDDDDDDDDDDDDDDKLLLLLLLLKLLLLLLLLMKDDDDDDDDEK',
  '......KMDDDDDDKLLLLLLLLKLLLLLLLLMKDDDDDDDDDDDDDDDDDDKMDDDDDDDDDDDKLLLKLLLMKDDDDDDDDDDDEKEEDDDDDDDDDDDDDDKLLLLLLLLKLLLLLLLLMKDDDDDDDDEK',
  '......KMDEEDDDKLLLLLLLLKLLLLLLLLMKDDDDDDDDDDDDDDDDDDKMDDDDDDDDDDDKMMMKMMMMKDDDDDDDDDDDEKEEDDDDDEEDDDDDDDKLLLLLLLLKLLLLLLLLMKDDDDDDDDEK',
  '......KMDDDDDDKLLLLLLLLKLLLLLLLLMKDDDDDDDDDDDDDDDDDDKMDDDDDDDDDDDKKKKKKKKKKDDDDDDDDDDDEKEEEEDDDDDDDDDDDDKLLLLLLLLKLLLLLLLLMKDDDDDDDDEK',
  '......KMDDDDDDKLLLLLLLLKLLLLLLLLMKDDDDDDDDDDDDDDDDDDKMDDDDDDDDDDKKKKKKKKKKKKDDDDDDDDDDEKEEDDDDDDDDDDDDDDKLLLLLLLLKLLLLLLLLMKDDDDDDDDEK',
  '......KMDDDDDDKKKKKKKKKKKKKKKKKKKKDDDDDDDEEDDDDDDDDDKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKEEDDDDDDDDDDDDDDKKKKKKKKKKKKKKKKKKKKDDDDDDDDEK',
  '......KMDDDDDDKLLLLLLLLKLLLLLLLLMKDDDDDDDDDDDDDDEEDDKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKEEDDDDDDDDDDDDDDKLLLLLLLLKLLLLLLLLMKDDDDDDDDEK',
  '......KMDDDDDDKLLLLLLLLKLLLLLLLLMKDDDDDDDDDDDDDDDDDDKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKEEDDDDDDDDDDDDDDKLLLLLLLLKLLLLLLLLMKDDDDDDDDEK',
  '......KMDDDDDDKLLLLLLLLKLLLLLLLLMKDDDDDDDDDDDDDDDDDDKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKEEDDDDDDDDDDDDDDKLLLLLLLLKLLLLLLLLMKDDDDDDDDEK',
  '......KMDDDDDDKLLLLLLLLKLLLLLLLLMKDDDDDDDDDDDDEEDDDDKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKEEDEEDDDDDDDDDDDKLLLLLLLLKLLLLLLLLMKDDDDDDEEEK',
  '......KMDDDDDDKLLLLLLLLKLLLLLLLLMKDDDDDDDDDDDDDDDDDDKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKEEDDDDDDDDDEEDDDKLLLLLLLLKLLLLLLLLMKDDDDDDDDEK',
  '......KMDDEEDDKLLLLLLLLKLLLLLLLLMKDDDDDDDDDDEEDDDDDDKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKEEDDDDDDDDDDDDDDKLLLLLLLLKLLLLLLLLMKDDDDDDDDEK',
  '......KMDDDDDDKMMMMMMMMKMMMMMMMMMKDDDDDDDDDDDDDDDDDDKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKEEDDDDDDDDDDDDDDKMMMMMMMMKMMMMMMMMMKDDDDDDDDEK',
  '......KMDDDDDDKKKKKKKKKKKKKKKKKKKKEDEEDDDDDDDDDDDDDDKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKEEDDDDDDDDDDDDDDKKKKKKKKKKKKKKKKKKKKDDDDDDDDEK',
  '......KMDDDDDKKKKKKKKKKKKKKKKKKKKKKDDDDDDDDDDDDDDDDDKMDDDDDDLLLLLLLLLLLLLLLLLLLLDDDDDDEKEEDDDDDDDDDDDDDKKKKKKKKKKKKKKKKKKKKKKDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDKMDDDDDDLKKKKKKKKKKKKKKKKKKLDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEEDDDDDDDDDDDDDDDDEEDDDDEEDDDEEDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDDEEDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEESEEKLDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDEEDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDEEDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDKMDDDDDDLKEEEEEEEEEEEEEEEEKLDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDEK',
  '......KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMDDDDDDLKKKKKKKKKKKKKKKKKKLDDDDDDEKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '......KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  '',
];
// HOUSE_CROSSGABLE_ROWS: 139w x 100h

const HOUSE_WRAPPORCH_ROWS = [
  '...............................................................................................KKKKKKKKKKKKK',
  '................................................................................................KLLLLLLLLLK',
  '................................................................................................KLMMMMMMMDK',
  '................................................................................................KLMMMMMMMDK',
  '................................................................................................KLMMMMMMMDK',
  '........................................KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKLMMMMMMMDKKKKK',
  '......................................KKKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLMMMMMMMDKMMMKKK',
  '....................................KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKLMMMMMMMDKDDDDDKKK',
  '..................................KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKLMMMMMMMDKDDDDDDDKKK',
  '................................KKKEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDKLMMMMMMMDKEEEDDDDEEKKK',
  '..............................KKKDDDDDDDDDDDDDDDMDDDDDDDDDDDDDDDDDDDDDDDMDDDDDDDDDDDDDDDDDDDDDDDKLMMMMMMMDKDDDDDDDDDDDKKK',
  '............................KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKLMMMMMMMDKDDDDDDDDDDDDEKK',
  '..........................KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKKKKKKKKKKDDDDDDDDDDDDDDKKK',
  '........................KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEEEEEEEEEEEDDDDDDDDDDDDDDKKK',
  '......................KKKEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEEEEEEEEEEEEDDEEEEEDDDDEEEEEKKK',
  '....................KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKK',
  '...................KKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKK',
  '.................KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKK',
  '...............KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKK',
  '.............KKKDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDKKK',
  '...........KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKK',
  '.........KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKK',
  '.......KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKK',
  '.....KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKK',
  '...KKKEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEEEDDDDEEEKKK',
  '.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  '......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '......KLEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEDK',
  '......KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '......KLMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMDDMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '......KLMMMMMMMMMDDMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDDK',
  '......KLMMMMMMMMMMMMMMMMDDMMMMMMMMDDDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '......KLMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '......KLMMMMMDDMMMMMMMMMMMMDDMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMDK',
  '......KLMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMDDMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '......KLMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  'KMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMK',
  'KDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDK',
  'KDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDK',
  'KDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDK',
  'KDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDK',
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  '......KEEEKLKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKLKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKLKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKLKEEK',
  '......KEEEKLKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKLKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKLKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKLKEEK',
  '......KLMMKLKMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMKLKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLKMMMMMDDMMMMMMMMMMMDDMMMMMMMMMDDMMMKLKDDK',
  '......KLMMKLKMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMKLKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLKMDK',
  '......KLMMKLKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLKMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMKLKMDK',
  '......KLMMKLKMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMKLKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLKMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMKLKMDK',
  '......KLMMKLKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLKMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMDDMMMMMMMMMMMKLKMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMKLKMDK',
  '......KLMMKLKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLKMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMKLKMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMKLKMDK',
  '......KLMMKLKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMKLKMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMKLKMDK',
  '......KLMMKLKMMMMMMMKKKKKKKKKKKKKKKKKKMMMMMMMMMKLKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLKDMMMMMMMKKKKKKKKKKKKKKKKKKMMMMMMMMKLKMDK',
  '......KLMMKLKMMMMMMMKSLLLLLLKLLLLLLLMKMMMMMMMMMKLKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDDMMMMMMMDDMMMMMMKLKMMDDMMMMKSLLLLLLKLLLLLLLMKDMMMMMMMKLKMDK',
  '......KLMMKLKMMMMMMMKLLLLLLLKLLLLLLLMKMMMMMMMMMKLKMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLKMMMMMMMMKLLLLLLLKLLLLLLLMKMMMMMMMMKLKMDK',
  '......KLMMKLKMMMMMMMKLLLLLLLKLLLLLLLMKMMMMDDMMMKLKMMMMMMMMMMMMMMMMLLLLLLLLLLLLLLLLLLMMMMMMMMMMMMMMMMMKLKMMMMMMDDKLLLLLLLKLLLLLLLMKMMMMMMMMKLKMDK',
  '......KLMMKLKMMMMMMMKLLLLLLLKLLLLLLLMKMMMMMMMMMKLKMMMMMMMMMMMMMMMMLKKKKKKKKKKKKKKKKLMMMMMMMMMMMMMMMMMKLKMMMMMMMMKLLLLLLLKLLLLLLLMKMMMMMMMMKLKMDK',
  '......KLMMKLKMMMMMMMKLLLLLLLKLLLLLLLMKMMMMMMMMMKLKMMMMMMMDDMMMMMMMLKDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMKLKMMMMMMDDKLLLLLLLKLLLLLLLMKMMMMMMMMKLKMDK',
  '......KLMMKLKMMMMMMMKLLLLLLLKLLLLLLLMKMMMMMMMMMKLKMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMKLKMMMMMMMMKLLLLLLLKLLLLLLLMKMMMMMMMMKLKMDK',
  '......KLMMKLKMMMMMMMKKKKKKKKKKKKKKKKKKMMMMMMMMMKLKMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMKLKMMMMMMMMKKKKKKKKKKKKKKKKKKMMMMMMMMKLKDDK',
  '......KLMMKLKMMMMMMMKLLLLLLLKLLLLLLLMKDMMMMMMMMKLKMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDEKLDDMMMMMMMMMMMMMMMKLKMMMMMMMMKLLLLLLLKLLLLLLLMKMMMMMMMMKLKMDK',
  '......KLMMKLKMMMMMMMKLLLLLLLKLLLLLLLMKMMMMMMMMMKLKMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMKLKMMMMMMMMKLLLLLLLKLLLLLLLMKMMMMMMMMKLKMDK',
  '......KLMMKLKMMMMMMMKLLLLLLLKLLLLLLLMKMMMMMMMMMKLKMMMMMMMMMDDMMMMMLKDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMKLKDMMMMMMMKLLLLLLLKLLLLLLLMKMMMMMMMMKLKMDK',
  '......KLMMKLKMMMMMMMKLLLLLLLKLLLLLLLMKMMMMMMMMMKLKMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMKLKMMMMMMMMKLLLLLLLKLLLLLLLMKMMMMMMMMKLKMDK',
  '......KLMMKLKMMMMMMMKLLLLLLLKLLLLLLLMKMMMMMMMMMKLKMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMKLKMMMMMMMMKLLLLLLLKLLLLLLLMKMMMMMMMMKLKMDK',
  '......KLMMKLKMMMMMMMKMMMMMMMKMMMMMMMMKMMMMMMMMMKLKMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMKLKMMMMMMMMKMMMMMMMKMMMMMMMMKMMMMMMDDKLKMDK',
  '......KLMMKLKMMMMMMMKKKKKKKKKKKKKKKKKKMMMMMMDDMKLKMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMKLKMMMMMMMMKKKKKKKKKKKKKKKKKKMMMMMMMMKLKMDK',
  '......KLMMKLKDDDMMMKKKKKKKKKKKKKKKKKKKKMMMMMMMMKLKMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDEKLMMMMDDMMMMMMMMMMMKLKMMMMMMMKKKKKKKKKKKKKKKKKKKKMDDMMMMKLKMDK',
  '......KLMMKLKDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLKDMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMKLKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLKMDK',
  '......KLMMKLKMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMKLKMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMKLKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLKMDK',
  '......KLMMKLKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLKMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDDEKLMMMMMMMMMMMMMMMMMKLKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLKMDK',
  '......KLMMKLKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLKMMMMMMMMMMMMMMMMLKDDEDDDEDDDESDEKLMMMMMMMMMMMMMMMMMKLKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLKMDK',
  '......KLMMKLKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKMMLKDDEDDDEDDDEDDEKLMMKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKLKMDK',
  '......KLMMKLKLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLMMLKDDEDDDEDDDEDDEKLMMLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLKLKMDK',
  '......KLMMKLKMMDMMMMDMMMMDMMMMDDMMMDMMMMDMMMMDMKLKDMMMMDMMMMDMMMMMLKDDEDDDEDDDEDDEKLMMMMDMMMMDMMMMDMMKLDMMMMDMMMMDMMMMDMMMMDMMMMDMMMMDMMMMKLKMDK',
  '......KLMMKLKMMDMMMMDMMMMDDDMMDMMMMDMMMMDMMMMDMKLKDMMDDDMMMMDMMMMMLKDDEDDDEDDDEDDEKLMMMMDMMMMDMMMMDMMKLDMMMMDMMMMDMDDMDMMMMDMMMMDMMMMDMMMMKLKMDK',
  '......KLMMKLKMMDMMMMDDMMMDMMMMDMMMMDMMMMDMMMMDMKLKDMMMMDMMMMDMMMMMLKDDEDDDEDDDEDDEKLMMMMDMMMMDMMMMDMMKLDDMMMDMMMMDMMMMDMMMMDMMMMDMMMMDMMMMKLKMDK',
  '......KLMMKLKMMDMMMMDMMMMDMMMMDMMMMDMMMMDMMMMDMKLKDMMMMDMMMMDMMMMMLKDDEDDDEDDDEDDEKLMMMMDMMMMDMMMMDMMKLDMMMMDMMMMDDMMMDMMMMDMMMMDMMMMDMMMMKLKMDK',
  '......KLMMKLKMMDDDMMDMMMMDMMMMDMMMMDMMMMDMMMMDMKLKDMMMMDMMMDDMMMMMLKDDEDDDEDDDEDDEKLMMMMDMMMMDMMMMDMMKLDMMMMDMMMMDMMMMDMMMMDMMMMDMMMMDMMMMKLKMDK',
  '......KLMMKLKMMDMMMMDMMMMDMMMMDMMMMDMMMMDMDDMDMKLKDMMMMDMMMMDMMMMMLKDDEDDDEDDDEDDEKLMMMMDMMMMDMMMMDMMKLDMMMMDMMMMDMDDMDMMMMDMMMMDMMMMDMMMMKLKMDK',
  '......KLMMKLKMMDMMMMDMMMMDMMMMDMMMMDMMMMDMMMMDMKLKDMMMMDMMMMDMMMMMLKDDEDDDEDDDEDDEKLMMMMDMMMMDMMMMDMMKLDMMMMDMMMMDMMMMDMMMMDMMMMDMMMMDMMMMKLKMDK',
  '......KLMMKLKMMDMMMMDMMMMDMMMMDMMMMDMMMMDMMMMDMKLKDMMMMDMMMMDMMMMMLKDDEDDDEDDDEDDEKLMMMMDMMMMDMMMMDMMKLDMMMMDMMMMDMMDDDMMMMDMMMMDMMMMDMMMMKLKMDK',
  '......KLMMKLKDMDMMMMDMMMMDMMMMDMMMMDMMMMDMMMMDMKLKDMMMMDMMMMDMMMMMLKDDEDDDEDDDEDDEKLMMMMDMMMMDDMMMDMMKLDMMMMDMMMMDMMMMDMMMMDMMMDDMMMDDMMMMKLKMDK',
  '......KLMMKLKMMDMMMMDMMMMDMMMMDMMMMDDDMMDMMMMDMKLKDMMMMDMMMMDMMMMMLKDDEDDDEDDDEDDEKLMMMMDMMMMDMMMMDMMKLDMMMMDMMMMDMMMMDMMMMDMMMMDMMMMDMMMMKLKMDK',
  '......KLMMKLKMMDDDMMDMMMMDMMMMDMMMMDMMMMDMMDDDMKLKDMMMMDMMMMDMMMMMLKDDEDDDEDDDEDDEKLMMMMDMMMMDMMMMDMMKLDMMMMDMMMMDMMMMDMMMMDDDMMDMMMMDMMMMKLKMDK',
  '......KLMMKLKMMDMMMMDMMMMDMMMMDMMMMDMMMMDMMMMDMKLKDMMMMDMMMMDMMMMMLKDDEDDDEDDDEDDEKLMMDDDMMMMDMMMMDMMKLDMMMMDDMMMDMMMMDMMMMDMMMMDMMMMDMMMMKLKMDK',
  '......KLMMKLKMMDMMMMDMMMMDMMMMDMMMMDMMMMDMMMMDMKLKDMMMMDMMMMDMMMMMLKEEEEEEEEEEEEEEKLMMMMDMMMMDMMMMDMMKLDMMMMDMMMMDMMMMDMMMMDMMMMDMMMMDMMMMKLKMDK',
  '......KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  '',
  '',
];
// HOUSE_WRAPPORCH_ROWS: 150w x 90h

const HOUSE_DORMER_ROWS = [
  '.........................................................................................KKKKKKKKKKKKK',
  '..........................................................................................KLLLLLLLLLK',
  '..........................................................................................KLMMMMMMMDK',
  '..........................................................................................KLMMMMMMMDK',
  '........................................................KKKKKKKKKKKKKKKKK.................KLMMMMMMMDK',
  '.......................................................KKDDDDDDDDDDDDDDEKK................KLMMMMMMMDK',
  '......................................................KKDEEEEEEEEEEEEEEEEKK...............KLMMMMMMMDK',
  '....................................................KKKEEEEEEEEEEEEEEEEEEEKKK.............KLMMMMMMMDK',
  '...................................................KKDDEEEEEEEEDDDEEEEEEEEDDKK............KLMMMMMMMDK',
  '..................................................KKDEEEEEEEEEEEEEEEEEEEEEEEEKK...........KLMMMMMMMDK',
  '.................................................KKDEEEEEEEEEEEEEEEEEEEEEEEEEEKK..........KLMMMMMMMDK',
  '................................................KKDEEEEEEEEEEEEEEEEEEEEEEEEEEEEKKK........KLMMMMMMMDK',
  '..............................................KKKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK.......KLMMMMMMMDK',
  '.............................................KKDEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEKK......KLMMMMMMMDK',
  '............................................KKDEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK.....KLMMMMMMMDK',
  '...........................................KKDEEEEDEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK....KLMMMMMMMDK',
  '..........................................KKDEEEEEEEEEEDEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKKK..KKKKKKKKKKK',
  '........................................KKKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK..KKEEEEEEEKKK',
  '.......................................KKDEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEKK..KKKKKKKKKKK',
  '......................................KKDEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK',
  '.....................................KKDEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK',
  '....................................KKEKEEEDEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKKK',
  '..................................KKKMMEKEDEEDEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK',
  '.................................KKMDDDDDEKDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEKK',
  '................................KKMEDDDEEEEKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK',
  '...............................KKDDDDDDDDDDDEKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKKK',
  '..............................KKDDDDDDDDDDDDDEKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK',
  '............................KKKDDDDDDDDDDDDDDDDEKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK',
  '...........................KKEEEDDDEEEEDDDEEEEDDEKEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEKK',
  '.........................KKKDDDDDDDDDDDDDDDDDDDDDDEKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK',
  '........................KKKKKKKKKKKKKKKKKKKKKKKKKKKKKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKKK',
  '........................KDDEKLMMMMMMMMMMMMMMMMMDKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK',
  '.......................KKDEEKLMMMMMMMMMMMMMMMMMDKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK',
  '.....................KKKEEDDKLMMMMMMMMMMMMMMMMMDKEDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDKK',
  '....................KKDEEEEEKLMMMMMMMMMMMMMMMMMDKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKKK',
  '...................KKDEEEEEEKLMMKKKKKKKKKKKKKMMDKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK',
  '..................KKDEEEEEEEKLMMKSLLLLKLLLLMKMMDKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK',
  '.................KKDEEEEEEEEKLMMKLLLLLKLLLLMKMMDKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK',
  '...............KKKEEEEEDDDEEKLMMKLLLLLKLLLLMKMMDKEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDKK',
  '..............KKEEEEEEEEEEEEKLMMKLLLLLKLLLLMKMMDKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKKK',
  '.............KKEEEEEEEEEEEEEKLMMKKKKKKKKKKKKKMMDKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK',
  '............KKEEEEEEEEEEEEEEKLMMKLLLLLKLLLLMKMMDKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK',
  '...........KKEEEEEEEEEEEEEEEKLMMKLLLLLKLLLLMKMMDKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK',
  '.........KKKEEEEEEEEDDDEEEEEKLMMKLLLLLKLLLLMKMMDKEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEKK',
  '........KKEEEEEEEEEEEEEEEEEEKLMMKLLLLLKLLLLMKMMDKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKKK',
  '.......KKEEEEEEEEEEEEEEEEEEEKLMMKMMMMMKMMMMMKMMDKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK',
  '......KKEEEEEEEEEEEEEEEEEEEEKLMMKKKKKKKKKKKKKMMDKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK',
  '.....KKEEEEEEEEEEEEEEEEEEEEEKLMKKKKKKKKKKKKKKKMDKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK',
  '...KKKDDDEEEEEEEEDDDEEEEEEEEKKKKKKKKKKKKKKKKKKKKKEEDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEKKK',
  '..KKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK',
  '.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  '........KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KLEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEDK',
  '........KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMDDMMMMMMDDMMMMMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMMMMMMDDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KLMMDDMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KLMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMDK',
  '........KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMDDMKKKKKKKKKKKKKKKKKKKKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDDKKKKKKKKKKKKKKKKKKKKMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMKSLLLLLLLKLLLLLLLLMKDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKSLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMDDMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMDDMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMMMLLLLLLLLLLLLLLLLLMMMMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMMMLKKKKKKKKKKKKKKKLMMMMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMKKKKKKKKKKKKKKKKKKKKMMMMMMMDDMMMMMMMMMLKDDEDDDEDDDEDEKLMMMMMMMMMMMKKKKKKKKKKKKKKKKKKKKMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDEKLMMMMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDEKLMMMMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMDDMMMMMMLKDDEDDDEDDDEDEKLMMMMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDEKLMMMMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMDDMMMMMMMMLKDDEDDDEDDDEDEKLMMMMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDEKLMMMMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMDDMMLKDDEDDDEDDDEDEKLMMMMMMMMMMMKLLLLLLLLKLLLLLLLLMKMMMMMMMMMMMMMMMMDK',
  '........KLMMMMDDMMKMMMMMMMMKMMMMMMMMMKMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDEKLMMMMMMMMMMMKMMMMMMMMKMMMMMMMMMKMMMMMMDDMMMMMMMMDK',
  '........KLMMMMMMMDKKKKKKKKKKKKKKKKKKKKMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDEKLMMMMMMMMMMMKKKKKKKKKKKKKKKKKKKKMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMKKKKKKKKKKKKKKKKKKKKKKMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDEKLMMMMMMMMMMKKKKKKKKKKKKKKKKKKKKKKMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMDK',
  '........KLMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDSDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDEKLDMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMMMMMMMMMMDDMMMMMMMMDDMMMMMMDDMMMMMMMMMLKDDEDDDEDDDEDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KLMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMLKDDEDDDEDDDEDEKLDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KLMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMLKDDEDDDEDDDEDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMDK',
  '........KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMDK',
  '........KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKDDEDDDEDDDEDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMDDMMMMMMMMMMMMLKDDEDDDEDDDEDEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKEEEEEEEEEEEEEKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMLKKKKKKKKKKKKKKKLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '........KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  '',
];
// HOUSE_DORMER_ROWS: 129w x 105h

const HOUSE_SALTBOX_ROWS = [
  '.........................................KKKKKKKKKKKKK',
  '..........................................KMMMMMMMMMK',
  '..........................................KMDDDDDDDEK',
  '..........................................KMDDDDDDDEK',
  '..........................................KMDDDDDDDEK',
  '..........................................KMDDDDDDDEK',
  '..........................................KMDDDDDDDEK',
  '.........................................KKMDDDDDDDEKK',
  '........................................KKKMDDDDDDDEKKKK',
  '......................................KKKMKMDDDDDDDEKMLKKK',
  '....................................KKKLMMKMDDDDDDDEKMMMLKKK',
  '...................................KKLMMMMKMDDDDDDDEKMDDMMLKK',
  '.................................KKKMMMMMMKKKKKKKKKKKMDDMMMMKKK',
  '...............................KKKLMDDMMMDDEEEEEEEEEEEEDMMMMMLKKK',
  '.............................KKKLMMMDDMMDKKEEEEEEEEEEEEDMMMMDMMLKK',
  '............................KKLMMMMMDDDDKEEDDDDDDDDDDEKKDDMMDDMMMKKK',
  '..........................KKKMMDMMMMDDKKEDDDDDDDDDDDDDEEKKDDDDMMMMLKKK',
  '........................KKKLMMDDMMMDKKEEDDDDDDDDDDDDDDDDEEKKDDMMMMMMLKKK',
  '......................KKKLMMMMDDMDDKEEDDDDDDDDDDDDDDDDDDDDEEKDDMMMDDMMLKK',
  '.....................KKLMMMMMMDDDKKEDDDDDDDDDDDDDDDDDDDDDDDDEKKDDMDDMMMMKKK',
  '...................KKKMMDDMMMDDKKEEDDDDDDDDDDDDDDDDDDDDDDDDDDEEKKDDDMMMMMLKKK',
  '.................KKKLMMMDDMMDKKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKDDMMMMDMMLKK',
  '...............KKKLMMMMMDDDDKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKKDDMMDDMMMKKK',
  '..............KKLMMDMMMMDDKKEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKKDDDDMMMMLKKK',
  '............KKKMMMDDMMDDKKEEDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDEEKKDDMMMMMMLKK',
  '..........KKKLMMMMDDMDKKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKDDMMMDDMMKKK',
  '.........KKLMMMMMMDDDKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKKDDMDDMMMLKKK',
  '.......KKKMMDDMMMDDKKEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKKDDDMMMMMLKKK',
  '.....KKKLMMMDDMDDKKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKDDMMMMDMMLKK',
  '...KKKLMMMMMDDDKKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKKDDMMDDMMMKKK',
  '..KKLMMDMMMMDDKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKKDMDDMMMMLKKK',
  '..KMMMDDMMDDKKEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKDDDMMMMMMLKK',
  '..KMMMDDMDKKEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKKDDMMMDDMMKKK',
  '..KMMMDDDKEEDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKKDDMDDMMMLKKK',
  '..KMMDKKKEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKKDDDMMMMMLKKK',
  '..KDKKK.KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKDDMMMMDMMLKK',
  '..KKK...KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKKDDMMDDMMMKKK',
  '..K.....KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKKDMDDMMMMLKKK',
  '........KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDEEKDDDMMMMMMLKK',
  '........KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKKDDMMMDDMMKKK',
  '........KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKKDDMDDMMMLKKK',
  '........KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKKDDDMMMMMLKKK',
  '........KMDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKDDMMMMDMMLKK',
  '........KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKKDDMMDDMMMKKK',
  '........KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKKDMDDMMMMLKKK',
  '........KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKDDDMMMMMMLKK',
  '........KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDEKKDDMMMDDMMKKK',
  '........KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKKDDMDDMMMLKKK',
  '........KMDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKKDDDMMMMMLKK',
  '........KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKDDMMMMDMMKKK',
  '........KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKKDDMMDDMMLKKK',
  '........KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKKDMDDMMMMLKKK',
  '........KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDEEKDDDMMMMMMLKK',
  '........KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKKDDMMMDDMMKKK',
  '........KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKKDMMDDMMMLKKK',
  '........KMDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKDDDDMMMMMLKK',
  '........KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKKDDMMMMDMMKKK',
  '........KMDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKKDDMMDDMMLKKK',
  '........KMDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKKDMDDMMMMLKKK',
  '........KMDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKDDDMMMMMMLKK',
  '........KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKKKKKKKKKKKKKKKKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKKDDMMMDDMMKKK',
  '........KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKSLLLLLLKLLLLLLLMKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKKDMMDDMMMLKKK',
  '........KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKLLLLLLLKLLLLLLLMKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKDDDDMMMMMLKK',
  '........KMDDDEEDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKLLLLLLLKLLLLLLLMKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKKDDMMMMDMMK',
  '........KMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKLLLLLLLKLLLLLLLMKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDEEKKDDMMDDMK',
  '........KMDDDDDDDDDDDDDDDMMMMMMMMMMMMMMMMMDDDDDDDDDDDDDDKLLLLLLLKLLLLLLLMKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDEEKKDMDDMK',
  '........KMDDDDDDDDDDDDDDDMKKKKKKKKKKKKKKKMDDDDDDDDDDDDDDKLLLLLLLKLLLLLLLMKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEKKKDDMK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDKLLLLLLLKLLLLLLLMKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDEEDDEK.KKKDK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDKKKKKKKKKKKKKKKKKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK...KKK',
  '........KMDDDDEEDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDKLLLLLLLKLLLLLLLMKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDEK.....K',
  '........KMDDDDDDDDDDEEDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDKLLLLLLLKLLLLLLLMKEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDKLLLLLLLKLLLLLLLMKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDKLLLLLLLKLLLLLLLMKDDDDDDDDDDDDDDDDDDDDDDDDDDKKKKKKKKKKKKKKKKKKDDDDDDDDDDDDDDDDDEEDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDKLLLLLLLKLLLLLLLMKDDDDDDDDDDDDDDDDDDDDDDDDDDKSLLLLLLKLLLLLLLMKDDDDDDDDDDDDDEEDDDDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDKLLLLLLLKLLLLLLLMKDDDDDDDDDDDDDDDDDDDDDDDDDDKLLLLLLLKLLLLLLLMKDDDDDDDDDDDDDDDDDDDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDKMMMMMMMKMMMMMMMMKDDDDDDDDDDDDDDDDDDDDDDDDDDKLLLLLLLKLLLLLLLMKDDDDDDDDDDDDDDDDDDDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDKKKKKKKKKKKKKKKKKKDDDDDDDDDDDDDDDDDDDDDDDDDDKLLLLLLLKLLLLLLLMKDDDDDDDDDDDDDDEEDDDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDKKKKKKKKKKKKKKKKKKKKDDDDDDDDDDDDDDDDDDDDDDDDDKLLLLLLLKLLLLLLLMKDDDDDDDDDDDDDDDDDDDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKLLLLLLLKLLLLLLLMKDDDDDDDDDDDDDDDDDDDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKKKKKKKKKKKKKKKKKDDDDDDDDDDDDDDDDDDDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKLLLLLLLKLLLLLLLMKDDDDDDDDDDDDDDDDDDDDDDEK',
  '........KMDDDEEDDDDDDDDDDMKEEEEEEEEEESEEKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDKLLLLLLLKLLLLLLLMKDDDDDDDDDDDDDDDDDDDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKLLLLLLLKLLLLLLLMKDDDDDDDDDDDDDDDDDDDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKLLLLLLLKLLLLLLLMKDDDDDDDDDDDDDDDDDDDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEKLLLLLLLKLLLLLLLMKDDDDDDDDDDDDDDDDDDDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKMMMMMMMKMMMMMMMMKDDDDDDDDDDDDDDDDDDDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKKKKKKKKKKKKKKKKKDEEDDDDDDDDEEDDDDDDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKKKKKKKKKKKKKKKKKKKDDDDDDDDDDDDDDDDDDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '........KMDDEEDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEEDDDDDDDDDDDDDDDDDDDDEEDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKEEEEEEEEEEEEEKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '........KMDDDDDDDDDDDDDDDMKKKKKKKKKKKKKKKMDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDEK',
  '........KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  '',
];
// HOUSE_SALTBOX_ROWS: 148w x 100h

const SHED_ROWS = [
  '',
  '',
  '',
  '',
  '............................KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  '..........................KKKDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKK',
  '.........................KKDEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKKK',
  '.......................KKKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK',
  '.....................KKKEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDKKK',
  '....................KKDEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKKK',
  '..................KKKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK',
  '................KKKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKKK',
  '..............KKKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKKK',
  '.............KKDDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDKKK',
  '...........KKKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKKK',
  '.........KKKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKK',
  '........KKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKKK',
  '......KKKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKKK',
  '....KKKEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEEEEEEEEDDDEKK',
  '...KKEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEKKK',
  '.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMMDDMMMMMMMMMMMMMMMMMMMMMMMDDMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMDDMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMDDMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKKKKKKKKKKKKMMMMMDK',
  '.....KLMMMMMMDDMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKSLLLKLLLLMKMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMKLLLLKLLLLMKMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLMMMMMMKLLLLKLLLLMKMMMMMDK',
  '.....KLMMMMMDDMMMMMMMMMMMMMMMMMKKKKKKKKKKKKKKKKKKKKKKKKKKKKMMMMMMMKLLLLKLLLLMKMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMKMDDDDDDDDDDDKKDDDDDDDDDDDEKMMMMMMMKKKKKKKKKKKKMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMKLLLLKLLLLMKMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMKLLLLKLLLLMKMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMKLLLLKLLLLMKMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMKMMMMKMMMMMKMMMMMDK',
  '.....KLMMMMMMMMMMMMMMDDMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMKKKKKKKKKKKKMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMKKKKKKKKKKKKKKMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMMMMMMMMMMMMMDDMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMDDMMMMMMMMMMMMMDDMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKDMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMKMDDEDDDEDSDDKKDDSDEDDDEDDEKDMMMMMMMDDMMMMMMMMMMMMMMDK',
  '.....KLMMMMDDMMMMMDDMMMMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMMMMMMDDMMMMMMMMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMMMMMMMMDDMMMMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMMDDMMMMMMMMMMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMDDMMMMMMMMMMMMMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMDKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMDDMMMMMMMMMMMMMMMMDK',
  '.....KLMMMMMMMMMDDMMMMMMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMMMMMMMMDDMMMMMMMMDK',
  '.....KLMMMMMMDDMMMMMMMMMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKDMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMDDMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMMMMMMMMMMMDDMMDDMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMKMDDEDDDEDDDDKKDDDDEDDDEDDEKMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMDDMMMMMMMMMMMMMMMMMMMMMKMDDDDDDDDDDDKKDDDDDDDDDDDEKMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KLMMMMMMMMMMMMMMMMMMMMMMMMKKKKKKKKKKKKKKKKKKKKKKKKKKKKMMMMMMMMMMMMMMMMMMMMMMMMDK',
  '.....KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  '',
];
// SHED_ROWS: 89w x 70h

/* ============================================================
   HOUSES
   ------------------------------------------------------------
   The construction (shingle courses, staggered eaves, the door
   and window layout) was already approved and stays exactly as
   it was. What changes is that every color now comes from the
   active six-role palette instead of its own private hex table —
   which does mean the neighbours' houses no longer each have
   their own signature color (a blue house, a green house...);
   everything on screen shares one time-of-day family of color,
   distinguished by size and shading rather than hue. That's a
   real, visible change from before — flagging it clearly rather
   than letting it slide by quietly.
   ============================================================ */
/* The houses used to be built here out of code-drawn rectangles
   (a drawHouse function). They're now typed out pixel-by-pixel as
   letter grids up above, alongside the trees — HOUSE_MAIN_ROWS,
   HOUSE_CROSSGABLE_ROWS, HOUSE_WRAPPORCH_ROWS, HOUSE_DORMER_ROWS,
   HOUSE_SALTBOX_ROWS and SHED_ROWS — and drawn with the same
   drawPixels call the trees use. */

/* ---- odds and ends ----------------------------------------- */
function drawMailbox(ctx, w, h, pal) {
  ctx.fillStyle = pal.D;
  ctx.fillRect(7, 8, 3, h - 9);
  ctx.fillStyle = pal.M;
  ctx.fillRect(2, 2, 13, 8);
  ctx.fillStyle = pal.L;
  ctx.fillRect(2, 2, 13, 3);
  ctx.fillStyle = pal.S;
  ctx.fillRect(14, 3, 2, 5);
}

function drawBench(ctx, w, h, pal) {
  ctx.fillStyle = pal.M;
  ctx.fillRect(1, 1, w - 2, 4);
  ctx.fillRect(1, 8, w - 2, 4);
  ctx.fillStyle = pal.D;
  ctx.fillRect(1, 4, w - 2, 1);
  ctx.fillRect(1, 11, w - 2, 1);
  ctx.fillStyle = pal.K;
  ctx.fillRect(3, 12, 3, 5);
  ctx.fillRect(w - 6, 12, 3, 5);
}

function drawStonePost(ctx, w, h, pal) {
  ctx.fillStyle = pal.M;
  ctx.fillRect(1, 2, w - 2, h - 3);
  ctx.fillStyle = pal.L;
  ctx.fillRect(1, 2, 4, h - 3);
  ctx.fillStyle = pal.D;
  for (let y = 6; y < h; y += 5) ctx.fillRect(1, y, w - 2, 1);
  ctx.fillStyle = pal.L;
  ctx.fillRect(0, 0, w, 3);
}

/* ============================================================
   THE GARDEN — beds, plants, and the forecast sign
   ------------------------------------------------------------
   Added in Stage 3. Everything here is typed out as pixel grids,
   the same way the trees and houses are.

   One small labour-saving thing: a bed holds a little CLUMP of
   three plants, not one. Rather than typing the same tomato
   plant out three times side by side, each plant is typed ONCE
   below, and clumpRows() stamps that one drawing across the bed
   a few times at slightly different heights. So if you want to
   redraw a plant, there's exactly one place to do it.
   ============================================================ */

/* ---- the raised bed ----------------------------------------
   32 wide x 16 tall — exactly two map squares across, one down.
   K outline   W wood light   w wood dark
   m soil mid  d soil dark    e soil deepest
   The dry bed and the watered bed are the same drawing; only
   which colors m/d/e point at changes (see BED_PAL below). */
const BED_ROWS = [
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  'KWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWK',
  'KwKKKKKKKKKKKKKKKKKKKKKKKKKKKKwK',
  'KwKmdmdmdmdmdmdmdmdmdmdmdmdmdKwK',
  'KwKdmdmdmdmdmdmdmdmdmdmdmdmdmKwK',
  'KwKmdedmdmdedmdmdedmdmdedmdmdKwK',
  'KwKdmdmdmdmdmdmdmdmdmdmdmdmdmKwK',
  'KwKmdmdmdmdmdmdmdmdmdmdmdmdmdKwK',
  'KwKdmdmedmdmdmedmdmdmedmdmdmeKwK',
  'KwKdmdmdmdmdmdmdmdmdmdmdmdmdmKwK',
  'KwKmdmdmdmdmdmdmdmdmdmdmdmdmdKwK',
  'KwKmdedmdmdedmdmdedmdmdedmdmdKwK',
  'KwKdmdmdmdmdmdmdmdmdmdmdmdmdmKwK',
  'KwKeeeeeeeeeeeeeeeeeeeeeeeeeeKwK',
  'KwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwK',
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK'
];

/* ---- the plants --------------------------------------------
   Each one is drawn once, small. Letters:
     K outline    D dark leaf   M mid leaf   L light leaf
     w a wooden pole (green beans climb one)
     d, e  turned soil (used by the just-planted mounds)
     F flower/fruit    f its shadow
     C, c  the raised centre of a coneflower or a Susan
   The F/f/C/c colors are the ONLY places in the whole game with
   a real color of their own rather than a palette role — a
   purple coneflower has to be purple. They still get nudged
   toward whatever light the world is in, so they sit down at
   dusk with everything else. */

/* Stage 1 of 4 — just planted. Little mounds of turned soil. */
const P_SEED = [
  '.KKK.',
  'KdddK',
  'KeeeK',
  '.KKK.'
];

/* Stage 2 of 4 — sprouted. Two first leaves. Flowers and
   vegetables sprout a little differently, and that's the only
   difference between them at this stage. */
const P_SPROUT_FLOWER = [
  '.K...K.',
  'KLK.KLK',
  'KMMLMMK',
  '.KMDMK.',
  '..KDK..',
  '..KKK..'
];
const P_SPROUT_VEG = [
  '.......',
  'KLLKLLK',
  'KMMDMMK',
  '.KMDMK.',
  '..KDK..',
  '..KKK..'
];

/* Stages 3 and 4 — growing, then in bloom / ready to pick.
   Each plant's silhouette is deliberately different enough to
   tell apart at a glance across the yard. */

const P_CONEFLOWER_GROW = [
  '...K...',
  '..KLK..',
  '..KMK..',
  '.KLMK..',
  'KLLMK..',
  '.KKMK..',
  '..KMLK.',
  '..KMLLK',
  '..KMKK.',
  '..KDK..',
  '..KKK..'
];
const P_CONEFLOWER_BLOOM = [
  '...KKK...',
  '..KCCCK..',
  '.KCcccCK.',
  'KFCcccCFK',
  'KFfCCCfFK',
  'KFFfffFFK',
  '.KFFFFFK.',
  '..KFFFK..',
  '...KKK...',
  '...KMK...',
  '..KLMK...',
  '.KLMMK...',
  '...KMLK..',
  '...KMK...',
  '...KKK...'
];

const P_SUSAN_GROW = [
  '...KKK...',
  '..KLLK...',
  '.KLMMLK..',
  'KLMMMMLK.',
  '.KMMDMMK.',
  '..KMDMK..',
  '..KMDMK..',
  '...KDK...',
  '...KKK...'
];
const P_SUSAN_BLOOM = [
  '...KKKKK...',
  '..KFFFFFK..',
  '.KFFfffFFK.',
  'KFFfcccfFFK',
  'KFffcccffFK',
  'KFFfcccfFFK',
  '.KFFfffFFK.',
  '..KFFFFFK..',
  '...KKKKK...',
  '....KMK....',
  '...KLMK....',
  '....KMK....',
  '....KKK....'
];

const P_MILKWEED_GROW = [
  '...KKK...',
  '..KLMK...',
  '.KLMMLK..',
  'KLMKMMLK.',
  '.KKMMKK..',
  '..KMMK...',
  '..KMDK...',
  '..KKKK...'
];
const P_MILKWEED_BLOOM = [
  '..KKKKKKK..',
  '.KFfFfFfFK.',
  'KfFfFfFfFfK',
  'KFfFfFfFfFK',
  '.KfFfFfFfK.',
  '..KKKKKKK..',
  '...KMMMK...',
  '..KLMMMK...',
  '...KMMMK...',
  '..KLMMMLK..',
  '...KMMMK...',
  '...KKKKK...'
];

const P_BLAZINGSTAR_GROW = [
  '..K..',
  '.KLK.',
  'KLMLK',
  '.KMK.',
  'KLMLK',
  '.KMK.',
  'KLMLK',
  '.KMK.',
  '.KMK.',
  '.KDK.',
  '.KDK.',
  '.KKK.'
];
const P_BLAZINGSTAR_BLOOM = [
  '...K...',
  '..KFK..',
  '.KFFFK.',
  'KFfFfFK',
  'KFFfFFK',
  'KfFFFfK',
  'KFfFfFK',
  'KFFfFFK',
  'KfFFFfK',
  '.KFfFK.',
  '.KFFFK.',
  '..KFK..',
  '..KKK..',
  '..KMK..',
  'KLMLK..',
  '..KMK..',
  '..KDK..',
  '..KKK..'
];

const P_TOMATO_GROW = [
  '...KKKKK...',
  '..KLLLLLK..',
  '.KLMMLMMLK.',
  'KLMMDMMDMLK',
  'KMMDMMMDMMK',
  '.KMMDMDMMK.',
  '..KMMDMMK..',
  '...KMDMK...',
  '....KDK....',
  '....KKK....'
];
const P_TOMATO_BLOOM = [
  '...KKKKK...',
  '..KLLLLLK..',
  '.KLMMLMMLK.',
  'KLMFfMFfMLK',
  'KMMFFMFFMMK',
  'KMDMMMMMDMK',
  '.KMFfMMDMK.',
  '..KFFMDMK..',
  '...KMDMK...',
  '...KMDMK...',
  '....KDK....',
  '....KKK....'
];

const P_BEANS_GROW = [
  '....K....',
  '...KwK...',
  '..KLwK...',
  '.KLMwK...',
  '..KKwLK..',
  '...KwMLK.',
  '...KwKKK.',
  '..KLwK...',
  '.KLMwK...',
  '..KKwLK..',
  '...KwMK..',
  '...KwK...',
  '...KwK...',
  '...KKK...'
];
const P_BEANS_BLOOM = [
  '....K....',
  '...KwK...',
  '..KLwK...',
  '.KLMwKF..',
  '..KKwKF..',
  '..FKwMLK.',
  '..FKwKKK.',
  '..fKwK...',
  '.KLwMKF..',
  '.KKwKKF..',
  '..KwMLKf.',
  '...KwK...',
  '...KwK...',
  '...KwK...',
  '...KKK...'
];

/* ---- the forecast sign -------------------------------------
   34 wide x 29 tall. Two sunken panels; the little weather
   pictures get placed on top of them by the game. */
const WSIGN_ROWS = [
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  'KWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWK',
  'KWKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKWK',
  'KWKwwwwwwwwwwwwwKKwwwwwwwwwwwwwKWK',
  'KWKwwwwwwwwwwwwwKKwwwwwwwwwwwwwKWK',
  'KWKwwwwwwwwwwwwwKKwwwwwwwwwwwwwKWK',
  'KWKwwwwwwwwwwwwwKKwwwwwwwwwwwwwKWK',
  'KWKwwwwwwwwwwwwwKKwwwwwwwwwwwwwKWK',
  'KWKwwwwwwwwwwwwwKKwwwwwwwwwwwwwKWK',
  'KWKwwwwwwwwwwwwwKKwwwwwwwwwwwwwKWK',
  'KWKwwwwwwwwwwwwwKKwwwwwwwwwwwwwKWK',
  'KWKwwwwwwwwwwwwwKKwwwwwwwwwwwwwKWK',
  'KWKwwwwwwwwwwwwwKKwwwwwwwwwwwwwKWK',
  'KWKwwwwwwwwwwwwwKKwwwwwwwwwwwwwKWK',
  'KWKwwwwwwwwwwwwwKKwwwwwwwwwwwwwKWK',
  'KWKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKWK',
  'KWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWK',
  'KwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwK',
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  '.......KWwK............KWwK.......',
  '.......KWwK............KWwK.......',
  '.......KWwK............KWwK.......',
  '.......KWwK............KWwK.......',
  '.......KWwK............KWwK.......',
  '.......KWwK............KWwK.......',
  '.......KWwK............KWwK.......',
  '.......KWwK............KWwK.......',
  '.......KWwK............KWwK.......',
  '.......KKKK............KKKK.......'
];

/* ---- the three weather pictures ----------------------------
   11 x 11 each, small enough to sit in the sign's panels.
     F sun face   S its hot centre   L cloud light   M cloud mid
     B raindrop */
const ICON_SUN = [
  '.....K.....',
  '..K.....K..',
  '...KKKKK...',
  '..KFFFFFK..',
  'KKFFSSSFFKK',
  '.KFFSSSFFK.',
  '..KFFFFFK..',
  '...KKKKK...',
  '..K.....K..',
  '.....K.....',
  '...........'
];
const ICON_CLOUD = [
  '...........',
  '.....KKK...',
  '...KKLLLKK.',
  '..KLLLLLLK.',
  '.KKLLLLLLLK',
  'KLLLLLLLLLK',
  'KLLLLMLLMLK',
  'KMMMMMMMMMK',
  '.KKKKKKKKK.',
  '...........',
  '...........'
];
const ICON_RAIN = [
  '...........',
  '...KKKKK...',
  '..KLLLLLK..',
  '.KLLLLLLLK.',
  'KMMMMMMMMMK',
  '.KKKKKKKKK.',
  '..B..B..B..',
  '.B..B..B...',
  '.B..B..B...',
  'B..B..B....',
  '...........'
];

/* Stamps one small typed drawing across a wider blank grid a
   few times, so a bed reads as a little clump rather than one
   lonely stem. Returns rows in exactly the same format as any
   hand-typed grid, so everything downstream is none the wiser. */
function clumpRows(unit, totalW, totalH) {
  const uw = Math.max.apply(null, unit.map(r => r.length));
  const uh = unit.length;
  const grid = [];
  for (let y = 0; y < totalH; y++) grid.push(new Array(totalW).fill('.'));

  let spots;
  if (uw <= 9) {
    const m = Math.round((totalW - uw) / 2);
    spots = [[m - uw - 2, 1], [m, 0], [m + uw + 2, 1]];
  } else {
    spots = [[1, 0], [totalW - uw - 1, 1]];
  }

  spots.forEach(([ox, dy]) => {
    if (ox < 0 || ox + uw > totalW) return;
    const oy = totalH - uh - dy;
    for (let y = 0; y < uh; y++) {
      for (let x = 0; x < unit[y].length; x++) {
        const c = unit[y][x];
        if (c === '.' || c === ' ') continue;
        const gy = oy + y, gx = ox + x;
        if (gy < 0 || gy >= totalH || gx < 0 || gx >= totalW) continue;
        grid[gy][gx] = c;
      }
    }
  });
  return grid.map(r => r.join(''));
}

/* ============================================================
   STAGE 4 ART — THE FIVE NATIVE TREES
   ------------------------------------------------------------
   Same language as every other living thing in the game: one
   letter per pixel, light from the upper-left, K sealing the
   silhouette, E shadow strokes tucked under lit clumps, D mass
   falling to the lower-right, S sparks rare and small. Every
   trunk here is capped with a row of K so it can never poke out
   from under its own canopy with a raw edge.

   Two extra letters appear that no other tree uses: F and f, a
   blossom or a berry. Only the redbud and the serviceberry
   have them. Everything else is the six roles.

   The five are told apart by SHAPE, never by colour:
     bur oak       broad and low-crowned, wider than it is tall
     sycamore      the giant — high crown over a pale mottled trunk
     hickory       narrow and tall, trunk flaking in and out
     redbud        small and low, magenta along the branches
     serviceberry  slim, forked, white flower and dark fruit
   ============================================================ */

/* ---- the shared sapling ------------------------------------
   Every species looks like this for its first five days, which
   is honest: you can't tell a redbud whip from an oak whip at
   arm's length either. */
const T_SAPLING = [
  '.....KKK......',
  '....KMLLK.....',
  '....KMLSK.....',
  '.....KMMK.....',
  '.....KMK......',
  '..KKKKMK......',
  '.KMLLDMK......',
  '.KMLLLMK.KKK..',
  '.KMMLDMKKMLLK.',
  '..KKKKMMMLLLK.',
  '......KMKKKKK.',
  '......KMK.....',
  '......KMK.....',
  '......KMK.....',
  '.....KEDMK....',
  '.....KEDMK....',
  '....KEEDMMK...',
  '....KKKKKKK...'
];

/* ---- the two young forms -----------------------------------
   A round-crowned one (bur oak, redbud) and an upright one
   (serviceberry, hickory, sycamore). Five days at this size,
   then it comes into its own shape. */
const T_YOUNG_ROUND = [
  '.....KKKK......',
  '...KKMLLMKK....',
  '..KMLMLLLMMKK..',
  '.KMLLSLLMLMMMK.',
  '.KMLLLLMLMMMMK.',
  'KMLMLLMMMMMMMMK',
  'KMLMEELMMMMDMMK',
  'KMMLMEEMMMDMMMK',
  '.KMMLMMMDMDMMK.',
  'KMMMMMMDMDDDMMK',
  'KMDMMMDDDDDDDMK',
  'KMDMDMDDDDEDDDK',
  '.KMDMDDDDDDDDK.',
  '.KKMDDDDDDDKK..',
  '...KKDDDDKK....',
  '.....KKKKK.....',
  '......KEDMK....',
  '......KEDMK....',
  '......KEDMK....',
  '......KEDMK....',
  '......KEDMK....',
  '.....KEEDMMK...',
  '.....KEEDMMK...',
  '.....KKKKKKK...'
];

const T_YOUNG_UPRIGHT = [
  '....KKKKK.....',
  '..KKMLLMKK....',
  '.KMLMLLLMMKK..',
  'KMLLSLLMLMMMK.',
  'KMLLLLMLMMMMK.',
  'KMLMLLMMMMMMK.',
  'KMLMEELMMMMMK.',
  'KMMLMEEMMDMMK.',
  '.KMMLMMMDMMK..',
  'KMMMMMMDMDMMK.',
  'KMDMMMDDDDDMK.',
  'KMDMDMDDDDDDK.',
  'KMMDMDDDEDDDK.',
  '.KMDDDDDDDDK..',
  '.KKMDDDDDKK...',
  '...KKDDKK.....',
  '....KKKKK.....',
  '....KEDMK.....',
  '....KEDMK.....',
  '....KEDMK.....',
  '....KEDMK.....',
  '....KEDMK.....',
  '....KEDMK.....',
  '...KEEDMMK....',
  '...KEEDMMK....',
  '...KKKKKKK....'
];

/* ---- BUR OAK -----------------------------------------------
   The one everybody pictures. Crown wider than it is tall,
   heavy horizontal lobes, sitting on a short stout trunk. */
const T_BUROAK = [
  '.....KKKK.......KKKK........',
  '...KKMLLMKK...KKMLLMKK......',
  '..KMLMLLLLMKKKMLLLLMMKK.....',
  '.KMLLLSLLLLMMMLLLMLMMMMKK...',
  'KMLLLLLLLLLLLMLLMLMMMMMMMKK.',
  'KMLLMLLLLLLLLLMLMMMMMMMMMMMK',
  'KMLLMEELLLLLLMMMMMMMDMMMMMMK',
  'KMLMMMEELLLMMMMMMMDMMMMMMMMK',
  '.KMLMMMMMLMMMMMMDMDMDMMMMMK.',
  'KMMLMLMMMMMMMMMMMDMDMDMMMMMK',
  'KMMMLMMMMMMMMMDMDMDMDMDMMMMK',
  'KMDMMMMMMMMMMMMDMDDDDDDDMMMK',
  'KMDMDMMMMMMMDMDDDDDDDDDDDMMK',
  '.KMDMDMMMMMDDDDDDDDDEDDDDMK.',
  '.KMMDMDMMDDDDDDDDDDEEDDDDDK.',
  '..KMDMDDDDDDDDDDDDDDEDDDDK..',
  '.KMDMDDDDDDDDDDDDDDDDDDDDDK.',
  '..KMDDDDDDDDDDDDDDDDDDDDDK..',
  '..KKMDDDDDDDKKDDDDDDDDDKKK..',
  '....KKDDDDKK..KKDDDDKKK.....',
  '......KKKK......KKKK........',
  '..........KKKKKKKK..........',
  '..........KEDDDMMK..........',
  '..........KEDDDMMK..........',
  '..........KEDDDMMK..........',
  '..........KEDDDMMK..........',
  '..........KEDDDMMK..........',
  '.........KEEDDDMMMK.........',
  '.........KEEDDDMMMK.........',
  '........KEEDDDDMMMMK........',
  '........KKKKKKKKKKKK........'
];

/* ---- AMERICAN SYCAMORE -------------------------------------
   The giant of the five: the tallest thing he can plant, and
   the only one whose trunk is drawn in the LIGHT tones, with
   dark patches flaking off it. That pale trunk is the whole
   point — it's how you know a sycamore from across a field. */
const T_SYCAMORE = [
  '....KKKK....KKKKK.........',
  '..KKMLLMKK.KMLLLMKK.......',
  '.KMLLLLLMKKMLLLLLMMKK.....',
  'KMLLLSLLLMMLLLLMMMMMMK....',
  'KMLLLLLLLLLLLMLMMMMMMMK...',
  '.KMLLMLLLLLLMLMMMMMMMMMK..',
  'KMLLMEELLLLMMMMMMMDMMMMMK.',
  'KMLMMMEELLMMMMMMDMMMMMMMMK',
  '.KMLMMMMLMMMMMDMDMDMMMMMK.',
  'KMMLMLMMMMMMMDMDMDMDMMMMMK',
  'KMMMMMMMMMMMDMDDDDDDDMMMMK',
  'KMDMMMMMMMDMDDDDDDDDDDDMMK',
  '.KMDMDMMMDDDDDDDDDEDDDDMK.',
  'KMMDMDMMDDDDDDDDDEEDDDDDDK',
  '.KMDMDMDDDDDDDDDDDEDDDDDK.',
  '.KMMDMDDDDDDDDDDDDDDDDDDK.',
  '..KMDMDDDDDDDDDDDDDDDDDK..',
  '..KKMDDDDDDKKDDDDDDDDKKK..',
  '....KKDDDDKK.KKDDDDKKK....',
  '......KKKK.....KKKK.......',
  '..........KKKKKK..........',
  '..........KLLLDK..........',
  '..........KMLLDK..........',
  '..........KLSLDK..........',
  '..........KLLDDK..........',
  '..........KLLLDK..........',
  '..........KMLLDK..........',
  '..........KLLLDK..........',
  '..........KLDLDK..........',
  '..........KLMLDK..........',
  '..........KLLLDK..........',
  '..........KMLLDK..........',
  '..........KLLDDK..........',
  '..........KLLLDK..........',
  '..........KLDLDK..........',
  '..........KLLLDK..........',
  '..........KMLLDK..........',
  '.........KMLLLLDK.........',
  '.........KLLSLLDK.........',
  '........KMLLLLLLDK........',
  '.......KMLLLLLDLLDK.......',
  '.......KKKKKKKKKKKK.......'
];

/* ---- SHAGBARK HICKORY --------------------------------------
   Narrow and tall. The whole point of it is the trunk: long
   plates of bark peeling away, which is why its edges jut in
   and out a pixel instead of running straight. */
const T_HICKORY = [
  '....KKKK........',
  '..KKMLLMKKK.....',
  '.KMLLLLLLMMKK...',
  'KMLLSLLLLMMMMK..',
  'KMLLLLLLLMLMMMK.',
  '.KMLLLMLLMMMMMK.',
  'KMLLMEELLMMMMMMK',
  'KMLMMMEELMMMDMMK',
  '.KMLMMMMLMMDMMK.',
  'KMMLMLMMMMDMDMMK',
  'KMMMMMMMDMDMDMMK',
  'KMDMMMMDMDDDDDMK',
  '.KMDMDMDDDDDDDK.',
  'KMMDMDDDDDDEDDDK',
  '.KMDMDDDDDEEDDK.',
  '.KMMDMDDDDDEDDK.',
  '..KMDMDDDDDDDK..',
  '..KKMDDDDDDDKK..',
  '....KKDDDDDKK...',
  '......KKDKK.....',
  '......KKKKKK....',
  '......KEDDMK....',
  '......KEDDMK....',
  '.....KEEDDMK....',
  '......KEDDMK....',
  '......KEDDMK....',
  '......KEDDMMK...',
  '......KEDDMK....',
  '.....KEEDDMK....',
  '......KEDDMK....',
  '......KEDDMMK...',
  '......KEDDMK....',
  '.....KEEDDMMK...',
  '.....KEEDDDMMK..',
  '....KEEDDDDMMMK.',
  '....KKKKKKKKKKK.'
];

/* ---- EASTERN REDBUD ----------------------------------------
   Small and low, leaning out sideways the way they do at a
   woodland edge, and carrying its magenta blossom right along
   the branches rather than only at the top. */
const T_REDBUD = [
  '.....KKKK....KKKK.....',
  '...KKMLLMKKKKMLFMKK...',
  '..KMLLLLFMMMLLLLLMMK..',
  '.KMLLFLLLSLLLLMMFMMMK.',
  'KMLLfLLLLLLLMLMMfMMMMK',
  'KMLLMEELLLLMMMMMMMDMMK',
  '.KMLMMEELMMMMMMDMMMMK.',
  'KMMLMLMMMMMMMDMDMDMMMK',
  'KMMMLMMFMMMMDMDMDMMMMK',
  'KMDMMMMfMMDMDDDDDDDMMK',
  'KMDMDMMMMDDDDDDDDDDDDK',
  '.KMDMDMMMDDDDDDFDDDDK.',
  '.KMMDMDMDDDDDDDfDDDDK.',
  '..KMDMDDDDDDDDDDDDDK..',
  '..KKMDDDDDKKKDDDDDKK..',
  '....KKDDDKK..KKDDKK...',
  '......KKKK.....KKK....',
  '........KKKKKK........',
  '........KEDDMK........',
  '........KEDDMK........',
  '........KEDDMK........',
  '.......KEEDDMMK.......',
  '.......KEEDDMMK.......',
  '......KEEDDDMMMK......',
  '......KEEDDDMMMK......',
  '.....KEEDDDDMMMMK.....',
  '.....KKKKKKKKKKKK.....'
];

/* ---- SERVICEBERRY ------------------------------------------
   The slim one, and the only one that forks: a second stem
   leans out of the trunk low down and runs to the ground
   beside it. White flower, a few dark berries. */
const T_SERVICEBERRY = [
  '.....KKKKK.......',
  '...KKMLLFMKKK....',
  '..KMLLLLLLLMMKK..',
  '.KMLLFLLSLLMMMMK.',
  '.KMLLLLLLLMFMMMK.',
  'KMLLLEELLLMMMMMMK',
  'KMLMMMEELMMMMDMMK',
  '.KMLMMMMFMMMDMMK.',
  'KMMLMLMMMMMDMDMK.',
  'KMMMMMMMMMDMDDDMK',
  'KMDMMMFMMDDDDDDDK',
  'KMDMDMMMDDDDDDDDK',
  '.KMDMDMDDDDDFDDK.',
  '.KMMDMDDDDDDDDDK.',
  '..KMDDDDDDDDDDK..',
  '..KKMDDDDDDDDKK..',
  '....KKDDDDDKK....',
  '.....KKKKKK......',
  '.....KEDMK.......',
  '.....KEDMK.......',
  '....KEDMK........',
  '....KEDMKKK......',
  '....KEDMMDMK.....',
  '....KEDMKKDMK....',
  '....KEDMK.KDMK...',
  '...KEDMK..KDMK...',
  '...KEDMK..KDMK...',
  '...KEDMK..KDMK...',
  '..KEDDMK..KDMK...',
  '..KEDDMMKKKDDMK..',
  '..KEEDDMMMMDDMK..',
  '..KKKKKKKKKKKKK..'
];

/* ---- the planting hole -------------------------------------
   A little ring of turned earth waiting for something. It stays
   under the tree once one is planted, so it reads as a mulch
   ring and the spot is always findable. */
const T_HOLE = [
  '...KKKKKKKK...',
  '.KKmmmmmmmmKK.',
  'KmmdddddddmmmK',
  'KmdddeeeddddmK',
  'KmddeeeeeedddK',
  'KmdddeeeeddmdK',
  'KmmdddeddddmlK',
  '.KmmdddddmllK.',
  '..KKmmllllKK..',
  '....KKKKKK....'
];

/* ---- the dedication plaque ---------------------------------
   A small marker on a short stake at the foot of the tree. The
   lines on it just mean "there are words here" — the actual
   words are read with the button, not painted on. */
const T_PLAQUE = [
  '.KKKKKKKKK.',
  'KLLLLLLLLMK',
  'KLMMMMMMMMK',
  'KLMLLLLLMMK',
  'KLMLMMMLMMK',
  'KLMLLLLLMMK',
  'KLMMMMMMMMK',
  'KDDDDDDDDDK',
  '.KKKEDKKKK.',
  '...KEDK....',
  '...KEDK....',
  '..KKKKKK...'
];

/* ============================================================
   Prairie Village — Stage 1: The Town
   ------------------------------------------------------------
   Stage 0 gave us a square that walks around an empty field.
   This stage gives that square a face, and gives the field a
   town: his house and backyard, the street outside it, and
   Harmon Park with the big oak.

   Nothing about the controls has changed. Left half of the
   screen is still the thumb-stick, right half is still the
   action button, movement still snaps to 8 directions.
   ============================================================ */

const TUNING = {
  // Walking speed, in screen-pixels per second. This is the number
  // you tuned in Stage 0 — the world is drawn at a size that keeps
  // 190 feeling exactly the same as it did then.
  playerSpeed: 190,
  stickMaxRadius: 58,
  stickDeadZone: 8
};

/* The art is drawn at 16 pixels to a square, then shown 3x bigger
   so it's comfortable on an iPad. So one square of the map is 48
   screen-pixels across. */
const ART = 16;
const SCALE = 3;
const T = ART * SCALE;          // 48 — one map square

const SNAP_STEP = Math.PI / 4;  // movement snaps to 8 compass directions

/* How big a solid, un-walk-through-able box each thing gets, in
   screen pixels [width, height]. The box always sits at the very
   bottom of the picture — which is why you can tuck in behind a
   tree's leaves or the peak of a roof. */
const PROP_BLOCK = {
  tree_a: [26, 16], tree_b: [30, 18], tree_c: [22, 14],
  pine: [24, 16], bush: [40, 18], oak: [116, 46],
  house_main: [615, 300],
  house_crossgable: [411, 264], house_wrapporch: [444, 234],
  house_dormer: [381, 279], house_saltbox: [438, 264],
  shed: [261, 174],
  sign: [78, 40], parksign: [80, 36],
  mailbox: [30, 20], bench: [78, 30], post: [40, 34],
  weathersign: [62, 26]
};

/* ============================================================
   WEATHER, GROWING, AND REMEMBERING
   ------------------------------------------------------------
   Stage 3. Three ideas, kept deliberately separate from the
   drawing and from Phaser so they can be tested on their own:

   1. WHAT THE WEATHER IS. Every real calendar day has exactly
      one weather — sunny, cloudy or rainy. It is not rolled at
      random when the app opens; it is worked out FROM the date
      itself. August 12th 2026 has the same weather whether he
      looks it up today, tomorrow, or next year, and that's what
      lets the sign promise tomorrow's weather honestly.

   2. WHAT A DAY DOES TO A PLANT. Growth, wilting, recovery.

   3. WHAT GETS WRITTEN DOWN. The whole garden squeezed into one
      short line of text the browser keeps for us.
   ============================================================ */

/* ---- calendar odds and ends -------------------------------- */
function dayKey(d) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function keyToDate(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function nextDayKey(k) {
  const d = keyToDate(k);
  d.setDate(d.getDate() + 1);
  return dayKey(d);
}
function dayNumber(k) {
  const [y, m, d] = k.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}
/* Turns any short piece of text into a number, so it can be fed
   to the same seeded random generator the grass tufts use. */
function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function seededRoll(str) {
  const r = makeRng(hashSeed(str));
  r(); r();
  return r();
}

/* ---- what kind of weather each month tends to have ----------
   [chance of rain, chance of cloud, chance of sun], one row per
   month starting at January. Kansas-ish: wet springs, and a hot
   dry stretch through July and August, which is exactly when he
   gets the game — so watering matters from day one. */
const SEASON_WEIGHTS = [
  [0.20, 0.46, 0.34], [0.20, 0.45, 0.35], [0.38, 0.32, 0.30],
  [0.42, 0.30, 0.28], [0.40, 0.30, 0.30], [0.26, 0.26, 0.48],
  [0.15, 0.20, 0.65], [0.13, 0.20, 0.67], [0.22, 0.32, 0.46],
  [0.24, 0.36, 0.40], [0.22, 0.42, 0.36], [0.20, 0.46, 0.34]
];

/* The weather for one real calendar day.
   Two dice, not one: a slow one that leans a whole WEEK wetter
   or drier, and a fast one for the individual day. That's what
   makes a dry spell feel like a spell — four hot days in a row
   he has to keep up with — instead of the weather flickering
   about at random. */
function weatherFor(key) {
  const month = Number(key.slice(5, 7)) - 1;
  const week = Math.floor(dayNumber(key) / 7);
  const shift = (seededRoll('spell:' + week) - 0.5) * 0.30;

  const w = SEASON_WEIGHTS[month];
  const rain = Math.max(0.04, w[0] - shift);
  const cloud = w[1];
  const sun = Math.max(0.04, w[2] + shift);

  const x = seededRoll('day:' + key) * (rain + cloud + sun);
  if (x < rain) return 'rainy';
  if (x < rain + cloud) return 'cloudy';
  return 'sunny';
}

const WEATHER = {
  sunny:  { label: 'Sunny',  icon: 'icon_sun',   note: 'Hot and clear — anything not watered will wilt.' },
  cloudy: { label: 'Cloudy', icon: 'icon_cloud', note: 'Grey and still — a quiet growing day.' },
  rainy:  { label: 'Rain',   icon: 'icon_rain',  note: 'Rain is watering the whole garden for you.' }
};

/* ---- what he can plant this stage --------------------------
   Four prairie natives and two vegetables. Trees are Stage 4 and
   deliberately are NOT in this list. */
const SEEDS = [
  { id: 'coneflower',  name: 'Purple Coneflower',   kind: 'flower',
    bloom: { F: '#a86bc9', f: '#7b4599', C: '#e5a94f', c: '#8a5418' } },
  { id: 'susan',       name: 'Black-Eyed Susan',    kind: 'flower',
    bloom: { F: '#f2c437', f: '#c99a1e', C: '#f2c437', c: '#3d2a12' } },
  { id: 'milkweed',    name: 'Butterfly Milkweed',  kind: 'flower',
    bloom: { F: '#f0862a', f: '#c25e12', C: '#f0862a', c: '#8a4410' } },
  { id: 'blazingstar', name: 'Prairie Blazing Star', kind: 'flower',
    bloom: { F: '#c4519f', f: '#8f3574', C: '#c4519f', c: '#6b2456' } },
  { id: 'tomato',      name: 'Tomatoes',            kind: 'veg',
    bloom: { F: '#d63f2c', f: '#9c2617', C: '#d63f2c', c: '#6d1a10' } },
  { id: 'beans',       name: 'Green Beans',         kind: 'veg',
    bloom: { F: '#8ec95e', f: '#5b9438', C: '#8ec95e', c: '#3f6a26' } }
];
function seedById(id) { return SEEDS.find(s => s.id === id) || null; }

const STAGE_NAMES = ['just planted', 'sprouting', 'growing', 'ready'];

/* ============================================================
   STAGE 4 — TREES AND DEDICATIONS
   ------------------------------------------------------------
   Trees are deliberately the OPPOSITE of the vegetable beds.
   The garden is fussy and daily; a tree is slow and forgiving.

     - Five native species, all available from the start.
     - Three sizes: sapling, young, mature. Five real days at
       each of the first two, so ten days from whip to full
       size — slow enough that the world visibly matures over
       weeks, fast enough that something changes in his first
       week with the game.
     - A SAPLING needs water, exactly as a real newly-planted
       tree needs establishing: on a day it isn't watered it
       simply doesn't grow, and on a hot day it looks thirsty.
       It never dies and never goes backwards.
     - Once it's past sapling it is on its own FOREVER. A week
       away can't undo his trees. That's the point of them.
     - Any tree can be given a dedication, in his own words, at
       any time. It's written into the save and never expires.
   ============================================================ */

const TREE_DAYS_PER_STAGE = 5;

const TREES = [
  { id: 'buroak', name: 'Bur Oak', form: 'round',
    blurb: 'Broad, tough, and older than the town.' },
  { id: 'redbud', name: 'Eastern Redbud', form: 'round',
    blurb: 'Small and low, magenta along every branch.' },
  { id: 'serviceberry', name: 'Serviceberry', form: 'upright',
    blurb: 'Slim and forked. First to flower in spring.' },
  { id: 'hickory', name: 'Shagbark Hickory', form: 'upright',
    blurb: 'Narrow and tall, with bark that peels in plates.' },
  { id: 'sycamore', name: 'American Sycamore', form: 'upright',
    blurb: 'The giant. You can spot its pale trunk for miles.' }
];
function treeById(id) { return TREES.find(t => t.id === id) || null; }

const TREE_STAGE_NAMES = ['a sapling', 'young', 'fully grown'];

/* ---- where a tree can go -----------------------------------
   Prepared planting spots, counted in map squares: three in his
   own backyard and six out on the lawn at Harmon Park. Each one
   is a small ring of turned earth, and each one is solid, so he
   walks up to it exactly the way he walks up to a garden bed
   and can never end up standing inside his own tree.

   Free planting anywhere on the grass is the obvious next step
   after the reveal; these fixed spots are the version that
   cannot possibly wall him into a corner. */
const TREE_SPOTS = {
  /* The backyard is the strip ABOVE the house, not below it — the
     house itself is 13 squares wide and stands on row 21, so the
     middle of the lower yard is roof. These three sit in the two
     clear side strips instead: one up by the top fence, two down
     level with the far corners of the patio. */
  home: [
    { col: 6.5, row: 4.5 },
    { col: 7, row: 17 },
    { col: 29, row: 17 }
  ],
  /* Three down the west lawn and three down the east, leaving the
     middle of the park to the big oak. Anything planted under its
     canopy would simply be hidden behind it. */
  park: [
    { col: 12, row: 10.5 },
    { col: 11, row: 15 },
    { col: 12, row: 19.5 },
    { col: 28, row: 17 },
    { col: 30.5, row: 20.5 },
    { col: 26, row: 22.5 }
  ]
};
/* How solid a planted spot is, in screen pixels. Sized to the
   trunk, not the canopy — so he can tuck in under the leaves
   exactly like he can with every other tree in the game. */
const TREE_BLOCK = [34, 16];

function treeSpotKey(areaKey, i) { return areaKey + ':' + i; }

/* ---- a brand-new tree, the moment it goes in the ground ---- */
function newTree(speciesId, dayKeyStr) {
  return {
    sp: speciesId,   // which species
    st: 0,           // 0 sapling, 1 young, 2 mature
    pr: 0,           // days of growth banked toward the next size
    wat: false,      // watered today?
    th: false,       // thirsty — went through a hot day dry
    ded: null,       // his dedication, or nothing
    pd: dayKeyStr    // the day he planted it
  };
}

/* ---- what one finished day does to one tree ---------------- */
function endTreeDay(t, weather) {
  if (t.st >= 2) return;                 // fully grown; nothing left to do
  if (t.st === 0) {
    // still establishing — it only grows on a day it got water
    if (t.wat) { t.pr++; t.th = false; }
    else if (weather === 'sunny') { t.th = true; }
  } else {
    t.pr++;                              // established: grows on its own
  }
  if (t.pr >= TREE_DAYS_PER_STAGE) { t.pr = 0; t.st++; t.th = false; }
}

/* A date written the way a plaque would write it. */
function prettyDay(key) {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const p = String(key || '').split('-');
  if (p.length !== 3) return '';
  return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1] + ' ' + p[0];
}

/* ---- where the beds are ------------------------------------
   Six raised beds in the patch of back lawn that's been left
   empty since Stage 1 — two rows of three. Counted in map
   squares; each bed is two squares across and one deep, with a
   clear two-square walkway all the way round. */
const GARDEN_PLOTS = [
  { col: 12, row: 5 }, { col: 16, row: 5 }, { col: 20, row: 5 },
  { col: 12, row: 8 }, { col: 16, row: 8 }, { col: 20, row: 8 }
];
const PLOT_TILES_W = 2;

/* ---- a brand-new, empty garden ----------------------------- */
function newGarden() {
  return {
    v: 2,
    day: null,
    plots: GARDEN_PLOTS.map(() => ({
      seed: null, stage: 0, wilted: false, watered: false, care: 0, picked: 0
    })),
    // Stage 4. Kept as a lookup rather than a list, keyed by
    // "which area : which spot", so adding more planting spots
    // later can never shuffle the trees he already has.
    trees: {}
  };
}

/* ---- starting a fresh day ----------------------------------
   If it's a rainy day, every bed counts as watered the moment
   the day begins — that IS the rain doing his job for him. */
function beginDay(g, key) {
  g.day = key;
  const wet = weatherFor(key) === 'rainy';
  g.plots.forEach(p => { p.watered = wet; });
  // Rain waters his saplings too, of course.
  Object.keys(g.trees || {}).forEach(k => { g.trees[k].wat = wet; });
}

/* ---- what one finished day does to one bed -----------------
   The whole growing rulebook, in one place:
     watered + sun     -> grows two stages (sun is a real bonus)
     watered + cloud   -> grows one stage
     watered + rain    -> grows one stage
     dry     + cloud   -> nothing happens
     dry     + sun     -> wilts, and slips back one stage
   A wilted plant never dies and never slips below "just
   planted". It spends two watered days recovering, then carries
   on growing from wherever it got back to. */
function endDay(plot, weather) {
  if (!plot.seed) return;

  if (plot.wilted) {
    if (plot.watered) {
      plot.care++;
      if (plot.care >= 2) { plot.wilted = false; plot.care = 0; }
    } else {
      plot.care = 0;
    }
    return;
  }

  if (plot.watered) {
    plot.stage = Math.min(3, plot.stage + (weather === 'sunny' ? 2 : 1));
  } else if (weather === 'sunny') {
    plot.wilted = true;
    plot.care = 0;
    plot.stage = Math.max(0, plot.stage - 1);
  }
}

/* ---- catching up on days he wasn't here --------------------
   Runs when the app opens, and again if he happens to be
   playing at midnight. Walks forward one real day at a time,
   applying that day's actual weather, so a week away is
   genuinely a week of weather — rain waters for him, sun wilts
   whatever was dry. Nothing is ever lost, only wilted. */
function catchUp(g, todayKey) {
  if (!g.day) { beginDay(g, todayKey); return 0; }
  if (g.day > todayKey) { g.day = todayKey; return 0; }  // clock went backwards

  let passed = 0;
  while (g.day !== todayKey && passed < 400) {
    const w = weatherFor(g.day);
    g.plots.forEach(p => endDay(p, w));
    Object.keys(g.trees || {}).forEach(k => endTreeDay(g.trees[k], w));
    beginDay(g, nextDayKey(g.day));
    passed++;
  }
  // Safety net: if the app genuinely sat unopened for over a year,
  // stop counting day by day and simply arrive at today. Nothing is
  // lost — by then everything is wilted and waiting either way.
  if (g.day !== todayKey) beginDay(g, todayKey);
  return passed;
}

/* ---- remembering, silently ---------------------------------
   One line of text under one name in the browser's own little
   notepad ("localStorage"), rewritten after every plant, every
   watering, and every new day. There is no save button because
   there is nothing to press: it has already happened.
   Wrapped in try/catch because a browser in private mode will
   refuse to write — in that case the game still plays perfectly
   for the session, it just forgets afterwards. */
const SAVE_KEY = 'prairie-village-save-v1';
const MAX_DEDICATION = 60;

/* Trims a dedication down to something a plaque could actually
   hold, and strips out line breaks and stray control characters
   so it can never break the message box it's shown in. */
function cleanDedication(text) {
  const s = String(text == null ? '' : text)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s.slice(0, MAX_DEDICATION);
}

function loadGarden() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return newGarden();
    const data = JSON.parse(raw);
    // Stage 4 bumped the save to version 2 by adding trees. A
    // version 1 save (his garden as it stands today) is read
    // exactly as before and simply arrives with no trees yet —
    // nothing he has already grown is lost.
    if (!data || (data.v !== 1 && data.v !== 2) || !Array.isArray(data.plots)) return newGarden();
    const g = newGarden();
    g.day = typeof data.day === 'string' ? data.day : null;
    for (let i = 0; i < g.plots.length; i++) {
      const s = data.plots[i];
      if (!s) continue;
      g.plots[i] = {
        seed: seedById(s.seed) ? s.seed : null,
        stage: Math.max(0, Math.min(3, s.stage | 0)),
        wilted: !!s.wilted,
        watered: !!s.watered,
        care: Math.max(0, Math.min(2, s.care | 0)),
        picked: Math.max(0, s.picked | 0)
      };
    }
    const t = data.trees;
    if (t && typeof t === 'object') {
      Object.keys(t).forEach(k => {
        const s = t[k];
        if (!s || !treeById(s.sp)) return;
        g.trees[k] = {
          sp: s.sp,
          st: Math.max(0, Math.min(2, s.st | 0)),
          // clamped to one LESS than a full stage: a legitimate save
          // can never hold a full bank (it would already have grown),
          // so this stops a mangled save from handing out a free
          // growth stage on a day the sapling wasn't even watered
          pr: Math.max(0, Math.min(TREE_DAYS_PER_STAGE - 1, s.pr | 0)),
          wat: !!s.wat,
          th: !!s.th,
          ded: s.ded ? cleanDedication(s.ded) : null,
          pd: typeof s.pd === 'string' ? s.pd : null
        };
      });
    }
    return g;
  } catch (e) {
    return newGarden();
  }
}

function saveGarden(g) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(g));
    return true;
  } catch (e) {
    return false;
  }
}


/* ============================================================
   A MAP AREA
   ------------------------------------------------------------
   Somewhere to collect up "what the ground looks like", "what
   objects are standing on it", and "where the edges lead".
   Everything here is counted in map squares, not pixels, which
   makes the layouts below readable.
   ============================================================ */
class AreaData {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.tiles = new Array(w * h).fill('grass');
    this.props = [];
    this.solids = [];
    this.exits = [];
    this.signs = [];
    this.treeSpots = [];
  }
  set(x, y, t) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.tiles[y * this.w + x] = t;
  }
  get(x, y) { return this.tiles[y * this.w + x]; }
  fill(t) { this.tiles.fill(t); }
  rect(x, y, w, h, t) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, t);
  }

  /* An object that stands on the ground: given the middle of its
     base, in map squares. */
  prop(key, cx, baseRow, opts) {
    this.props.push({ key, x: cx * T, y: baseRow * T, mode: 'stand', opts: opts || {} });
    const b = PROP_BLOCK[key];
    if (b && !(opts && opts.walkThrough)) {
      this.solid(cx * T - b[0] / 2, baseRow * T - b[1], b[0], b[1]);
    }
  }

  /* A thing that fills exactly one map square, like a fence panel. */
  tile(key, col, row, block) {
    this.props.push({ key, x: col * T, y: row * T, mode: 'tile' });
    if (block) this.solid(col * T + block[0], row * T + block[1], block[2], block[3]);
  }

  solid(x, y, w, h) { this.solids.push({ x, y, w, h }); }

  /* Runs of fence get ONE long solid box rather than one per panel —
     fewer things for the game to check, and you slide along it more
     smoothly. */
  fenceRow(c0, c1, row) {
    for (let c = c0; c <= c1; c++) this.tile('fence_h', c, row);
    this.solid(c0 * T, row * T + 12, (c1 - c0 + 1) * T, 26);
  }
  fenceCol(col, r0, r1) {
    for (let r = r0; r <= r1; r++) this.tile('fence_v', col, r);
    this.solid(col * T + 9, r0 * T, 30, (r1 - r0 + 1) * T);
  }
  /* Boundary hedges get painted straight into the floor picture rather
     than being hundreds of separate objects. He can never get behind
     one, so nothing is lost — and it keeps the game running smoothly
     on an iPad. */
  hedgeRow(c0, c1, row) {
    this.rect(c0, row, c1 - c0 + 1, 1, 'hedge');
    this.solid(c0 * T, row * T, (c1 - c0 + 1) * T, T);
  }
  hedgeCol(col, r0, r1) {
    this.rect(col, r0, 1, r1 - r0 + 1, 'hedge');
    this.solid(col * T, r0 * T, T, (r1 - r0 + 1) * T);
  }

  /* Walking into this patch takes you somewhere else. */
  exit(col, row, w, h, to, spawnCol, spawnRow) {
    this.exits.push({
      x: col * T, y: row * T, w: w * T, h: h * T,
      to, sx: spawnCol * T, sy: spawnRow * T
    });
  }

  /* A prepared tree-planting spot: a ring of turned earth, given
     as the middle of its base in map squares. It's solid — sized
     to a trunk, not a canopy — so he walks up to it the same way
     he walks up to a garden bed, and can never end up standing
     inside his own tree. */
  treeSpot(cx, baseRow) {
    this.treeSpots.push({ i: this.treeSpots.length, x: cx * T, y: baseRow * T });
    this.solid(cx * T - TREE_BLOCK[0] / 2, baseRow * T - TREE_BLOCK[1],
               TREE_BLOCK[0], TREE_BLOCK[1]);
  }

  /* A sign whose words appear at the bottom of the screen when he
     stands near it. */
  signPost(key, cx, baseRow, text) {
    this.prop(key, cx, baseRow);
    this.signs.push({ x: cx * T, y: baseRow * T, text });
  }
}

const CLOSED_SIGN = 'Trail closed for maintenance — opening soon!';

/* ============================================================
   THE THREE AREAS
   ------------------------------------------------------------
   Loosely Prairie Village: a quiet leafy street, ranch houses set
   well back with deep lawns, and the park just across the road.
   ============================================================ */
const AREAS = {

  /* ---------- HIS HOUSE AND BACKYARD ---------- */
  home: {
    label: 'Home',
    w: 36, h: 28,
    build(a) {
      a.fill('grass');
      a.rect(0, 26, 36, 2, 'walk');        // the sidewalk out front
      a.rect(15, 21, 3, 5, 'path');        // front walk to the door
      a.rect(23, 14, 4, 12, 'conc');       // driveway, running past the
                                           // side of the house into the yard
      a.rect(13, 11, 14, 3, 'path');       // the patio out back

      // the house itself — 13 squares wide, standing on row 21
      a.prop('house_main', 16.5, 21);

      // backyard fence, with the driveway left open as the way in
      a.fenceRow(4, 31, 2);
      a.fenceCol(4, 3, 20);
      a.fenceCol(31, 3, 20);
      a.fenceRow(4, 9, 21);
      a.fenceRow(27, 31, 21);

      // in the backyard — deliberately left roomy in the middle,
      // because that's where the garden beds go in a later stage
      a.prop('tree_b', 6.6, 7);
      a.prop('tree_a', 29.2, 6);
      a.prop('tree_c', 7.2, 12.5);
      a.prop('bench', 11, 12.6);
      a.prop('bush', 5.6, 17.4);
      a.prop('bush', 29.6, 12);
      a.prop('bush', 12, 3.9);
      a.prop('bush', 24, 3.9);
      // These two used to sit at (18, 10.4) and (21, 10.4). Moved
      // out to the corners of the patio in Stage 3 so they're not
      // standing in the walkway between the garden and the house.
      a.prop('bush', 15.5, 10.9);
      a.prop('bush', 24.5, 10.9);

      // THE GARDEN — six raised beds in the patch of lawn that has
      // been kept deliberately empty since Stage 1. The ground under
      // each bed is turned over to dirt, and each bed is solid, so
      // he walks around them rather than over them.
      GARDEN_PLOTS.forEach(p => {
        a.rect(p.col, p.row, PLOT_TILES_W, 1, 'dirt');
        a.solid(p.col * T, p.row * T + 8, PLOT_TILES_W * T, T - 12);
      });

      // the forecast sign, standing at the near corner of the garden
      a.prop('weathersign', 9.2, 7.6);
      a.signs.push({ x: 9.2 * T, y: 7.6 * T, weather: true });

      // STAGE 4 — three planting spots on the open back lawn, well
      // clear of the beds, the patio and the driveway
      TREE_SPOTS.home.forEach(s => a.treeSpot(s.col, s.row));

      // out front
      a.prop('bush', 11.6, 21.9);
      a.prop('bush', 13.2, 21.9);
      a.prop('bush', 20, 21.9);
      a.prop('bush', 21.6, 21.9);
      a.prop('mailbox', 22.4, 25.5);
      a.prop('tree_a', 7.5, 25);
      a.prop('tree_c', 33, 25);
      a.prop('tree_b', 12, 24.4);
      a.prop('tree_c', 29.5, 24.4);

      // hedges standing in for "the rest of the block"
      a.hedgeRow(0, 35, 0);
      a.hedgeRow(0, 35, 1);
      a.hedgeCol(0, 2, 27); a.hedgeCol(1, 2, 27);
      a.hedgeCol(34, 2, 27); a.hedgeCol(35, 2, 27);

      // walking off the bottom puts you out on the street
      a.exit(13, 27.2, 16, 0.8, 'street', 41.5, 2.5);
    }
  },

  /* ---------- THE STREET BETWEEN THEM ---------- */
  street: {
    label: 'The Street',
    w: 56, h: 18,
    build(a) {
      a.fill('grass');
      a.rect(0, 7, 56, 1, 'walk');
      a.rect(0, 8, 56, 4, 'road');
      a.rect(0, 12, 56, 1, 'walk');
      for (let c = 1; c < 54; c += 3) a.set(c, 9, 'roadD');   // centre line

      a.rect(40, 0, 4, 7, 'conc');    // his driveway, heading home
      a.rect(8, 13, 6, 5, 'path');    // the path down into the park

      // neighbours' houses along the north side — each one a
      // different build now (cross-gable, wrap porch, dormer,
      // saltbox), sitting at slightly different setbacks so the
      // taller roofs still fit under the top of the map
      a.prop('house_crossgable', 6, 6.3);
      a.prop('house_wrapporch', 18, 5.7);
      a.prop('house_dormer', 30, 6.6);
      a.prop('house_saltbox', 50, 6.3);
      a.prop('mailbox', 44.6, 6.6);

      // the trees that make it a tree-lined street
      [3, 9, 15, 21, 27, 33, 46, 52].forEach((c, i) => {
        // the two trees by the dormer cottage stand a touch lower
        // so their trunks stay in front of its lawn
        a.prop(i % 2 ? 'tree_a' : 'tree_b', c, (c === 27 || c === 33) ? 6.8 : 6.4);
      });
      [3, 20, 26, 32, 38, 44, 50].forEach((c, i) => {
        a.prop(i % 2 ? 'tree_b' : 'tree_a', c, 14.4);
      });
      a.prop('tree_c', 16, 16.5);
      a.prop('tree_c', 41, 16.5);
      a.prop('bush', 36, 15.5);
      a.prop('bush', 47, 15.5);

      // the park gate
      a.prop('post', 7.6, 13.9);
      a.prop('post', 14.4, 13.9);
      a.prop('parksign', 16.4, 15.3);

      // hedges closing off the block — with gaps left at his own
      // driveway and at the park gate, which are the ways out
      a.hedgeRow(0, 39, 0); a.hedgeRow(44, 55, 0);
      a.hedgeRow(0, 7, 17); a.hedgeRow(14, 55, 17);
      a.hedgeCol(54, 0, 17); a.hedgeCol(55, 0, 17);
      a.hedgeCol(1, 0, 8); a.hedgeCol(1, 11, 17);
      a.hedgeCol(0, 0, 17);

      // ...except right here, where the road carries on west
      a.signPost('sign', 1.5, 11, CLOSED_SIGN);
      a.solid(1 * T, 8 * T, T, 3 * T);

      a.exit(40, 0, 4, 0.8, 'home', 25, 24.5);
      a.exit(8, 17.2, 6, 0.8, 'park', 21, 2);
    }
  },

  /* ---------- HARMON PARK ---------- */
  park: {
    label: 'Harmon Park',
    w: 44, h: 34,
    build(a) {
      a.fill('lawn');
      a.rect(18, 0, 6, 7, 'path');       // in from the street
      a.rect(8, 7, 29, 2, 'path');       // the loop path
      a.rect(8, 25, 29, 2, 'path');
      a.rect(8, 9, 2, 16, 'path');
      a.rect(35, 9, 2, 16, 'path');
      a.rect(21, 27, 3, 7, 'dirt');      // the trail heading south

      // THE BIG OAK — the landmark of the whole park
      a.prop('oak', 22, 18);

      // the gate you came in through
      a.prop('post', 17.5, 6.6);
      a.prop('post', 24.5, 6.6);
      a.prop('parksign', 27.5, 6.4);

      // benches looking out over the lawn
      a.prop('bench', 11.8, 12);
      a.prop('bench', 33, 20);
      a.prop('bench', 16.5, 24.4);

      // the garden shed, on the east lawn — home base for the
      // community garden
      a.prop('shed', 28.5, 13);

      // a handful of trees on the lawn, well clear of the oak
      a.prop('tree_a', 12.5, 16);
      a.prop('tree_c', 31.5, 13.5);
      a.prop('tree_b', 30.5, 23.5);
      a.prop('tree_c', 13, 22);
      a.prop('bush', 26, 10.5);
      a.prop('bush', 18, 10.5);

      // STAGE 4 — six planting spots spread across the open lawn,
      // clear of the oak's shade, the shed, the benches and the
      // loop path. This is the town's job: filling the park in.
      TREE_SPOTS.park.forEach(s => a.treeSpot(s.col, s.row));

      // woods around the edge
      const woods = [];
      for (let c = 2; c <= 41; c += 3) {
        if (c < 16 || c > 25) { woods.push([c, 2.4]); woods.push([c + 1.4, 4.2]); }
        if (c < 19 || c > 25) woods.push([c, 30.6]);
      }
      for (let r = 6; r <= 30; r += 3) {
        woods.push([2.2, r]); woods.push([4.4, r + 1.5]);
        woods.push([41.6, r]); woods.push([39.4, r + 1.5]);
      }
      woods.forEach((p, i) => {
        a.prop(['tree_a', 'tree_b', 'pine', 'tree_c'][i % 4], p[0], p[1]);
      });

      a.hedgeRow(0, 20, 33); a.hedgeRow(24, 43, 33);
      a.hedgeRow(0, 20, 32);
      a.hedgeRow(24, 43, 32);
      a.hedgeCol(0, 0, 33); a.hedgeCol(43, 0, 33);
      a.hedgeRow(0, 17, 0);
      a.hedgeRow(24, 43, 0);

      // ...and the trail that isn't ready yet
      a.signPost('sign', 22.5, 32.8, CLOSED_SIGN);
      a.solid(21 * T, 32 * T, 3 * T, T);

      a.exit(18, 0, 6, 0.8, 'street', 11, 15.5);
    }
  }
};

/* ============================================================
   THE GAME
   ============================================================ */
class PrairieScene extends Phaser.Scene {
  constructor() { super('prairie'); }

  create() {
    this.input.addPointer(3);
    this.cameras.main.setBackgroundColor('#4e7d3a');
    this.cameras.main.roundPixels = true;

    /* Stage 3 — before anything is drawn, pick up where he left off.
       loadGarden() reads the one line the browser wrote down last
       time; catchUp() then walks forward through every real day
       that has passed since, applying that day's actual weather. */
    this.garden = loadGarden();
    this.daysAway = catchUp(this.garden, dayKey(new Date()));
    if (this.daysAway > 0) saveGarden(this.garden);
    this.weatherToday = weatherFor(this.garden.day);
    this.weatherTomorrow = weatherFor(nextDayKey(this.garden.day));
    this.activePlot = -1;
    this.activeTree = -1;
    this.menuOpen = false;
    this.plotViews = [];
    this.treeViews = [];
    this.signIcons = [];
    this.dedicationBox = null;

    this.buildArt();
    this.buildPlayer();
    this.buildControls();

    this.keys = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');

    this.stickPointerId = null;
    this.stickVector = new Phaser.Math.Vector2(0, 0);
    this.actionCount = 0;
    this.facing = 'down';
    this.transitioning = false;
    this.worldObjects = [];

    this.input.on('pointerdown', (p) => this.onDown(p));
    this.input.on('pointermove', (p) => this.onMove(p));
    this.input.on('pointerup', (p) => this.onUp(p));
    this.input.on('pointerupoutside', (p) => this.onUp(p));

    this.scale.on('resize', () => {
      // Only tidy away a menu drawn INSIDE the game. The dedication
      // box is a real text box living above the game, and it looks
      // after itself — closing it here would yank the keyboard away
      // mid-sentence when the phone rotates.
      if (this.menuObjects) this.closeChoiceMenu();
      this.layoutControls();
    });
    this.buildWeatherLook();
    this.layoutControls();

    // Start at his own back door, more or less.
    this.enterArea('home', 25 * T, 24.5 * T);

    // If real days went by while the app was closed, say so once.
    if (this.daysAway === 1) {
      this.time.delayedCall(2400, () => this.toast(
        'A new day — ' + WEATHER[this.weatherToday].label.toLowerCase() + '.', 3200));
    } else if (this.daysAway > 1) {
      this.time.delayedCall(2400, () => this.toast(
        this.daysAway + ' days have gone by. Today is ' +
        WEATHER[this.weatherToday].label.toLowerCase() + '.', 3600));
    }
  }

  /* ---------------------------------------------------------
     Turning the drawings into pictures the game can use
     --------------------------------------------------------- */
  makeTexture(key, w, h, draw, outlineColor) {
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.createCanvas(key, w, h);
    const ctx = tex.context || tex.getContext();
    draw(ctx);
    if (outlineColor) outlinePass(ctx, w, h, outlineColor);
    tex.refresh();
    this.propSize[key] = { w, h };
    return tex;
  }

  smallCanvas(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'));
    return c;
  }

  /* Same, but traces a dark outline afterward — used for anything
     built from round shapes rather than typed-out pixel art. */
  smallCanvasOutlined(w, h, draw, outlineColor) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    draw(ctx);
    outlinePass(ctx, w, h, outlineColor);
    return c;
  }

  buildArt() {
    this.propSize = {};

    // Which of the six time-of-day looks is active right now —
    // everything in the game, him and Henri included as of Aug 2,
    // is colored from this one palette rather than any private
    // hex table.
    this.palette = computePalette(new Date());
    const pal = this.palette;

    /* ---- him ---- */
    // Turn his 14-letter role map into an actual palette by looking
    // each role up in the active six-color set.
    const heroPal = {};
    Object.keys(HERO_ROLE_MAP).forEach(k => { heroPal[k] = pal[HERO_ROLE_MAP[k]]; });

    const frames = heroFrames();
    const hw = 32 * SCALE;
    if (this.textures.exists('hero')) this.textures.remove('hero');
    const hero = this.textures.createCanvas('hero', frames.length * hw, hw);
    const hctx = hero.context || hero.getContext();
    frames.forEach((f, i) => drawPixels(hctx, f.rows, heroPal, i * hw, 0, SCALE));
    frames.forEach((f, i) => hero.add(f.name, 0, i * hw, 0, hw, hw));
    hero.refresh();

    ['down', 'left', 'right', 'up'].forEach(dir => {
      const key = 'walk-' + dir;
      if (this.anims.exists(key)) return;
      this.anims.create({
        key,
        frames: [dir + '0', dir + '1', dir + '0', dir + '2'].map(f => ({ key: 'hero', frame: f })),
        frameRate: 8,
        repeat: -1
      });
    });

    this.buildHenriArt(pal);

    /* ---- the ground ---- */
    // Fences, signposts, and the hedge all use letter grids too, so
    // their "palettes" are just the six roles under different names.
    const FENCE_PAL = { K: pal.K, W: pal.M, w: pal.D };
    const SIGN_PAL = { K: pal.K, W: pal.M, w: pal.D, R: pal.L, P: pal.D };

    this.tileArt = {
      grass: [0, 1, 2].map(i => this.smallCanvas(16, 16, c => paintGrassRole(c, pal, 11 + i * 37))),
      lawn: [0, 1].map(i => this.smallCanvas(16, 16, c => paintGrassRole(c, pal, 3 + i * 19))),
      road: [0, 1].map(i => this.smallCanvas(16, 16, c => paintRoad(c, pal, 5 + i * 23, false))),
      roadD: [this.smallCanvas(16, 16, c => paintRoad(c, pal, 5, true))],
      walk: [0, 1].map(i => this.smallCanvas(16, 16, c => paintWalk(c, pal, 7 + i * 41))),
      path: [0, 1].map(i => this.smallCanvas(16, 16, c => paintTile(c, 16, 16, pal.M, [pal.D, pal.L], 13 + i * 29))),
      conc: [0, 1].map(i => this.smallCanvas(16, 16, c => paintTile(c, 16, 16, pal.L, [pal.M, pal.D], 17 + i * 31))),
      dirt: [0, 1].map(i => this.smallCanvas(16, 16, c => paintTile(c, 16, 16, pal.D, [pal.E, pal.M], 23 + i * 43))),
      hedge: [this.smallCanvas(16, 16, c => drawPixels(c, HEDGE_ROWS, pal))]
    };

    /* ---- everything that stands on the ground ---- */
    [['tree_a', TREE_A_ROWS], ['tree_b', TREE_B_ROWS], ['tree_c', TREE_C_ROWS],
     ['pine', PINE_ROWS], ['bush', BUSH_ROWS], ['oak', OAK_ROWS]].forEach(([key, rows]) => {
      const sz = gridSize(rows);
      this.makeTexture(key, sz.w, sz.h, c => drawPixels(c, rows, pal));
    });

    /* Buildings come from typed letter-grids now, exactly like the
       trees — same drawPixels call, same six-role palette. Their
       outlines are drawn into the grids themselves, so no extra
       outline pass is needed. */
    [['house_main', HOUSE_MAIN_ROWS],
     ['house_crossgable', HOUSE_CROSSGABLE_ROWS],
     ['house_wrapporch', HOUSE_WRAPPORCH_ROWS],
     ['house_dormer', HOUSE_DORMER_ROWS],
     ['house_saltbox', HOUSE_SALTBOX_ROWS],
     ['shed', SHED_ROWS]].forEach(([key, rows]) => {
      const sz = gridSize(rows);
      this.makeTexture(key, sz.w, sz.h, c => drawPixels(c, rows, pal));
    });

    this.makeTexture('fence_h', 16, 16, c => drawPixels(c, FENCE_H, FENCE_PAL));
    this.makeTexture('fence_v', 16, 16, c => drawPixels(c, FENCE_V, FENCE_PAL));
    this.makeTexture('sign', 30, 25, c => drawPixels(c, SIGN_ROWS, SIGN_PAL));
    this.makeTexture('parksign', 32, 15, c => drawPixels(c, PARKSIGN_ROWS, SIGN_PAL));
    this.makeTexture('mailbox', 17, 17, c => drawMailbox(c, 17, 17, pal), pal.K);
    this.makeTexture('bench', 28, 18, c => drawBench(c, 28, 18, pal), pal.K);
    this.makeTexture('post', 14, 26, c => drawStonePost(c, 14, 26, pal), pal.K);

    /* ---- Stage 3: the garden ----
       The bed is drawn twice from the SAME typed grid — once with
       dry soil colors, once with wet ones. That colour change is
       the whole "I already watered this" signal. */
    const BED_DRY = { K: pal.K, W: pal.M, w: pal.D, m: pal.M, d: pal.D, e: pal.E };
    const BED_WET = { K: pal.K, W: pal.D, w: pal.E, m: pal.D, d: pal.E, e: pal.K };
    const bsz = gridSize(BED_ROWS);
    this.makeTexture('bed_dry', bsz.w, bsz.h, c => drawPixels(c, BED_ROWS, BED_DRY));
    this.makeTexture('bed_wet', bsz.w, bsz.h, c => drawPixels(c, BED_ROWS, BED_WET));

    /* Every bed's planting is drawn on a little 32 x 26 canvas that
       sits on top of the bed — 32 across because that's exactly how
       wide a bed is, 26 tall so a blazing star can stand up proud
       of it. */
    const PW = 32, PH = 26;
    const leafPal = {
      K: pal.K, E: pal.E, D: pal.D, M: pal.M, L: pal.L, S: pal.S,
      w: pal.M, d: pal.D, e: pal.E
    };
    /* Flowers keep their own real colour, nudged a quarter of the
       way toward whatever light the world is in, so a coneflower is
       always purple but goes quiet at dusk with everything else. */
    const lit = hex => blendHex(hex, pal.M, 0.25);

    this.makeTexture('plant_seed', PW, PH,
      c => drawPixels(c, clumpRows(P_SEED, PW, PH), leafPal));
    this.makeTexture('plant_sprout_flower', PW, PH,
      c => drawPixels(c, clumpRows(P_SPROUT_FLOWER, PW, PH), leafPal));
    this.makeTexture('plant_sprout_veg', PW, PH,
      c => drawPixels(c, clumpRows(P_SPROUT_VEG, PW, PH), leafPal));

    const PLANT_GRIDS = {
      coneflower:  [P_CONEFLOWER_GROW, P_CONEFLOWER_BLOOM],
      susan:       [P_SUSAN_GROW, P_SUSAN_BLOOM],
      milkweed:    [P_MILKWEED_GROW, P_MILKWEED_BLOOM],
      blazingstar: [P_BLAZINGSTAR_GROW, P_BLAZINGSTAR_BLOOM],
      tomato:      [P_TOMATO_GROW, P_TOMATO_BLOOM],
      beans:       [P_BEANS_GROW, P_BEANS_BLOOM]
    };
    SEEDS.forEach(s => {
      const pl = Object.assign({}, leafPal, {
        F: lit(s.bloom.F), f: lit(s.bloom.f),
        C: lit(s.bloom.C), c: lit(s.bloom.c)
      });
      const grids = PLANT_GRIDS[s.id];
      this.makeTexture('plant_' + s.id + '_grow', PW, PH,
        c => drawPixels(c, clumpRows(grids[0], PW, PH), pl));
      this.makeTexture('plant_' + s.id + '_bloom', PW, PH,
        c => drawPixels(c, clumpRows(grids[1], PW, PH), pl));
    });

    const wsz = gridSize(WSIGN_ROWS);
    this.makeTexture('weathersign', wsz.w, wsz.h, c => drawPixels(c, WSIGN_ROWS, FENCE_PAL));

    const ICON_PAL = {
      K: pal.K, L: pal.L, M: pal.M,
      F: lit('#f6d24a'), S: lit('#fff3c4'), B: lit('#7fc4e8')
    };
    [['icon_sun', ICON_SUN], ['icon_cloud', ICON_CLOUD], ['icon_rain', ICON_RAIN]]
      .forEach(pair => {
        const g = gridSize(pair[1]);
        this.makeTexture(pair[0], g.w, g.h, c => drawPixels(c, pair[1], ICON_PAL));
      });

    /* ---- Stage 4: the trees ----
       Straight through the same six roles as every other living
       thing. The two flowering species get their real blossom
       colour, nudged a quarter of the way toward whatever light
       the world is in — exactly the treatment the garden flowers
       already get, so a redbud is always pink but goes quiet at
       dusk along with everything else. */
    const treePal = { K: pal.K, E: pal.E, D: pal.D, M: pal.M, L: pal.L, S: pal.S };

    [['tree_sapling', T_SAPLING],
     ['tree_young_round', T_YOUNG_ROUND],
     ['tree_young_upright', T_YOUNG_UPRIGHT]].forEach(([key, rows]) => {
      const sz = gridSize(rows);
      this.makeTexture(key, sz.w, sz.h, c => drawPixels(c, rows, treePal));
    });

    const TREE_GRIDS = {
      buroak: T_BUROAK, redbud: T_REDBUD, serviceberry: T_SERVICEBERRY,
      hickory: T_HICKORY, sycamore: T_SYCAMORE
    };
    const TREE_BLOSSOM = {
      redbud:       { F: '#d47ab8', f: '#a3468c' },
      serviceberry: { F: '#f7f2e4', f: '#8d3a3a' }
    };
    TREES.forEach(t => {
      const tp = Object.assign({}, treePal);
      const b = TREE_BLOSSOM[t.id];
      if (b) { tp.F = lit(b.F); tp.f = lit(b.f); }
      const rows = TREE_GRIDS[t.id];
      const sz = gridSize(rows);
      this.makeTexture('tree_' + t.id, sz.w, sz.h, c => drawPixels(c, rows, tp));
    });

    // the ring of turned earth, and the little plaque
    const HOLE_PAL = { K: pal.K, m: pal.D, d: pal.E, e: pal.K, l: pal.L };
    const hsz = gridSize(T_HOLE);
    this.makeTexture('treehole', hsz.w, hsz.h, c => drawPixels(c, T_HOLE, HOLE_PAL));
    const qsz = gridSize(T_PLAQUE);
    this.makeTexture('plaque', qsz.w, qsz.h, c => drawPixels(c, T_PLAQUE, treePal));
  }

  /* Henri gets his own small spritesheet: 9 frames (3 directions x
     2 walk frames + 1 sit frame each). Each frame is drawn and
     outlined on its own little canvas first, then stamped into the
     sheet — outlining the whole sheet at once would smear a line
     across the gap between frames. */
  buildHenriArt(pal) {
    const HW = HENRI_W, HH = HENRI_H;
    const specs = [
      ['down0', 'down', false, false], ['down1', 'down', false, true], ['downSit', 'down', true, false],
      ['up0', 'up', false, false], ['up1', 'up', false, true], ['upSit', 'up', true, false],
      ['left0', 'left', false, false], ['left1', 'left', false, true], ['leftSit', 'left', true, false]
    ];
    if (this.textures.exists('henri')) this.textures.remove('henri');
    const tex = this.textures.createCanvas('henri', specs.length * HW, HH);
    const ctx = tex.context || tex.getContext();
    specs.forEach((s, i) => {
      // The grids carry their own K outline, so no outline pass here —
      // running one would fatten his line to two pixels.
      const frame = document.createElement('canvas');
      frame.width = HW; frame.height = HH;
      drawHenri(frame.getContext('2d'), s[1], s[2], s[3], pal);
      ctx.drawImage(frame, i * HW, 0);
    });
    tex.refresh();
    specs.forEach((s, i) => tex.add(s[0], 0, i * HW, 0, HW, HH));

    ['down', 'up', 'left'].forEach(dir => {
      const key = 'henri-walk-' + dir;
      if (this.anims.exists(key)) return;
      this.anims.create({
        key,
        frames: [dir + '0', dir + '1'].map(f => ({ key: 'henri', frame: f })),
        frameRate: 6,
        repeat: -1
      });
    });
  }

  /* Stitch the whole floor of an area into one big picture. Much
     kinder on an iPad than drawing a thousand little squares. */
  paintGround(key, a) {
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.createCanvas(key, a.w * ART, a.h * ART);
    const ctx = tex.context || tex.getContext();
    for (let y = 0; y < a.h; y++) {
      for (let x = 0; x < a.w; x++) {
        const variants = this.tileArt[a.get(x, y)] || this.tileArt.grass;
        const v = variants[(x * 7 + y * 11 + ((x * y) % 5)) % variants.length];
        ctx.drawImage(v, x * ART, y * ART);
      }
    }
    tex.refresh();
    return tex;
  }

  /* ---------------------------------------------------------
     Moving into an area (and out of the old one)
     --------------------------------------------------------- */
  enterArea(key, spawnX, spawnY) {
    const def = AREAS[key];
    const a = new AreaData(def.w, def.h);
    def.build(a);

    // tidy away whatever was here before
    if (this.worldObjects) this.worldObjects.forEach(o => o.destroy());
    this.worldObjects = [];
    if (this.blockerCollider) { this.blockerCollider.destroy(); this.blockerCollider = null; }
    if (this.blockers) { this.blockers.clear(true, true); this.blockers.destroy(); this.blockers = null; }
    if (this.groundImage) { this.groundImage.destroy(); this.groundImage = null; }
    if (this.plotViews) this.plotViews.forEach(v => { v.bed.destroy(); v.plant.destroy(); });
    this.plotViews = [];
    if (this.signIcons) this.signIcons.forEach(i => i.destroy());
    this.signIcons = [];
    if (this.plotGlow) { this.plotGlow.destroy(); this.plotGlow = null; }
    if (this.treeViews) this.treeViews.forEach(v => {
      v.hole.destroy(); v.tree.destroy(); v.plaque.destroy();
    });
    this.treeViews = [];
    if (this.treeGlow) { this.treeGlow.destroy(); this.treeGlow = null; }
    this.activePlot = -1;
    this.activeTree = -1;
    this.actionVerbShown = null;
    if (this.textures.exists('ground')) this.textures.remove('ground');

    // the floor
    this.paintGround('ground', a);
    this.groundImage = this.add.image(0, 0, 'ground')
      .setOrigin(0, 0).setScale(SCALE).setDepth(-10);

    // everything standing on it
    this.blockers = this.physics.add.staticGroup();
    a.props.forEach(p => {
      const img = this.add.image(p.x, p.y, p.key).setScale(SCALE);
      if (p.mode === 'tile') {
        img.setOrigin(0, 0).setDepth(p.y + T - 8);
      } else {
        img.setOrigin(0.5, 1).setDepth(p.y);
      }
      this.worldObjects.push(img);
    });
    a.solids.forEach(s => {
      const z = this.add.zone(s.x + s.w / 2, s.y + s.h / 2, s.w, s.h);
      this.blockers.add(z);
      z.body.updateFromGameObject();
    });

    if (key === 'home') this.buildGardenViews(a);
    if (a.treeSpots.length) this.buildTreeViews(a, key);

    const W = a.w * T, H = a.h * T;
    this.physics.world.setBounds(0, 0, W, H);
    this.cameras.main.setBounds(0, 0, W, H);

    this.player.body.reset(spawnX, spawnY);
    this.blockerCollider = this.physics.add.collider(this.player, this.blockers);
    this.cameras.main.centerOn(spawnX, spawnY);

    // Henri rides along in the fade rather than retracing the whole
    // walk from the old area — he just reappears at your heel.
    this.henriTrail = [];
    if (this.henri) {
      this.henri.setPosition(spawnX, spawnY + T * 0.6);
      this.henriState = 'sit';
      this.henriFacing = 'down';
    }

    this.areaKey = key;
    this.area = a;
    this.exitCooldown = 350;

    this.showAreaLabel(def.label);
    this.hideMessage();
  }

  goTo(target, sx, sy) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.player.body.setVelocity(0, 0);
    this.cameras.main.fadeOut(150, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.enterArea(target, sx, sy);
      this.cameras.main.fadeIn(200, 0, 0, 0);
      this.time.delayedCall(210, () => { this.transitioning = false; });
    });
  }

  /* ---------------------------------------------------------
     Him
     --------------------------------------------------------- */
  buildPlayer() {
    this.shadow = this.add.ellipse(0, 0, 42, 14, 0x1d2b16, 0.22);

    this.player = this.add.sprite(0, 0, 'hero', 'down0');
    this.player.setOrigin(0.5, 1);
    this.physics.add.existing(this.player);
    // What actually bumps into things is his feet, not his whole
    // body — that's why he can stand slightly "under" a tree.
    this.player.body.setSize(42, 18);
    this.player.body.setOffset(27, 78);
    this.player.body.setCollideWorldBounds(true);

    this.cameras.main.startFollow(this.player, true, 0.14, 0.14);

    // Henri — no physics body of his own. He simply retraces the
    // path his human just walked, which is what keeps him out of
    // fences and trees without needing his own collision checks.
    this.henriShadow = this.add.ellipse(0, 0, 26, 9, 0x1d2b16, 0.22);
    this.henri = this.add.sprite(0, 0, 'henri', 'downSit');
    this.henri.setOrigin(0.5, 1);
    this.henriTrail = [];
    this.henriState = 'sit';
    this.henriFacing = 'down';
  }

  /* ---------------------------------------------------------
     On-screen controls  (unchanged from Stage 0)
     --------------------------------------------------------- */
  buildControls() {
    const D = 10000;

    this.stickBase = this.add.circle(0, 0, TUNING.stickMaxRadius, 0xffffff, 0.16)
      .setScrollFactor(0).setDepth(D).setVisible(false);
    this.stickBase.setStrokeStyle(3, 0xffffff, 0.35);

    this.stickKnob = this.add.circle(0, 0, 26, 0xffffff, 0.42)
      .setScrollFactor(0).setDepth(D + 1).setVisible(false);

    this.actionHint = this.add.text(0, 0, 'tap anywhere\non this side', {
      fontFamily: '-apple-system, sans-serif', fontSize: '14px',
      color: '#ffffff', align: 'center'
    }).setOrigin(0.5).setAlpha(0.22).setScrollFactor(0).setDepth(D);

    // the little box that reads out a sign
    this.msgBox = this.add.rectangle(0, 0, 10, 10, 0x2b1d11, 0.9)
      .setScrollFactor(0).setDepth(D + 4).setVisible(false);
    this.msgBox.setStrokeStyle(3, 0xcb9f63, 0.95);
    this.msgText = this.add.text(0, 0, '', {
      fontFamily: '-apple-system, sans-serif', fontSize: '17px',
      color: '#f6ecd6', align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 5).setVisible(false);

    // the name of wherever you've just walked into
    this.areaLabel = this.add.text(0, 0, '', {
      fontFamily: '-apple-system, sans-serif', fontSize: '26px',
      color: '#ffffff', align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 3).setAlpha(0);
    this.areaLabel.setShadow(0, 3, '#000000', 6, false, true);

    // the round action button, and the word telling him what it
    // will do right now — the one context-sensitive button
    this.actionRing = this.add.circle(0, 0, 46, 0xf6ecd6, 0.13)
      .setScrollFactor(0).setDepth(D).setVisible(false);
    this.actionRing.setStrokeStyle(3, 0xf6ecd6, 0.55);
    this.actionLabel = this.add.text(0, 0, '', {
      fontFamily: '-apple-system, sans-serif', fontSize: '15px',
      color: '#fff8e8', align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 1).setVisible(false);

    this.readout = this.add.text(10, 10, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.35)', padding: { x: 6, y: 4 }
    }).setScrollFactor(0).setDepth(D + 2);
  }

  layoutControls() {
    const w = this.scale.width, h = this.scale.height;
    this.actionHint.setPosition(w * 0.75, h * 0.62);
    this.actionRing.setPosition(w * 0.75, h * 0.62);
    this.actionLabel.setPosition(w * 0.75, h * 0.62);
    this.readout.setPosition(10, 10);
    this.areaLabel.setPosition(w * 0.5, 52);
    this.msgText.setPosition(w * 0.5, h - 52);
    this.msgBox.setPosition(w * 0.5, h - 52);
  }

  showAreaLabel(text) {
    this.areaLabel.setText(text).setAlpha(0);
    this.tweens.killTweensOf(this.areaLabel);
    this.tweens.add({
      targets: this.areaLabel,
      alpha: { from: 0, to: 1 },
      duration: 400,
      yoyo: true,
      hold: 1100,
      ease: 'Quad.Out'
    });
  }

  showMessage(text) {
    if (this.msgShowing === text) return;
    this.msgShowing = text;
    this.msgText.setText(text).setVisible(true);
    const b = this.msgText.getBounds();
    this.msgBox.setSize(b.width + 34, b.height + 22).setVisible(true);
    this.layoutControls();
  }

  hideMessage() {
    this.msgShowing = null;
    this.msgText.setVisible(false);
    this.msgBox.setVisible(false);
  }

  /* ---------------------------------------------------------
     Touch input  (unchanged from Stage 0)
     --------------------------------------------------------- */
  onDown(p) {
    if (this.menuOpen) return;
    if (p.x >= this.scale.width * 0.5) { this.pressAction(p.x, p.y); return; }
    if (this.stickPointerId === null) {
      this.stickPointerId = p.id;
      this.stickBase.setPosition(p.x, p.y).setVisible(true);
      this.stickKnob.setPosition(p.x, p.y).setVisible(true);
    }
  }

  onMove(p) {
    if (this.menuOpen) return;
    if (p.id !== this.stickPointerId) return;
    const dx = p.x - this.stickBase.x;
    const dy = p.y - this.stickBase.y;
    const dist = Math.min(Math.hypot(dx, dy), TUNING.stickMaxRadius);
    const angle = Math.atan2(dy, dx);

    this.stickKnob.setPosition(
      this.stickBase.x + Math.cos(angle) * dist,
      this.stickBase.y + Math.sin(angle) * dist
    );

    if (dist < TUNING.stickDeadZone) {
      this.stickVector.set(0, 0);
    } else {
      const strength = (dist - TUNING.stickDeadZone) /
                       (TUNING.stickMaxRadius - TUNING.stickDeadZone);
      this.stickVector.set(Math.cos(angle) * strength, Math.sin(angle) * strength);
    }
  }

  onUp(p) {
    if (p.id !== this.stickPointerId) return;
    this.stickPointerId = null;
    this.stickVector.set(0, 0);
    this.stickBase.setVisible(false);
    this.stickKnob.setVisible(false);
  }

  pressAction(x, y) {
    this.actionCount++;
    const ring = this.add.circle(x, y, 18, 0xffffff, 0)
      .setScrollFactor(0).setDepth(10005);
    ring.setStrokeStyle(3, 0xffffff, 0.9);
    this.tweens.add({
      targets: ring,
      scale: { from: 0.5, to: 2.1 },
      alpha: { from: 1, to: 0 },
      duration: 320, ease: 'Quad.Out',
      onComplete: () => ring.destroy()
    });

    // Stage 3: if he's standing at a bed, the button does the
    // gardening rather than nothing at all.
    if (this.activePlot >= 0) { this.doPlotAction(this.activePlot); return; }
    // Stage 4: and if he's at a planting spot, it does the trees.
    if (this.activeTree >= 0) this.doTreeAction(this.activeTree);
  }

  resolveDirection(vx, vy) {
    const mag = Math.min(1, Math.hypot(vx, vy));
    if (mag === 0) return { x: 0, y: 0 };
    const snapped = Math.round(Math.atan2(vy, vx) / SNAP_STEP) * SNAP_STEP;
    return { x: Math.cos(snapped) * mag, y: Math.sin(snapped) * mag };
  }

  /* ---------------------------------------------------------
     Every frame
     --------------------------------------------------------- */
  update(time, delta) {
    if (this.transitioning || !this.area) {
      if (this.player) this.player.body.setVelocity(0, 0);
      return;
    }
    if (this.menuOpen) { this.player.body.setVelocity(0, 0); return; }
    if (this.exitCooldown > 0) this.exitCooldown -= delta;

    let vx = this.stickVector.x;
    let vy = this.stickVector.y;

    // keyboard, for testing on a laptop
    if (this.keys.left.isDown || this.wasd.A.isDown) vx = -1;
    else if (this.keys.right.isDown || this.wasd.D.isDown) vx = 1;
    if (this.keys.up.isDown || this.wasd.W.isDown) vy = -1;
    else if (this.keys.down.isDown || this.wasd.S.isDown) vy = 1;

    const dir = this.resolveDirection(vx, vy);
    this.player.body.setVelocity(dir.x * TUNING.playerSpeed, dir.y * TUNING.playerSpeed);

    const moving = dir.x !== 0 || dir.y !== 0;
    if (moving) {
      if (Math.abs(dir.x) > Math.abs(dir.y)) this.facing = dir.x > 0 ? 'right' : 'left';
      else this.facing = dir.y > 0 ? 'down' : 'up';
      const anim = 'walk-' + this.facing;
      const cur = this.player.anims.currentAnim;
      if (!cur || cur.key !== anim || !this.player.anims.isPlaying) this.player.play(anim, true);
    } else {
      this.player.anims.stop();
      this.player.setFrame(this.facing + '0');
    }

    // keep him sorted correctly against the trees and houses
    this.player.setDepth(this.player.y);
    this.shadow.setPosition(this.player.x, this.player.y - 3).setDepth(this.player.y - 1);

    this.updateHenri(delta, moving);

    this.checkSigns();
    this.checkExits();

    // has midnight slipped past while he's been playing?
    this.dayCheck = (this.dayCheck || 0) - delta;
    if (this.dayCheck <= 0) { this.dayCheck = 4000; this.checkNewDay(); }

    // A garden bed always wins over a planting spot, but the two
    // are far enough apart in both areas that it never comes up.
    this.activePlot = this.nearestPlot();
    this.activeTree = (this.activePlot >= 0) ? -1 : this.nearestTreeSpot();
    this.updatePlotHint();
    this.stepRain(delta);

    this.readout.setText([
      `fps     ${Math.round(this.game.loop.actualFps)}`,
      `where   ${this.areaKey}`,
      `facing  ${this.facing}`,
      `day     ${this.garden.day}`,
      `weather ${this.weatherToday}`
    ].join('\n'));
  }

  checkSigns() {
    // a message he just triggered himself wins over any sign
    if (this.time.now < (this.toastUntil || 0)) return;
    let found = null;
    for (const s of this.area.signs) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y) < 130) {
        found = s.weather ? this.forecastText() : s.text; break;
      }
    }
    if (found) this.showMessage(found);
    else if (this.msgShowing) this.hideMessage();
  }

  checkExits() {
    if (this.exitCooldown > 0) return;
    const b = this.player.body;
    for (const e of this.area.exits) {
      if (b.right > e.x && b.left < e.x + e.w &&
          b.bottom > e.y && b.top < e.y + e.h) {
        this.goTo(e.to, e.sx, e.sy);
        return;
      }
    }
  }

  /* ---------------------------------------------------------
     THE GARDEN
     ------------------------------------------------------------
     Six raised beds in the back lawn. The rules live up in the
     weather-and-growing block; everything down here is just
     showing them on screen and listening for his thumb.
     --------------------------------------------------------- */

  /* Make the beds, the plants standing in them, the little
     highlight that shows which bed he's at, and the two weather
     pictures on the forecast sign. Called once, when he walks
     into the backyard. */
  buildGardenViews(a) {
    GARDEN_PLOTS.forEach((p) => {
      const x = p.col * T, y = p.row * T;
      const bed = this.add.image(x, y, 'bed_dry')
        .setOrigin(0, 0).setScale(SCALE).setDepth(y + 2);
      const plant = this.add.image(x + PLOT_TILES_W * T / 2, y + 13 * SCALE, 'plant_seed')
        .setOrigin(0.5, 1).setScale(SCALE).setDepth(y + T - 6).setVisible(false);
      this.plotViews.push({ bed, plant });
    });

    this.plotGlow = this.add.rectangle(0, 0, PLOT_TILES_W * T, T, 0xfff2c4, 0.10)
      .setOrigin(0, 0).setVisible(false).setDepth(3);
    this.plotGlow.setStrokeStyle(3, 0xfff2c4, 0.85);

    // the two weather pictures, nailed onto the sign's panels
    const sign = a.props.filter(pr => pr.key === 'weathersign')[0];
    if (sign) {
      const sz = this.propSize['weathersign'];
      const left = sign.x - (sz.w * SCALE) / 2;
      const top = sign.y - sz.h * SCALE;
      [[4, 'weatherToday'], [19, 'weatherTomorrow']].forEach(spot => {
        const ic = this.add.image(left + spot[0] * SCALE, top + 4 * SCALE,
                                  WEATHER[this[spot[1]]].icon)
          .setOrigin(0, 0).setScale(SCALE).setDepth(sign.y + 1);
        this.signIcons.push(ic);
      });
    }

    this.refreshGarden();
  }

  /* Redraw every bed from the saved numbers. Called after any
     change, so there's only ever one place that decides what a
     bed looks like. */
  refreshGarden() {
    if (!this.plotViews || !this.plotViews.length) return;
    this.garden.plots.forEach((p, i) => {
      const v = this.plotViews[i];
      if (!v) return;
      v.bed.setTexture(p.watered ? 'bed_wet' : 'bed_dry');

      if (!p.seed) { v.plant.setVisible(false); return; }
      const s = seedById(p.seed);
      let key;
      if (p.stage === 0) key = 'plant_seed';
      else if (p.stage === 1) key = (s.kind === 'veg') ? 'plant_sprout_veg' : 'plant_sprout_flower';
      else if (p.stage === 2) key = 'plant_' + s.id + '_grow';
      else key = 'plant_' + s.id + '_bloom';

      v.plant.setTexture(key).setVisible(true);
      // a wilted plant goes grey-green and droops a couple of
      // pixels — same drawing, just tired
      v.plant.setTint(p.wilted ? 0x9aa07e : 0xffffff);
      v.plant.y = GARDEN_PLOTS[i].row * T + 13 * SCALE + (p.wilted ? 3 : 0);
    });
  }

  refreshSignIcons() {
    if (!this.signIcons || this.signIcons.length < 2) return;
    this.signIcons[0].setTexture(WEATHER[this.weatherToday].icon);
    this.signIcons[1].setTexture(WEATHER[this.weatherTomorrow].icon);
  }

  /* Which bed is he standing at? -1 for none. The reach is a bit
     under half the gap between beds, so it's never ambiguous. */
  nearestPlot() {
    if (this.areaKey !== 'home' || !this.plotViews.length) return -1;
    let best = -1, bestD = 92;
    GARDEN_PLOTS.forEach((p, i) => {
      const cx = p.col * T + PLOT_TILES_W * T / 2;
      const cy = p.row * T + T / 2;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, cx, cy);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  /* What the one action button will do if he presses it now. */
  plotVerb(i) {
    const p = this.garden.plots[i];
    if (!p.seed) return 'PLANT';
    if (!p.watered) return 'WATER';
    if (p.stage === 3 && !p.wilted) {
      return (seedById(p.seed).kind === 'veg') ? 'HARVEST' : 'REPLANT';
    }
    return 'CHECK';
  }

  updatePlotHint() {
    const i = this.activePlot;
    if (this.plotGlow) {
      if (i >= 0) {
        this.plotGlow
          .setPosition(GARDEN_PLOTS[i].col * T, GARDEN_PLOTS[i].row * T)
          .setDepth(GARDEN_PLOTS[i].row * T + 3)
          .setVisible(true);
      } else {
        this.plotGlow.setVisible(false);
      }
    }

    // and the same soft outline for a tree-planting spot
    if (this.treeGlow) {
      if (this.activeTree >= 0) {
        const v = this.treeViews[this.activeTree];
        this.treeGlow.setPosition(v.x, v.y - 7).setVisible(true);
      } else {
        this.treeGlow.setVisible(false);
      }
    }

    let verb = i >= 0 ? this.plotVerb(i) : '';
    if (!verb && this.activeTree >= 0) verb = this.treeVerb(this.activeTree);
    if (this.actionVerbShown === verb) return;
    this.actionVerbShown = verb;
    this.actionLabel.setText(verb).setVisible(!!verb);
    this.actionRing.setVisible(!!verb);
    this.actionHint.setVisible(!verb);
  }

  /* The button was pressed while he's at a bed. */
  doPlotAction(i) {
    const p = this.garden.plots[i];
    const verb = this.plotVerb(i);

    if (verb === 'PLANT' || verb === 'REPLANT') {
      this.openSeedMenu(i, verb === 'REPLANT');
      return;
    }

    if (verb === 'WATER') {
      p.watered = true;
      this.commitGarden();
      this.toast(p.seed
        ? 'Watered the ' + seedById(p.seed).name.toLowerCase() + '.'
        : 'Turned and watered the bed. Ready for seed.');
      return;
    }

    if (verb === 'HARVEST') {
      const s = seedById(p.seed);
      p.picked++;
      p.seed = null; p.stage = 0; p.wilted = false; p.care = 0;
      this.commitGarden();
      this.toast('Picked the ' + s.name.toLowerCase() + '. The bed is clear again.');
      return;
    }

    // CHECK — nothing to do, so just tell him how it's getting on
    const s = seedById(p.seed);
    let line = s.name + ' — ' + STAGE_NAMES[p.stage];
    if (p.wilted) line += ', wilted (' + (2 - p.care) + ' more day' +
                          (2 - p.care === 1 ? '' : 's') + ' of water)';
    line += '.';
    if (p.watered) line += ' Watered today.';
    this.toast(line);
  }

  /* ---------------------------------------------------------
     STAGE 4 — THE TREES
     ------------------------------------------------------------
     Nine prepared spots: three on his back lawn, six out at
     Harmon Park. The growing rules live up in the rules block
     with the weather; everything down here is showing them on
     screen and listening for his thumb.
     --------------------------------------------------------- */

  /* The ring of earth, the tree standing in it, and the plaque at
     its foot — one set per spot. Made once, when he walks in. */
  buildTreeViews(a, areaKey) {
    a.treeSpots.forEach(sp => {
      // The ring is flat on the ground, so it's pinned low in the
      // draw order and everything — him, Henri, the tree — passes
      // in front of it.
      const hole = this.add.image(sp.x, sp.y, 'treehole')
        .setOrigin(0.5, 1).setScale(SCALE).setDepth(2);
      const tree = this.add.image(sp.x, sp.y, 'tree_sapling')
        .setOrigin(0.5, 1).setScale(SCALE).setDepth(sp.y).setVisible(false);
      const plaque = this.add.image(sp.x + 23, sp.y + 3, 'plaque')
        .setOrigin(0.5, 1).setScale(SCALE).setDepth(sp.y + 3).setVisible(false);
      this.treeViews.push({
        key: treeSpotKey(areaKey, sp.i), x: sp.x, y: sp.y, hole, tree, plaque
      });
    });

    this.treeGlow = this.add.ellipse(0, 0, TREE_BLOCK[0] + 22, 28, 0xfff2c4, 0.10)
      .setVisible(false).setDepth(3);
    this.treeGlow.setStrokeStyle(3, 0xfff2c4, 0.85);

    this.refreshTrees();
  }

  /* Redraw every spot from the saved numbers. Called after any
     change, so there's only ever one place that decides what a
     tree looks like. */
  refreshTrees() {
    if (!this.treeViews || !this.treeViews.length) return;
    this.treeViews.forEach(v => {
      const t = this.garden.trees[v.key];
      if (!t) { v.tree.setVisible(false); v.plaque.setVisible(false); return; }

      const sp = treeById(t.sp);
      let key;
      if (t.st === 0) key = 'tree_sapling';
      else if (t.st === 1) key = (sp.form === 'round') ? 'tree_young_round' : 'tree_young_upright';
      else key = 'tree_' + sp.id;

      v.tree.setTexture(key).setVisible(true);
      // a thirsty sapling goes the same grey-green a wilted
      // vegetable does — it's the one visual language for "this
      // wants water"
      v.tree.setTint(t.th ? 0x9aa07e : 0xffffff);
      v.plaque.setVisible(!!t.ded);
    });
  }

  /* Which planting spot is he standing at? -1 for none. */
  nearestTreeSpot() {
    if (!this.treeViews || !this.treeViews.length) return -1;
    let best = -1, bestD = 96;
    this.treeViews.forEach((v, i) => {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, v.x, v.y - 8);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  /* What the one action button will do if he presses it now. */
  treeVerb(i) {
    const t = this.garden.trees[this.treeViews[i].key];
    if (!t) return 'PLANT';
    if (t.st === 0 && !t.wat) return 'WATER';
    if (!t.ded) return 'DEDICATE';
    return 'READ';
  }

  doTreeAction(i) {
    const v = this.treeViews[i];
    const t = this.garden.trees[v.key];
    const verb = this.treeVerb(i);

    if (verb === 'PLANT') { this.openTreeMenu(v.key); return; }

    if (verb === 'WATER') {
      t.wat = true; t.th = false;
      this.commitTrees();
      this.toast('Watered the ' + treeById(t.sp).name.toLowerCase() + ' sapling.');
      return;
    }

    if (verb === 'DEDICATE') { this.openDedicationBox(v.key); return; }

    // READ — his own words, with a way back in to fix a typo,
    // because a memorial he can't correct would be a cruel thing
    // to build
    this.openChoiceMenu({
      title: '“' + t.ded + '”',
      subtitle: treeById(t.sp).name +
                (t.pd ? '  ·  planted ' + prettyDay(t.pd) : ''),
      rows: [{ label: 'Change the words', pick: () => this.openDedicationBox(v.key) }],
      cancel: 'Close'
    });
  }

  openTreeMenu(key) {
    this.openChoiceMenu({
      title: 'What shall we plant here?',
      subtitle: 'Five natives · all of them do well in Kansas',
      rows: TREES.map(t => ({
        label: t.name,
        sub: t.blurb,
        pick: () => this.plantTree(key, t.id)
      })),
      cancel: 'Never mind'
    });
  }

  plantTree(key, speciesId) {
    this.garden.trees[key] = newTree(speciesId, this.garden.day);
    // If it's raining right now, the rain waters the new sapling the
    // moment it goes in — exactly as a seed planted today lands in
    // soil the rain already wet. Without this, a tree planted in the
    // rain would ask for the watering can while the sky did the job.
    if (this.weatherToday === 'rainy') this.garden.trees[key].wat = true;
    this.commitTrees();
    this.toast('Planted a ' + treeById(speciesId).name.toLowerCase() +
               '. Keep it watered while it takes.', 3000);

    /* The dedication is offered, never forced — and it's offered as
       a question first rather than throwing the keyboard straight
       up at him. That's also what makes the keyboard work: on a
       phone it will only open in answer to a tap. */
    this.time.delayedCall(1100, () => {
      if (this.menuOpen || !this.garden.trees[key]) return;
      this.openChoiceMenu({
        title: 'Dedicate this tree?',
        subtitle: treeById(speciesId).name,
        rows: [{
          label: 'Write a few words',
          sub: 'A small plaque at its foot',
          pick: () => this.openDedicationBox(key)
        }],
        cancel: 'Not now'
      });
    });
  }

  commitTrees() {
    saveGarden(this.garden);
    this.refreshTrees();
    this.actionVerbShown = null;
  }

  /* ---- his own words ---------------------------------------
     This is the one place in the whole game that isn't drawn by
     Phaser. It's a real text box laid over the top, because a
     real text box is the only thing that will bring up the
     phone's keyboard. Everything else about it — the colours,
     the border — is made to match the panels around it. */
  openDedicationBox(key) {
    if (this.menuOpen) return;
    const t = this.garden.trees[key];
    if (!t) return;

    this.menuOpen = true;
    this.player.body.setVelocity(0, 0);
    this.stickPointerId = null;
    this.stickVector.set(0, 0);
    this.stickBase.setVisible(false);
    this.stickKnob.setVisible(false);
    // hand the keyboard over to the text box
    if (this.input.keyboard) this.input.keyboard.enabled = false;

    const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    const wrap = document.createElement('div');
    wrap.style.cssText =
      'position:fixed;top:0;left:0;right:0;bottom:0;z-index:60;display:flex;' +
      'align-items:center;justify-content:center;background:rgba(18,12,6,0.78);' +
      'padding:12px;box-sizing:border-box;touch-action:auto;' +
      '-webkit-user-select:auto;user-select:auto;font-family:' + font + ';';

    const panel = document.createElement('div');
    panel.style.cssText =
      'background:#2b1d11;border:3px solid #cb9f63;border-radius:10px;' +
      'padding:16px 18px;width:430px;max-width:92vw;box-sizing:border-box;color:#f6ecd6;';

    const h1 = document.createElement('div');
    h1.textContent = t.ded ? 'Change the words' : 'Dedicate this tree';
    h1.style.cssText = 'font-size:19px;margin-bottom:3px;';

    const h2 = document.createElement('div');
    h2.textContent = treeById(t.sp).name +
      (t.pd ? '  ·  planted ' + prettyDay(t.pd) : '');
    h2.style.cssText = 'font-size:12px;color:#c9ab82;margin-bottom:12px;';

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = MAX_DEDICATION;
    input.value = t.ded || '';
    input.placeholder = 'For someone, or something, or nothing at all';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('enterkeyhint', 'done');
    input.style.cssText =
      'width:100%;box-sizing:border-box;font-family:inherit;font-size:17px;' +
      'padding:11px 12px;border-radius:7px;border:2px solid #8a6b41;' +
      'background:#3f2c19;color:#f6ecd6;outline:none;touch-action:auto;' +
      '-webkit-user-select:text;user-select:text;';

    const count = document.createElement('div');
    count.style.cssText =
      'font-size:11px;color:#9c805a;margin:6px 2px 12px;text-align:right;';
    const tick = () => {
      count.textContent = (MAX_DEDICATION - input.value.length) + ' characters left';
    };
    tick();
    input.addEventListener('input', tick);

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;';
    const mkBtn = (label, primary) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText =
        'flex:1;font-family:inherit;font-size:16px;padding:12px 8px;' +
        'border-radius:7px;cursor:pointer;-webkit-tap-highlight-color:transparent;' +
        'border:2px solid ' + (primary ? '#cb9f63' : '#6b5231') + ';' +
        'background:' + (primary ? '#4a3419' : '#241809') + ';' +
        'color:' + (primary ? '#f6ecd6' : '#c9ab82') + ';';
      return b;
    };
    const skip = mkBtn(t.ded ? 'Leave it as it is' : 'Not now', false);
    const save = mkBtn('Put up the plaque', true);
    row.appendChild(skip);
    row.appendChild(save);

    panel.appendChild(h1);
    panel.appendChild(h2);
    panel.appendChild(input);
    panel.appendChild(count);
    panel.appendChild(row);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      try { input.blur(); } catch (e) {}
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      this.dedicationBox = null;
      this.menuOpen = false;
      this.actionVerbShown = null;
      if (this.input.keyboard) this.input.keyboard.enabled = true;
    };
    const commit = () => {
      const words = cleanDedication(input.value);
      const tree = this.garden.trees[key];
      close();
      if (!tree) return;
      tree.ded = words || null;
      this.commitTrees();
      this.toast(words
        ? 'The plaque reads: “' + words + '”'
        : 'No plaque for now — the tree grows all the same.', 3600);
    };

    save.addEventListener('click', commit);
    skip.addEventListener('click', close);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
    });
    // tapping the dark surround is the same as saying "not now"
    wrap.addEventListener('pointerdown', e => { if (e.target === wrap) close(); });

    this.dedicationBox = { wrap: wrap, close: close };

    /* Called straight out of the tap that opened this, which is
       the one thing that persuades a phone to slide its keyboard
       up on its own. If it doesn't, he can still tap the box. */
    try { input.focus(); } catch (e) {}
  }

  /* ---- a plain list of choices over a dimmed screen ---------
     The same look as the seed list, but general enough to serve
     the species list, the "dedicate this?" question, and reading
     a plaque back. */
  openChoiceMenu(opts) {
    if (this.menuOpen) return;
    this.menuOpen = true;
    // A quarter-second where it ignores taps, so the same quick jab
    // that opened it can't also pick something.
    this.menuReadyAt = this.time.now + 250;

    this.player.body.setVelocity(0, 0);
    this.stickPointerId = null;
    this.stickVector.set(0, 0);
    this.stickBase.setVisible(false);
    this.stickKnob.setVisible(false);

    const D = 20000;
    const w = this.scale.width, h = this.scale.height;
    const font = '-apple-system, sans-serif';
    const objs = [];

    const veil = this.add.rectangle(w / 2, h / 2, w * 2, h * 2, 0x120c06, 0.74)
      .setScrollFactor(0).setDepth(D).setInteractive();
    objs.push(veil);

    const nRows = opts.rows.length + 1;
    const head = opts.subtitle ? 78 : 56;
    const rowH = Math.max(32, Math.min(52, Math.floor((h - 56 - head) / nRows)));
    const panelW = Math.min(380, w - 36);
    const panelH = head + nRows * rowH + 12;
    const px = Math.round(w / 2), py = Math.round(h / 2);
    const top = py - panelH / 2;

    const panel = this.add.rectangle(px, py, panelW, panelH, 0x2b1d11, 0.98)
      .setScrollFactor(0).setDepth(D + 1);
    panel.setStrokeStyle(3, 0xcb9f63, 0.95);
    objs.push(panel);

    objs.push(this.add.text(px, top + 28, opts.title, {
      fontFamily: font, fontSize: '19px', color: '#f6ecd6', align: 'center',
      wordWrap: { width: panelW - 36 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 2));

    if (opts.subtitle) {
      objs.push(this.add.text(px, top + 56, opts.subtitle, {
        fontFamily: font, fontSize: '13px', color: '#c9ab82', align: 'center'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 2));
    }

    opts.rows.forEach((r, i) => {
      const ry = Math.round(top + head + i * rowH + rowH / 2);
      const btn = this.add.rectangle(px, ry, panelW - 26, rowH - 6, 0x3f2c19, 1)
        .setScrollFactor(0).setDepth(D + 2).setInteractive();
      btn.setStrokeStyle(2, 0x8a6b41, 0.9);
      btn.on('pointerdown', () => {
        if (this.time.now < this.menuReadyAt) return;
        this.closeChoiceMenu();
        r.pick();
      });
      objs.push(btn);

      // the little describing line only appears if the row is
      // tall enough to hold it comfortably
      const withSub = !!r.sub && rowH >= 44;
      objs.push(this.add.text(px, withSub ? ry - 9 : ry, r.label, {
        fontFamily: font, fontSize: '17px', color: '#f6ecd6'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 3));
      if (withSub) {
        objs.push(this.add.text(px, ry + 11, r.sub, {
          fontFamily: font, fontSize: '11px', color: '#b39468'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 3));
      }
    });

    const cy = Math.round(top + head + opts.rows.length * rowH + rowH / 2);
    const cancel = this.add.rectangle(px, cy, panelW - 26, rowH - 6, 0x241809, 1)
      .setScrollFactor(0).setDepth(D + 2).setInteractive();
    cancel.setStrokeStyle(2, 0x6b5231, 0.9);
    cancel.on('pointerdown', () => {
      if (this.time.now < this.menuReadyAt) return;
      this.closeChoiceMenu();
    });
    objs.push(cancel);
    objs.push(this.add.text(px, cy, opts.cancel || 'Never mind', {
      fontFamily: font, fontSize: '16px', color: '#c9ab82'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 3));

    this.menuObjects = objs;
  }

  closeChoiceMenu() {
    if (!this.menuObjects) return;
    this.menuOpen = false;
    this.menuObjects.forEach(o => o.destroy());
    this.menuObjects = null;
    this.actionVerbShown = null;
  }

  /* ---- picking a seed --------------------------------------
     A plain list of buttons over a dimmed screen. While it's
     open the thumb-stick is switched off, so nothing can be
     nudged by accident. */
  openSeedMenu(plotIndex, isReplant) {
    if (this.menuOpen) return;
    this.menuOpen = true;
    this.menuPlot = plotIndex;
    // A quarter of a second where the menu ignores taps, so the very
    // same quick jab that opened it can't also pick something.
    this.menuReadyAt = this.time.now + 250;

    this.player.body.setVelocity(0, 0);
    this.stickPointerId = null;
    this.stickVector.set(0, 0);
    this.stickBase.setVisible(false);
    this.stickKnob.setVisible(false);

    const D = 20000;
    const w = this.scale.width, h = this.scale.height;
    const objs = [];
    const font = '-apple-system, sans-serif';

    const veil = this.add.rectangle(w / 2, h / 2, w * 2, h * 2, 0x120c06, 0.74)
      .setScrollFactor(0).setDepth(D).setInteractive();
    objs.push(veil);

    const rows = SEEDS.length + 1;
    const head = 78;
    const rowH = Math.max(34, Math.min(50, Math.floor((h - 60 - head) / rows)));
    const panelW = Math.min(340, w - 36);
    const panelH = head + rows * rowH + 12;
    const px = Math.round(w / 2), py = Math.round(h / 2);
    const top = py - panelH / 2;

    const panel = this.add.rectangle(px, py, panelW, panelH, 0x2b1d11, 0.98)
      .setScrollFactor(0).setDepth(D + 1);
    panel.setStrokeStyle(3, 0xcb9f63, 0.95);
    objs.push(panel);

    const p = this.garden.plots[plotIndex];
    objs.push(this.add.text(px, top + 26,
      isReplant ? 'Replant this bed?' : 'What shall we plant?',
      { fontFamily: font, fontSize: '20px', color: '#f6ecd6' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(D + 2));
    objs.push(this.add.text(px, top + 52,
      (isReplant && p.seed)
        ? 'Growing now: ' + seedById(p.seed).name
        : 'Bed ' + (plotIndex + 1) + ' of 6',
      { fontFamily: font, fontSize: '13px', color: '#c9ab82' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(D + 2));

    SEEDS.forEach((s, i) => {
      const ry = Math.round(top + head + i * rowH + rowH / 2);
      const btn = this.add.rectangle(px, ry, panelW - 26, rowH - 6, 0x3f2c19, 1)
        .setScrollFactor(0).setDepth(D + 2).setInteractive();
      btn.setStrokeStyle(2, 0x8a6b41, 0.9);
      btn.on('pointerdown', () => {
        if (this.time.now < this.menuReadyAt) return;
        this.chooseSeed(s.id);
      });
      objs.push(btn);
      objs.push(this.add.text(px, ry, s.name,
        { fontFamily: font, fontSize: '17px', color: '#f6ecd6' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(D + 3));
    });

    const cy = Math.round(top + head + SEEDS.length * rowH + rowH / 2);
    const cancel = this.add.rectangle(px, cy, panelW - 26, rowH - 6, 0x241809, 1)
      .setScrollFactor(0).setDepth(D + 2).setInteractive();
    cancel.setStrokeStyle(2, 0x6b5231, 0.9);
    cancel.on('pointerdown', () => {
      if (this.time.now < this.menuReadyAt) return;
      this.closeSeedMenu();
    });
    objs.push(cancel);
    objs.push(this.add.text(px, cy, isReplant ? 'Leave it be' : 'Never mind',
      { fontFamily: font, fontSize: '16px', color: '#c9ab82' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(D + 3));

    this.menuObjects = objs;
  }

  closeSeedMenu() {
    if (!this.menuOpen) return;
    this.menuOpen = false;
    if (this.menuObjects) this.menuObjects.forEach(o => o.destroy());
    this.menuObjects = null;
  }

  chooseSeed(id) {
    const p = this.garden.plots[this.menuPlot];
    p.seed = id;
    p.stage = 0;
    p.wilted = false;
    p.care = 0;
    this.closeSeedMenu();
    this.commitGarden();
    this.toast(p.watered
      ? 'Planted ' + seedById(id).name.toLowerCase() + ' in the wet soil.'
      : 'Planted ' + seedById(id).name.toLowerCase() + '. Give it a drink.');
  }

  /* ---- writing it down -------------------------------------
     Every single change goes straight to the browser's notepad.
     There is no save button because there is nothing to press. */
  commitGarden() {
    saveGarden(this.garden);
    this.refreshGarden();
    this.actionVerbShown = null;   // so the button re-reads itself
  }

  /* ---- the day turning over --------------------------------
     Checked every few seconds, so if he's playing at midnight
     the garden rolls over under him rather than waiting for the
     next launch. */
  checkNewDay() {
    const today = dayKey(new Date());
    if (!this.garden.day || today === this.garden.day) return;
    const passed = catchUp(this.garden, today);
    this.weatherToday = weatherFor(this.garden.day);
    this.weatherTomorrow = weatherFor(nextDayKey(this.garden.day));
    saveGarden(this.garden);
    this.refreshGarden();
    this.refreshTrees();
    this.refreshSignIcons();
    this.applyWeatherLook();
    this.actionVerbShown = null;
    if (passed > 0) {
      this.toast('A new day in Prairie Village — ' +
                 WEATHER[this.weatherToday].label.toLowerCase() + '.', 3200);
    }
  }

  forecastText() {
    return 'Today: ' + WEATHER[this.weatherToday].label +
           '     Tomorrow: ' + WEATHER[this.weatherTomorrow].label + '\n' +
           WEATHER[this.weatherToday].note;
  }

  /* A message he caused himself. Sits on top of any sign text
     for a few seconds, then gets out of the way. */
  toast(text, ms) {
    this.showMessage(text);
    this.toastUntil = this.time.now + (ms || 2600);
  }

  /* ---- what the weather looks like -------------------------
     A thin wash of colour over the whole screen, plus falling
     streaks when it rains. Deliberately cheap: one rectangle and
     forty-odd little ones, nothing that will trouble a phone. */
  buildWeatherLook() {
    this.weatherTint = this.add.rectangle(0, 0, 4000, 4000, 0xffffff, 0)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(9000);
    this.rainDrops = [];
    for (let i = 0; i < 44; i++) {
      this.rainDrops.push(
        this.add.rectangle(0, 0, 2, 13, 0xbfe3f5, 0.5)
          .setScrollFactor(0).setDepth(9001).setVisible(false)
      );
    }
    this.applyWeatherLook();
  }

  applyWeatherLook() {
    const look = {
      sunny:  [0xffd9a0, 0.05],
      cloudy: [0x5a6b7a, 0.13],
      rainy:  [0x36485c, 0.24]
    }[this.weatherToday] || [0xffffff, 0];
    this.weatherTint.setFillStyle(look[0], look[1]);

    const raining = (this.weatherToday === 'rainy');
    const w = this.scale.width, h = this.scale.height;
    this.rainDrops.forEach(r => {
      r.setVisible(raining);
      if (raining) {
        r.x = Math.random() * w;
        r.y = Math.random() * h;
        r.fallSpeed = 620 + Math.random() * 340;
      }
    });
  }

  stepRain(delta) {
    if (this.weatherToday !== 'rainy' || !this.rainDrops) return;
    const w = this.scale.width, h = this.scale.height;
    const dt = delta / 1000;
    for (const r of this.rainDrops) {
      r.y += (r.fallSpeed || 700) * dt;
      r.x -= 90 * dt;
      if (r.y > h + 14) { r.y = -20; r.x = Math.random() * w; }
      if (r.x < -12) r.x = w + 12;
    }
  }


  /* ---------------------------------------------------------
     Henri
     ------------------------------------------------------------
     He doesn't pathfind. He follows a trail of breadcrumbs dropped
     wherever the player has actually walked, aiming for the crumb
     that's about a tile behind — the standard trick for a follower
     that has to dodge the same obstacles you already dodged. If he
     ever ends up miles away (a bug, not something that should
     happen in normal play), he just steps up next to you instead
     of trying to catch up the honest way.
     --------------------------------------------------------- */
  updateHenri(delta, playerMoving) {
    if (!this.henri) return;

    const trail = this.henriTrail;
    const last = trail[trail.length - 1];
    if (!last || Phaser.Math.Distance.Between(last.x, last.y, this.player.x, this.player.y) > 8) {
      trail.push({ x: this.player.x, y: this.player.y });
      if (trail.length > 240) trail.shift();
    }

    // walk backward along the trail until we've covered the lag
    // distance — that point is where Henri is trying to get to
    const FOLLOW_LAG = T * 1.1;
    let target = { x: this.player.x, y: this.player.y };
    let remaining = FOLLOW_LAG;
    let px = this.player.x, py = this.player.y;
    for (let i = trail.length - 1; i >= 0; i--) {
      const p = trail[i];
      const segLen = Phaser.Math.Distance.Between(px, py, p.x, p.y);
      if (segLen >= remaining) {
        const t = segLen > 0 ? remaining / segLen : 0;
        target = { x: Phaser.Math.Linear(px, p.x, t), y: Phaser.Math.Linear(py, p.y, t) };
        remaining = -1;
        break;
      }
      remaining -= segLen;
      target = { x: p.x, y: p.y };
      px = p.x; py = p.y;
    }

    // safety net: if something (a bug, not normal play) has left
    // him miles away, just bring him along rather than have him
    // trek all the way back across the map
    const distToPlayer = Phaser.Math.Distance.Between(this.henri.x, this.henri.y, this.player.x, this.player.y);
    if (distToPlayer > T * 7) this.henri.setPosition(target.x, target.y);

    const dx = target.x - this.henri.x, dy = target.y - this.henri.y;
    const dist = Math.hypot(dx, dy);
    const HENRI_SPEED = TUNING.playerSpeed * 1.25;

    if (dist > 3) {
      const step = Math.min(dist, HENRI_SPEED * (delta / 1000));
      this.henri.x += (dx / dist) * step;
      this.henri.y += (dy / dist) * step;
      if (Math.abs(dx) > Math.abs(dy)) this.henriFacing = dx > 0 ? 'right' : 'left';
      else this.henriFacing = dy > 0 ? 'down' : 'up';
    }

    // he only sits once you've actually stopped AND he's caught up —
    // otherwise he'd plop down mid-stride every time the gap closed
    this.henriState = (playerMoving || dist > 6) ? 'walk' : 'sit';

    const dirKey = this.henriFacing === 'right' ? 'left' : this.henriFacing;
    this.henri.setFlipX(this.henriFacing === 'right');
    if (this.henriState === 'walk') {
      const anim = 'henri-walk-' + dirKey;
      const cur = this.henri.anims.currentAnim;
      if (!cur || cur.key !== anim || !this.henri.anims.isPlaying) this.henri.play(anim, true);
    } else {
      this.henri.anims.stop();
      this.henri.setFrame(dirKey + 'Sit');
    }

    this.henri.setDepth(this.henri.y - 2);
    this.henriShadow.setPosition(this.henri.x, this.henri.y - 2).setDepth(this.henri.y - 3);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#4e7d3a',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: { default: 'arcade', arcade: { debug: false } },
  render: { pixelArt: true, antialias: false, roundPixels: true },
  scene: [PrairieScene]
});
