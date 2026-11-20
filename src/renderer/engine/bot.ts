// Um bot: cápsula brilhante, rosto plano, braços em pá, pés em meia-lua, anel, coroa e tela.
// Objetos mutáveis atualizados por quadro; nada disso passa pelo React.

import * as THREE from 'three';
import type { Agent, Status } from '@shared/types';
import { pastelOf } from '../avatar';
import type { Skin } from '../skins/registry';
import { GEO, GOLD } from './geometry';

export const BOT_COLOR: Record<string, number> = { silver: 0xc3cad6, pink: 0xff6fae, yellow: 0xffd23f, purple: 0xa56bff, orange: 0xff9233, teal: 0x1fc8b4, blue: 0x3d8bff, green: 0x3ecf6e, red: 0xff4d4d };
export const STATUS_COLOR: Record<Status, number> = { available: 0x49d17a, waiting: 0xf0a93b, working: 0x4aa8ff, problem: 0xff4d4d };

export type Expr = 'neutral' | 'asleep' | 'sleepy' | 'look' | 'happy' | 'wink' | 'surprised';
export const restExpr = (st: Status): Expr => (st === 'working' ? 'neutral' : st === 'available' ? 'asleep' : 'sleepy');
export const damp = (cur: number, target: number, k: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-k * dt));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export interface Move { a: THREE.Vector3; c: THREE.Vector3; t: number; dur: number; target: BotView | null; done: (() => void) | null; side?: number; sh?: number }
export interface Say { text: string; t: number; dur: number; pending: boolean; done: (() => void) | null }

interface Eye { pill: THREE.Mesh; arc: THREE.Mesh }

export class BotView {
  d: Agent;
  readonly group = new THREE.Group();
  readonly rig = new THREE.Group();
  readonly body: THREE.Mesh;
  readonly bodyMat: THREE.MeshPhysicalMaterial;
  readonly limbMat: THREE.MeshPhysicalMaterial;
  readonly faceMat = new THREE.MeshBasicMaterial({ color: 0x07080b }); // rosto plano: sem luz, sem reflexo
  readonly face = new THREE.Group();
  readonly eyeL: Eye;
  readonly eyeR: Eye;
  readonly mouthLine: THREE.Mesh;
  readonly mouthSmile: THREE.Mesh;
  readonly mouthO: THREE.Mesh;
  readonly mouthG = new THREE.Group();
  readonly armL: THREE.Group;
  readonly armR: THREE.Group;
  readonly footL: THREE.Group;
  readonly footR: THREE.Group;
  readonly consoleMat: THREE.MeshBasicMaterial;
  readonly consoleMesh: THREE.Mesh;
  readonly ringMat: THREE.MeshBasicMaterial;
  readonly ring: THREE.Mesh;
  crown: THREE.Group | null = null;
  baseColor: number;
  skinCur: string | null | undefined = undefined;
  chief = false;
  dim = false;

  home = new THREE.Vector3();
  homeYaw = 0;
  targetYaw = 0;
  spot = new THREE.Vector3();
  spotYaw = 0;
  /** desvio fixo do olhar em relação à câmera, sorteado na criação */
  userYaw = 0;
  /** entrou com a sala já aberta: aparece no lugar antes de seguir o status */
  newcomer = false;
  readonly phase = rand(0, 6.28);
  readonly speed = rand(5, 8);
  move: Move | null = null;
  say: Say | null = null;
  partner: BotView | null = null;
  away = false;
  hover = false;
  forcedExpr: Expr | null = null;
  baseExpr: Expr;
  dock = 0;
  dockSlot = -1;
  wantDock = false;
  calledUntil = 0;
  arrT = 0;
  spin = 0;
  lastX?: number;
  lastZ?: number;
  fx: { expr: Expr; exprUntil: number; nextExprAt: number; nextBlinkAt: number; blinkUntil: number; lookDir: number };

  // sobreposições (DOM)
  label!: HTMLDivElement;
  lDot!: HTMLSpanElement;
  lName!: HTMLSpanElement;
  lBadge!: HTMLSpanElement;
  lRole!: HTMLDivElement;
  bubble!: HTMLDivElement;
  bubbleKey: string | null = null;

  constructor(d: Agent, holoTex: THREE.Texture, private scene: THREE.Scene) {
    this.d = d;
    this.baseColor = pastelOf(d.slot);
    this.baseExpr = restExpr(d.status);
    this.fx = { expr: this.baseExpr, exprUntil: 0, nextExprAt: rand(2, 9), nextBlinkAt: rand(0.5, 4), blinkUntil: 0, lookDir: 1 };
    this.group.add(this.rig);
    this.bodyMat = new THREE.MeshPhysicalMaterial({ color: this.baseColor, roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.95 });
    this.limbMat = this.bodyMat.clone();
    this.body = new THREE.Mesh(GEO.body, this.bodyMat);
    this.body.position.y = 0.465;
    this.body.castShadow = true;
    this.body.userData.bot = this;
    this.rig.add(this.body);

    // rosto na superfície do corpo; girar `face` em Y desliza os olhos pela curva (olhar de lado)
    this.face.position.y = 0.6;
    this.rig.add(this.face);
    const makeEye = (side: number): Eye => {
      const h = new THREE.Group();
      h.rotation.set(-0.27, side * 0.5, 0, 'YXZ');
      const pill = new THREE.Mesh(GEO.eye, this.faceMat);
      pill.position.z = 0.3;
      pill.scale.set(1, 1, 0.1);
      const arc = new THREE.Mesh(GEO.arcEye, this.faceMat);
      arc.position.set(0, -0.014, 0.3);
      arc.rotation.z = Math.PI / 2 - 1.1;
      arc.scale.z = 0.7;
      arc.visible = false;
      h.add(pill, arc);
      this.face.add(h);
      return { pill, arc };
    };
    this.eyeL = makeEye(-1);
    this.eyeR = makeEye(1);
    this.mouthLine = new THREE.Mesh(GEO.mouthLine, this.faceMat);
    this.mouthLine.rotation.z = Math.PI / 2;
    this.mouthLine.scale.z = 0.5;
    this.mouthLine.position.set(0, -0.012, 0.299);
    this.mouthSmile = new THREE.Mesh(GEO.mouthSmile, this.faceMat);
    this.mouthSmile.rotation.z = -(Math.PI / 2 + 0.95);
    this.mouthSmile.scale.z = 0.7;
    this.mouthSmile.position.set(0, 0.024, 0.3);
    this.mouthSmile.visible = false;
    this.mouthO = new THREE.Mesh(GEO.mouthO, this.faceMat);
    this.mouthO.scale.set(1, 1, 0.3);
    this.mouthO.position.set(0, -0.016, 0.298);
    this.mouthO.visible = false;
    this.mouthG.add(this.mouthLine, this.mouthSmile, this.mouthO);
    this.face.add(this.mouthG);

    // braços: pás achatadas encostadas nas laterais, presas no alto
    const makeArm = (side: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.305, 0.6, 0);
      const arm = new THREE.Mesh(GEO.arm, this.limbMat);
      arm.scale.set(0.33, 1, 1);
      arm.position.set(side * 0.014, -0.175, 0);
      arm.rotation.z = side * 0.07;
      arm.castShadow = true;
      pivot.add(arm);
      this.rig.add(pivot);
      return pivot;
    };
    this.armL = makeArm(-1);
    this.armR = makeArm(1);

    // pés: placas finas em meia-lua abraçando a parte de baixo do corpo
    const makeFoot = (side: number) => {
      const holder = new THREE.Group();
      const foot = new THREE.Mesh(GEO.foot, this.limbMat);
      const az = side * 1.5, pol = 0.86, r = 0.36;
      const dir = new THREE.Vector3(Math.sin(pol) * Math.sin(az), -Math.cos(pol), Math.sin(pol) * Math.cos(az));
      foot.position.set(0, 0.36, 0).addScaledVector(dir, r);
      foot.lookAt(dir.clone().multiplyScalar(3).add(new THREE.Vector3(0, 0.33, 0)));
      foot.rotateX(-0.42);
      foot.rotateZ(-side * 0.3);
      foot.castShadow = true;
      foot.userData.q0 = foot.quaternion.clone();
      holder.add(foot);
      this.group.add(holder);
      return holder;
    };
    this.footL = makeFoot(-1);
    this.footR = makeFoot(1);

    // tela holográfica na frente (só aparece em quem está trabalhando)
    this.consoleMat = new THREE.MeshBasicMaterial({ map: holoTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide, toneMapped: false });
    this.consoleMesh = new THREE.Mesh(GEO.console, this.consoleMat);
    this.consoleMesh.position.set(0, 0.47, 0.62);
    this.consoleMesh.rotation.x = 0.5;
    this.consoleMesh.visible = false;
    this.group.add(this.consoleMesh);

    this.ringMat = new THREE.MeshBasicMaterial({ color: BOT_COLOR[d.color || ''] ?? STATUS_COLOR[d.status], transparent: true, opacity: 0.6, toneMapped: false, side: THREE.DoubleSide, depthWrite: false });
    this.ring = new THREE.Mesh(GEO.ring, this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.012;
    scene.add(this.ring);
    scene.add(this.group);
    this.setChief(d.chief);
  }

  setChief(on: boolean) {
    if (on === this.chief && (on ? !!this.crown : !this.crown)) return;
    this.chief = on;
    if (on && !this.crown) {
      const crown = new THREE.Group();
      const wall = new THREE.Mesh(GEO.crown, GOLD);
      wall.castShadow = true;
      const rim = new THREE.Mesh(GEO.crownRim, GOLD);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.006;
      rim.castShadow = true;
      crown.add(wall, rim);
      const tilt = 0.52; // inclinada para o lado direito do bot
      crown.position.set(Math.sin(tilt) * 0.283, 0.585 + Math.cos(tilt) * 0.283, 0.02);
      crown.rotation.z = -tilt;
      this.rig.add(crown);
      this.crown = crown;
    } else if (!on && this.crown) {
      this.rig.remove(this.crown);
      this.crown = null;
    }
    this.ring.scale.setScalar(on ? 1.16 : 1);
  }

  setSlot(slot: number) {
    const c = pastelOf(slot);
    if (c === this.baseColor) return;
    this.baseColor = c;
    this.skinCur = undefined; // força reaplicar
  }

  setSkin(s: Skin | null, tex: (s: Skin) => THREE.Texture) {
    const key = s ? s.name : null;
    if (this.skinCur === key) return;
    this.skinCur = key;
    const m = this.bodyMat;
    const t = s ? tex(s) : null;
    m.map = t;
    m.emissiveMap = t;
    m.emissive.setHex(s ? 0xffffff : 0x000000);
    m.emissiveIntensity = s ? 0.3 : 1;
    m.color.setHex(s ? 0xffffff : this.baseColor);
    m.needsUpdate = true;
    this.limbMat.color.set(s ? s.limb : this.baseColor);
    this.faceMat.color.set(s ? s.eye : 0x07080b);
    this.mouthG.visible = !(s && s.mouth === false);
  }

  setDim(on: boolean) {
    if (on === this.dim) return;
    this.dim = on;
    for (const m of [this.bodyMat, this.limbMat]) { m.transparent = on; m.opacity = on ? 0.4 : 1; m.needsUpdate = true; }
    this.label?.classList.toggle('dim', on);
  }

  pickExpr(): Expr {
    const r = Math.random();
    if (this.baseExpr === 'asleep') return r < 0.85 ? 'asleep' : 'sleepy';
    if (this.baseExpr === 'sleepy') return r < 0.55 ? 'look' : r < 0.8 ? 'neutral' : 'surprised';
    return r < 0.38 ? 'look' : r < 0.68 ? 'happy' : r < 0.85 ? 'wink' : 'surprised';
  }

  updateFace(t: number, dt: number) {
    const f = this.fx;
    if (t > f.nextExprAt) {
      f.expr = this.pickExpr();
      f.lookDir = Math.random() < 0.5 ? -1 : 1;
      f.exprUntil = t + rand(1.2, 2.8);
      f.nextExprAt = f.exprUntil + rand(4, 12);
    }
    if (t > f.exprUntil) f.expr = this.baseExpr;
    if (t > f.nextBlinkAt) { f.blinkUntil = t + 0.13; f.nextBlinkAt = t + (Math.random() < 0.2 ? 0.32 : rand(1.8, 5.5)); }
    const talking = !!this.say && !this.move && !this.say.pending;
    const thinking = !!this.say && !this.move && this.say.pending;
    const awake = talking || !!this.move || !!this.partner || this.away; // acorda para falar, andar ou se reunir
    const expr: Expr = this.forcedExpr || (thinking ? 'look' : this.hover ? 'happy' : awake && (f.expr === 'asleep' || f.expr === 'sleepy') ? 'neutral' : f.expr);
    let sL = 1, sR = 1, sx = 1, arc = false, mouth: 'line' | 'smile' | 'o' = 'line', look = 0;
    if (expr === 'happy') { arc = true; mouth = 'smile'; }
    else if (expr === 'wink') { sR = 0.1; mouth = 'smile'; }
    else if (expr === 'surprised') { sL = sR = 1.25; sx = 1.15; mouth = 'o'; }
    else if (expr === 'look') look = (thinking ? Math.sin(t * 1.1 + this.phase) : f.lookDir) * 0.24;
    else if (expr === 'sleepy') sL = sR = 0.42;
    else if (expr === 'asleep') { sL = sR = 0.1; sx = 1.15; }
    if (t < f.blinkUntil && expr !== 'asleep') sL = sR = 0.08;
    if (talking) { mouth = 'o'; arc = false; }
    for (const [e, s] of [[this.eyeL, sL], [this.eyeR, sR]] as [Eye, number][]) {
      e.pill.visible = !arc;
      e.arc.visible = arc;
      e.pill.scale.y = damp(e.pill.scale.y, s, 30, dt);
      e.pill.scale.x = damp(e.pill.scale.x, sx, 18, dt);
    }
    this.mouthLine.visible = mouth === 'line';
    this.mouthSmile.visible = mouth === 'smile';
    this.mouthO.visible = mouth === 'o';
    if (mouth === 'o') { const k = talking ? 0.45 + Math.abs(Math.sin(t * 13)) * 0.9 : 1; this.mouthO.scale.set(talking ? 1.1 : 1, k, 0.12); }
    this.face.rotation.y = damp(this.face.rotation.y, look, 9, dt);
  }

  /** Corpo, braços, recarga, tela e anel (a caminhada e a fala são do motor). */
  updateBody(t: number, dt: number, screens: boolean, dockMat: THREE.MeshBasicMaterial | undefined) {
    const walking = !!this.move, talking = !walking && !!this.say && !this.say.pending;
    const busy = this.d.status === 'working';
    const hideScreen = walking || !!this.say || this.away || !!this.partner || !screens || !busy;
    this.ring.position.x = this.group.position.x;
    this.ring.position.z = this.group.position.z;
    let dy = this.targetYaw - this.group.rotation.y;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.group.rotation.y += dy * (1 - Math.exp(-dt * 9));

    const docked = this.wantDock && !walking && this.group.position.distanceTo(this.home) < 0.06;
    this.dock = damp(this.dock, docked ? 1 : 0, docked ? 5 : 12, dt);
    const dk = this.dock, up = 1 - dk;
    let aL: number, aR: number, rz: number, ry: number, rx = 0;
    let fL = 0, fR = 0;
    if (docked) { rz = 0; ry = 0; aL = aR = 0; }
    else if (walking) {
      // desliza: inclina para a frente ao arrancar, para trás ao frear e para dentro nas curvas
      const k = Math.min(1, this.move!.t / this.move!.dur), g = 4 * k * (1 - k);
      rx = 0.55 * (1 - 2 * k) * g + 0.07 * g + Math.sin(t * 7 + this.phase) * 0.012;
      rz = -0.12 * Math.max(-1, Math.min(1, dy));
      ry = 0;
      aL = aR = 0.18 + rx * 1.6;
    } else {
      rz = Math.sin(t * 0.8 + this.phase) * 0.02;
      ry = Math.sin(t * (busy ? 1.6 : 0.9) + this.phase) * 0.012;
      if (talking) { aL = -0.15; aR = -1.25 + Math.sin(t * 6) * 0.28; }
      else if (!busy) { aL = Math.sin(t * 0.9 + this.phase) * 0.04; aR = Math.sin(t * 0.9 + this.phase + 2) * 0.04; }
      else { aL = -0.95 + Math.sin(t * this.speed + this.phase) * 0.2; aR = -0.95 + Math.sin(t * this.speed * 1.27 + this.phase + 1.4) * 0.2; }
    }
    this.rig.rotation.z = damp(this.rig.rotation.z, rz, 14, dt);
    this.rig.rotation.x = damp(this.rig.rotation.x, rx, 9, dt);
    // os pés giram conforme a distância percorrida
    const p = this.group.position;
    if (this.lastX !== undefined) {
      const dd = Math.hypot(p.x - this.lastX, p.z - this.lastZ!);
      this.spin += dd / 0.1;
      if (dd < 1e-4) this.spin += (Math.round(this.spin / Math.PI) * Math.PI - this.spin) * 0.15;
    }
    this.lastX = p.x;
    this.lastZ = p.z;
    [this.footL, this.footR].forEach((h, i) => { const f = h.children[0]; f.quaternion.copy(f.userData.q0); f.rotateZ((i ? -1 : 1) * this.spin); });
    this.rig.position.y = damp(this.rig.position.y, ry, 14, dt);
    this.armL.rotation.x = damp(this.armL.rotation.x, aL, 16, dt);
    this.armR.rotation.x = damp(this.armR.rotation.x, aR, 16, dt);
    // recolhe braços e pés e apaga o rosto quando está na recarga
    [this.armL, this.armR].forEach((a, k) => { a.scale.setScalar(Math.max(up, 0.001)); a.position.x = (k ? 1 : -1) * 0.305 * (1 - 0.75 * dk); a.position.y = 0.6 - 0.12 * dk; a.visible = up > 0.03; });
    [this.footL, this.footR].forEach((f) => { f.scale.setScalar(Math.max(up, 0.001)); f.visible = up > 0.03; });
    this.face.visible = dk < 0.6;
    fL += 0.33 * dk;
    fR += 0.33 * dk;
    if (dockMat) dockMat.opacity = docked ? 0.45 + Math.sin(t * 1.6 + this.phase) * 0.3 : 0.12;
    if (this.lRole) this.lRole.style.display = dk > 0.5 ? 'none' : '';
    this.footL.position.y = damp(this.footL.position.y, fL, 20, dt);
    this.footR.position.y = damp(this.footR.position.y, fR, 20, dt);

    const target = hideScreen ? 0 : 0.72 + Math.sin(t * 7 + this.phase) * 0.08;
    this.consoleMat.opacity = damp(this.consoleMat.opacity, target, 6, dt);
    this.consoleMesh.visible = this.consoleMat.opacity > 0.02;
    this.consoleMesh.position.y = 0.47 + Math.sin(t * 1.3 + this.phase) * 0.012;
    const st = this.d.status;
    this.ringMat.opacity = (this.chief ? Math.max(up, 0.55) : up) * (0.42 + Math.sin(t * (st === 'waiting' ? 3.2 : st === 'working' ? 6 : st === 'problem' ? 9 : 1.6) + this.phase) * 0.22) * (this.dim ? 0.5 : 1);
    this.ringMat.color.setHex(st === 'problem' ? STATUS_COLOR.problem : this.chief ? 0xffc531 : BOT_COLOR[this.d.color || ''] ?? STATUS_COLOR[st]);
    this.updateFace(t, dt);
  }

  dispose() {
    this.scene.remove(this.group);
    this.scene.remove(this.ring);
    this.bodyMat.dispose();
    this.limbMat.dispose();
    this.faceMat.dispose();
    this.consoleMat.dispose();
    this.ringMat.dispose();
    this.label?.remove();
    this.bubble?.remove();
  }
}
