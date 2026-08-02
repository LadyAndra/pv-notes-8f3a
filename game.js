/* ============================================================
   Prairie Village — Stage 0: Foundations  (revision 2)
   ------------------------------------------------------------
   Changes in this revision:
     - The action button is now the WHOLE right half of the screen.
       Tap anywhere over there and it registers, with a little ripple
       where your thumb landed.
     - Trees and the fence now BLOCK you. You can't walk through them,
       and you slide along them instead of sticking.
     - You can walk *behind* a tree's leaves — it draws over you.
     - New: a MOVE button in the top-right corner cycles between three
       movement styles so you can feel the difference. Your choice is
       remembered on this phone.
   ============================================================ */

const TUNING = {
  playerSpeed: 190,
  stickMaxRadius: 58,
  stickDeadZone: 8,
};

const WORLD_W = 1600;
const WORLD_H = 1200;

// The three movement styles you're deciding between.
const MOVE_MODES = [
  { key: 'FREE',  label: 'FREE  (any angle)'  },
  { key: 'EIGHT', label: '8-WAY (snaps to 8)' },
  { key: 'FOUR',  label: '4-WAY (up/down/L/R)'},
];

class PrairieScene extends Phaser.Scene {
  constructor() { super('prairie'); }

  create() {
    this.input.addPointer(3);

    this.cameras.main.setBackgroundColor('#5d8f42');
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);

    // remember the movement style between visits
    const saved = window.localStorage.getItem('pv_move_mode');
    this.moveModeIndex = Math.max(0, MOVE_MODES.findIndex(m => m.key === saved));

    this.buildWorld();
    this.buildPlayer();
    this.buildControls();

    this.keys = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');

    this.stickPointerId = null;
    this.stickVector = new Phaser.Math.Vector2(0, 0);
    this.actionCount = 0;
    this.facing = 'down';

    this.input.on('pointerdown', (p) => this.onDown(p));
    this.input.on('pointermove', (p) => this.onMove(p));
    this.input.on('pointerup', (p) => this.onUp(p));
    this.input.on('pointerupoutside', (p) => this.onUp(p));

    this.scale.on('resize', () => this.layoutControls());
    this.layoutControls();
  }

  // ---------------------------------------------------------
  // The field, the trees, the fence
  // ---------------------------------------------------------
  buildWorld() {
    const rng = new Phaser.Math.RandomDataGenerator(['prairie-village']);

    // --- flat ground art (nothing here blocks you) ---
    const ground = this.add.graphics().setDepth(0);
    ground.fillStyle(0x6da84e, 1);
    for (let i = 0; i < 60; i++) {
      ground.fillRect(
        rng.between(0, WORLD_W), rng.between(0, WORLD_H),
        rng.between(40, 130), rng.between(30, 90)
      );
    }
    ground.fillStyle(0xb79b6a, 1);
    ground.fillRect(WORLD_W / 2 - 40, 0, 80, WORLD_H);

    // --- solid things live in this group ---
    this.blockers = this.physics.add.staticGroup();

    // Trees. Each one is drawn separately so it can sort in front of or
    // behind you depending on who is further "down" the screen.
    for (let i = 0; i < 26; i++) {
      const tx = rng.between(60, WORLD_W - 60);
      const ty = rng.between(80, WORLD_H - 60);
      if (Math.abs(tx - WORLD_W / 2) < 90) continue; // keep the path walkable
      this.addTree(tx, ty);
    }

    // Fence along the top — a nice flat wall to slide against.
    const fence = this.add.graphics().setDepth(56);
    fence.fillStyle(0x8a6a45, 1);
    for (let x = 20; x < WORLD_W; x += 40) fence.fillRect(x, 30, 6, 26);
    fence.fillStyle(0x9c7a52, 1);
    fence.fillRect(20, 38, WORLD_W - 40, 4);

    const fenceBody = this.add.zone(WORLD_W / 2, 50, WORLD_W - 40, 16);
    this.blockers.add(fenceBody);
    fenceBody.body.updateFromGameObject();
  }

  addTree(tx, ty) {
    // ty is the base of the trunk — where it "stands" on the ground.
    const g = this.add.graphics();
    g.fillStyle(0x5a4331, 1);
    g.fillRect(tx - 4, ty - 16, 8, 16);
    g.fillStyle(0x35692c, 1);
    g.fillCircle(tx, ty - 22, 18);
    g.fillStyle(0x2c5624, 1);
    g.fillCircle(tx - 7, ty - 17, 9);
    // Depth = how far down the screen it stands. Higher = drawn on top.
    g.setDepth(ty);

    // The blocking box is only the trunk area — so the leaves overhang
    // and you can tuck in behind them. Feels much better than a big
    // invisible wall around the whole tree.
    const body = this.add.zone(tx, ty - 5, 18, 12);
    this.blockers.add(body);
    body.body.updateFromGameObject();
  }

  buildPlayer() {
    this.player = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, 22, 26, 0xf2e4c8);
    this.player.setStrokeStyle(2, 0x3a2c1e);

    this.physics.add.existing(this.player);
    // The box that actually bumps into things is his feet, not his whole
    // body — that's why you can stand slightly "under" a tree's leaves.
    this.player.body.setSize(20, 14);
    this.player.body.setOffset(1, 12);
    this.player.body.setCollideWorldBounds(true);

    // a little "nose" so you can see which way he's facing
    this.nose = this.add.rectangle(0, 0, 10, 5, 0x3a2c1e);

    this.physics.add.collider(this.player, this.blockers);
  }

  // ---------------------------------------------------------
  // On-screen controls
  // ---------------------------------------------------------
  buildControls() {
    const D = 10000;

    this.stickBase = this.add.circle(0, 0, TUNING.stickMaxRadius, 0xffffff, 0.16)
      .setScrollFactor(0).setDepth(D).setVisible(false);
    this.stickBase.setStrokeStyle(3, 0xffffff, 0.35);

    this.stickKnob = this.add.circle(0, 0, 26, 0xffffff, 0.42)
      .setScrollFactor(0).setDepth(D + 1).setVisible(false);

    // Faded hint that the right side is the action side.
    this.actionHint = this.add.text(0, 0, 'tap anywhere\non this side', {
      fontFamily: '-apple-system, sans-serif', fontSize: '14px',
      color: '#ffffff', align: 'center'
    }).setOrigin(0.5).setAlpha(0.30).setScrollFactor(0).setDepth(D);

    this.readout = this.add.text(10, 46, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.35)', padding: { x: 6, y: 4 }
    }).setScrollFactor(0).setDepth(D + 2);

    // --- the movement-style toggle (temporary, just for this stage) ---
    this.modeBtn = this.add.rectangle(0, 0, 172, 34, 0x000000, 0.45)
      .setOrigin(1, 0).setScrollFactor(0).setDepth(D + 2);
    this.modeBtn.setStrokeStyle(2, 0xffffff, 0.5);
    this.modeLabel = this.add.text(0, 0, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ffffff'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(D + 3);
    this.refreshModeLabel();
  }

  layoutControls() {
    const w = this.scale.width, h = this.scale.height;
    this.actionHint.setPosition(w * 0.75, h * 0.62);
    this.readout.setPosition(10, 92);
    this.modeBtn.setPosition(w - 10, 46);
    this.modeLabel.setPosition(w - 20, 56);
  }

  refreshModeLabel() {
    this.modeLabel.setText('MOVE: ' + MOVE_MODES[this.moveModeIndex].label);
  }

  cycleMoveMode() {
    this.moveModeIndex = (this.moveModeIndex + 1) % MOVE_MODES.length;
    window.localStorage.setItem('pv_move_mode', MOVE_MODES[this.moveModeIndex].key);
    this.refreshModeLabel();
    this.tweens.add({
      targets: [this.modeBtn, this.modeLabel],
      alpha: { from: 0.4, to: 1 }, duration: 180
    });
  }

  // ---------------------------------------------------------
  // Touch input
  // ---------------------------------------------------------
  onDown(p) {
    // The mode toggle sits on the right side, so check it first.
    const b = this.modeBtn;
    if (p.x >= b.x - b.width && p.x <= b.x && p.y >= b.y && p.y <= b.y + b.height) {
      this.cycleMoveMode();
      return;
    }

    // RIGHT HALF = action, anywhere.
    if (p.x >= this.scale.width * 0.5) {
      this.pressAction(p.x, p.y);
      return;
    }

    // LEFT HALF = joystick, appears under your thumb.
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
    // ripple where the thumb landed
    const ring = this.add.circle(x, y, 18, 0xffffff, 0)
      .setScrollFactor(0).setDepth(10005);
    ring.setStrokeStyle(3, 0xffffff, 0.9);
    this.tweens.add({
      targets: ring,
      scale: { from: 0.5, to: 2.1 },
      alpha: { from: 1, to: 0 },
      duration: 320,
      ease: 'Quad.Out',
      onComplete: () => ring.destroy()
    });
  }

  // ---------------------------------------------------------
  // Turn the raw stick into movement, in the chosen style
  // ---------------------------------------------------------
  resolveDirection(vx, vy) {
    const mode = MOVE_MODES[this.moveModeIndex].key;
    const mag = Math.min(1, Math.hypot(vx, vy));
    if (mag === 0) return { x: 0, y: 0 };

    if (mode === 'FREE') return { x: vx, y: vy };

    const step = (mode === 'EIGHT') ? Math.PI / 4 : Math.PI / 2;
    const snapped = Math.round(Math.atan2(vy, vx) / step) * step;
    return { x: Math.cos(snapped) * mag, y: Math.sin(snapped) * mag };
  }

  update() {
    let vx = this.stickVector.x;
    let vy = this.stickVector.y;

    // keyboard fallback for laptop testing
    if (this.keys.left.isDown || this.wasd.A.isDown) vx = -1;
    else if (this.keys.right.isDown || this.wasd.D.isDown) vx = 1;
    if (this.keys.up.isDown || this.wasd.W.isDown) vy = -1;
    else if (this.keys.down.isDown || this.wasd.S.isDown) vy = 1;

    const dir = this.resolveDirection(vx, vy);
    this.player.body.setVelocity(dir.x * TUNING.playerSpeed, dir.y * TUNING.playerSpeed);

    // face the dominant direction (this is how nearly all top-down
    // games do it, even ones that move at any angle)
    if (dir.x !== 0 || dir.y !== 0) {
      if (Math.abs(dir.x) > Math.abs(dir.y)) this.facing = dir.x > 0 ? 'right' : 'left';
      else this.facing = dir.y > 0 ? 'down' : 'up';
    }
    const n = {
      down:  [0, 10, 10, 5], up: [0, -10, 10, 5],
      left:  [-10, 2, 5, 10], right: [10, 2, 5, 10]
    }[this.facing];
    this.nose.setPosition(this.player.x + n[0], this.player.y + n[1]);
    this.nose.setSize(n[2], n[3]);

    // keep the player sorted correctly against the trees
    this.player.setDepth(this.player.y);
    this.nose.setDepth(this.player.y + 0.1);

    this.readout.setText([
      `mode    ${MOVE_MODES[this.moveModeIndex].key}`,
      `fps     ${Math.round(this.game.loop.actualFps)}`,
      `facing  ${this.facing}`,
      `taps    ${this.actionCount}`
    ].join('\n'));
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#5d8f42',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: { default: 'arcade', arcade: { debug: false } },
  render: { pixelArt: true, antialias: false },
  scene: [PrairieScene]
});
