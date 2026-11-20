// Motor da sala (TS puro sobre three.js): cena, câmera, layout ao vivo, caminhada, separação,
// falas em fila, reuniões e sobreposições (rótulos e balões). O React só chama setRoom/setPrefs.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BASE_DIMS, computeLayout, computeMeetings, DEPT_Z1, DOCK, dockSlot, seatAt, TABLE_R, ZONE, zoneSlot, type DeptLayout, type Meeting, type RoomDims, type RoomLayout } from '@shared/layout';
import type { Agent, AgentId, RoomEvent, RoomState, Status } from '@shared/types';
import { css } from '../avatar';
import { splitDoing } from '../doing';
import { hm, statusText, t as tr } from '../i18n';
import { resolveSkin, skinCanvas, type Skin } from '../skins/registry';
import type { Prefs } from '../store';
import { BotView, damp, restExpr, STATUS_COLOR } from './bot';
import { bodyUShift, crispText, GEO } from './geometry';
import { makeHolo } from './holo';
import { playBlip } from './blip';

export interface EngineCallbacks {
  openAgent(id: AgentId): void;
  openTable(deptKey: string): void;
  activeChanged(id: AgentId | null): void;
  cameraChanged(cam: { p: number[]; t: number[] }): void;
  rotateStopped(): void;
  layoutChanged(depts: DeptLayout[]): void;
  ready(): void;
}

interface Step { bot: AgentId; text?: string; walkTo?: AgentId }

const ROT = [0.024, 0.05, 0.11];
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const BASE_CAM_OFF = new THREE.Vector3(10, 7.4, 15);
const nowMs = () => performance.timeOrigin + performance.now();
const norm = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export class RoomEngine {
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private floor: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private grid: THREE.GridHelper;
  private sun!: THREE.DirectionalLight;
  private dimsKey = '';
  /** vista inicial ("Ver tudo"): acompanha o tamanho da arena */
  private homeCam = new THREE.Vector3(10, 8, 15);
  private homeTgt = new THREE.Vector3(0, 0.6, 0);
  private sign: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private signKey = '';
  private zoneGroup = new THREE.Group();
  private deptGroup = new THREE.Group();
  private dockGroup = new THREE.Group();
  private tables: THREE.Object3D[] = [];
  private dockSlots: { mat: THREE.MeshBasicMaterial; bot: BotView | null }[] = [];
  private holo = makeHolo(STATUS_COLOR.working);
  private bots = new Map<AgentId, BotView>();
  private skinTex = new Map<string, THREE.Texture>();
  private layout: RoomLayout = { dims: BASE_DIMS, depts: [], deptOf: new Map(), spots: new Map(), order: [] };
  private meetings: Meeting[] = [];
  private shapeKey = '';
  private room: RoomState = { at: 0, agents: [], groups: [], events: [], connectors: [] };
  private prefs: Prefs;
  private seenEv = new Set<string>();
  private lastDoing = new Map<AgentId, string>();
  private queue: Step[] = [];
  private scriptRunning = false;
  private focus: { bot: BotView | null; t: 0 | number } | null = null;
  private downAt: [number, number] | null = null;
  private rotMs = nowMs();
  private timer = new THREE.Timer();
  private holoAcc = 0;
  private raf = 0;
  private timers: ReturnType<typeof setInterval>[] = [];
  private cleanups: (() => void)[] = [];
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private first = true;
  private readyFired = false;
  private tmp = new THREE.Vector3();
  private fTgt = new THREE.Vector3();
  private fOff = new THREE.Vector3();
  private proj = new THREE.Vector3();

  constructor(private app: HTMLElement, private labelsEl: HTMLElement, private cb: EngineCallbacks, prefs: Prefs) {
    this.prefs = prefs;
    const w = app.clientWidth || 800, h = app.clientHeight || 600;
    this.scene.background = new THREE.Color(0x070a12);
    this.scene.fog = new THREE.Fog(0x070a12, 22, 44);
    this.camera = new THREE.PerspectiveCamera(46, w / h, 0.1, 120);
    this.camera.position.copy(this.homeCam);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    // até 1,5x: em tela retina, 2x custava ~40% dos quadros sem ganho visível; cai sozinho se ficar lento (adaptQuality)
    this.pixelRatio = Math.min(window.devicePixelRatio, 1.5);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap foi removido no three 0.18x
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.className = 'scene';
    app.insertBefore(this.renderer.domElement, labelsEl);
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    } catch { /* sem ambiente */ }

    const c = (this.controls = new OrbitControls(this.camera, this.renderer.domElement));
    c.target.copy(this.homeTgt);
    c.enableDamping = true;
    c.minDistance = 1.2;
    c.maxDistance = 60;
    c.maxPolarAngle = Math.PI / 2.02;
    c.screenSpacePanning = false;
    c.zoomToCursor = true;
    c.panSpeed = 1.1;
    c.keyPanSpeed = 22;
    c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    c.addEventListener('start', () => {
      this.focus = null;
      if (this.prefs.rotate) this.cb.rotateStopped();
    });
    c.addEventListener('end', () => this.cb.cameraChanged(this.camState()));
    // o giro segue o relógio, então continua do mesmo ponto quando a página é recarregada
    if (prefs.rotate) this.camera.position.copy(c.target).add(BASE_CAM_OFF.clone().applyAxisAngle(Y_AXIS, ((this.rotMs / 1000) * ROT[prefs.speed]) % (Math.PI * 2)));
    else if (prefs.cam) { this.camera.position.fromArray(prefs.cam.p); c.target.fromArray(prefs.cam.t); }

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    this.scene.add(new THREE.HemisphereLight(0xa9c8ff, 0x101522, 0.35));
    const sun = (this.sun = new THREE.DirectionalLight(0xffffff, 1.5));
    sun.position.set(8, 16, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 12, bottom: -12 });
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);

    // sala aberta, sem paredes
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(BASE_DIMS.roomW, BASE_DIMS.roomD), new THREE.MeshStandardMaterial({ color: 0x0d1220, roughness: 0.32, metalness: 0.55, envMapIntensity: 0.35 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
    this.grid = new THREE.GridHelper(24, 24, 0x2f7cff, 0x1b3a6e);
    this.grid.position.y = 0.006;
    const gm = this.grid.material as THREE.Material;
    gm.transparent = true;
    gm.opacity = 0.32;
    this.scene.add(this.grid);
    this.sign = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 1.1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
    this.sign.position.set(0, 4.3, -BASE_DIMS.roomD / 2 + 0.06);
    this.scene.add(this.sign);
    this.buildZone();
    this.scene.add(this.deptGroup, this.dockGroup, this.zoneGroup);

    this.bindInput();
    this.timers.push(setInterval(() => this.pump(), 600));
    // quem é chamado sai da recarga; quem fica sem nada para fazer volta para ela
    this.timers.push(setInterval(() => {
      if ([...this.bots.values()].some((b) => this.dockable(b) !== b.wantDock)) {
        this.applyHomes();
        this.walkHomeAll();
      }
    }, 400));
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(app);
    this.cleanups.push(() => ro.disconnect());
    this.applyPrefs();
    this.watchPauses();
    this.animate();
  }

  // ---------- cena fixa ----------
  private aniso() {
    return this.renderer.capabilities.getMaxAnisotropy();
  }

  private buildZone() {
    const amber = 0xf0a93b;
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(ZONE.w, ZONE.d), new THREE.MeshBasicMaterial({ color: amber, transparent: true, opacity: 0.055, depthWrite: false, toneMapped: false }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(ZONE.x, 0.009, ZONE.z);
    this.zoneGroup.add(pad);
    const edgeMat = new THREE.MeshBasicMaterial({ color: amber, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false });
    for (const [w, d, ox, oz] of [[ZONE.w, 0.03, 0, -ZONE.d / 2], [ZONE.w, 0.03, 0, ZONE.d / 2], [0.03, ZONE.d, -ZONE.w / 2, 0], [0.03, ZONE.d, ZONE.w / 2, 0]]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), edgeMat);
      e.position.set(ZONE.x + ox, 0.02, ZONE.z + oz);
      this.zoneGroup.add(e);
    }
    const label = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.3625), new THREE.MeshBasicMaterial({ map: crispText(tr('zone'), '#ffd27a', this.aniso()), transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }));
    label.rotation.x = -Math.PI / 2;
    label.position.set(ZONE.x, 0.012, ZONE.z + ZONE.d / 2 + 0.42);
    this.zoneGroup.add(label);
  }

  private clearGroup(g: THREE.Group) {
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((x) => { (x as THREE.MeshBasicMaterial).map?.dispose(); x.dispose(); });
      }
    });
    g.clear();
  }

  private buildDepts() {
    this.clearGroup(this.deptGroup);
    this.tables = [];
    for (const D of this.layout.depts) {
      const z0 = this.layout.dims.z0;
      const w = D.x1 - D.x0, d = DEPT_Z1 - z0, cx = D.tx, cz = (z0 + DEPT_Z1) / 2;
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: D.color, transparent: true, opacity: 0.07, depthWrite: false, toneMapped: false }));
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(cx, 0.008, cz);
      this.deptGroup.add(pad);
      const em = new THREE.MeshBasicMaterial({ color: D.color, toneMapped: false });
      for (const [bw, bd, ox, oz] of [[w, 0.045, 0, -d / 2], [w, 0.045, 0, d / 2], [0.045, d, -w / 2, 0], [0.045, d, w / 2, 0]]) {
        const e = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.025, bd), em);
        e.position.set(cx + ox, 0.018, cz + oz);
        this.deptGroup.add(e);
      }
      const lw = Math.min(2.6, w - 0.4);
      const lb = new THREE.Mesh(new THREE.PlaneGeometry(lw, lw / 8), new THREE.MeshBasicMaterial({ map: crispText(D.name.toUpperCase() + ' · ' + D.members.length, css(D.color), this.aniso()), transparent: true, depthWrite: false, toneMapped: false }));
      lb.rotation.x = -Math.PI / 2;
      lb.position.set(cx, 0.012, DEPT_Z1 - 0.35);
      this.deptGroup.add(lb);
      // mesa de reunião (clicar nela fala com o grupo)
      const topMat = new THREE.MeshStandardMaterial({ color: 0x161c2b, roughness: 0.25, metalness: 0.7, envMapIntensity: 0.6 });
      const top = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_R, TABLE_R, 0.05, 40), topMat);
      top.position.set(cx, 0.44, D.tz);
      top.castShadow = true;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.16, 0.42, 16), topMat);
      leg.position.set(cx, 0.21, D.tz);
      const glow = new THREE.Mesh(new THREE.TorusGeometry(TABLE_R, 0.014, 8, 48), em);
      glow.rotation.x = Math.PI / 2;
      glow.position.set(cx, 0.47, D.tz);
      top.userData.dept = D.key;
      leg.userData.dept = D.key;
      this.deptGroup.add(top, leg, glow);
      this.tables.push(top, leg);
    }
  }

  /** Ajusta piso, grade, letreiro, sombra, neblina e vista inicial ao tamanho da arena. Devolve true se mudou. */
  private applyDims(d: RoomDims): boolean {
    const key = [d.roomW, d.roomD, d.cz, d.dockPerRow, d.dockZ].map((v) => v.toFixed(2)).join('|');
    if (key === this.dimsKey) return false;
    const firstDims = !this.dimsKey;
    this.dimsKey = key;
    this.floor.geometry.dispose();
    this.floor.geometry = new THREE.PlaneGeometry(d.roomW, d.roomD);
    this.floor.position.z = d.cz;
    const gsize = Math.ceil(Math.max(d.roomW, d.roomD) + 2);
    const gm = this.grid.material as THREE.Material;
    const opacity = gm.opacity;
    this.scene.remove(this.grid);
    this.grid.geometry.dispose();
    gm.dispose();
    this.grid = new THREE.GridHelper(gsize, gsize, 0x2f7cff, 0x1b3a6e);
    this.grid.position.set(0, 0.006, d.cz);
    const ng = this.grid.material as THREE.Material;
    ng.transparent = true;
    ng.opacity = opacity;
    this.scene.add(this.grid);
    this.sign.position.set(0, 4.3 * Math.min(d.scale, 1.6), d.cz - d.roomD / 2 + 0.06);
    this.sign.scale.setScalar(Math.min(d.scale, 1.6));
    const sc = this.sun.shadow.camera;
    const half = Math.max(d.roomW, d.roomD) / 2 + 3;
    Object.assign(sc, { left: -half, right: half, top: half, bottom: -half });
    sc.updateProjectionMatrix();
    this.sun.position.set(8 * d.scale, 16 * d.scale, 9 * d.scale + d.cz);
    this.sun.target.position.set(0, 0, d.cz);
    this.sun.target.updateMatrixWorld();
    const fog = this.scene.fog as THREE.Fog;
    fog.near = 22 * d.scale;
    fog.far = 44 * d.scale;
    this.camera.far = Math.max(120, 120 * d.scale);
    this.camera.updateProjectionMatrix();
    this.controls.maxDistance = 60 * Math.max(1, d.scale);
    const prevCam = this.homeCam.clone(), prevTgt = this.homeTgt.clone();
    this.homeTgt.set(0, 0.6, d.cz * 0.5);
    this.homeCam.set(10, 8, 15).multiplyScalar(d.scale).add(new THREE.Vector3(0, 0, d.cz * 0.5));
    // a câmera ainda na vista inicial (ou girando sozinha) acompanha a arena; uma vista escolhida pelo dono fica
    const atHome = this.camera.position.distanceTo(prevCam) < 0.5 && this.controls.target.distanceTo(prevTgt) < 0.5;
    if ((firstDims && !this.prefs.cam) || this.prefs.rotate || atHome) {
      const off = this.camera.position.clone().sub(this.controls.target);
      const want = this.homeCam.distanceTo(this.homeTgt);
      this.controls.target.copy(this.homeTgt);
      if (this.prefs.rotate) off.setLength(want);
      else off.copy(this.homeCam).sub(this.homeTgt);
      this.camera.position.copy(this.homeTgt).add(off);
    }
    return true;
  }

  private buildDock(n: number, force = false) {
    if (this.dockSlots.length === n && !force) return;
    const d = this.layout.dims;
    this.clearGroup(this.dockGroup);
    const old = this.dockSlots;
    this.dockSlots = [];
    if (!n) return;
    // uma placa por fileira; a da frente leva a borda verde
    for (let row = 0; row * d.dockPerRow < n; row++) {
      const cnt = Math.min(d.dockPerRow, n - row * d.dockPerRow);
      const w = cnt * DOCK.step + 0.3, cx = d.dockX0 + ((cnt - 1) * DOCK.step) / 2, z = dockSlot(row * d.dockPerRow, d).z;
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, 1.0), new THREE.MeshStandardMaterial({ color: 0x141a28, roughness: 0.35, metalness: 0.7 }));
      base.position.set(cx, 0.015, z);
      base.receiveShadow = true;
      this.dockGroup.add(base);
      if (row === 0) {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, 0.03), new THREE.MeshBasicMaterial({ color: 0x49d17a, toneMapped: false }));
        edge.position.set(cx, 0.034, z + 0.5);
        this.dockGroup.add(edge);
      }
    }
    for (let k = 0; k < n; k++) {
      const m = new THREE.MeshBasicMaterial({ color: 0x49d17a, transparent: true, opacity: 0.12, toneMapped: false, side: THREE.DoubleSide, depthWrite: false });
      const r = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.36, 40), m);
      r.rotation.x = -Math.PI / 2;
      const p = dockSlot(k, d);
      r.position.set(p.x, 0.034, p.z);
      this.dockGroup.add(r);
      const keep = old[k]?.bot && this.bots.has(old[k].bot!.d.id) ? old[k].bot : null;
      this.dockSlots.push({ mat: m, bot: keep });
    }
    for (const b of this.bots.values()) if (b.dockSlot >= n || (b.dockSlot >= 0 && this.dockSlots[b.dockSlot]?.bot !== b)) b.dockSlot = -1;
    const lb = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.25), new THREE.MeshBasicMaterial({ map: crispText(tr('dock'), '#8ff0b4', this.aniso()), transparent: true, depthWrite: false, toneMapped: false }));
    lb.rotation.x = -Math.PI / 2;
    lb.position.set(d.dockX0 + 0.75, 0.012, d.dockZ + 0.78);
    this.dockGroup.add(lb);
  }

  // ---------- dados ----------
  private connectorLabel = (id: string) => this.room.connectors.find((c) => c.id === id)?.label || id;

  setRoom(room: RoomState) {
    this.room = room;
    const shape = JSON.stringify([
      room.agents.map((a) => [a.id, a.department, a.chief, a.slot]),
      room.groups.map((g) => [g.id, g.members]),
      room.connectors.map((c) => [c.id, c.label, c.departments]),
      this.prefs.deptMode,
    ]);
    if (shape !== this.shapeKey) {
      this.shapeKey = shape;
      this.relayout();
    }
    const multi = room.connectors.length > 1;
    const errored = new Set(room.connectors.filter((c) => c.state === 'error').map((c) => c.id));
    for (const a of room.agents) {
      const b = this.bots.get(a.id);
      if (!b) continue;
      b.d = a;
      b.setChief(a.chief);
      b.setSlot(a.slot);
      b.setDim(errored.has(a.connectorId));
      b.lBadge.textContent = multi ? this.connectorLabel(a.connectorId) : '';
      b.lBadge.style.display = multi ? '' : 'none';
      this.refreshStatus(b);
    }
    this.applySkins();
    this.meetings = computeMeetings(room.groups, this.layout, room.agents);
    if (this.first) {
      this.first = false;
      this.initialPlacement();
      room.events.forEach((e) => this.seenEv.add(e.id));
      // só as falas que acabaram de chegar viram balões
      setTimeout(() => this.queue.push(...this.stepsOf(this.room.events.filter((e) => e.at > Date.now() - 120_000))), 1700);
      return;
    }
    this.applyHomes();
    for (const b of this.bots.values()) {
      if (b.say && b.say.pending && b.d.status !== 'working') b.say = null;
    }
    this.walkHomeAll();
    const nw = room.events.filter((e) => !this.seenEv.has(e.id));
    nw.forEach((e) => this.seenEv.add(e.id));
    this.queue.push(...this.stepsOf(nw.filter((e) => e.at > Date.now() - 120_000)));
  }

  private relayout() {
    this.lastAction = 'layout refeito';
    const order: string[] = [];
    for (const c of this.room.connectors) for (const d of c.departments ?? []) if (!order.includes(d)) order.push(d);
    this.layout = computeLayout(this.room.agents, {
      mode: this.prefs.deptMode,
      order,
      connectorOrder: this.room.connectors.map((c) => c.id),
      connectorLabel: this.connectorLabel,
      groups: this.room.groups,
    });
    const ids = new Set(this.room.agents.map((a) => a.id));
    for (const [id, b] of this.bots) {
      if (ids.has(id)) continue;
      if (b.dockSlot >= 0 && this.dockSlots[b.dockSlot]) this.dockSlots[b.dockSlot].bot = null;
      for (const o of this.bots.values()) if (o.partner === b) o.partner = null;
      b.dispose();
      this.bots.delete(id);
    }
    for (const a of this.room.agents) {
      let b = this.bots.get(a.id);
      const p = this.layout.spots.get(a.id)!;
      if (!b) {
        b = new BotView(a, this.holo.tex, this.scene);
        this.makeOverlay(b);
        b.group.position.set(p.x, 0, p.z);
        b.userYaw = (Math.random() - 0.5) * 1.6;
        this.bots.set(a.id, b);
        if (!this.first) b.newcomer = true;
      }
      b.spot.set(p.x, 0, p.z);
      b.spotYaw = Math.atan2(this.homeCam.x - p.x, this.homeCam.z - p.z) + b.userYaw;
    }
    const grew = this.applyDims(this.layout.dims);
    this.buildDepts();
    this.buildDock(this.room.agents.length, grew);
    this.deptGroup.visible = this.prefs.depts;
    this.cb.layoutChanged(this.layout.depts);
  }

  private initialPlacement() {
    // quem acabou de mudar de situação começa onde estava e anda até o novo lugar
    const real = new Map<BotView, Status>();
    for (const b of this.bots.values()) {
      if (b.d.previousStatus && b.d.previousStatus !== b.d.status && Date.now() - b.d.statusSince < 25_000) {
        real.set(b, b.d.status);
        b.d = { ...b.d, status: b.d.previousStatus };
      }
    }
    this.applyHomes();
    for (const b of this.bots.values()) {
      b.group.position.copy(b.home);
      b.group.rotation.y = b.targetYaw = b.homeYaw;
      b.dock = b.wantDock ? 1 : 0;
    }
    setTimeout(() => {
      for (const [b, s] of real) b.d = { ...b.d, status: s };
      this.applyHomes();
      for (const b of this.bots.values()) this.refreshStatus(b);
      this.walkHomeAll();
    }, 1000);
  }

  setPrefs(p: Prefs) {
    const prev = this.prefs;
    this.prefs = p;
    if (p.rotate && !prev.rotate) this.rotMs = nowMs();
    if (p.deptMode !== prev.deptMode && this.room.agents.length) this.setRoom(this.room);
    this.applyPrefs();
  }

  private applyPrefs() {
    const p = this.prefs;
    this.deptGroup.visible = p.depts;
    this.zoneGroup.visible = p.zone;
    this.labelsEl.classList.toggle('off', !p.names);
    this.labelsEl.style.setProperty('--ls', String([0.85, 1, 1.25][p.size] ?? 1));
    const light = p.theme === 1;
    (this.scene.background as THREE.Color).setHex(light ? 0xdde5f0 : 0x070a12);
    (this.scene.fog as THREE.Fog).color.setHex(light ? 0xdde5f0 : 0x070a12);
    this.floor.material.color.setHex(light ? 0xc3cede : 0x0d1220);
    (this.grid.material as THREE.Material).opacity = light ? 0.5 : 0.32;
    const sk = (p.sign || '').trim() + '|' + (light ? 1 : 0);
    if (sk !== this.signKey) {
      this.signKey = sk;
      this.sign.material.map?.dispose();
      this.sign.material.map = (p.sign || '').trim() ? crispText(p.sign.trim().toUpperCase(), light ? '#1f5fae' : '#9fe6ff', this.aniso()) : null;
      this.sign.visible = !!(p.sign || '').trim();
      this.sign.material.needsUpdate = true;
    }
    this.applySkins();
  }

  private texFor = (s: Skin) => {
    let t = this.skinTex.get(s.name);
    if (!t) {
      t = new THREE.CanvasTexture(skinCanvas(s));
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      // 0,5 = rosto da skin na frente do bot (como na referência, three r160) + correção da versão do three
      t.offset.x = 0.5 + bodyUShift(GEO.body);
      t.anisotropy = 8;
      this.skinTex.set(s.name, t);
    }
    return t;
  };

  applySkins() {
    if (this.prefs.skins) this.lastAction = 'skins aplicadas';
    for (const b of this.bots.values()) b.setSkin(resolveSkin(b.d.slot, this.prefs.skinOf[b.d.id], this.prefs.skins), this.texFor);
  }

  // ---------- rótulos e balões ----------
  private makeOverlay(b: BotView) {
    const el = document.createElement('div');
    el.className = 'bot-label';
    const dot = document.createElement('span');
    dot.className = 'dot';
    const name = document.createElement('span');
    name.className = 'name';
    const badge = document.createElement('span');
    badge.className = 'badge';
    const role = document.createElement('div');
    role.className = 'role';
    el.append(dot, name, badge, role);
    el.addEventListener('click', () => this.cb.openAgent(b.d.id));
    this.labelsEl.appendChild(el);
    b.label = el;
    b.lDot = dot;
    b.lName = name;
    b.lBadge = badge;
    b.lRole = role;
    const bub = document.createElement('div');
    bub.className = 'speech-bubble';
    this.app.appendChild(bub);
    b.bubble = bub;
  }

  private refreshStatus(b: BotView) {
    const st = b.d.status;
    b.baseExpr = restExpr(st);
    const dg = splitDoing(b.d.doing);
    const sub = st === 'working' ? dg.label || statusText('working') : st === 'available' ? b.d.role || b.d.department : statusText(st);
    const nx = b.d.next ? ' · ⏰ ' + hm(b.d.next.at) : '';
    b.lName.textContent = b.d.name;
    b.lDot.style.background = css(STATUS_COLOR[st]);
    b.lRole.textContent = sub + nx;
    // frase de conversa: aparece uma vez como balão em cima do bot (se não veio já como fala)
    const said = this.lastDoing.get(b.d.id);
    if (st === 'working' && dg.speech && dg.speech !== said) {
      this.lastDoing.set(b.d.id, dg.speech);
      const dup = this.room.events.some((e) => e.from === b.d.id && e.at > Date.now() - 120_000 && e.text.trim() === dg.speech);
      if (!dup) this.queue.push({ bot: b.d.id, text: dg.speech });
    } else if (!dg.speech) this.lastDoing.delete(b.d.id);
  }

  private updateOverlays() {
    const w = this.app.clientWidth, h = this.app.clientHeight;
    for (const b of this.bots.values()) {
      this.proj.set(b.group.position.x, 1.06, b.group.position.z).project(this.camera);
      const x = (this.proj.x * 0.5 + 0.5) * w, y = (-this.proj.y * 0.5 + 0.5) * h;
      if (this.proj.z > 1) { b.label.style.display = 'none'; b.bubble.style.display = 'none'; continue; }
      b.label.style.display = 'block';
      b.label.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) translate(-50%,-100%)`;
      const s = this.prefs.bubbles && b.say && !b.move ? b.say : null;
      if (!s) { b.bubble.style.display = 'none'; b.bubbleKey = null; continue; }
      const key = s.pending ? '\u0000dots' : s.text;
      if (key !== b.bubbleKey) {
        b.bubbleKey = key;
        b.bubble.textContent = '';
        if (s.pending) {
          const d = document.createElement('span');
          d.className = 'dots';
          d.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
          b.bubble.append(d);
        } else {
          const who = document.createElement('div');
          who.className = 'who';
          who.textContent = b.d.name;
          const tx = document.createElement('div');
          tx.textContent = s.text.length > 260 ? s.text.slice(0, 257) + '…' : s.text; // sempre texto, nunca HTML
          b.bubble.append(who, tx);
        }
      }
      b.bubble.style.display = 'block';
      b.bubble.style.zIndex = s.pending ? '8' : '9';
      b.bubble.style.transform = `translate3d(${Math.min(w - 130, Math.max(130, x)).toFixed(2)}px,${(y - 40).toFixed(2)}px,0) translate(-50%,-100%)`;
    }
  }

  // ---------- onde cada bot fica ----------
  private inMeeting(b: BotView) {
    return this.meetings.some((M) => M.members.includes(b.d.id));
  }
  private dockable(b: BotView) {
    return b.d.status === 'available' && !this.inMeeting(b) && !b.say && !b.away && !b.partner && !(b.calledUntil > Date.now());
  }

  private applyHomes() {
    const bots = [...this.bots.values()];
    const order = this.layout.order;
    const ws = bots.filter((b) => b.d.status === 'waiting').sort((a, b) => order.indexOf(a.d.id) - order.indexOf(b.d.id));
    const seat = new Map<BotView, { M: Meeting; k: number }>();
    for (const M of this.meetings) M.members.forEach((id, k) => { const b = this.bots.get(id); if (b && b.d.status !== 'waiting') seat.set(b, { M, k }); });
    for (const b of bots) {
      b.wantDock = this.dockable(b);
      if (!b.wantDock && b.dockSlot >= 0) { if (this.dockSlots[b.dockSlot]) this.dockSlots[b.dockSlot].bot = null; b.dockSlot = -1; }
    }
    for (const b of bots) {
      if (b.wantDock && b.dockSlot < 0) {
        b.dockSlot = this.dockSlots.findIndex((x) => !x.bot);
        if (b.dockSlot >= 0) this.dockSlots[b.dockSlot].bot = b;
        else b.wantDock = false;
      }
    }
    for (const b of bots) {
      const k = ws.indexOf(b);
      if (b.wantDock) { const p = dockSlot(b.dockSlot, this.layout.dims); b.home.set(p.x, 0, p.z); b.homeYaw = 0; }
      else if (k >= 0) { const sl = zoneSlot(k, ws.length); b.home.set(sl.x, 0, sl.z); b.homeYaw = 0; }
      else if (seat.has(b)) { const { M, k: i } = seat.get(b)!; const s = seatAt(M, i, M.members.length); b.home.set(s.x, 0, s.z); b.homeYaw = s.yaw; }
      else { b.home.copy(b.spot); b.homeYaw = b.spotYaw; }
    }
  }

  private walkHomeAll() {
    for (const b of this.bots.values()) {
      if (b.newcomer) {
        // recém-chegado: aparece no próprio lugar e só então segue o status
        b.newcomer = false;
        b.group.position.copy(b.home);
        b.group.rotation.y = b.targetYaw = b.homeYaw;
        b.dock = b.wantDock ? 1 : 0;
        continue;
      }
      if (!b.move && !b.away && b.group.position.distanceTo(b.home) > 0.05) this.walkTo(b, null, null);
    }
  }

  // ---------- caminhada, fala, roteiro ----------
  /** Mesas de reunião como obstáculos fixos: raio da mesa + corpo do bot (0,3) + folga. As cadeiras ficam a 1,15. */
  private static readonly TABLE_CLEAR = TABLE_R + 0.34;
  private nearTable(x: number, z: number, r = RoomEngine.TABLE_CLEAR): boolean {
    return this.layout.depts.some((D) => Math.hypot(x - D.tx, z - D.tz) < r);
  }

  private walkTo(b: BotView, target: BotView | null, done: (() => void) | null) {
    const a = b.group.position.clone();
    let dest = b.home.clone();
    if (target) {
      const dir = a.clone().sub(target.group.position).setY(0);
      if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
      dir.normalize();
      const tp = target.group.position, a0 = Math.atan2(dir.x, dir.z);
      // ponto livre em volta do outro bot (ninguém parado nem a caminho dali)
      for (const da of [0, 0.75, -0.75, 1.5, -1.5, 2.25, -2.25, Math.PI]) {
        dest = new THREE.Vector3(tp.x + Math.sin(a0 + da) * 1.05, 0, tp.z + Math.cos(a0 + da) * 1.05);
        const busy = this.nearTable(dest.x, dest.z, RoomEngine.TABLE_CLEAR + 0.05) || [...this.bots.values()].some((o) => o !== b && o !== target && Math.hypot((o.move ? o.move.c.x : o.group.position.x) - dest.x, (o.move ? o.move.c.z : o.group.position.z) - dest.z) < 0.8);
        if (!busy) break;
      }
      b.partner = target;
      b.away = true;
    }
    b.move = { a, c: dest, t: 0, dur: Math.max(0.9, a.distanceTo(dest) / 3.0), target, done };
  }

  private goHome(b: BotView) {
    const p = b.partner;
    if (p) {
      if (p.partner === b) p.partner = null;
      if (!p.away && !p.move) p.targetYaw = p.homeYaw;
    }
    b.partner = null;
    b.say = null;
    this.walkTo(b, null, null);
  }

  private blip() {
    if (this.prefs.sound) playBlip();
  }

  private sayTo(b: BotView, text: string, opts: { pending?: boolean; done?: () => void } = {}) {
    if (!opts.pending) this.blip();
    const dur = opts.pending ? 150 : Math.min(16, Math.max(3.5, 2.5 + text.length * 0.07));
    b.say = { text, t: 0, dur, pending: !!opts.pending, done: opts.done || null };
  }

  private updateMove(b: BotView, dt: number) {
    const v = b.move;
    if (!v) return;
    v.t += dt;
    const a = v.a, c = v.c;
    const k = Math.min(1, v.t / v.dur), e = k * k * (3 - 2 * k);
    const tmp = this.tmp.lerpVectors(a, c, e);
    // desvio: contorna em arco quem estiver no caminho (para o lado em que o outro não está)
    const w = Math.min(1, Math.sin(Math.PI * k) * 6), L = Math.hypot(c.x - a.x, c.z - a.z) || 1, ux = (c.x - a.x) / L, uz = (c.z - a.z) / L, RR = 1.0;
    let sh = 0;
    for (const o of this.bots.values()) {
      if (o === b) continue;
      const ox = o.group.position.x - tmp.x, oz = o.group.position.z - tmp.z;
      const al = ox * ux + oz * uz, la = ox * -uz + oz * ux;
      if (Math.abs(al) >= RR || Math.abs(la) >= RR) continue;
      const need = Math.sqrt(RR * RR - al * al) - Math.abs(la);
      if (need <= 0) continue;
      const side = Math.abs(la) > 0.02 ? -Math.sign(la) : v.side || (v.side = Math.sin(b.phase * 7) > 0 ? 1 : -1);
      sh += side * need;
    }
    // mesas no caminho: contorna do mesmo jeito, com raio maior
    const RT = TABLE_R + 0.45;
    for (const D of this.layout.depts) {
      const ox = D.tx - tmp.x, oz = D.tz - tmp.z;
      const al = ox * ux + oz * uz, la = ox * -uz + oz * ux;
      if (Math.abs(al) >= RT || Math.abs(la) >= RT) continue;
      const need = Math.sqrt(RT * RT - al * al) - Math.abs(la);
      if (need <= 0) continue;
      const side = Math.abs(la) > 0.02 ? -Math.sign(la) : v.side || (v.side = Math.sin(b.phase * 7) > 0 ? 1 : -1);
      sh += side * need;
    }
    sh = Math.max(-1.6, Math.min(1.6, sh)) * w;
    v.sh = v.sh === undefined ? sh : v.sh + (sh - v.sh) * Math.min(1, dt * 9);
    b.group.position.x = tmp.x - uz * v.sh;
    b.group.position.z = tmp.z + ux * v.sh;
    if (a.distanceTo(c) > 0.05) b.targetYaw = Math.atan2(c.x - a.x, c.z - a.z);
    if (k >= 1) {
      b.move = null;
      b.arrT = performance.now();
      const tg = v.target;
      if (tg) {
        const tp = tg.group.position, bp = b.group.position;
        b.targetYaw = Math.atan2(tp.x - bp.x, tp.z - bp.z);
        if (!tg.away && !tg.move) {
          tg.partner = b;
          tg.targetYaw = Math.atan2(bp.x - tp.x, bp.z - tp.z);
          tg.forcedExpr = 'surprised';
          setTimeout(() => { tg.forcedExpr = 'happy'; }, 500);
          setTimeout(() => { tg.forcedExpr = null; }, 1900);
        }
      } else {
        b.away = false;
        b.targetYaw = b.homeYaw;
      }
      v.done?.();
    }
  }

  /** Ninguém ocupa o mesmo lugar: quem anda desvia de quem está parado; entre dois parados, cede quem chegou por último. */
  private separate(dt: number) {
    const R = 0.8;
    const bots = [...this.bots.values()];
    for (let i = 0; i < bots.length; i++) for (let j = i + 1; j < bots.length; j++) {
      const p = bots[i], q = bots[j], pp = p.group.position, qp = q.group.position;
      let dx = pp.x - qp.x, dz = pp.z - qp.z, d = Math.hypot(dx, dz);
      if (d >= R) continue;
      let ov: number;
      if (d < 1e-3) { const an = (i * 2.4 + j) % 6.283; dx = Math.sin(an); dz = Math.cos(an); d = 1; ov = R; }
      else ov = R - d;
      const nx = dx / d, nz = dz / d;
      let wp: number, wq: number;
      if (!!p.move !== !!q.move) { wp = p.move ? 1 : 0; wq = 1 - wp; }
      else if (p.move) { wp = wq = 0.5; }
      else { wp = p.arrT >= q.arrT ? 1 : 0; wq = 1 - wp; }
      const f = p.move || q.move ? 1 : Math.min(1, dt * 8);
      pp.x += nx * ov * wp * f; pp.z += nz * ov * wp * f;
      qp.x -= nx * ov * wq * f; qp.z -= nz * ov * wq * f;
    }
    // ninguém atravessa uma mesa: quem encostar é empurrado para a borda (a mesa não se mexe)
    const RC = RoomEngine.TABLE_CLEAR;
    for (const b of bots) {
      const p = b.group.position;
      for (const D of this.layout.depts) {
        let dx = p.x - D.tx, dz = p.z - D.tz;
        const d = Math.hypot(dx, dz);
        if (d >= RC) continue;
        if (d < 1e-3) { dx = 0; dz = 1; } else { dx /= d; dz /= d; }
        p.x = D.tx + dx * RC;
        p.z = D.tz + dz * RC;
      }
    }
  }

  private updateSay(b: BotView, dt: number) {
    const s = b.say;
    if (!s || b.move) return;
    s.t += dt;
    const p = b.partner, bp = b.group.position;
    if (p) b.targetYaw = Math.atan2(p.group.position.x - bp.x, p.group.position.z - bp.z);
    else b.targetYaw = Math.atan2(this.camera.position.x - bp.x, this.camera.position.z - bp.z);
    if (s.t >= s.dur) {
      b.say = null;
      if (!p && !b.away) b.targetYaw = b.homeYaw;
      s.done?.();
    }
  }

  private stepsOf(evs: RoomEvent[]): Step[] {
    return evs.map((e) => (e.to ? { bot: e.from, walkTo: e.to, text: e.text } : { bot: e.from, text: e.text }));
  }

  private pump() {
    if (this.scriptRunning || !this.queue.length) return;
    const q = this.queue;
    this.queue = [];
    this.runScript(q);
  }

  /** Passos { bot, text, walkTo? }: anda (se pedido) até o outro bot e fala. Um por vez. */
  private runScript(steps: Step[]) {
    if (this.scriptRunning || !steps.length) return;
    this.scriptRunning = true;
    let i = 0;
    const moved = new Set<BotView>();
    const next = () => {
      if (i >= steps.length) { moved.forEach((b) => this.goHome(b)); this.scriptRunning = false; return; }
      const s = steps[i++];
      const b = this.bots.get(s.bot);
      if (!b) { next(); return; }
      const to = s.walkTo ? this.bots.get(s.walkTo) : undefined;
      const speak = () => { if (s.text) this.sayTo(b, s.text, { done: next }); else next(); };
      if (to && to !== b) {
        if (b.away && b.partner === to && !b.move) speak();
        else { moved.add(b); b.say = null; this.walkTo(b, to, speak); }
      } else speak();
    };
    next();
  }

  replay() {
    this.queue.push(...this.stepsOf(this.room.events.slice(-5)));
    this.pump();
  }

  /** Quem a mensagem cita: nome completo, ou uma palavra do nome com 5+ letras, sem acentos. */
  mentioned(text: string, fromId: AgentId): AgentId | null {
    const from = this.bots.get(fromId);
    if (!from) return null;
    const tx = ' ' + norm(text).replace(/[^a-z0-9]+/g, ' ') + ' ';
    const own = norm(from.d.name).split(/\s+/);
    let best: BotView | null = null, bestLen = 0;
    for (const o of this.bots.values()) {
      if (o === from) continue;
      const full = norm(o.d.name);
      if (tx.includes(' ' + full + ' ') && full.length + 100 > bestLen) { best = o; bestLen = full.length + 100; }
      for (const w of full.split(/\s+/)) {
        if (w.length < 5 || own.includes(w)) continue;
        if (tx.includes(' ' + w + ' ') && w.length > bestLen) { best = o; bestLen = w.length; }
      }
    }
    return best ? best.d.id : null;
  }

  /** O dono falou com um bot: ele "pensa" e, se citou outro bot, anda até ele antes. */
  messageSent(id: AgentId, text: string) {
    const b = this.bots.get(id);
    if (!b) return;
    b.calledUntil = Date.now() + 20_000;
    if (b.move || this.scriptRunning) return;
    const otherId = this.mentioned(text, id);
    const other = otherId ? this.bots.get(otherId) : undefined;
    const think = () => this.sayTo(b, '', { pending: true, done: () => { if (b.away) this.goHome(b); } });
    if (other && !(b.away && b.partner === other)) this.walkTo(b, other, think);
    else think();
  }

  /** Mensagem no grupo: os membros andam até a mesa e ficam pensando. */
  groupMessageSent(groupId: string) {
    const g = this.room.groups.find((x) => x.id === groupId);
    if (!g) return;
    const D = this.layout.depts.find((d) => d.groups.includes(groupId));
    if (!D) return;
    const ms = g.members.map((m) => this.bots.get(m)).filter((x): x is BotView => !!x && x.d.status !== 'waiting');
    ms.forEach((x, k) => {
      const s = seatAt({ x: D.tx, z: D.tz }, k, ms.length);
      x.calledUntil = Date.now() + 20_000;
      if (x.dockSlot >= 0) { this.dockSlots[x.dockSlot].bot = null; x.dockSlot = -1; }
      x.wantDock = false;
      x.home.set(s.x, 0, s.z);
      x.homeYaw = s.yaw;
      if (!x.move && !this.scriptRunning) this.walkTo(x, null, () => this.sayTo(x, '', { pending: true }));
    });
  }

  thinkMany(ids: AgentId[]) {
    for (const id of ids) {
      const x = this.bots.get(id);
      if (x && !x.move && !x.say) this.sayTo(x, '', { pending: true });
    }
  }

  retrySent(id: AgentId) {
    const b = this.bots.get(id);
    if (b) this.sayTo(b, '', { pending: true });
  }

  // ---------- câmera ----------
  focusAgent(id: AgentId | null) {
    if (this.prefs.rotate) this.cb.rotateStopped();
    const b = id ? this.bots.get(id) ?? null : null;
    this.focus = { bot: b, t: 0 };
    this.cb.activeChanged(b ? b.d.id : null);
  }

  viewAll() {
    this.focus = { bot: null, t: 0 };
    this.cb.activeChanged(null);
  }

  private camState() {
    const r2 = (a: number[]) => a.map((v) => Math.round(v * 100) / 100);
    return { p: r2(this.camera.position.toArray()), t: r2(this.controls.target.toArray()) };
  }

  private updateFocus(dt: number) {
    const f = this.focus;
    if (!f) return;
    f.t += dt;
    const c = this.controls;
    if (f.bot) this.fTgt.set(f.bot.group.position.x, 0.5, f.bot.group.position.z);
    else this.fTgt.copy(this.homeTgt);
    const wantDist = f.bot ? 3.6 : this.homeCam.distanceTo(this.homeTgt);
    this.fOff.subVectors(this.camera.position, c.target);
    if (!f.bot) this.fOff.lerp(this.tmp.subVectors(this.homeCam, this.homeTgt), 1 - Math.exp(-4 * dt));
    else if (f.t < 1.6) {
      const d = damp(this.fOff.length(), wantDist, 4, dt);
      if (this.fOff.y / this.fOff.length() < 0.28) this.fOff.y = damp(this.fOff.y, this.fOff.length() * 0.32, 4, dt);
      this.fOff.setLength(d);
    }
    c.target.x = damp(c.target.x, this.fTgt.x, 6, dt);
    c.target.y = damp(c.target.y, this.fTgt.y, 6, dt);
    c.target.z = damp(c.target.z, this.fTgt.z, 6, dt);
    this.camera.position.copy(c.target).add(this.fOff);
    if (!f.bot && f.t > 2.2) { this.focus = null; this.cb.cameraChanged(this.camState()); }
  }

  // ---------- entrada ----------
  private pick(ev: { clientX: number; clientY: number }): BotView | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    this.pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([...this.bots.values()].map((b) => b.body), false);
    return hits.length ? (hits[0].object.userData.bot as BotView) : null;
  }

  private bindInput() {
    const el = this.renderer.domElement;
    const on = <K extends keyof HTMLElementEventMap>(t: EventTarget, type: K | string, fn: (e: never) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opts);
      this.cleanups.push(() => t.removeEventListener(type, fn as EventListener, opts));
    };
    // Espaço segurado: arrastar move a vista; sem espaço, arrastar gira
    const setPan = (v: boolean) => { this.controls.mouseButtons.LEFT = v ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE; document.body.classList.toggle('panning', v); };
    const typing = (e: KeyboardEvent) => { const t = e.target as HTMLElement | null; return !!t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable); };
    on(window, 'keydown', (e: KeyboardEvent) => { if (e.code === 'Space' && !typing(e)) { e.preventDefault(); if (!e.repeat) setPan(true); } });
    on(window, 'keyup', (e: KeyboardEvent) => { if (e.code === 'Space') setPan(false); });
    on(window, 'blur', () => setPan(false));
    on(el, 'pointerdown', (e: PointerEvent) => { this.downAt = [e.clientX, e.clientY]; });
    on(el, 'pointerup', (e: PointerEvent) => {
      if (!this.downAt) return;
      const moved = Math.hypot(e.clientX - this.downAt[0], e.clientY - this.downAt[1]);
      this.downAt = null;
      if (moved > 6) return;
      const b = this.pick(e);
      if (b) { this.cb.openAgent(b.d.id); return; }
      const T = this.raycaster.intersectObjects(this.tables, false)[0];
      if (T) this.cb.openTable(T.object.userData.dept as string);
    });
    on(el, 'pointermove', (e: PointerEvent) => {
      if (e.buttons) return;
      const h = this.pick(e);
      for (const b of this.bots.values()) b.hover = b === h;
      el.style.cursor = h || this.raycaster.intersectObjects(this.tables, false).length ? 'pointer' : 'grab';
    });
    on(el, 'dblclick', (e: MouseEvent) => { const b = this.pick(e); if (b) this.focusAgent(b.d.id); });
    on(el, 'pointercancel', () => { this.downAt = null; });
    this.controls.listenToKeyEvents(window);
  }

  private resize() {
    const w = this.app.clientWidth, h = this.app.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ---------- laço ----------
  private frameMs: number[] = [];
  private lastFrame = 0;
  private pixelRatio = 1;
  private qualityAt = 0;

  /** A cada 3 s: se a média passar de 24 ms por quadro (< ~42 fps), reduz a resolução em 0,25 (mínimo 1x). */
  private adaptQuality(now: number) {
    if (now - this.qualityAt < 3000 || this.frameMs.length < 90 || document.hidden) return;
    this.qualityAt = now;
    const recent = this.frameMs.slice(-90);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    if (avg > 24 && this.pixelRatio > 1) {
      this.pixelRatio = Math.max(1, this.pixelRatio - 0.25);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.resize();
      this.frameMs = [];
    }
  }

  /** Tempos de quadro dos últimos ~5 s (para diagnóstico). */
  frameStats() {
    const f = this.frameMs.slice(1);
    if (!f.length) return null;
    const sorted = f.slice().sort((a, b) => a - b);
    const avg = f.reduce((s, x) => s + x, 0) / f.length;
    return { frames: f.length, fps: Math.round(1000 / avg), p95: Math.round(sorted[Math.floor(f.length * 0.95)]), max: Math.round(sorted[f.length - 1]), over50: f.filter((x) => x > 50).length };
  }

  private animate = () => {
    this.raf = requestAnimationFrame(this.animate);
    const nowF = performance.now();
    if (this.lastFrame) { this.frameMs.push(nowF - this.lastFrame); if (this.frameMs.length > 300) this.frameMs.shift(); }
    this.lastFrame = nowF;
    this.adaptQuality(nowF);
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const t = this.timer.getElapsed();
    this.holoAcc += dt;
    if (this.holoAcc > 0.045) {
      this.holoAcc = 0;
      if (this.prefs.screens && [...this.bots.values()].some((b) => b.consoleMesh.visible || b.d.status === 'working')) this.holo.draw(t);
    }
    for (const b of this.bots.values()) {
      this.updateMove(b, dt);
      this.updateSay(b, dt);
      // na recarga só o bot em foco acompanha a câmera (inclusive no giro); os outros ficam parados na
      // direção da recarga, sem girar junto com a tela
      if (b.wantDock && !b.move && !b.say && b.group.position.distanceTo(b.home) < 0.3) {
        b.targetYaw = this.focus?.bot === b ? Math.atan2(this.camera.position.x - b.group.position.x, this.camera.position.z - b.group.position.z) : b.homeYaw;
      }
      // sentado numa reunião, a tela entraria no tampo da mesa: fica escondida
      b.updateBody(t, dt, this.prefs.screens && !this.inMeeting(b), b.dockSlot >= 0 ? this.dockSlots[b.dockSlot]?.mat : undefined);
    }
    this.separate(dt);
    this.separate(dt);
    this.separate(dt);
    this.updateFocus(dt);
    const ms = nowMs();
    if (this.prefs.rotate && !this.focus && !this.downAt) {
      this.fOff.subVectors(this.camera.position, this.controls.target).applyAxisAngle(Y_AXIS, (ROT[this.prefs.speed] * (ms - this.rotMs)) / 1000);
      this.camera.position.copy(this.controls.target).add(this.fOff);
    }
    this.rotMs = ms;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.updateOverlays();
    if (!this.readyFired) { this.readyFired = true; requestAnimationFrame(() => this.cb.ready()); }
  };

  /** Pausas longas (> 400 ms) vão para o log do app com a última ação conhecida, para achar travamentos. */
  lastAction = 'início';
  private watchPauses() {
    try {
      const po = new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (e.duration > 400) console.warn(`[sala] pausa de ${Math.round(e.duration)} ms (última ação: ${this.lastAction}; ${this.bots.size} bots)`);
      });
      po.observe({ type: 'longtask', buffered: false });
      this.cleanups.push(() => po.disconnect());
    } catch { /* navegador sem longtask */ }
  }

  /** Para testes: menor distância entre dois bots agora. */
  minDistance(): number {
    const bs = [...this.bots.values()];
    let m = Infinity;
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) m = Math.min(m, bs[i].group.position.distanceTo(bs[j].group.position));
    return m;
  }

  /** Para o teste de fumaça: quantos bots parados na recarga estão de frente para a câmera e quantos estão em foco. */
  dockFacing(): { docked: number; facingCamera: number; focusedDocked: boolean } {
    let docked = 0, facing = 0, focusedDocked = false;
    for (const b of this.bots.values()) {
      if (!b.wantDock || b.move || b.say || b.group.position.distanceTo(b.home) >= 0.3) continue;
      docked++;
      const toCam = Math.atan2(this.camera.position.x - b.group.position.x, this.camera.position.z - b.group.position.z);
      const d = Math.abs(Math.atan2(Math.sin(toCam - b.group.rotation.y), Math.cos(toCam - b.group.rotation.y)));
      if (d < 0.15 && Math.abs(Math.atan2(Math.sin(toCam - b.homeYaw), Math.cos(toCam - b.homeYaw))) > 0.15) facing++;
      if (this.focus?.bot === b) focusedDocked = true;
    }
    return { docked, facingCamera: facing, focusedDocked };
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.timers.forEach(clearInterval);
    this.cleanups.forEach((f) => f());
    for (const b of this.bots.values()) b.dispose();
    this.bots.clear();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.skinTex.forEach((t) => t.dispose());
  }
}
