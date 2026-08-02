/* ============================================================
   Prairie Village — Stage 0: Foundations
   ------------------------------------------------------------
   What this file does right now:
     - fills the whole phone screen with a green field
     - puts a placeholder square (the future "him") in the middle
     - gives you a thumb joystick: touch anywhere on the LEFT half
       and drag; the stick appears wherever your thumb lands
     - gives you an action button on the RIGHT side
     - shows a small readout so we can check things are working

   Nothing here is final art or final feel — this stage exists to
   prove the pipeline works and to tune the controls to your thumbs.
   ============================================================ */

// ---- Knobs we may tune after you test it -------------------
const TUNING = {
  playerSpeed: 190,      // how fast the square moves (pixels per second)
  stickMaxRadius: 58,    // how far the knob can travel from the center
  stickDeadZone: 8,      // ignore tiny thumb wobbles
  buttonRadius: 44,      // size of the action button
  buttonMarginX: 78,     // distance from the right edge
  buttonMarginY: 108,    // distance from the bottom edge (clears the home bar)
};

const WORLD_W = 1600;
const WORLD_H = 1200;

class PrairieScene extends Phaser.Scene {
  constructor() {
    super('prairie');
  }

  create() {
    // --- allow more than one finger at a time (stick + button) ---
    this.input.addPointer(3);

    // --- the field --------------------------------------------
    this.cameras.main.setBackgroundColor('#5d8f42');
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    // Some scenery so you can actually SEE that you're moving.
    // (These are throwaway shapes — real tiles arrive in Stage 1.)
    const scenery = this.add.graphics();
    const rng = new Phaser.Math.RandomDataGenerator(['prairie-village']);

    // patches of lighter grass
    scenery.fillStyle(0x6da84e, 1);
    for (let i = 0; i < 60; i++) {
      scenery.fillRect(
        rng.between(0, WORLD_W), rng.between(0, WORLD_H),
        rng.between(40, 130), rng.between(30, 90)
      );
    }

    // a dirt path down the middle, so there's a landmark
    scenery.fillStyle(0xb79b6a, 1);
    scenery.fillRect(WORLD_W / 2 - 40, 0, 80, WORLD_H);

    // blobby "trees"
    for (let i = 0; i < 26; i++) {
      const tx = rng.between(60, WORLD_W - 60);
      const ty = rng.between(60, WORLD_H - 60);
      if (Math.abs(tx - WORLD_W / 2) < 90) continue; // keep the path clear
      scenery.fillStyle(0x5a4331, 1);
      scenery.fillRect(tx - 4, ty, 8, 16);
      scenery.fillStyle(0x35692c, 1);
      scenery.fillCircle(tx, ty - 6, 18);
    }

    // a fence line along the top edge, purely as a reference point
    scenery.fillStyle(0x8a6a45, 1);
    for (let x = 20; x < WORLD_W; x += 40) scenery.fillRect(x, 30, 6, 26);

    // --- the placeholder player -------------------------------
    this.player = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, 22, 26, 0xf2e4c8);
    this.player.setStrokeStyle(2, 0x3a2c1e);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);

    // camera follows him with a little smoothing
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);

    // --- on-screen controls (these sit still while the world scrolls) ---
    this.buildControls();

    // --- keyboard, so it's testable on a laptop too -----------
    this.keys = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');

    // --- touch handling ---------------------------------------
    this.stickPointerId = null;
    this.stickVector = new Phaser.Math.Vector2(0, 0);
    this.actionCount = 0;

    this.input.on('pointerdown', (p) => this.onDown(p));
    this.input.on('pointermove', (p) => this.onMove(p));
    this.input.on('pointerup', (p) => this.onUp(p));
    this.input.on('pointerupoutside', (p) => this.onUp(p));

    // --- reposition everything if the phone is rotated --------
    this.scale.on('resize', () => this.layoutControls());
    this.layoutControls();
  }

  // ---------------------------------------------------------
  // Build the joystick + action button + readout text
  // ---------------------------------------------------------
  buildControls() {
    const D = 1000; // depth: keep controls drawn on top of everything

    this.stickBase = this.add.circle(0, 0, TUNING.stickMaxRadius, 0xffffff, 0.16)
      .setScrollFactor(0).setDepth(D).setVisible(false);
    this.stickBase.setStrokeStyle(3, 0xffffff, 0.35);

    this.stickKnob = this.add.circle(0, 0, 26, 0xffffff, 0.42)
      .setScrollFactor(0).setDepth(D + 1).setVisible(false);

    this.actionBtn = this.add.circle(0, 0, TUNING.buttonRadius, 0xffffff, 0.22)
      .setScrollFactor(0).setDepth(D);
    this.actionBtn.setStrokeStyle(3, 0xffffff, 0.45);

    this.actionLabel = this.add.text(0, 0, 'A', {
      fontFamily: 'monospace', fontSize: '26px', color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(D + 1);

    this.readout = this.add.text(10, 10, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.35)', padding: { x: 6, y: 4 }
    }).setScrollFactor(0).setDepth(D + 2);

    this.hint = this.add.text(0, 0,
      'Left half: hold & drag to walk   •   Right: tap A', {
      fontFamily: '-apple-system, sans-serif', fontSize: '13px',
      color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.30)',
      padding: { x: 8, y: 5 }
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(D + 2);
  }

  layoutControls() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.actionBtn.setPosition(w - TUNING.buttonMarginX, h - TUNING.buttonMarginY);
    this.actionLabel.setPosition(this.actionBtn.x, this.actionBtn.y);

    // keep the readout clear of the notch
    this.readout.setPosition(10, 46);
    this.hint.setPosition(w / 2, h - 16);
  }

  // ---------------------------------------------------------
  // Touch input
  // ---------------------------------------------------------
  onDown(p) {
    // Did they hit the action button?
    const dToBtn = Phaser.Math.Distance.Between(p.x, p.y, this.actionBtn.x, this.actionBtn.y);
    if (dToBtn <= TUNING.buttonRadius + 14) {
      this.pressAction();
      return;
    }

    // Otherwise, a touch on the left half starts the joystick.
    if (p.x < this.scale.width * 0.5 && this.stickPointerId === null) {
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
      // strength ramps from 0 at the dead zone to 1 at full stretch
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

  pressAction() {
    this.actionCount++;
    // quick visual "pop" so you can feel the press registered
    this.tweens.add({
      targets: [this.actionBtn, this.actionLabel],
      scale: { from: 0.86, to: 1 },
      duration: 130,
      ease: 'Back.Out'
    });
  }

  // ---------------------------------------------------------
  // Every frame
  // ---------------------------------------------------------
  update() {
    let vx = this.stickVector.x;
    let vy = this.stickVector.y;

    // keyboard fallback (laptop testing)
    if (this.keys.left.isDown || this.wasd.A.isDown) vx = -1;
    else if (this.keys.right.isDown || this.wasd.D.isDown) vx = 1;
    if (this.keys.up.isDown || this.wasd.W.isDown) vy = -1;
    else if (this.keys.down.isDown || this.wasd.S.isDown) vy = 1;

    this.player.body.setVelocity(vx * TUNING.playerSpeed, vy * TUNING.playerSpeed);

    this.readout.setText([
      `screen  ${Math.round(this.scale.width)} x ${Math.round(this.scale.height)}`,
      `fps     ${Math.round(this.game.loop.actualFps)}`,
      `stick   ${vx.toFixed(2)}, ${vy.toFixed(2)}`,
      `A taps  ${this.actionCount}`
    ].join('\n'));
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#5d8f42',
  scale: {
    mode: Phaser.Scale.RESIZE,      // always fill the screen, any phone
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  render: {
    pixelArt: true,                 // keeps future 16x16 art crisp, not blurry
    antialias: false
  },
  scene: [PrairieScene]
});
