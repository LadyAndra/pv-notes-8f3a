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
   ============================================================ */
const HERO_PALETTE = {
  K: '#241a12', S: '#f0c69c', s: '#d69f74',
  H: '#6b4423', h: '#4a2e18',
  P: '#7b4bbd', p: '#5a3690',
  G: '#3a7fd8', g: '#c3e6fa',
  T: '#2a2a30', t: '#191920',
  C: '#9d8a5e', c: '#7c6c47',
  N: '#8a6a45', n: '#5c4630'
};

const HERO_DOWN = [
  '................................',
  '................................',
  '................................',
  '...........KKKKKKKKKK...........',
  '..........KPPPPPPPPPPK..........',
  '..........KPPPPPPPPPPK..........',
  '.........KPPPPPPPPPPPPK.........',
  '.........KPPPPPPPPPPPPK.........',
  '.........KppppppppppppK.........',
  '.........KHHHHHHHHHHHHK.........',
  '..........KSSSSSSSSSSK..........',
  '..........KGGGGSSGGGGK..........',
  '..........KgKggGGggKgK..........',
  '..........KsSSSSSSSSsK..........',
  '..........KHHSSSSSSHHK..........',
  '..........KHHHHSSHHHHK..........',
  '..........KHHHHHHHHHHK..........',
  '...........KHHHHHHHHK...........',
  '........KTTTTTTTTTTTTTTK........',
  '........KTTTTTTTTTTTTTTK........',
  '........KTtTTTTTTTTTTtTK........',
  '........KTtTTTTTTTTTTtTK........',
  '........KSSTTTTTTTTTTSSK........',
  '........KSSTTTTTTTTTTSSK........',
  '........KSSTTTTTTTTTTSSK........',
  '..........KCCCCCCCCCCK..........',
  '..........KCcCCCCCCcCK..........',
  '..........KCCCCKKCCCCK..........',
  '..........KSSSK..KSSSK..........',
  '..........KSSSK..KSSSK..........',
  '.........KNNNNK..KNNNNK.........',
  '.........KnnnnK..KnnnnK.........'
];

const HERO_UP = [
  '................................',
  '................................',
  '................................',
  '...........KKKKKKKKKK...........',
  '..........KPPPPPPPPPPK..........',
  '..........KPPPPPPPPPPK..........',
  '.........KPPPPPPPPPPPPK.........',
  '.........KPPPPPPPPPPPPK.........',
  '.........KPPPPPPPPPPPPK.........',
  '.........KPPPPPPPPPPPPK.........',
  '.......KPPPPPPPPPPPPPPPPK.......',
  '.......KppppppppppppppppK.......',
  '.......KKKKKKKKKKKKKKKKKK.......',
  '..........KHHHHHHHHHHK..........',
  '..........KHHHHHHHHHHK..........',
  '..........KHhHHHHHHhHK..........',
  '..........KHHHHHHHHHHK..........',
  '...........KHHHHHHHHK...........',
  '........KTTTTTTTTTTTTTTK........',
  '........KTTTTTTTTTTTTTTK........',
  '........KTtTTTTTTTTTTtTK........',
  '........KTtTTTTTTTTTTtTK........',
  '........KSSTTTTTTTTTTSSK........',
  '........KSSTTTTTTTTTTSSK........',
  '........KSSTTTTTTTTTTSSK........',
  '..........KCCCCCCCCCCK..........',
  '..........KCcCCCCCCcCK..........',
  '..........KCCCCKKCCCCK..........',
  '..........KSSSK..KSSSK..........',
  '..........KSSSK..KSSSK..........',
  '.........KNNNNK..KNNNNK.........',
  '.........KnnnnK..KnnnnK.........'
];

const HERO_LEFT = [
  '................................',
  '................................',
  '................................',
  '...........KKKKKKKKK............',
  '..........KPPPPPPPPPK...........',
  '..........KPPPPPPPPPK...........',
  '..........KPPPPPPPPPK...........',
  '..........KPPPPPPPPPK...........',
  '..........KpppppppppK...........',
  '..........KpppppppppPPPPPPPK....',
  '..........KHHHHHHHHHpppppppK....',
  '..........KSSSSSSSHHK...........',
  '..........KGggGSSSHHK...........',
  '..........KsSSSSSHHHK...........',
  '..........KHSSSSHHHHK...........',
  '..........KHHSSHHHHHK...........',
  '..........KHHHHHHHHHK...........',
  '...........KHHHHHHHK............',
  '.........KTTTTTTTTTTTTK.........',
  '.........KTTTTTTTTTTTTK.........',
  '.........KTTTTTTTTTTtTK.........',
  '.........KTTTTTTTTTTtTK.........',
  '.........KSSTTTTTTTTTTK.........',
  '.........KSSTTTTTTTTTTK.........',
  '.........KSSTTTTTTTTTTK.........',
  '..........KCCCCCCCCCCK..........',
  '..........KCcCCCCCCcCK..........',
  '..........KCCCCCCCCCCK..........',
  '...........KSSSSSSSSK...........',
  '...........KSSSSSSSSK...........',
  '..........KNNNNNNNNNK...........',
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
   ============================================================ */
const HENRI_W = 26, HENRI_H = 20;
const HENRI_COAT = '#f7f1e4';
const HENRI_SHADE = '#dcd2ba';
const HENRI_MARK = '#221e18';

function drawHenri(ctx, dir, sit, bounce) {
  const lift = bounce ? 1 : 0;      // trot hop
  const crouch = sit ? 2 : 0;       // settles lower when sitting
  const cx = 13;
  const groundY = 18 - crouch;

  if (dir === 'left') {
    const bodyY = groundY - 6 - lift;
    pixelEllipse(ctx, 15, bodyY, sit ? 6 : 8, sit ? 6 : 5, HENRI_COAT);
    pixelEllipse(ctx, 15, bodyY + 2, sit ? 5 : 7, 2, HENRI_SHADE);
    const headX = sit ? 8 : 6, headY = bodyY - (sit ? 3 : 1);
    pixelCircle(ctx, headX, headY, 4, HENRI_COAT);
    ctx.fillStyle = HENRI_COAT;
    ctx.fillRect(headX - 6, headY, 3, 3);               // snout
    ctx.fillStyle = HENRI_MARK;
    ctx.fillRect(headX - 7, headY + 1, 2, 2);            // nose
    pixelEllipse(ctx, headX + 1, headY - 3, 2, 3, HENRI_MARK);  // ear
    pixelCircle(ctx, headX + 2, headY - 1, 2, HENRI_MARK);      // eye patch
    if (sit) {
      pixelEllipse(ctx, 22, bodyY + 2, 3, 3, HENRI_COAT);        // tail, curled
      ctx.fillStyle = HENRI_COAT;
      ctx.fillRect(headX - 3, groundY - 2, 3, 3);                // front paws forward
    } else {
      pixelEllipse(ctx, 22, bodyY - 3, 3, 4, HENRI_COAT);        // tail, trailing
      ctx.fillStyle = HENRI_SHADE;
      ctx.fillRect(10, groundY - 1, 3, 3 - lift);
      ctx.fillRect(19, groundY - 1, 3, 3 - lift);
    }
  } else {
    // down / up — seen mostly from above, a rounder silhouette
    const bodyY = groundY - 6 - lift;
    pixelEllipse(ctx, cx, bodyY, 7, sit ? 6 : 5, HENRI_COAT);
    const headY = bodyY - (sit ? 5 : 4);
    pixelCircle(ctx, cx, headY, 5, HENRI_COAT);
    pixelEllipse(ctx, cx - 5, headY - 2, 2, 3, HENRI_MARK);      // ears
    pixelEllipse(ctx, cx + 5, headY - 2, 2, 3, HENRI_MARK);
    if (dir === 'down') {
      pixelCircle(ctx, cx - 3, headY, 2, HENRI_MARK);            // eye patch
      ctx.fillStyle = HENRI_MARK;
      ctx.fillRect(cx - 1, headY + 2, 2, 1);                     // nose
    } else {
      pixelEllipse(ctx, cx, groundY - 1, 3, 2, HENRI_COAT);      // tail peeking out
    }
    if (!sit) {
      ctx.fillStyle = HENRI_SHADE;
      ctx.fillRect(cx - 6, groundY - 1, 3, 3 - lift);
      ctx.fillRect(cx + 3, groundY - 1, 3, 3 - lift);
    }
  }
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

/* A blade-of-grass tuft or two, for the nicer grass tiles. */
function paintGrass(ctx, seed) {
  paintTile(ctx, 16, 16, '#6da84e', ['#5f9642', '#7cb95c'], seed);
  const rnd = makeRng(seed + 99);
  const tufts = pick(rnd, 0, 2);
  for (let i = 0; i < tufts; i++) {
    const x = pick(rnd, 2, 13), y = pick(rnd, 2, 12);
    ctx.fillStyle = '#4f8437';
    ctx.fillRect(x, y, 1, 3);
    ctx.fillRect(x - 1, y + 1, 1, 2);
    ctx.fillRect(x + 1, y + 1, 1, 2);
  }
}

function paintRoad(ctx, seed, withDash) {
  paintTile(ctx, 16, 16, '#6a6a70', ['#5e5e64', '#76767c'], seed);
  if (withDash) { ctx.fillStyle = '#d8c96a'; ctx.fillRect(4, 7, 8, 2); }
}

function paintWalk(ctx, seed) {
  paintTile(ctx, 16, 16, '#c3c1b3', ['#b4b2a4', '#d0cec1'], seed);
  ctx.fillStyle = '#a9a79a';
  ctx.fillRect(0, 0, 16, 1);
  ctx.fillRect(0, 0, 1, 16);
}

/* ============================================================
   FENCES  (16 x 16, made to tile seamlessly end to end)
   ============================================================ */
const FENCE_PALETTE = { K: '#3a2a1a', W: '#ab8250', w: '#8b6839' };

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
const SIGN_PALETTE = {
  K: '#2b1d11', W: '#cb9f63', w: '#a87d47', R: '#fbf3e2', P: '#8a6a45'
};

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
const PARKSIGN_PALETTE = {
  K: '#2b1d11', W: '#8a6a45', w: '#6d5334', R: '#f6ecd6', P: '#6d5334'
};

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
   TREES
   ============================================================ */
const TREE_STYLES = {
  a: { r: 13, trunk: '#6b4a2b', dark: '#2c6329', mid: '#3d8434', lite: '#57a642', w: 32, h: 40 },
  b: { r: 15, trunk: '#5e422a', dark: '#28582a', mid: '#377a33', lite: '#4d9a3d', w: 36, h: 46 },
  c: { r: 11, trunk: '#75512f', dark: '#336b26', mid: '#458f31', lite: '#63b247', w: 28, h: 34 }
};

function drawRoundTree(ctx, style, seed) {
  const s = TREE_STYLES[style];
  const rnd = makeRng(seed);
  const cx = Math.floor(s.w / 2);
  const baseY = s.h - 2;
  const trunkH = Math.floor(s.r * 0.9);

  // trunk first, so the leaves sit on top of it
  ctx.fillStyle = s.trunk;
  ctx.fillRect(cx - 3, baseY - trunkH, 6, trunkH);
  ctx.fillStyle = '#4a341e';
  ctx.fillRect(cx - 3, baseY - trunkH, 2, trunkH);

  // canopy: a few overlapping blobs so no two trees match exactly
  const cy = baseY - trunkH - s.r + 3;
  pixelCircle(ctx, cx, cy, s.r, s.dark);
  pixelCircle(ctx, cx - pick(rnd, 1, 4), cy + 2, s.r - 2, s.mid);
  pixelCircle(ctx, cx + pick(rnd, 1, 4), cy - 1, s.r - 3, s.mid);
  pixelCircle(ctx, cx - 3, cy - 3, Math.max(3, s.r - 6), s.lite);
  pixelCircle(ctx, cx + pick(rnd, 2, 5), cy + pick(rnd, 1, 3), 3, s.lite);
}

function drawPine(ctx, w, h) {
  const cx = Math.floor(w / 2);
  ctx.fillStyle = '#5e422a';
  ctx.fillRect(cx - 2, h - 9, 4, 8);
  const tiers = 3;
  for (let t = 0; t < tiers; t++) {
    const top = 3 + t * Math.floor((h - 14) / tiers);
    const bot = top + Math.floor((h - 14) / tiers) + 5;
    for (let y = top; y < bot; y++) {
      const half = Math.floor(((y - top) / (bot - top)) * (4 + t * 4)) + 2;
      ctx.fillStyle = (y - top) < 2 ? '#4d9a3d' : '#2c6b2c';
      ctx.fillRect(cx - half, y, half * 2, 1);
    }
  }
}

function drawBush(ctx, w, h, seed) {
  const rnd = makeRng(seed);
  const cx = Math.floor(w / 2), cy = h - 8;
  pixelCircle(ctx, cx, cy, 7, '#2c6329');
  pixelCircle(ctx, cx - 4, cy + 1, 5, '#3d8434');
  pixelCircle(ctx, cx + 4, cy + 1, 5, '#3d8434');
  pixelCircle(ctx, cx - 2, cy - 3, 3, '#57a642');
  if (rnd() < 0.5) { pixelCircle(ctx, cx + 3, cy - 2, 2, '#57a642'); }
}

/* ---- THE BIG OAK -------------------------------------------
   Harmon Park's landmark. Roughly three ordinary trees wide.
   The dark oval at the base of the trunk is the hollow he'll
   eventually be able to climb into — for now it's just a hint. */
const OAK_W = 124, OAK_H = 152;

function drawBigOak(ctx, w, h) {
  const cx = Math.floor(w / 2);
  const baseY = h - 2;
  const trunkH = 40;

  // wide, gnarled trunk
  ctx.fillStyle = '#6b4a2b';
  ctx.fillRect(cx - 11, baseY - trunkH, 22, trunkH);
  ctx.fillStyle = '#57391f';
  ctx.fillRect(cx - 11, baseY - trunkH, 5, trunkH);
  ctx.fillRect(cx + 6, baseY - trunkH, 4, trunkH);
  ctx.fillStyle = '#7d5934';
  ctx.fillRect(cx - 5, baseY - trunkH, 3, trunkH);
  // roots flaring out
  ctx.fillStyle = '#6b4a2b';
  ctx.fillRect(cx - 17, baseY - 7, 7, 7);
  ctx.fillRect(cx + 10, baseY - 7, 7, 7);
  ctx.fillRect(cx - 21, baseY - 4, 5, 4);
  ctx.fillRect(cx + 16, baseY - 4, 5, 4);
  // the hollow at the base — someday he'll climb in here
  pixelCircle(ctx, cx, baseY - 12, 7, '#2e1d10');
  pixelCircle(ctx, cx, baseY - 11, 5, '#160d07');
  // two big lower branches reaching out
  ctx.fillStyle = '#6b4a2b';
  ctx.fillRect(cx - 27, baseY - trunkH - 5, 20, 7);
  ctx.fillRect(cx + 7, baseY - trunkH - 5, 20, 7);
  ctx.fillRect(cx - 31, baseY - trunkH - 11, 7, 8);
  ctx.fillRect(cx + 25, baseY - trunkH - 11, 7, 8);

  // canopy — layered blobs, darkest at the back
  const cy = baseY - trunkH - 36;
  pixelCircle(ctx, cx, cy, 38, '#255a24');
  pixelCircle(ctx, cx - 30, cy + 12, 24, '#255a24');
  pixelCircle(ctx, cx + 30, cy + 12, 24, '#255a24');
  pixelCircle(ctx, cx - 20, cy + 6, 22, '#347331');
  pixelCircle(ctx, cx + 20, cy + 5, 22, '#347331');
  pixelCircle(ctx, cx, cy - 6, 27, '#347331');
  pixelCircle(ctx, cx - 12, cy - 14, 15, '#4a9440');
  pixelCircle(ctx, cx + 14, cy - 9, 12, '#4a9440');
  pixelCircle(ctx, cx - 29, cy + 4, 9, '#4a9440');
  pixelCircle(ctx, cx + 3, cy + 18, 10, '#4a9440');
  pixelCircle(ctx, cx + 28, cy + 14, 8, '#4a9440');
  pixelCircle(ctx, cx - 6, cy - 22, 7, '#5fae4e');
}

/* ============================================================
   HOUSES
   ============================================================ */
function drawHouse(ctx, w, h, c) {
  const roofH = Math.round(h * 0.46);
  const wallTop = roofH;

  // walls
  ctx.fillStyle = c.wall;
  ctx.fillRect(2, wallTop, w - 4, h - wallTop);
  ctx.fillStyle = c.wallDark;
  for (let y = wallTop + 3; y < h; y += 4) ctx.fillRect(2, y, w - 4, 1);
  ctx.fillRect(2, wallTop, 3, h - wallTop);
  ctx.fillRect(w - 5, wallTop, 3, h - wallTop);

  // roof — narrower at the top, wider at the eaves
  for (let r = 0; r < roofH; r++) {
    const inset = Math.round((1 - r / roofH) * 6);
    ctx.fillStyle = (r < 2) ? c.roofLite : (r % 4 === 3 ? c.roofDark : c.roof);
    ctx.fillRect(inset, r, w - inset * 2, 1);
  }
  // eaves shadow on the wall
  ctx.fillStyle = c.roofDark;
  ctx.fillRect(0, roofH - 2, w, 2);

  // chimney — a short stack near the ridge, not a stripe down the roof
  const chH = Math.round(roofH * 0.5);
  ctx.fillStyle = c.chimney;
  ctx.fillRect(w - 30, 1, 9, chH);
  ctx.fillStyle = '#5d5048';
  ctx.fillRect(w - 32, 0, 13, 4);
  ctx.fillRect(w - 30, 1 + chH - 2, 9, 2);

  // door, centred at the bottom
  const dh = Math.min(30, h - wallTop - 4), dw = Math.round(dh * 0.62);
  const dx = Math.round(w / 2 - dw / 2), dy = h - dh;
  ctx.fillStyle = c.trim;
  ctx.fillRect(dx - 2, dy - 2, dw + 4, dh + 2);
  ctx.fillStyle = c.door;
  ctx.fillRect(dx, dy, dw, dh);
  ctx.fillStyle = c.doorDark;
  ctx.fillRect(dx, dy, 3, dh);
  ctx.fillRect(dx, dy, dw, 2);
  ctx.fillStyle = '#f2d98a';
  ctx.fillRect(dx + dw - 5, dy + Math.floor(dh / 2), 3, 3);

  // windows either side of the door
  const winH = Math.min(18, h - wallTop - 12);
  const winW = 20;
  const winY = wallTop + 6;
  [[7, winY], [w - winW - 7, winY]].forEach(p => {
    ctx.fillStyle = c.trim;
    ctx.fillRect(p[0] - 2, p[1] - 2, winW + 4, winH + 4);
    ctx.fillStyle = c.win;
    ctx.fillRect(p[0], p[1], winW, winH);
    ctx.fillStyle = c.winLite;
    ctx.fillRect(p[0], p[1], Math.floor(winW / 2) - 1, Math.floor(winH / 2));
    ctx.fillStyle = c.trim;
    ctx.fillRect(p[0] + Math.floor(winW / 2) - 1, p[1], 2, winH);
    ctx.fillRect(p[0], p[1] + Math.floor(winH / 2) - 1, winW, 2);
  });
}

const HOUSE_STYLES = {
  main:  { w: 208, h: 112, roof: '#8c4a3a', roofDark: '#6d3529', roofLite: '#a35b48',
           wall: '#e8dcc0', wallDark: '#cfc1a2', door: '#4a6f8c', doorDark: '#37556e',
           win: '#7fb6d8', winLite: '#bfe0f2', trim: '#f6eeda', chimney: '#7d6a5a' },
  blue:  { w: 128, h: 88, roof: '#4a6f8c', roofDark: '#37556e', roofLite: '#5c85a4',
           wall: '#dfe6ea', wallDark: '#c3ccd3', door: '#8c5a3a', doorDark: '#6b4229',
           win: '#7fb6d8', winLite: '#bfe0f2', trim: '#f6f8fa', chimney: '#7d6a5a' },
  green: { w: 128, h: 88, roof: '#4e6b3c', roofDark: '#3a512c', roofLite: '#60814b',
           wall: '#efe3c4', wallDark: '#d4c7a6', door: '#7a4630', doorDark: '#5b3322',
           win: '#7fb6d8', winLite: '#bfe0f2', trim: '#fbf5e4', chimney: '#8a7565' },
  cream: { w: 128, h: 88, roof: '#7d6a5a', roofDark: '#5f4f42', roofLite: '#93806f',
           wall: '#f0e4cb', wallDark: '#d6c9ac', door: '#5a6f4a', doorDark: '#425336',
           win: '#7fb6d8', winLite: '#bfe0f2', trim: '#fbf6e8', chimney: '#7d6a5a' }
};

/* ---- odds and ends ----------------------------------------- */
function drawMailbox(ctx, w, h) {
  ctx.fillStyle = '#6b4a2b';
  ctx.fillRect(7, 8, 3, h - 9);
  ctx.fillStyle = '#5a5a62';
  ctx.fillRect(2, 2, 13, 8);
  ctx.fillStyle = '#767680';
  ctx.fillRect(2, 2, 13, 3);
  ctx.fillStyle = '#b8433a';
  ctx.fillRect(14, 3, 2, 5);
}

function drawBench(ctx, w, h) {
  ctx.fillStyle = '#a8814f';
  ctx.fillRect(1, 1, w - 2, 4);
  ctx.fillRect(1, 8, w - 2, 4);
  ctx.fillStyle = '#8a6a3c';
  ctx.fillRect(1, 4, w - 2, 1);
  ctx.fillRect(1, 11, w - 2, 1);
  ctx.fillStyle = '#5a5a62';
  ctx.fillRect(3, 12, 3, 5);
  ctx.fillRect(w - 6, 12, 3, 5);
}

function drawHedge(ctx, seed) {
  paintTile(ctx, 16, 16, '#2f6b2c', ['#276024', '#3d8434'], seed);
  const rnd = makeRng(seed + 7);
  for (let i = 0; i < 6; i++) {
    pixelCircle(ctx, pick(rnd, 2, 13), pick(rnd, 3, 12), 2, '#47883a');
  }
  ctx.fillStyle = '#1f4a1e';
  ctx.fillRect(0, 14, 16, 2);
}

function drawStonePost(ctx, w, h) {
  ctx.fillStyle = '#9a9186';
  ctx.fillRect(1, 2, w - 2, h - 3);
  ctx.fillStyle = '#b0a89c';
  ctx.fillRect(1, 2, 4, h - 3);
  ctx.fillStyle = '#7d7469';
  for (let y = 6; y < h; y += 5) ctx.fillRect(1, y, w - 2, 1);
  ctx.fillStyle = '#b0a89c';
  ctx.fillRect(0, 0, w, 3);
}

/* Make the whole art block usable from a plain Node test script. */

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
  house_main: [618, 300],
  house_blue: [378, 232], house_green: [378, 232], house_cream: [378, 232],
  sign: [78, 40], parksign: [80, 36],
  mailbox: [30, 20], bench: [78, 30], post: [40, 34]
};

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
      a.prop('bush', 18, 10.4);
      a.prop('bush', 21, 10.4);

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

      // neighbours' houses along the north side
      a.prop('house_blue', 6, 5.5);
      a.prop('house_green', 18, 5.5);
      a.prop('house_cream', 30, 5.5);
      a.prop('house_blue', 50, 5.5);
      a.prop('mailbox', 44.6, 6.6);

      // the trees that make it a tree-lined street
      [3, 9, 15, 21, 27, 33, 46, 52].forEach((c, i) => {
        a.prop(i % 2 ? 'tree_a' : 'tree_b', c, 6.4);
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

      // a handful of trees on the lawn, well clear of the oak
      a.prop('tree_a', 12.5, 16);
      a.prop('tree_c', 31.5, 13.5);
      a.prop('tree_b', 30.5, 23.5);
      a.prop('tree_c', 13, 22);
      a.prop('bush', 26, 10.5);
      a.prop('bush', 18, 10.5);

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

    this.scale.on('resize', () => this.layoutControls());
    this.layoutControls();

    // Start at his own back door, more or less.
    this.enterArea('home', 25 * T, 24.5 * T);
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
    const LEAF = '#1b3a17', WOOD = '#241a12', STONE = '#4a463f';

    /* ---- him ---- */
    const frames = heroFrames();
    const hw = 32 * SCALE;
    if (this.textures.exists('hero')) this.textures.remove('hero');
    const hero = this.textures.createCanvas('hero', frames.length * hw, hw);
    const hctx = hero.context || hero.getContext();
    frames.forEach((f, i) => drawPixels(hctx, f.rows, HERO_PALETTE, i * hw, 0, SCALE));
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

    this.buildHenriArt();

    /* ---- the ground ---- */
    this.tileArt = {
      grass: [0, 1, 2].map(i => this.smallCanvas(16, 16, c => paintGrass(c, 11 + i * 37))),
      lawn: [0, 1].map(i => this.smallCanvas(16, 16, c => {
        paintTile(c, 16, 16, '#78b455', ['#6aa649', '#88c266'], 3 + i * 19);
      })),
      road: [0, 1].map(i => this.smallCanvas(16, 16, c => paintRoad(c, 5 + i * 23, false))),
      roadD: [this.smallCanvas(16, 16, c => paintRoad(c, 5, true))],
      walk: [0, 1].map(i => this.smallCanvas(16, 16, c => paintWalk(c, 7 + i * 41))),
      path: [0, 1].map(i => this.smallCanvas(16, 16, c => {
        paintTile(c, 16, 16, '#cbbb96', ['#bbaa85', '#dacdae'], 13 + i * 29);
      })),
      conc: [0, 1].map(i => this.smallCanvas(16, 16, c => {
        paintTile(c, 16, 16, '#c9c6bb', ['#bab7ab', '#d7d4ca'], 17 + i * 31);
      })),
      dirt: [0, 1].map(i => this.smallCanvas(16, 16, c => {
        paintTile(c, 16, 16, '#b08a5a', ['#9b7748', '#c39c6a'], 23 + i * 43);
      })),
      hedge: [0, 1].map(i => this.smallCanvas(16, 16, c => drawHedge(c, 61 + i * 53)))
    };

    /* ---- everything that stands on the ground ---- */
    ['a', 'b', 'c'].forEach((s, i) => {
      const st = TREE_STYLES[s];
      this.makeTexture('tree_' + s, st.w, st.h, c => drawRoundTree(c, s, 101 + i * 57), LEAF);
    });
    this.makeTexture('pine', 26, 40, c => drawPine(c, 26, 40), LEAF);
    this.makeTexture('bush', 22, 20, c => drawBush(c, 22, 20, 5), LEAF);
    this.makeTexture('oak', OAK_W, OAK_H, c => drawBigOak(c, OAK_W, OAK_H), '#14300f');

    Object.keys(HOUSE_STYLES).forEach(name => {
      const s = HOUSE_STYLES[name];
      this.makeTexture('house_' + name, s.w, s.h, c => drawHouse(c, s.w, s.h, s), '#2b1d11');
    });

    this.makeTexture('fence_h', 16, 16, c => drawPixels(c, FENCE_H, FENCE_PALETTE));
    this.makeTexture('fence_v', 16, 16, c => drawPixels(c, FENCE_V, FENCE_PALETTE));
    this.makeTexture('sign', 30, 25, c => drawPixels(c, SIGN_ROWS, SIGN_PALETTE));
    this.makeTexture('parksign', 32, 15, c => drawPixels(c, PARKSIGN_ROWS, PARKSIGN_PALETTE));
    this.makeTexture('mailbox', 17, 17, c => drawMailbox(c, 17, 17), WOOD);
    this.makeTexture('bench', 28, 18, c => drawBench(c, 28, 18), WOOD);
    this.makeTexture('post', 14, 26, c => drawStonePost(c, 14, 26), STONE);
  }

  /* Henri gets his own small spritesheet: 9 frames (3 directions x
     2 walk frames + 1 sit frame each). Each frame is drawn and
     outlined on its own little canvas first, then stamped into the
     sheet — outlining the whole sheet at once would smear a line
     across the gap between frames. */
  buildHenriArt() {
    const HW = HENRI_W, HH = HENRI_H;
    const OUTLINE = '#241a12';
    const specs = [
      ['down0', 'down', false, false], ['down1', 'down', false, true], ['downSit', 'down', true, false],
      ['up0', 'up', false, false], ['up1', 'up', false, true], ['upSit', 'up', true, false],
      ['left0', 'left', false, false], ['left1', 'left', false, true], ['leftSit', 'left', true, false]
    ];
    if (this.textures.exists('henri')) this.textures.remove('henri');
    const tex = this.textures.createCanvas('henri', specs.length * HW, HH);
    const ctx = tex.context || tex.getContext();
    specs.forEach((s, i) => {
      const frame = this.smallCanvasOutlined(HW, HH, c => drawHenri(c, s[1], s[2], s[3]), OUTLINE);
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

    this.readout = this.add.text(10, 10, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.35)', padding: { x: 6, y: 4 }
    }).setScrollFactor(0).setDepth(D + 2);
  }

  layoutControls() {
    const w = this.scale.width, h = this.scale.height;
    this.actionHint.setPosition(w * 0.75, h * 0.62);
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
    if (p.x >= this.scale.width * 0.5) { this.pressAction(p.x, p.y); return; }
    if (this.stickPointerId === null) {
      this.stickPointerId = p.id;
      this.stickBase.setPosition(p.x, p.y).setVisible(true);
      this.stickKnob.setPosition(p.x, p.y).setVisible(true);
    }
  }

  onMove(p) {
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

    this.readout.setText([
      `fps     ${Math.round(this.game.loop.actualFps)}`,
      `where   ${this.areaKey}`,
      `facing  ${this.facing}`
    ].join('\n'));
  }

  checkSigns() {
    let found = null;
    for (const s of this.area.signs) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y) < 130) {
        found = s.text; break;
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
