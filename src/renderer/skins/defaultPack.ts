// GERADO por scripts/extract-skins.mjs a partir de referencia/index.html (array SKINS). Não editar à mão.
// Skins marcadas pack:'terceiros' imitam personagens de terceiros: só para uso pessoal.
/* eslint-disable */
import { sk, FX, EY, SW, SH, type Skin } from './kit';
void EY;

const RAW: Skin[] = [
  { name:'Raio', eye:'#07080b', limb:'#1f9d4d', draw(g){
      sk.fill(g, '#3b2fd0'); sk.band(g, 470, 170, '#1f9d4d'); sk.band(g, 452, 30, '#c9a13a');
      for (let x = 20; x < SW; x += 64) sk.rr(g, x, 458, 30, 18, 4, '#8f6f1f');
      sk.ell(g, FX - 86, EY, 86, 66, '#22b455'); sk.ell(g, FX + 86, EY, 86, 66, '#22b455'); sk.lens(g);
      sk.poly(g, [[FX+10,40],[FX-45,110],[FX-8,110],[FX-30,160],[FX+45,85],[FX+6,85],[FX+34,40]], '#ffe21a');
      sk.poly(g, [[FX-70,320],[FX+70,320],[FX,430]], '#c9a13a'); sk.poly(g, [[FX-52,330],[FX+52,330],[FX,412]], '#ffd91a');
      sk.poly(g, [[FX+6,338],[FX-22,372],[FX-2,372],[FX-12,400],[FX+24,362],[FX+4,362],[FX+16,338]], '#3b2fd0');
      [-1, 1].forEach(s => { for (let k = 0; k < 3; k++) sk.rr(g, FX + s*230 - 60, 330 + k*34, 120, 20, 4, '#22b455'); }); } },
  { name:'Água-viva', eye:'#5ff3ff', glow:1, limb:'#3aa0ff', draw(g){
      sk.grad(g, 0, SH, [[0, '#d77bff'], [0.42, '#9a5cf0'], [0.5, '#1668d6'], [1, '#07225e']]);
      const r = sk.rnd(7);
      for (let x = 0; x < SW; x += 64) sk.ell(g, x + 32, 300, 34, 26, '#c56bff');
      g.lineCap = 'round';
      for (let k = 0; k < 16; k++){ const x0 = k*64 + 32; g.strokeStyle = ['#ff8fe0', '#6ff0ff', '#c78bff'][k % 3]; g.lineWidth = 7 + (k % 3)*3; g.beginPath(); g.moveTo(x0, 318);
        for (let y = 318; y < 620 - (k % 4)*40; y += 8) g.lineTo(x0 + Math.sin(y/26 + k)*20, y); g.stroke(); }
      for (let k = 0; k < 60; k++) sk.ell(g, r()*SW, 330 + r()*300, 3 + r()*5, 3 + r()*5, 'rgba(140,240,255,0.8)');
      for (let k = 0; k < 14; k++){ g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(k*76 + 20, 20); g.lineTo(k*76 + 30, 270); g.stroke(); } } },
  { name:'Mago', eye:'#07080b', mouth:false, limb:'#5b2a8c', draw(g){
      sk.fill(g, '#5b2a8c'); const r = sk.rnd(3);
      for (let k = 0; k < 26; k++){ const x = r()*SW, y = 30 + r()*560; if (Math.abs(x - FX) < 230) continue; sk.star(g, x, y, 10 + r()*14, '#e3c15a'); }
      sk.ell(g, 170, 150, 46, 46, '#e3c15a'); sk.ell(g, 190, 140, 40, 40, '#5b2a8c');
      sk.poly(g, [[FX,60],[FX+215,330],[FX-215,330]], '#d6b04a'); sk.poly(g, [[FX,96],[FX+180,330],[FX-180,330]], '#2a1245');
      sk.ell(g, FX, EY + 26, 128, 84, '#f0bfa2');
      const bd = [[FX-170,236]]; for (let k = 0; k <= 10; k++) bd.push([FX - 170 + k*34, k % 2 ? 380 + (5 - Math.abs(5 - k))*26 : 330 + (5 - Math.abs(5 - k))*26]); bd.push([FX+170,236], [FX+70,262], [FX,250], [FX-70,262]);
      sk.poly(g, bd, '#f4f4f6'); sk.rr(g, FX - 16, 216, 32, 46, 8, '#e3a585');
      sk.band(g, 560, 80, '#3d1b62'); sk.band(g, 552, 12, '#d6b04a'); } },
  { name:'Olhudo', eye:'#07080b', limb:'#18a39a', draw(g){
      sk.fill(g, '#1cb0a5'); const r = sk.rnd(11);
      for (let k = 0; k < 160; k++) sk.ell(g, r()*SW, r()*SH, 4 + r()*7, 8 + r()*10, '#128d85', r()*3);
      sk.lens(g, '#f4eed6', 50, 48);
      const cols = ['#c8324a', '#7c4ad6', '#3a8f2c', '#e08a1a', '#1f6fd6'];
      for (let k = 0; k < 22; k++){ const x = r()*SW, y = 60 + r()*540, rad = 18 + r()*30; if (Math.abs(x - FX) < 170 && Math.abs(y - EY) < 110) continue;
        sk.ell(g, x, y + 5, rad, rad, '#0e7972'); sk.ell(g, x, y, rad, rad, '#f4eed6'); sk.ell(g, x, y, rad*0.55, rad*0.55, cols[k % 5]); sk.ell(g, x, y, rad*0.26, rad*0.26, '#111'); sk.ell(g, x - rad*0.3, y - rad*0.3, rad*0.14, rad*0.14, '#fff'); } } },
  { name:'Foguete', eye:'#07080b', limb:'#3aa59b', draw(g){
      sk.fill(g, '#e9efe4'); const r = sk.rnd(5);
      for (let x = 30; x < SW; x += 90) [60, 150, 330].forEach(y => sk.ell(g, x + (y % 40), y, 5, 5, '#b9c2b6'));
      sk.ell(g, FX, EY + 18, 176, 122, '#e8891a'); sk.ell(g, FX, EY + 18, 146, 96, '#8fe0d2');
      sk.band(g, 372, 10, '#e8891a'); sk.band(g, 388, 6, '#7f8fd0'); sk.band(g, 410, 44, '#f6f8f2');
      g.fillStyle = '#c5cdc2'; for (let x = 0; x < SW; x += 14) g.fillRect(x, 410, 3, 44);
      sk.grad(g, 454, SH, [[0, '#3aa59b'], [0.25, '#7fd6c8'], [0.45, '#ffd24a'], [0.75, '#e8791a'], [1, '#141414']]);
      g.fillStyle = 'rgba(10,30,30,0.45)'; for (let x = 0; x < SW; x += 128) g.fillRect(x, 454, 10, 186);
      g.fillStyle = '#d83a3a'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.fillText('M·SPACE', 200, 330); g.fillText('M·SPACE', SW - 200, 330); } },
  { name:'Viking', eye:'#07080b', mouth:false, limb:'#8d949c', draw(g){
      sk.fill(g, '#8d949c'); const r = sk.rnd(9);
      for (let k = 0; k < 500; k++) sk.ell(g, r()*SW, r()*300, 2 + r()*5, 2 + r()*3, 'rgba(60,66,74,0.18)');
      sk.band(g, 300, 340, '#4d535b'); g.strokeStyle = '#8b939c'; g.lineWidth = 3;
      for (let y = 312; y < SH; y += 16) for (let x = (y/16 % 2)*12; x < SW; x += 24){ g.beginPath(); g.arc(x, y, 10, 0, Math.PI); g.stroke(); }
      sk.band(g, 150, 22, '#6b727b'); for (let x = 16; x < SW; x += 64) sk.ell(g, x, 161, 8, 8, '#c9cfd6');
      sk.rr(g, FX - 196, 172, 392, 150, 40, '#f0b79c'); sk.rr(g, FX - 196, 190, 392, 22, 0, '#3f7fb0');
      sk.poly(g, [[FX-22,30],[FX+22,30],[FX+18,236],[FX,262],[FX-18,236]], '#6b727b');
      const bd = [[FX-196,232],[FX-60,250],[FX,268],[FX+60,250],[FX+196,232]]; for (let k = 10; k >= 0; k--) bd.push([FX - 190 + k*38, (k % 2 ? 400 : 356) + (5 - Math.abs(5 - k))*18]);
      sk.poly(g, bd, '#e4521b'); sk.rr(g, FX - 40, 286, 80, 26, 6, '#fff'); g.fillStyle = '#e4521b'; for (let k = 1; k < 4; k++) g.fillRect(FX - 40 + k*20 - 1, 286, 3, 26);
      sk.band(g, 520, 30, '#7a4a2a'); for (let x = 32; x < SW; x += 96) sk.ell(g, x, 535, 9, 9, '#c9cfd6'); } },
  { name:'Corrida', eye:'#07080b', limb:'#d81f26', draw(g){
      sk.fill(g, '#d81f26'); sk.grad(g, 0, 90, [[0, '#ff6a6a'], [1, '#d81f26']]);
      sk.ell(g, FX, EY, 210, 70, '#a81219'); sk.ell(g, FX, EY, 190, 56, '#f4f6fa');
      sk.poly(g, [[FX-46,70],[FX+46,70],[FX+34,112],[FX-34,112]], '#ffc21a');
      sk.rr(g, FX - 78, 330, 156, 320, 18, '#1c1c1f'); g.strokeStyle = '#3a3a40'; g.lineWidth = 9;
      for (let y = 350; y < SH; y += 34){ g.beginPath(); g.moveTo(FX - 60, y); g.lineTo(FX, y + 26); g.lineTo(FX + 60, y); g.stroke(); }
      sk.band(g, 300, 12, '#a81219');
      [-1, 1].forEach(s => { const x = FX + s*270; sk.poly(g, [[x-90,330],[x+90,300],[x+70,420],[x-110,450]], '#101014');
        g.fillStyle = '#fff'; g.font = 'italic 900 96px sans-serif'; g.textAlign = 'center'; g.fillText('07', x - 10, 412);
        sk.poly(g, [[x-30,500],[x+10,500],[x-10,465]], '#ffe21a'); sk.ell(g, x + 60, 500, 22, 22, '#fff'); sk.star(g, x + 60, 500, 16, '#1f5fb0'); });
      sk.rr(g, 0, 0, 60, SH, 0, '#1c1c1f'); sk.rr(g, SW - 60, 0, 60, SH, 0, '#1c1c1f'); } },
  { name:'Lutador', eye:'#07080b', limb:'#1fa85a', draw(g){
      sk.fill(g, '#f4d21b'); sk.band(g, 318, 150, '#c98b5e'); sk.band(g, 468, 172, '#1fa85a'); sk.band(g, 440, 46, '#7c3fd0');
      sk.ell(g, FX, 463, 46, 40, '#f4d21b'); sk.star(g, FX, 463, 30, '#1fa85a', 8);
      [-1, 1].forEach(s => { const x = FX + s*84; sk.poly(g, [[x-s*70,EY+60],[x+s*20,EY+66],[x+s*118,EY-96],[x+s*52,EY-46],[x+s*44,EY-110],[x-s*6,EY-52],[x-s*40,EY-104],[x-s*52,EY-40]], '#7c3fd0'); });
      sk.lens(g, '#fff', 44, 40);
      sk.rr(g, FX - 62, 262, 124, 44, 14, '#7c3fd0'); sk.rr(g, FX - 50, 270, 100, 28, 6, '#fff'); g.fillStyle = '#b9b9c6'; for (let k = 1; k < 5; k++) g.fillRect(FX - 50 + k*20 - 1, 270, 3, 28);
      sk.zig(g, 300, 18, 32, '#1fa85a', 14); } },
  { name:'Terminal', eye:'#39ffb0', glow:1, limb:'#101418', draw(g){
      sk.fill(g, '#04080a'); const r = sk.rnd(21); g.font = 'bold 17px monospace'; g.textAlign = 'left';
      const words = ['status', 'ok', 'sync', 'run()', 'bots:17', 'ready', '0x1F', 'await', 'ping', 'log', 'task', 'done', '>>'];
      for (let y = 40; y < SH; y += 26) for (let x = 10 + r()*60; x < SW; x += 70 + r()*120){ if (Math.abs(x + 30 - FX) < 190 && y > 120 && y < 480) continue; g.fillStyle = r() > 0.8 ? '#b6ffe2' : '#1fd18a'; g.fillText(words[Math.floor(r()*words.length)], x, y); }
      g.strokeStyle = '#fff'; g.lineWidth = 16; g.beginPath(); g.arc(FX, 366, 44, Math.PI, 0); g.stroke();
      sk.rr(g, FX - 86, 366, 172, 110, 22, '#fff'); sk.rr(g, FX - 62, 398, 124, 46, 23, '#e0242c'); sk.ell(g, FX - 36, 421, 15, 15, '#ffb3b3'); } },
  { name:'Suéter', eye:'#07080b', limb:'#f3ead8', draw(g){
      sk.fill(g, '#f6efe0'); sk.ell(g, FX, 236, 12, 9, '#2a2a2a'); sk.band(g, 326, 14, '#f29ab8'); sk.band(g, 346, 230, '#fbe3c6');
      const cols = ['#f29ab8', '#f6b13a', '#f7dd72'];
      for (let row = 0; row < 3; row++) for (let k = 0; k < 17; k++){ const x = k*64 + (row % 2)*32, y = 384 + row*76; sk.poly(g, [[x, y - 38], [x + 32, y], [x, y + 38], [x - 32, y]], cols[(k + row) % 3]); }
      g.strokeStyle = 'rgba(190,90,120,0.6)'; g.lineWidth = 2; for (let k = -10; k < 28; k++){ g.beginPath(); g.moveTo(k*64, 346); g.lineTo(k*64 + 194, 576); g.moveTo(k*64, 346); g.lineTo(k*64 - 194, 576); g.stroke(); }
      sk.band(g, 576, 64, '#f6efe0'); g.fillStyle = '#e2d8c2'; for (let x = 0; x < SW; x += 16) g.fillRect(x, 580, 4, 60); } },
  { name:'Zigue-zague', eye:'#07080b', limb:'#ff5a7a', draw(g){
      sk.fill(g, '#ff5a7a'); sk.ell(g, FX - 150, 250, 26, 14, '#ff8fa6'); sk.ell(g, FX + 150, 250, 26, 14, '#ff8fa6');
      ['#fff', '#35c46a', '#2f6fe0', '#ffd24a', '#b05ae0', '#fff', '#2f6fe0'].forEach((c, k) => sk.zig(g, 310 + k*46, 30, 32, c, 50));
      sk.band(g, 620, 20, '#2f6fe0'); } },
  { name:'Ninja', eye:'#07080b', mouth:false, limb:'#1b1f2a', draw(g){
      sk.fill(g, '#1b1f2a'); g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 2; for (let y = 10; y < SH; y += 12){ g.beginPath(); g.moveTo(0, y); g.lineTo(SW, y); g.stroke(); }
      sk.rr(g, FX - 176, EY - 50, 352, 104, 50, '#f1c9a5'); sk.band(g, 96, 34, '#d6283a'); sk.ell(g, FX, 113, 30, 30, '#f4f4f4'); sk.star(g, FX, 113, 22, '#d6283a', 4);
      sk.band(g, 436, 36, '#d6283a'); sk.star(g, FX, 362, 42, '#aeb6c2', 4); sk.ell(g, FX, 362, 9, 9, '#1b1f2a');
      sk.poly(g, [[SW-40,96],[SW,130],[SW-10,230],[SW-50,130]], '#d6283a'); } },
  { name:'Abelha', eye:'#07080b', limb:'#16161a', draw(g){
      sk.fill(g, '#ffc61a'); sk.grad(g, 0, 120, [[0, '#ffe07a'], [1, '#ffc61a']]);
      [330, 440, 550].forEach(y => sk.band(g, y, 58, '#16161a')); sk.ell(g, FX - 140, 256, 28, 16, '#ff9a7a'); sk.ell(g, FX + 140, 256, 28, 16, '#ff9a7a');
      [-1, 1].forEach(s => sk.ell(g, FX + s*330, 250, 90, 54, 'rgba(255,255,255,0.75)', s*0.5)); } },
  { name:'Panda', eye:'#ffffff', mouth:false, limb:'#16161a', draw(g){
      sk.fill(g, '#f7f7f4'); sk.band(g, 380, 150, '#16161a'); sk.ell(g, FX, 520, 150, 90, '#f7f7f4');
      sk.ell(g, FX - 86, EY + 6, 60, 74, '#16161a', 0.35); sk.ell(g, FX + 86, EY + 6, 60, 74, '#16161a', -0.35);
      sk.ell(g, FX, 262, 20, 13, '#16161a'); g.strokeStyle = '#16161a'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.arc(FX - 16, 276, 16, 0.1, Math.PI - 0.4); g.stroke(); g.beginPath(); g.arc(FX + 16, 276, 16, 0.4, Math.PI - 0.1); g.stroke();
      sk.ell(g, FX - 190, 60, 70, 60, '#16161a'); sk.ell(g, FX + 190, 60, 70, 60, '#16161a'); } },
  { name:'Robô retrô', eye:'#5ff3ff', glow:1, limb:'#8a96a3', draw(g){
      sk.fill(g, '#c9d2dc'); sk.band(g, 0, 70, '#aab5c1'); sk.band(g, 560, 80, '#aab5c1');
      for (let x = 24; x < SW; x += 80){ sk.ell(g, x, 84, 7, 7, '#7d8894'); sk.ell(g, x, 548, 7, 7, '#7d8894'); }
      sk.rr(g, FX - 200, EY - 84, 400, 180, 36, '#7d8894'); sk.rr(g, FX - 186, EY - 70, 372, 152, 26, '#0b1622');
      g.fillStyle = 'rgba(95,243,255,0.08)'; for (let y = EY - 66; y < EY + 80; y += 8) g.fillRect(FX - 182, y, 364, 3);
      sk.rr(g, FX - 150, 350, 300, 150, 16, '#93a0ad'); ['#e0242c', '#ffc21a', '#35c46a'].forEach((c, k) => sk.ell(g, FX - 104 + k*48, 392, 17, 17, c));
      sk.rr(g, FX + 50, 372, 80, 40, 8, '#0b1622'); g.strokeStyle = '#35ffb0'; g.lineWidth = 4; g.beginPath(); g.moveTo(FX + 56, 394); [8, -10, 12, -6, 4, 0].forEach((d, k) => g.lineTo(FX + 68 + k*10, 394 + d)); g.stroke();
      g.fillStyle = '#5c6772'; for (let k = 0; k < 9; k++) g.fillRect(FX - 124 + k*30, 440, 16, 40); } },
  { name:'Astronauta', eye:'#ffffff', glow:1, limb:'#eef1f5', draw(g){
      sk.fill(g, '#eef1f5'); sk.ell(g, FX, EY + 16, 214, 128, '#c7ced8'); sk.ell(g, FX, EY + 16, 196, 112, '#141b2c');
      sk.ell(g, FX - 110, EY - 40, 50, 18, 'rgba(255,255,255,0.22)', -0.5); sk.band(g, 372, 12, '#f0802a'); sk.band(g, 610, 30, '#f0802a');
      sk.rr(g, FX - 90, 410, 180, 110, 14, '#c7ced8'); ['#e0242c', '#2f6fe0', '#35c46a', '#ffc21a'].forEach((c, k) => sk.rr(g, FX - 70 + k*38, 430, 26, 26, 5, c)); sk.rr(g, FX - 70, 474, 140, 22, 6, '#141b2c');
      sk.rr(g, FX + 220, 410, 90, 60, 6, '#2f6fe0'); sk.star(g, FX + 265, 440, 20, '#fff'); sk.rr(g, FX - 310, 410, 90, 60, 6, '#f0802a'); sk.ell(g, FX - 265, 440, 18, 18, '#fff'); } },
  { name:'Galáxia', eye:'#ffffff', glow:1, limb:'#2a1a66', draw(g){
      sk.grad(g, 0, SH, [[0, '#0b0a2a'], [0.5, '#3a1a7a'], [1, '#0a2a5a']]); const r = sk.rnd(33);
      for (let k = 0; k < 8; k++) sk.ell(g, r()*SW, r()*SH, 90 + r()*90, 40 + r()*40, ['rgba(255,90,200,0.12)', 'rgba(80,200,255,0.12)'][k % 2], r()*3);
      for (let k = 0; k < 260; k++){ const a = r(); sk.ell(g, r()*SW, r()*SH, 1 + a*2.4, 1 + a*2.4, a > 0.85 ? '#ffe9a8' : '#fff'); }
      for (let k = 0; k < 7; k++) sk.star(g, r()*SW, 300 + r()*300, 10 + r()*10, '#fff', 4);
      sk.ell(g, FX, 430, 56, 56, '#ffb04a'); sk.ell(g, FX - 14, 414, 30, 22, '#ffd08a'); g.strokeStyle = '#ffe9c8'; g.lineWidth = 9; g.beginPath(); g.ellipse(FX, 432, 96, 22, -0.25, 0, 7); g.stroke(); sk.ell(g, FX, 404, 54, 30, '#ffb04a'); } },
  // ---- segunda leva: mesmos temas das referências, em desenhos próprios ----
  { name:'Armadura', eye:'#eafcff', glow:1, mouth:false, limb:'#2d5d8a', draw(g){
      sk.fill(g, '#2d5d8a'); sk.grad(g, 0, 90, [[0, '#4f86b8'], [1, '#2d5d8a']]);
      sk.poly(g, [[FX-170,110],[FX-70,70],[FX+70,70],[FX+170,110],[FX+180,250],[FX+110,320],[FX-110,320],[FX-180,250]], '#f0a43a');
      sk.poly(g, [[FX-40,70],[FX+40,70],[FX+24,150],[FX-24,150]], '#d98a22'); sk.rr(g, FX - 70, 276, 140, 10, 5, '#b86f14');
      sk.rr(g, FX - 134, EY - 22, 104, 42, 12, '#17324d'); sk.rr(g, FX + 30, EY - 22, 104, 42, 12, '#17324d');
      [-1, 1].forEach(s => { sk.poly(g, [[FX+s*210,340],[FX+s*420,300],[FX+s*440,420],[FX+s*230,440]], '#3f77a8'); sk.rr(g, FX + s*300 - 50, 470, 100, 26, 8, '#f0a43a'); });
      sk.ell(g, FX, 430, 62, 62, '#17324d'); sk.ell(g, FX, 430, 48, 48, '#8ff3ff'); sk.ell(g, FX, 430, 26, 26, '#ffffff');
      sk.band(g, 540, 14, '#f0a43a'); sk.band(g, 554, 86, '#234a70'); } },
  { name:'Felino', eye:'#eef2f8', glow:1, mouth:false, limb:'#23203a', draw(g){
      sk.fill(g, '#23203a'); g.fillStyle = 'rgba(255,255,255,0.045)'; for (let y = 0; y < SH; y += 14) for (let x = (y/14 % 2)*10; x < SW; x += 20) g.fillRect(x, y, 6, 6);
      sk.poly(g, [[FX-200,20],[FX-110,70],[FX-210,130]], '#3a3660'); sk.poly(g, [[FX+200,20],[FX+110,70],[FX+210,130]], '#3a3660');
      g.strokeStyle = '#b9c0d6'; g.lineWidth = 7; g.lineJoin = 'round';
      [-1, 1].forEach(s => { g.beginPath(); g.moveTo(FX + s*20, 150); g.lineTo(FX + s*150, 140); g.lineTo(FX + s*180, 226); g.lineTo(FX + s*60, 262); g.closePath(); g.stroke(); });
      sk.poly(g, [[FX-16,246],[FX+16,246],[FX,266]], '#b9c0d6'); g.lineWidth = 4;
      [-1, 1].forEach(s => [0, 1, 2].forEach(k => { g.beginPath(); g.moveTo(FX + s*40, 270 + k*8); g.lineTo(FX + s*170, 262 + k*22); g.stroke(); }));
      g.lineWidth = 6; g.beginPath(); g.arc(FX, 300, 190, 0.35, Math.PI - 0.35); g.stroke();
      for (let k = -4; k <= 4; k++){ const a = Math.PI/2 + k*0.2, x = FX + Math.cos(a)*190, y = 300 + Math.sin(a)*190; sk.poly(g, [[x-13,y],[x+13,y],[x,y+46]], '#e6e9f2'); }
      sk.band(g, 590, 50, '#3a3660'); } },
  { name:'Estrela', eye:'#07080b', limb:'#d43a7a', draw(g){
      sk.fill(g, '#1c2f6b'); sk.band(g, 0, 130, '#d43a7a'); sk.zig(g, 110, 34, 64, '#d43a7a', 20);
      sk.ell(g, FX, EY + 16, 190, 112, '#f3cfae'); sk.poly(g, [[FX-190,150],[FX,96],[FX+190,150],[FX+150,120],[FX-150,120]], '#d43a7a');
      sk.star(g, FX, 440, 96, '#f6c531', 8); sk.star(g, FX, 440, 52, '#fff3b0', 8);
      [-1, 1].forEach(s => { sk.poly(g, [[FX+s*110,430],[FX+s*512,400],[FX+s*512,470]], '#f6c531'); sk.rr(g, FX + s*330 - 46, 540, 92, 30, 10, '#d43a7a'); });
      sk.band(g, 600, 40, '#d43a7a'); } },
  { name:'Teia', eye:'#b6ff5a', glow:1, limb:'#0f3b3a', draw(g){
      sk.fill(g, '#0f3b3a'); g.strokeStyle = '#b6ff5a'; g.lineWidth = 4; g.lineCap = 'round';
      const cx = FX, cy = 440;
      for (let k = 0; k < 16; k++){ const a = k*Math.PI/8; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a)*900, cy + Math.sin(a)*900); g.stroke(); }
      for (let rr = 50; rr < 760; rr += 54){ g.beginPath(); for (let k = 0; k <= 16; k++){ const a0 = k*Math.PI/8, a1 = a0 + Math.PI/16, x = cx + Math.cos(a0)*rr, y = cy + Math.sin(a0)*rr; if (!k) g.moveTo(x, y); else g.lineTo(x, y); g.quadraticCurveTo(cx + Math.cos(a1)*rr*0.9, cy + Math.sin(a1)*rr*0.9, cx + Math.cos(a0 + Math.PI/8)*rr, cy + Math.sin(a0 + Math.PI/8)*rr); } g.stroke(); }
      sk.rr(g, FX - 176, EY - 56, 352, 124, 60, '#0a2726'); sk.ell(g, cx, cy, 20, 20, '#b6ff5a'); } },
  // Guerra nas Estrelas (uso pessoal, a pedido): Stormtrooper, Darth Vader, R2-D2
  { name:'Stormtrooper', eye:'#0b0d11', mouth:false, limb:'#f4f5f7', draw(g){
      sk.fill(g, '#f4f5f7'); sk.grad(g, 430, 640, [[0, '#f4f5f7'], [1, '#d5d9df']]);
      sk.band(g, 112, 26, '#15181d'); sk.rr(g, FX - 150, 40, 70, 62, 8, '#8d949d');
      [-1, 1].forEach(s => {
        sk.poly(g, [[FX + s*18, 168], [FX + s*150, 150], [FX + s*176, 196], [FX + s*150, 244], [FX + s*70, 252], [FX + s*22, 222]], '#0b0d11');
        sk.poly(g, [[FX + s*40, 178], [FX + s*138, 164], [FX + s*150, 190], [FX + s*60, 196]], '#2b3038');
        sk.ell(g, FX + s*196, 300, 34, 44, '#9aa1aa'); g.fillStyle = '#4c535c'; for (let k = 0; k < 5; k++) g.fillRect(FX + s*196 - 24, 274 + k*12, 48, 5);
        g.save(); g.translate(FX + s*250, 420); g.rotate(s*0.5); sk.rr(g, -22, -90, 44, 180, 22, '#e6e9ed'); g.fillStyle = '#2b4fb5'; for (let k = 0; k < 9; k++) g.fillRect(-14, -70 + k*16, 28, 6); g.restore();
        sk.ell(g, FX + s*96, 452, 56, 34, '#15181d', s*0.5); sk.ell(g, FX + s*104, 456, 20, 20, '#9aa1aa');
      });
      g.strokeStyle = '#15181d'; g.lineWidth = 26; g.lineCap = 'butt'; g.beginPath(); g.arc(FX, 420, 132, Math.PI*1.2, Math.PI*1.8); g.stroke();
      g.strokeStyle = '#f4f5f7'; g.lineWidth = 7; for (let k = -3; k <= 3; k++){ const a = -Math.PI/2 + k*0.2; g.beginPath(); g.moveTo(FX + Math.cos(a)*116, 420 + Math.sin(a)*116); g.lineTo(FX + Math.cos(a)*148, 420 + Math.sin(a)*148); g.stroke(); }
      sk.rr(g, FX - 44, 410, 88, 84, 26, '#15181d'); sk.rr(g, FX - 22, 428, 14, 46, 7, '#9aa1aa'); sk.rr(g, FX + 8, 428, 14, 46, 7, '#9aa1aa');
      sk.band(g, 560, 80, '#15181d'); } },
  { name:'Darth Vader', eye:'#1c2b55', mouth:false, limb:'#0d0e12', draw(g){
      sk.fill(g, '#0d0e12'); sk.grad(g, 0, 150, [[0, '#2b2d36'], [1, '#0d0e12']]);
      sk.poly(g, [[FX - 26, 0], [FX + 26, 0], [FX + 18, 150], [FX - 18, 150]], '#3a3d49'); sk.poly(g, [[FX - 8, 0], [FX + 8, 0], [FX + 5, 150], [FX - 5, 150]], '#191a20');
      g.strokeStyle = '#3a3d49'; g.lineWidth = 12; g.beginPath(); g.moveTo(FX - 330, 330); g.quadraticCurveTo(FX - 210, 130, FX, 150); g.quadraticCurveTo(FX + 210, 130, FX + 330, 330); g.stroke();
      sk.poly(g, [[FX - 250, 170], [FX, 150], [FX + 250, 170], [FX + 230, 400], [FX, 470], [FX - 230, 400]], '#17181e');
      [-1, 1].forEach(s => {
        sk.ell(g, FX + s*88, EY + 4, 84, 58, '#343846', s*0.12); sk.ell(g, FX + s*88, EY + 6, 70, 46, '#1c2b55', s*0.12); sk.ell(g, FX + s*96, EY - 6, 40, 16, '#4a67b8', s*0.12);
        g.strokeStyle = '#343846'; g.lineWidth = 8; g.beginPath(); g.moveTo(FX + s*176, 250); g.lineTo(FX + s*96, 420); g.stroke();
      });
      g.fillStyle = '#343846'; for (let k = 0; k < 4; k++) g.fillRect(FX - 16, 196 + k*14, 32, 7);
      sk.poly(g, [[FX, 262], [FX + 112, 418], [FX - 112, 418]], '#3d404c'); sk.poly(g, [[FX, 284], [FX + 92, 406], [FX - 92, 406]], '#0a0b0e');
      g.fillStyle = '#4d5160'; for (let k = -5; k <= 5; k++){ const h = 100 - Math.abs(k)*17; g.fillRect(FX + k*15 - 3, 406 - h, 6, h); }
      sk.ell(g, FX, 268, 16, 16, '#cfd3da'); sk.ell(g, FX - 112, 418, 9, 9, '#8a8f9c'); sk.ell(g, FX + 112, 418, 9, 9, '#8a8f9c');
      sk.rr(g, FX - 120, 490, 240, 96, 10, '#1d1f27'); ([['#d8362d', 0], ['#2f6fe0', 1], ['#d8362d', 3], ['#b9bec8', 4]] as [string, number][]).forEach(([c, k]) => sk.rr(g, FX - 100 + k*42, 508, 30, 22, 4, c));
      g.fillStyle = '#8a8f9c'; for (let k = 0; k < 3; k++) g.fillRect(FX - 100, 546 + k*12, 200, 4); } },
  { name:'R2-D2', eye:'#2a57c4', mouth:false, limb:'#eef0f3', draw(g){
      sk.fill(g, '#eef0f3'); sk.grad(g, 0, 270, [[0, '#d5dae0'], [1, '#b4bbc4']]);
      sk.band(g, 270, 16, '#7f8893'); sk.band(g, 286, 8, '#2a57c4'); sk.band(g, 240, 30, '#2a57c4');
      for (let k = 0; k < 8; k++){ const x = k*128 + 20; if (Math.abs(x + 44 - FX) < 110) continue; sk.rr(g, x, 150, 88, 70, 8, '#2a57c4'); sk.rr(g, x + 14, 164, 26, 20, 4, k % 2 ? '#39d0c8' : '#b4bbc4'); }
      sk.rr(g, FX - 150, EY - 40, 300, 84, 10, '#2a57c4');
      sk.ell(g, FX, 96, 70, 62, '#2a57c4'); sk.ell(g, FX, 96, 50, 46, '#0c0e13'); sk.ell(g, FX - 16, 80, 14, 12, '#6f7a88');
      sk.ell(g, FX - 190, 110, 24, 24, '#39d0c8'); sk.ell(g, FX + 150, 60, 15, 15, '#e0442e');
      [0, 1].forEach(k => { sk.rr(g, FX - 150, 316 + k*46, 300, 30, 8, '#2a57c4'); sk.rr(g, FX - 120, 324 + k*46, 240, 12, 5, '#8fa9e6'); });
      sk.rr(g, FX - 130, 420, 110, 150, 12, '#2a57c4'); sk.rr(g, FX - 110, 440, 70, 110, 14, '#b4bbc4'); g.fillStyle = '#7f8893'; for (let k = 0; k < 4; k++) g.fillRect(FX - 100, 456 + k*24, 50, 8);
      for (let k = 0; k < 4; k++) sk.rr(g, FX + 6, 470 + k*24, 80, 14, 7, '#b4bbc4');
      g.strokeStyle = '#b4bbc4'; g.lineWidth = 4; g.strokeRect(FX + 110, 320, 130, 200); g.strokeRect(FX - 290, 320, 120, 200);
      [-1, 1].forEach(s => { sk.rr(g, FX + s*400 - 60, 300, 120, 290, 18, '#dfe3e8'); sk.rr(g, FX + s*400 - 22, 340, 44, 200, 10, '#2a57c4'); });
      sk.band(g, 596, 44, '#7f8893'); } },
  // Marvel (uso pessoal, a pedido)
  { name:'Homem-Aranha', eye:'#ffffff', mouth:false, limb:'#c8141c', draw(g){
      sk.fill(g, '#c8141c'); sk.band(g, 470, 170, '#1d3fa8');
      [-1, 1].forEach(s => sk.poly(g, [[FX + s*250, 300], [FX + s*512, 260], [FX + s*512, 470], [FX + s*210, 470]], '#1d3fa8'));
      g.strokeStyle = '#3a0508'; g.lineWidth = 3;
      for (let k = 0; k < 24; k++){ const a = k*Math.PI/12; g.beginPath(); g.moveTo(FX, 232); g.lineTo(FX + Math.cos(a)*620, 232 + Math.sin(a)*620); g.stroke(); }
      for (let r = 50; r < 620; r += 46){ g.beginPath(); for (let k = 0; k <= 24; k++){ const a = k*Math.PI/12, a2 = a - Math.PI/24; if (k) g.quadraticCurveTo(FX + Math.cos(a2)*r*0.9, 232 + Math.sin(a2)*r*0.9, FX + Math.cos(a)*r, 232 + Math.sin(a)*r); else g.moveTo(FX + r, 232); } g.stroke(); }
      sk.band(g, 470, 170, '#1d3fa8'); [-1, 1].forEach(s => sk.poly(g, [[FX + s*250, 300], [FX + s*512, 260], [FX + s*512, 470], [FX + s*210, 470]], '#1d3fa8'));
      [-1, 1].forEach(s => { sk.poly(g, [[FX + s*14, 228], [FX + s*40, 160], [FX + s*150, 132], [FX + s*176, 190], [FX + s*120, 250], [FX + s*50, 256]], '#0a0a0c'); sk.poly(g, [[FX + s*30, 224], [FX + s*50, 172], [FX + s*142, 150], [FX + s*160, 190], [FX + s*114, 236], [FX + s*56, 242]], '#ffffff'); });
      sk.ell(g, FX, 392, 16, 30, '#0a0a0c'); sk.ell(g, FX, 362, 11, 11, '#0a0a0c'); g.strokeStyle = '#0a0a0c'; g.lineWidth = 6;
      [-1, 1].forEach(s => [[-28, -44], [-10, -30], [12, 26], [30, 44]].forEach(([y0, y1], k) => { g.beginPath(); g.moveTo(FX + s*10, 392 + y0*0.4); g.lineTo(FX + s*44, 392 + y0); g.lineTo(FX + s*(k < 2 ? 54 : 50), 392 + y1 + (k < 2 ? -22 : 22)); g.stroke(); }));
      sk.band(g, 462, 14, '#0a0a0c'); } },
  { name:'Homem de Ferro', eye:'#d8f6ff', glow:1, mouth:false, limb:'#a3121a', draw(g){
      sk.fill(g, '#a3121a'); sk.grad(g, 0, 130, [[0, '#d0242c'], [1, '#a3121a']]);
      sk.poly(g, [[FX - 150, 96], [FX - 60, 70], [FX, 104], [FX + 60, 70], [FX + 150, 96], [FX + 176, 230], [FX + 120, 322], [FX + 60, 344], [FX - 60, 344], [FX - 120, 322], [FX - 176, 230]], '#e6b422');
      sk.poly(g, [[FX - 120, 322], [FX - 60, 344], [FX + 60, 344], [FX + 120, 322], [FX + 96, 300], [FX - 96, 300]], '#c9971a');
      [-1, 1].forEach(s => { sk.poly(g, [[FX + s*26, 204], [FX + s*150, 184], [FX + s*140, 226], [FX + s*36, 224]], '#3a2a06'); sk.poly(g, [[FX + s*36, 207], [FX + s*140, 192], [FX + s*132, 219], [FX + s*42, 218]], '#d8f6ff'); });
      sk.rr(g, FX - 44, 288, 88, 8, 4, '#3a2a06'); g.strokeStyle = '#8a6a10'; g.lineWidth = 4; g.beginPath(); g.moveTo(FX - 150, 96); g.lineTo(FX - 110, 200); g.moveTo(FX + 150, 96); g.lineTo(FX + 110, 200); g.stroke();
      sk.band(g, 372, 10, '#6e0b10'); sk.ell(g, FX, 440, 58, 58, '#e6b422'); sk.ell(g, FX, 440, 46, 46, '#0d2a3a'); sk.ell(g, FX, 440, 36, 36, '#8fe9ff'); sk.ell(g, FX, 440, 18, 18, '#ffffff');
      [-1, 1].forEach(s => { sk.poly(g, [[FX + s*90, 400], [FX + s*230, 380], [FX + s*250, 520], [FX + s*110, 560]], '#e6b422'); sk.rr(g, FX + s*330 - 50, 330, 100, 220, 14, '#e6b422'); });
      sk.band(g, 584, 56, '#e6b422'); } },
  { name:'Capitão América', eye:'#07080b', limb:'#1c3f9e', draw(g){
      sk.fill(g, '#1c3f9e'); sk.band(g, 238, 80, '#f1c9a5'); sk.poly(g, [[FX - 512, 238], [FX - 200, 238], [FX - 150, 318], [FX - 512, 318]], '#1c3f9e'); sk.poly(g, [[FX + 512, 238], [FX + 200, 238], [FX + 150, 318], [FX + 512, 318]], '#1c3f9e');
      sk.lens(g, '#ffffff', 40, 34);
      g.fillStyle = '#ffffff'; g.font = 'bold 96px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('A', FX, 96);
      [-1, 1].forEach(s => { for (let k = 0; k < 3; k++) sk.poly(g, [[FX + s*236, 150 + k*22], [FX + s*330, 126 + k*22], [FX + s*300, 164 + k*22], [FX + s*236, 168 + k*22]], '#ffffff'); });
      sk.band(g, 318, 150, '#1c3f9e'); sk.star(g, FX, 388, 62, '#ffffff');
      for (let x = 0, k = 0; x < SW; x += 64, k++) sk.band(g, 468, 0, '#fff'), g.fillStyle = k % 2 ? '#ffffff' : '#c8141c', g.fillRect(x, 468, 64, 110);
      sk.band(g, 578, 62, '#1c3f9e'); sk.band(g, 560, 20, '#6b4a2a'); sk.rr(g, FX - 26, 554, 52, 32, 6, '#c9ced6'); } },
  { name:'Hulk', eye:'#07080b', mouth:false, limb:'#5fae3a', draw(g){
      sk.fill(g, '#5fae3a'); sk.grad(g, 300, 470, [[0, '#5fae3a'], [1, '#4c9330']]);
      sk.band(g, 0, 96, '#12140f'); sk.zig(g, 86, 46, 44, '#12140f', 20);
      [-1, 1].forEach(s => sk.poly(g, [[FX + s*10, 176], [FX + s*170, 128], [FX + s*176, 156], [FX + s*20, 196]], '#12140f'));
      sk.ell(g, FX - 82, EY + 6, 40, 30, '#e9f2e2'); sk.ell(g, FX + 82, EY + 6, 40, 30, '#e9f2e2');
      sk.ell(g, FX, 262, 26, 12, '#3f7d27');
      sk.rr(g, FX - 96, 292, 192, 62, 18, '#1d2a12'); g.fillStyle = '#ffffff'; for (let k = 0; k < 6; k++){ g.fillRect(FX - 84 + k*29, 296, 23, 18); g.fillRect(FX - 84 + k*29, 332, 23, 18); }
      g.strokeStyle = '#3f7d27'; g.lineWidth = 6; [-1, 1].forEach(s => { g.beginPath(); g.arc(FX + s*90, 400, 70, Math.PI*0.15, Math.PI*0.85); g.stroke(); });
      g.beginPath(); g.moveTo(FX, 390); g.lineTo(FX, 470); g.stroke();
      sk.band(g, 490, 150, '#6a35a8'); sk.zig(g, 474, 26, 52, '#6a35a8', 30); sk.zig(g, 600, 22, 40, '#5fae3a', 60); } },
  { name:'Thor', eye:'#07080b', limb:'#b3121c', draw(g){
      sk.fill(g, '#b3121c'); sk.rr(g, FX - 250, 0, 500, 640, 0, '#23262e');
      sk.rr(g, FX - 210, 60, 420, 300, 60, '#e9c46a'); sk.rr(g, FX - 170, 110, 340, 230, 70, '#f1c9a5');
      sk.poly(g, [[FX - 150, 262], [FX + 150, 262], [FX + 120, 350], [FX, 392], [FX - 120, 350]], '#d9a94a'); sk.rr(g, FX - 40, 238, 80, 34, 12, '#f1c9a5');
      sk.grad(g, 0, 0, [[0, '#fff'], [1, '#fff']]); sk.rr(g, FX - 220, 0, 440, 132, 0, '#c9ced6'); sk.band(g, 0, 0, '#fff'); sk.rr(g, FX - 220, 118, 440, 22, 8, '#8f96a1'); sk.rr(g, FX - 14, 0, 28, 132, 6, '#8f96a1');
      [-1, 1].forEach(s => { for (let k = 0; k < 4; k++) sk.poly(g, [[FX + s*214, 112 - k*4], [FX + s*(300 + k*26), 20 - k*2 + k*20], [FX + s*(270 + k*20), 90 + k*10], [FX + s*214, 136]], k % 2 ? '#e7eaee' : '#ffffff'); sk.ell(g, FX + s*214, 122, 20, 20, '#8f96a1'); });
      [-1, 1].forEach(s => [0, 1].forEach(k => { sk.ell(g, FX + s*72, 450 + k*86, 36, 36, '#c9ced6'); sk.ell(g, FX + s*72, 450 + k*86, 22, 22, '#8f96a1'); }));
      sk.band(g, 396, 12, '#b3121c'); } },
  { name:'Pantera Negra', eye:'#ffffff', glow:1, mouth:false, limb:'#101016', draw(g){
      sk.fill(g, '#101016'); sk.grad(g, 0, 140, [[0, '#2a2a36'], [1, '#101016']]);
      [-1, 1].forEach(s => { sk.poly(g, [[FX + s*150, 40], [FX + s*230, -10], [FX + s*250, 90]], '#1c1c26'); sk.poly(g, [[FX + s*20, 226], [FX + s*56, 172], [FX + s*156, 156], [FX + s*150, 214], [FX + s*76, 244]], '#ffffff'); });
      g.strokeStyle = '#3a3a4c'; g.lineWidth = 4; g.beginPath(); g.moveTo(FX - 8, 60); g.lineTo(FX - 8, 150); g.moveTo(FX + 8, 60); g.lineTo(FX + 8, 150); g.stroke();
      sk.poly(g, [[FX - 22, 262], [FX + 22, 262], [FX, 284]], '#2a2a36');
      for (let k = -4; k <= 4; k++){ const x = FX + k*46, h = 62 - Math.abs(k)*8; sk.poly(g, [[x - 16, 330 + Math.abs(k)*6], [x + 16, 330 + Math.abs(k)*6], [x, 330 + Math.abs(k)*6 + h]], '#c9ced6'); }
      g.strokeStyle = '#8b5cf6'; g.lineWidth = 3; for (let k = 0; k < 5; k++){ g.beginPath(); g.moveTo(FX - 200 + k*20, 440 + k*26); g.lineTo(FX, 470 + k*26); g.lineTo(FX + 200 - k*20, 440 + k*26); g.stroke(); } } },
  { name:'Wolverine', eye:'#ffffff', mouth:false, limb:'#f2c81a', draw(g){
      sk.fill(g, '#f2c81a'); sk.band(g, 238, 70, '#f1c9a5');
      [-1, 1].forEach(s => { sk.poly(g, [[FX + s*4, 250], [FX + s*30, 150], [FX + s*200, -10], [FX + s*300, -10], [FX + s*236, 150], [FX + s*190, 250], [FX + s*90, 262]], '#0f1014'); sk.poly(g, [[FX + s*40, 226], [FX + s*60, 180], [FX + s*150, 160], [FX + s*130, 226]], '#ffffff');
        sk.poly(g, [[FX + s*512, 238], [FX + s*190, 238], [FX + s*190, 308], [FX + s*512, 308]], '#f2c81a');
        sk.poly(g, [[FX + s*190, 320], [FX + s*512, 300], [FX + s*512, 420], [FX + s*250, 400]], '#1f49b0');
        for (let k = 0; k < 3; k++) sk.poly(g, [[FX + s*240, 420 + k*36], [FX + s*120, 436 + k*36], [FX + s*240, 444 + k*36]], '#0f1014'); });
      sk.rr(g, FX - 50, 280, 100, 12, 6, '#7a4a35'); g.fillStyle = '#ffffff'; for (let k = 0; k < 5; k++) g.fillRect(FX - 44 + k*18, 282, 12, 8);
      sk.band(g, 540, 30, '#c8141c'); sk.rr(g, FX - 34, 528, 68, 54, 8, '#0f1014'); g.strokeStyle = '#c8141c'; g.lineWidth = 8; g.beginPath(); g.moveTo(FX - 18, 540); g.lineTo(FX + 18, 570); g.moveTo(FX + 18, 540); g.lineTo(FX - 18, 570); g.stroke();
      sk.band(g, 570, 70, '#1f49b0'); } },
  { name:'Deadpool', eye:'#ffffff', mouth:false, limb:'#b3121c', draw(g){
      sk.fill(g, '#b3121c'); sk.grad(g, 0, 120, [[0, '#d2222c'], [1, '#b3121c']]);
      [-1, 1].forEach(s => { sk.ell(g, FX + s*92, EY + 4, 80, 96, '#111115', s*0.3); sk.poly(g, [[FX + s*36, 222], [FX + s*60, 186], [FX + s*140, 176], [FX + s*128, 222], [FX + s*80, 236]], '#ffffff');
        sk.poly(g, [[FX + s*200, 330], [FX + s*512, 300], [FX + s*512, 470], [FX + s*250, 470]], '#111115'); sk.rr(g, FX + s*150 - 30, 400, 60, 90, 8, '#6b4a2a'); });
      g.strokeStyle = '#7d0c13'; g.lineWidth = 4; g.beginPath(); g.moveTo(FX, 0); g.lineTo(FX, 330); g.stroke();
      sk.band(g, 490, 34, '#6b4a2a'); for (let x = 30; x < SW; x += 90) sk.rr(g, x, 484, 40, 46, 6, '#4f3620');
      sk.ell(g, FX, 507, 42, 42, '#111115'); sk.ell(g, FX, 507, 34, 34, '#b3121c'); sk.rr(g, FX - 3, 473, 6, 68, 2, '#111115'); sk.ell(g, FX - 16, 502, 9, 12, '#111115'); sk.ell(g, FX + 16, 502, 9, 12, '#111115');
      sk.band(g, 524, 116, '#b3121c'); [-1, 1].forEach(s => sk.poly(g, [[FX + s*120, 540], [FX + s*300, 540], [FX + s*260, 640], [FX + s*150, 640]], '#111115')); } },
  { name:'Patrulha', eye:'#ffffff', glow:1, limb:'#f1f3f5', draw(g){
      sk.fill(g, '#f1f3f5'); sk.rr(g, FX - 230, EY - 46, 460, 96, 40, '#f08a1c'); sk.rr(g, FX - 214, EY - 34, 428, 72, 30, '#12202e');
      sk.band(g, 80, 10, '#c9d0d8'); [-1, 1].forEach(s => { sk.ell(g, FX + s*300, 200, 46, 46, '#c9d0d8'); sk.ell(g, FX + s*300, 200, 28, 28, '#2fb16a'); });
      sk.rr(g, FX - 90, 300, 180, 44, 12, '#c9d0d8'); g.fillStyle = '#55606c'; for (let k = 0; k < 7; k++) g.fillRect(FX - 76 + k*24, 308, 10, 28);
      sk.band(g, 380, 16, '#2fb16a'); sk.rr(g, FX - 120, 420, 240, 110, 18, '#dfe4ea'); ['#f08a1c', '#2fb16a', '#12202e'].forEach((c, k) => sk.rr(g, FX - 96 + k*70, 446, 52, 22, 6, c));
      sk.rr(g, FX - 96, 486, 192, 20, 6, '#b3bcc6'); sk.band(g, 570, 70, '#c9d0d8'); } },
  { name:'Sombrio', eye:'#c46bff', glow:1, mouth:false, limb:'#15131c', draw(g){
      sk.fill(g, '#15131c'); sk.grad(g, 0, 120, [[0, '#34304a'], [1, '#15131c']]);
      sk.poly(g, [[FX-18,0],[FX+18,0],[FX+10,150],[FX-10,150]], '#2c2840');
      sk.poly(g, [[FX-250,150],[FX,110],[FX+250,150],[FX+200,270],[FX,300],[FX-200,270]], '#231f33');
      sk.rr(g, FX - 150, EY - 22, 120, 46, 10, '#0a0910'); sk.rr(g, FX + 30, EY - 22, 120, 46, 10, '#0a0910');
      g.strokeStyle = '#c46bff'; g.lineWidth = 4; for (let k = 0; k < 5; k++){ g.beginPath(); g.moveTo(FX - 60 + k*8, 300 + k*18); g.lineTo(FX + 60 - k*8, 300 + k*18); g.stroke(); }
      g.strokeStyle = '#4a4468'; g.lineWidth = 6; [-1, 1].forEach(s => { g.beginPath(); g.moveTo(FX + s*200, 270); g.lineTo(FX + s*260, 640); g.stroke(); });
      sk.rr(g, FX - 80, 440, 160, 70, 10, '#231f33'); ['#c46bff', '#ff5a7a', '#5ff3ff'].forEach((c, k) => sk.rr(g, FX - 60 + k*44, 460, 30, 14, 4, c)); } },
  { name:'Droide', eye:'#07080b', limb:'#e9edf0', draw(g){
      sk.fill(g, '#e9edf0'); sk.band(g, 0, 300, '#b9c2ca'); sk.band(g, 300, 14, '#7d8891');
      for (let k = 0; k < 8; k++) sk.rr(g, k*128 + 14, 30, 100, 60, 10, k % 2 ? '#1f9a6b' : '#a9b3bc');
      sk.rr(g, FX - 190, EY - 60, 380, 132, 30, '#dfe5ea'); sk.ell(g, FX + 250, 190, 40, 40, '#16212b'); sk.ell(g, FX + 250, 190, 20, 20, '#e0443a'); sk.ell(g, FX - 250, 190, 30, 30, '#1f9a6b');
      sk.rr(g, FX - 150, 340, 300, 60, 10, '#1f9a6b'); g.fillStyle = '#e9edf0'; for (let k = 0; k < 6; k++) g.fillRect(FX - 130 + k*46, 352, 30, 12);
      sk.rr(g, FX - 110, 420, 100, 150, 10, '#cfd6dc'); sk.rr(g, FX + 10, 420, 100, 150, 10, '#cfd6dc'); g.fillStyle = '#7d8891'; for (let k = 0; k < 5; k++){ g.fillRect(FX - 96, 436 + k*26, 72, 10); g.fillRect(FX + 24, 436 + k*26, 72, 10); }
      [-1, 1].forEach(s => sk.rr(g, FX + s*330 - 60, 340, 120, 240, 16, '#1f9a6b')); sk.band(g, 600, 40, '#7d8891'); } },
  { name:'Ogro', eye:'#07080b', mouth:false, limb:'#6f9a3a', draw(g){
      sk.fill(g, '#86b548'); const r = sk.rnd(11); for (let k = 0; k < 90; k++) sk.ell(g, r()*SW, 120 + r()*520, 6 + r()*10, 4 + r()*6, 'rgba(60,100,30,0.35)');
      sk.band(g, 0, 120, '#7b848c'); g.fillStyle = '#5b646c'; for (let x = 0; x < SW; x += 46) g.fillRect(x, 0, 6, 120); for (let x = 20; x < SW; x += 64) sk.ell(g, x, 108, 8, 8, '#474f56');
      sk.poly(g, [[FX-200,150],[FX-40,176],[FX-40,190],[FX-200,172]], '#3d5a1c'); sk.poly(g, [[FX+200,150],[FX+40,176],[FX+40,190],[FX+200,172]], '#3d5a1c');
      sk.rr(g, FX - 150, 262, 300, 60, 24, '#3d2a1a'); for (let k = 0; k < 7; k++) sk.rr(g, FX - 126 + k*38, 286, 28, 30, 5, '#f4ecd0');
      sk.poly(g, [[FX-140,300],[FX-106,300],[FX-123,226]], '#fff6dc'); sk.poly(g, [[FX+140,300],[FX+106,300],[FX+123,226]], '#fff6dc');
      sk.band(g, 440, 200, '#6b4a2a'); sk.zig(g, 420, 26, 40, '#6b4a2a', 30); sk.band(g, 500, 24, '#c9a13a'); sk.rr(g, FX - 36, 488, 72, 48, 8, '#e3bd50'); } },
  { name:'Zumbi', eye:'#07080b', mouth:false, limb:'#cfc3e6', draw(g){
      sk.fill(g, '#ded5f0'); sk.poly(g, [[0,0],[SW,0],[SW,90],[FX+160,130],[FX+60,60],[FX-40,150],[FX-170,80],[FX-300,120],[0,70]], '#9a94ad');
      sk.ell(g, FX + 82, EY, 74, 78, '#2a2536'); sk.ell(g, FX + 82, EY, 50, 54, '#efeaff'); sk.ell(g, FX - 82, EY, 60, 62, '#f6f3ff'); sk.ell(g, FX - 82, EY, 60, 62, 'rgba(120,100,170,0.15)');
      sk.poly(g, [[FX-170,270],[FX+170,256],[FX+190,640],[FX-190,640]], '#17141f');
      for (let k = 0; k < 6; k++) sk.rr(g, FX - 120 + k*42, 270 - k*2, 30, 44 + (k % 3)*14, 6, k % 2 ? '#f1e7a8' : '#fbf6dc');
      sk.ell(g, FX + 10, 470, 84, 46, '#ff6fc0'); sk.rr(g, FX - 30, 430, 80, 60, 26, '#ff8fd0');
      g.strokeStyle = '#8b83a3'; g.lineWidth = 5; g.beginPath(); g.moveTo(FX - 300, 200); g.lineTo(FX - 260, 260); g.lineTo(FX - 290, 300); g.lineTo(FX - 250, 360); g.stroke();
      sk.ell(g, FX + 300, 420, 30, 30, '#b9e04a'); sk.ell(g, FX + 350, 470, 14, 14, '#b9e04a'); } },
  { name:'Alerta', eye:'#ffffff', glow:1, limb:'#e8eaee', draw(g){
      sk.fill(g, '#f2f3f5'); sk.rr(g, -40, EY - 60, SW + 80, 116, 0, '#e8203c'); sk.grad(g, EY - 60, EY - 20, [[0, 'rgba(255,255,255,0.3)'], [1, 'rgba(255,255,255,0)']]);
      sk.band(g, 400, 240, '#131317'); g.strokeStyle = '#131317'; g.lineWidth = 6; [330, 360].forEach((y, q) => { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= SW; x += 40) g.lineTo(x, y + ((x/40 + q) % 3 - 1)*12); g.stroke(); });
      g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 470); g.lineTo(SW, 470); g.stroke();
      sk.poly(g, [[FX,300],[FX+130,520],[FX-130,520]], '#ff2440'); sk.poly(g, [[FX,346],[FX+90,496],[FX-90,496]], '#1a0c10');
      sk.rr(g, FX - 10, 384, 20, 66, 8, '#ff2440'); sk.ell(g, FX, 474, 12, 12, '#ff2440'); } },
  { name:'Gorro', eye:'#07080b', limb:'#f4f8ff', draw(g){
      sk.fill(g, '#f4f8ff'); sk.band(g, 0, 118, '#5a4f9a'); const cols = ['#6a5fb0', '#4a71b8', '#8a5aa8'];
      for (let y = 0; y < 100; y += 14) for (let x = (y/14 % 2)*10; x < SW; x += 20) sk.ell(g, x, y + 7, 9, 6, cols[(x/20 + y/14) % 3 | 0]);
      sk.band(g, 96, 30, '#463d80'); g.fillStyle = '#5a4f9a'; for (let x = 0; x < SW; x += 16) g.fillRect(x, 96, 8, 30);
      g.strokeStyle = '#1b2333'; g.lineWidth = 16; g.lineCap = 'butt'; [86, 56, 26].forEach(rr => { g.beginPath(); g.arc(FX, 480, rr, Math.PI*1.2, Math.PI*1.8); g.stroke(); }); sk.rr(g, FX - 10, 470, 20, 34, 8, '#1b2333');
      sk.grad(g, 560, SH, [[0, 'rgba(120,170,255,0)'], [1, 'rgba(120,170,255,0.5)']]); } },
  { name:'Listras', eye:'#d6f1ff', glow:1, limb:'#1557d6', draw(g){
      sk.fill(g, '#1557d6'); for (let x = 0; x < SW; x += 32){ g.fillStyle = (x/32) % 2 ? '#2f8cff' : '#0b3fb0'; g.fillRect(x, 0, 16, SH); }
      sk.grad(g, 0, SH, [[0, 'rgba(120,200,255,0.35)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,10,60,0.5)']]); } },
  { name:'Gato pixel', eye:'#7dffa0', glow:1, mouth:false, limb:'#b9a57e', draw(g){
      const r = sk.rnd(23), cols = ['#cdbb93', '#bfab82', '#d8c8a2', '#b39d74'];
      for (let y = 0; y < SH; y += 32) for (let x = 0; x < SW; x += 32){ g.fillStyle = cols[r()*4 | 0]; g.fillRect(x, y, 31, 31); }
      for (let k = 0; k < 46; k++){ const x = (r()*32 | 0)*32, y = 320 + (r()*10 | 0)*32; g.fillStyle = '#7dffa0'; g.fillRect(x + 4, y + 4, 23, 23); }
      sk.poly(g, [[FX-210,40],[FX-120,96],[FX-220,150]], '#a48c62'); sk.poly(g, [[FX+210,40],[FX+120,96],[FX+220,150]], '#a48c62');
      sk.poly(g, [[FX-14,244],[FX+14,244],[FX,260]], '#6b5a3c'); g.strokeStyle = '#6b5a3c'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.arc(FX - 14, 262, 14, 0.2, Math.PI - 0.3); g.stroke(); g.beginPath(); g.arc(FX + 14, 262, 14, 0.3, Math.PI - 0.2); g.stroke();
      [-1, 1].forEach(s => [-1, 0, 1].forEach(k => { g.beginPath(); g.moveTo(FX + s*60, 258 + k*6); g.lineTo(FX + s*170, 252 + k*20); g.stroke(); })); } },
  { name:'Equalizador', eye:'#52ff8a', glow:1, mouth:false, limb:'#17191d', draw(g){
      sk.fill(g, '#0e1013'); sk.band(g, 70, 70, '#f07a1c'); sk.grad(g, 70, 100, [[0, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]); sk.rr(g, FX - 30, 60, 60, 20, 8, '#ffb46a');
      const r = sk.rnd(41); for (let k = 0; k < 32; k++){ const h = 2 + (Math.abs(Math.sin(k*0.55))*7 + r()*3 | 0); for (let q = 0; q < h; q++){ g.fillStyle = q > 7 ? '#ffe14a' : '#52ff8a'; g.fillRect(k*32 + 4, 600 - q*24, 24, 18); } } } },
  { name:'Neon', eye:'#5dff9a', glow:1, mouth:false, limb:'#232a78', draw(g){
      sk.fill(g, '#232a78'); sk.grad(g, 0, SH, [[0, '#3a43a8'], [1, '#14194f']]); g.strokeStyle = '#5dff9a'; g.lineWidth = 9; g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath(); g.moveTo(FX - 250, 640); g.lineTo(FX - 250, 170); g.quadraticCurveTo(FX - 250, 60, FX - 120, 60); g.lineTo(FX + 120, 60); g.quadraticCurveTo(FX + 250, 60, FX + 250, 170); g.lineTo(FX + 250, 640); g.stroke();
      g.beginPath(); g.moveTo(FX - 250, 300); g.lineTo(FX - 150, 250); g.lineTo(FX + 150, 250); g.lineTo(FX + 250, 300); g.stroke();
      g.beginPath(); g.moveTo(FX - 250, 380); g.lineTo(FX, 460); g.lineTo(FX + 250, 380); g.stroke(); sk.ell(g, FX, 520, 16, 16, '#5dff9a');
      g.lineWidth = 5; for (let x = 60; x < SW; x += 120) if (Math.abs(x - FX) > 280){ g.beginPath(); g.moveTo(x, 120); g.lineTo(x, 520); g.stroke(); sk.ell(g, x, 540, 9, 9, '#5dff9a'); } } },
  { name:'Lava', eye:'#07080b', limb:'#e3261c', draw(g){
      sk.fill(g, '#e3261c'); const r = sk.rnd(77), cols = ['#ff7a1c', '#ff9fb0', '#ffb347', '#ff5a3a'];
      for (let k = 0; k < 26; k++){ const x = r()*SW, y = r()*SH, a = 40 + r()*70; if (Math.abs(x - FX) < 230 && Math.abs(y - EY - 10) < 110) continue; sk.ell(g, x, y, a, a*(0.7 + r()*0.5), cols[k % 4], r()*3); }
      sk.grad(g, 0, SH, [[0, 'rgba(255,255,255,0.18)'], [0.4, 'rgba(255,255,255,0)'], [1, 'rgba(90,0,0,0.35)']]); } },
  { name:'Algodão-doce', eye:'#07080b', mouth:false, limb:'#b6ff3a', draw(g){
      sk.fill(g, '#2fd6c8'); sk.band(g, 0, 250, '#ff5ab4'); const r = sk.rnd(9);
      for (let row = 0; row < 4; row++) for (let x = (row % 2)*32; x < SW + 64; x += 64) sk.ell(g, x, 40 + row*56, 38, 34, ['#ff8fd0', '#ff5ab4', '#ffb6e2', '#ff74c2'][row]);
      for (let x = 0; x < SW + 64; x += 64) sk.ell(g, x, 262, 36, 30, '#ffe0f3');
      for (let k = 0; k < 40; k++) sk.ell(g, r()*SW, 300 + r()*90, 4, 4, '#eaffff');
      sk.band(g, 420, 220, '#aeb6be'); sk.band(g, 420, 12, '#8d959d'); sk.poly(g, [[FX-110,520],[FX+110,520],[FX+80,470],[FX,452],[FX-80,470]], '#b6ff3a');
      g.fillStyle = '#5c8f10'; for (let k = 0; k < 9; k++) g.fillRect(FX - 84 + k*20, 476, 6, 40); } },
  { name:'Guerreiro', eye:'#07080b', mouth:false, limb:'#8d5a36', draw(g){
      sk.fill(g, '#f2b9a2'); const r = sk.rnd(3); for (let k = 0; k < 120; k++) sk.ell(g, r()*SW, r()*120, 4, 4, 'rgba(210,90,60,0.5)');
      sk.poly(g, [[FX-40,0],[FX+40,0],[FX+30,120],[FX+10,96],[FX-6,128],[FX-24,100],[FX-36,124]], '#e2521c');
      sk.band(g, EY - 26, 44, '#3f8fc4'); sk.poly(g, [[FX-150,150],[FX-20,172],[FX-20,188],[FX-150,176]], '#e2521c'); sk.poly(g, [[FX+150,150],[FX+20,172],[FX+20,188],[FX+150,176]], '#e2521c');
      sk.rr(g, FX - 18, EY - 10, 36, 56, 6, '#e0a08a');
      const pts = [[FX-200,236]]; for (let k = 0; k <= 10; k++) pts.push([FX - 200 + k*40, 400 + (k % 2 ? 60 : 0) - Math.abs(k - 5)*14]); pts.push([FX + 200, 236]); sk.poly(g, pts, '#e2521c');
      sk.rr(g, FX - 56, 262, 112, 34, 10, '#5a1c10'); for (let k = 0; k < 5; k++) sk.rr(g, FX - 48 + k*20, 264, 17, 16, 3, '#fff5e0');
      sk.band(g, 440, 200, '#5d6068'); g.fillStyle = '#3f4248'; for (let y = 440; y < SH; y += 14) for (let x = (y/14 % 2)*9; x < SW; x += 18){ g.beginPath(); g.arc(x, y + 8, 7, 0, Math.PI); g.fill(); }
      sk.band(g, 500, 26, '#8d5a36'); for (let x = 30; x < SW; x += 80) sk.ell(g, x, 513, 8, 8, '#d9d2c2'); } },
  { name:'Cavaleiro', eye:'#07080b', mouth:false, limb:'#9aa1a8', draw(g){
      sk.fill(g, '#a9b0b7'); const r = sk.rnd(15); for (let k = 0; k < 300; k++) sk.ell(g, r()*SW, r()*250, 2 + r()*8, 2 + r()*5, 'rgba(60,66,72,0.22)');
      sk.band(g, EY - 26, 46, '#f2b9a2'); sk.band(g, EY - 40, 16, '#8a9198'); sk.band(g, 0, 16, '#8a9198');
      sk.rr(g, FX - 22, 0, 44, 280, 10, '#8a9198'); [40, 100, 160].forEach(y => sk.ell(g, FX, y, 9, 9, '#d8dde2')); for (let x = 30; x < SW; x += 90) sk.ell(g, x, EY - 32, 6, 6, '#d8dde2');
      sk.band(g, 240, 60, '#f2b9a2'); const pts = [[FX-210,244]]; for (let k = 0; k <= 10; k++) pts.push([FX - 210 + k*42, 380 + (k % 2 ? 50 : 0) - Math.abs(k - 5)*12]); pts.push([FX + 210, 244]); sk.poly(g, pts, '#d8501e');
      sk.rr(g, FX - 50, 286, 100, 30, 10, '#5a1c10'); for (let k = 0; k < 4; k++) sk.rr(g, FX - 40 + k*21, 288, 18, 14, 3, '#fff5e0');
      sk.band(g, 300, 20, 'rgba(0,0,0,0)'); sk.band(g, 440, 200, '#5d6068'); g.fillStyle = '#3f4248'; for (let y = 440; y < SH; y += 14) for (let x = (y/14 % 2)*9; x < SW; x += 18){ g.beginPath(); g.arc(x, y + 8, 7, 0, Math.PI); g.fill(); }
      sk.band(g, 520, 24, '#b9c0c6'); for (let x = 30; x < SW; x += 80) sk.ell(g, x, 532, 7, 7, '#6d747b'); } },
  { name:'Eremita', eye:'#4fe6ff', glow:1, mouth:false, limb:'#8a4a26', draw(g){
      sk.fill(g, '#9a552c'); sk.grad(g, 0, SH, [[0, '#b56a3a'], [1, '#6e3a1c']]);
      sk.poly(g, [[FX-210,300],[FX-190,150],[FX,70],[FX+190,150],[FX+210,300]], '#3b2416'); sk.rr(g, FX - 150, 150, 300, 150, 40, '#f0c3a6');
      sk.rr(g, FX - 16, EY - 4, 32, 60, 6, '#dfa98a'); sk.poly(g, [[FX-150,150],[FX,96],[FX+150,150],[FX+150,176],[FX,134],[FX-150,176]], '#3b2416');
      const pts = [[FX-170,240]]; for (let k = 0; k <= 8; k++) pts.push([FX - 160 + k*40, 420 + (k % 2 ? 46 : 0) + (4 - Math.abs(k - 4))*34]); pts.push([FX + 170, 240]); sk.poly(g, pts, '#f6f6f2');
      sk.poly(g, [[FX-150,246],[FX-10,250],[FX-60,300],[FX-190,290]], '#ffffff'); sk.poly(g, [[FX+150,246],[FX+10,250],[FX+60,300],[FX+190,290]], '#ffffff');
      sk.rr(g, FX - 30, 276, 60, 20, 8, '#7a3a2a'); g.strokeStyle = '#5a2f18'; g.lineWidth = 16; g.beginPath(); g.moveTo(0, 420); g.lineTo(FX - 200, 470); g.moveTo(SW, 420); g.lineTo(FX + 200, 470); g.stroke();
      sk.band(g, 590, 50, '#5a2f18'); for (let x = 30; x < SW; x += 70) sk.ell(g, x, 615, 8, 8, '#d9c7a0'); } },
  // terceira leva: coelhos, raio-X, anões e ogro de ferro, em desenhos próprios
  { name:'Coelho', eye:'#3a0f24', limb:'#ff9ccb', draw(g){
      sk.grad(g, 0, SH, [[0, '#ffb3d9'], [1, '#ff8cc3']]); sk.lens(g, '#7fe3f0', 50, 50); sk.lens(g, '#ffffff', 42, 42);
      [-1, 1].forEach(s => { sk.ell(g, FX + s*168, 268, 34, 24, '#ffd0e6'); for (let k = 0; k < 3; k++) sk.rr(g, FX + s*250 - 30, 250 + k*18, 60, 7, 3, '#ffffff');
        sk.ell(g, FX + s*96, 470, 44, 34, '#ffffff'); for (let k = -1; k <= 1; k++) sk.rr(g, FX + s*96 + k*16 - 3, 478, 6, 22, 3, '#ff5c9f'); });
      sk.ell(g, FX, 250, 62, 42, '#ffffff'); sk.ell(g, FX, 226, 16, 11, '#ff4f93');
      sk.ell(g, FX - 40, 372, 52, 48, '#ff5fa6'); sk.ell(g, FX + 40, 372, 52, 48, '#ff5fa6'); sk.poly(g, [[FX-88,392],[FX+88,392],[FX,478]], '#ff5fa6'); } },
  { name:'Coelha', eye:'#3a2418', limb:'#ffd3e0', draw(g){
      sk.fill(g, '#ffd3e0'); sk.band(g, 318, 170, '#a9e4f5'); sk.band(g, 488, 152, '#22386e');
      sk.lens(g, '#58d6d0', 46, 52); sk.lens(g, '#ffffff', 38, 44);
      [-1, 1].forEach(s => { sk.ell(g, FX + s*172, 262, 30, 22, '#ffb0c6'); sk.ell(g, FX + s*58, 318, 62, 44, '#ffffff'); sk.ell(g, FX + s*120, 492, 46, 34, '#ffffff'); });
      sk.ell(g, FX, 248, 56, 40, '#fff4f7'); sk.ell(g, FX, 226, 14, 10, '#ff8fae');
      g.strokeStyle = '#3d4658'; g.lineWidth = 8; g.lineCap = 'round'; [392, 446].forEach(y => { g.beginPath(); g.moveTo(FX - 14, y - 14); g.lineTo(FX + 14, y + 14); g.moveTo(FX + 14, y - 14); g.lineTo(FX - 14, y + 14); g.stroke(); });
      sk.ell(g, FX - 92, 400, 12, 12, '#ff3f7f'); sk.ell(g, FX - 72, 400, 12, 12, '#ff3f7f'); sk.poly(g, [[FX-106,404],[FX-58,404],[FX-82,432]], '#ff3f7f'); } },
  { name:'Coelho roqueiro', eye:'#0b1430', limb:'#19b8f2', draw(g){
      sk.fill(g, '#19b8f2'); sk.band(g, 0, 120, '#101116'); sk.zig(g, 100, 46, 64, '#101116', 30);
      sk.band(g, 330, 180, '#14151b'); sk.band(g, 510, 130, '#d9b98c'); sk.rr(g, FX - 5, 510, 10, 130, 0, '#b8966a');
      sk.poly(g, [[FX-110,330],[FX+110,330],[FX,470]], '#19b8f2'); sk.poly(g, [[FX-110,330],[FX-40,330],[FX-6,440],[FX-70,400]], '#22242c'); sk.poly(g, [[FX+110,330],[FX+40,330],[FX+6,440],[FX+70,400]], '#22242c');
      const r = sk.rnd(41); for (let k = 0; k < 26; k++){ const x = r()*SW, y = 350 + r()*130; if (Math.abs(x - FX) < 120) continue; sk.poly(g, [[x+8,y],[x-10,y+16],[x,y+16],[x-8,y+32],[x+12,y+12],[x+2,y+12]], '#ff5a5f'); }
      sk.lens(g, '#ffffff', 34, 42); sk.poly(g, [[FX-46,228],[FX+46,228],[FX+34,290],[FX-34,290]], '#eaf8ff'); sk.rr(g, FX - 16, 222, 32, 16, 6, '#ff9db0');
      [-1, 1].forEach(s => { sk.ell(g, FX + s*110, 500, 46, 32, '#ffffff'); for (let k = 0; k < 3; k++) sk.rr(g, FX + s*252 - 26, 252 + k*16, 52, 6, 3, '#ffffff'); }); } },
  { name:'Raio-X', eye:'#1a0b2e', mouth:false, limb:'#2a35d8', draw(g){
      sk.fill(g, '#2a35d8'); sk.poly(g, [[0,640],[0,470],[160,430],[330,520],[420,640]], '#ff2f6d');
      g.strokeStyle = '#35d6ff'; g.lineWidth = 7; for (let k = 0; k < 5; k++){ g.beginPath(); g.moveTo(40 + k*60, 640); g.quadraticCurveTo(80 + k*60, 560, 150 + k*50, 520 + k*10); g.stroke(); }
      g.fillStyle = '#ff3d8b'; g.beginPath(); g.moveTo(FX, 40); g.bezierCurveTo(FX + 300, 40, FX + 300, 600, FX, 600); g.closePath(); g.fill();
      g.fillStyle = '#f4ead6'; g.beginPath(); g.moveTo(FX, 60); g.bezierCurveTo(FX + 250, 60, FX + 240, 330, FX + 120, 340); g.lineTo(FX, 340); g.closePath(); g.fill();
      sk.ell(g, FX + 82, EY, 62, 66, '#cdbfa4'); sk.ell(g, FX + 82, EY, 50, 54, '#fff7e8'); sk.poly(g, [[FX,262],[FX+26,300],[FX,300]], '#3a1030');
      sk.rr(g, FX, 318, 150, 26, 8, '#3a1030'); for (let k = 0; k < 5; k++) sk.rr(g, FX + 6 + k*28, 318, 22, 16, 4, '#fffaf0');
      for (let k = 0; k < 4; k++){ g.strokeStyle = '#f4ead6'; g.lineWidth = 18; g.lineCap = 'round'; g.beginPath(); g.moveTo(FX + 8, 400 + k*40); g.quadraticCurveTo(FX + 110, 386 + k*40, FX + 170 - k*8, 420 + k*40); g.stroke(); }
      sk.rr(g, FX - 10, 380, 22, 180, 8, '#f4ead6');
      sk.ell(g, FX - 82, EY, 56, 44, '#ff9fd0'); sk.ell(g, FX - 82, EY, 46, 36, '#ffe3f2'); sk.ell(g, FX - 120, 280, 10, 16, '#58e0ff');
      sk.rr(g, FX - 90, 292, 90, 22, 8, '#3a1030'); sk.rr(g, FX - 30, 292, 24, 14, 3, '#ffffff');
      g.strokeStyle = '#141a66'; g.lineWidth = 9; g.beginPath(); g.moveTo(FX - 100, 410); g.lineTo(FX - 64, 446); g.moveTo(FX - 64, 410); g.lineTo(FX - 100, 446); g.stroke(); } },
  { name:'Anão', eye:'#07080b', mouth:false, limb:'#7fa39a', draw(g){
      sk.fill(g, '#7fa39a'); const r = sk.rnd(9);
      for (let y = 300; y < SH; y += 34) for (let x = (y/34 % 2)*24; x < SW + 48; x += 48){ g.strokeStyle = '#5f857c'; g.lineWidth = 5; g.beginPath(); g.arc(x, y, 24, 0, Math.PI); g.stroke(); }
      for (let k = 0; k < 40; k++) sk.ell(g, r()*SW, 300 + r()*340, 6 + r()*16, 4 + r()*10, 'rgba(176,96,48,0.45)');
      sk.band(g, 0, 170, '#b5683a'); sk.grad(g, 0, 170, [[0, '#c9824d'], [1, '#9c5328']]);
      g.strokeStyle = '#e0a36c'; g.lineWidth = 6; for (let x = 30; x < SW; x += 90){ g.beginPath(); g.ellipse(x, 90, 26, 52, 0, 0, 7); g.stroke(); g.beginPath(); g.moveTo(x, 40); g.lineTo(x, 140); g.stroke(); }
      sk.band(g, 162, 16, '#7a3f1c'); sk.rr(g, FX - 210, 170, 420, 130, 30, '#f2a7b8'); sk.rr(g, FX - 30, 120, 60, 130, 10, '#b5683a'); sk.rr(g, FX - 14, 130, 28, 110, 6, '#e0a36c');
      sk.poly(g, [[FX-150,170],[FX-30,188],[FX-30,200],[FX-150,190]], '#d92f25'); sk.poly(g, [[FX+150,170],[FX+30,188],[FX+30,200],[FX+150,190]], '#d92f25');
      const pts = [[FX-220,236]]; for (let k = 0; k <= 12; k++) pts.push([FX - 210 + k*35, 400 + (k % 2 ? 40 : 0) + (6 - Math.abs(k - 6))*22]); pts.push([FX + 220, 236]); pts.push([FX + 60, 262]); pts.push([FX, 246]); pts.push([FX - 60, 262]); sk.poly(g, pts, '#e8372b');
      g.strokeStyle = '#b81f1a'; g.lineWidth = 5; for (let k = -5; k <= 5; k++){ g.beginPath(); g.moveTo(FX + k*34, 290); g.lineTo(FX + k*38, 430 - Math.abs(k)*18); g.stroke(); }
      sk.rr(g, FX - 44, 282, 88, 26, 8, '#1b1210'); for (let k = 0; k < 3; k++) sk.rr(g, FX - 36 + k*26, 282, 20, 14, 3, '#fffdf2');
      sk.band(g, 520, 34, '#1d1a18'); sk.rr(g, FX - 34, 512, 68, 50, 8, '#c9a13a'); sk.rr(g, FX - 20, 524, 40, 26, 4, '#1d1a18'); } },
  { name:'Trança', eye:'#07080b', mouth:false, limb:'#a8643a', draw(g){
      sk.fill(g, '#f2a7b8'); sk.band(g, 330, 310, '#a8643a'); sk.grad(g, 330, SH, [[0, '#b87446'], [1, '#8a4c28']]);
      sk.zig(g, 316, 30, 80, '#a8643a', 30); g.strokeStyle = '#e9c79a'; g.lineWidth = 5; g.setLineDash([14, 12]); g.beginPath(); for (let x = 0, k = 0; x <= SW; x += 80, k++) g[k ? 'lineTo' : 'moveTo'](x, 362 + (k % 2 ? 30 : 0)); g.stroke(); g.setLineDash([]);
      g.strokeStyle = '#8a4c28'; g.lineWidth = 5; for (let x = 20; x < SW; x += 70){ g.beginPath(); g.ellipse(x, 500, 18, 60, 0, 0, 7); g.stroke(); }
      sk.band(g, 0, 130, '#ee3b2b'); sk.grad(g, 0, 130, [[0, '#ff5a3c'], [1, '#e0301f']]);
      g.fillStyle = '#ee3b2b'; g.beginPath(); g.moveTo(0, 0); g.lineTo(SW, 0); g.lineTo(SW, 330); g.lineTo(FX + 215, 330); g.bezierCurveTo(FX + 200, 190, FX + 90, 120, FX - 60, 150); g.bezierCurveTo(FX - 150, 170, FX - 215, 210, FX - 225, 330); g.lineTo(0, 330); g.closePath(); g.fill();
      g.strokeStyle = '#c92418'; g.lineWidth = 6; for (let k = 0; k < 9; k++){ g.beginPath(); g.moveTo(FX - 240 + k*60, 20); g.quadraticCurveTo(FX - 200 + k*62, 80, FX - 260 + k*70, 140); g.stroke(); }
      for (let k = 0; k < 7; k++) sk.ell(g, FX + 236 + (k % 2 ? 12 : -12), 300 + k*38, 34, 26, k % 2 ? '#e0301f' : '#ff5a3c', k % 2 ? 0.5 : -0.5);
      sk.rr(g, FX + 214, 560, 44, 16, 6, '#ffd24a'); sk.poly(g, [[FX+214,576],[FX+258,576],[FX+236,630]], '#ee3b2b');
      sk.poly(g, [[FX-140,170],[FX-30,186],[FX-30,196],[FX-140,186]], '#c92418'); sk.poly(g, [[FX+140,170],[FX+30,186],[FX+30,196],[FX+140,186]], '#c92418');
      sk.rr(g, FX - 16, 216, 32, 30, 8, '#e88da2'); sk.rr(g, FX - 50, 262, 100, 30, 10, '#fffdf2'); sk.rr(g, FX - 50, 274, 100, 5, 2, '#3a1a1a'); for (let k = 1; k < 4; k++) sk.rr(g, FX - 52 + k*25, 262, 4, 30, 1, '#3a1a1a'); } },
  { name:'Ogro de ferro', eye:'#07080b', mouth:false, limb:'#4f6b45', draw(g){
      sk.fill(g, '#8fbf7a'); sk.band(g, 0, 250, '#5f8f84'); const r = sk.rnd(23);
      for (let k = 0; k < 70; k++) sk.ell(g, r()*SW, r()*250, 10 + r()*40, 6 + r()*22, r() < 0.5 ? 'rgba(126,196,178,0.55)' : 'rgba(58,84,60,0.5)');
      sk.band(g, 232, 22, '#a8923a'); sk.rr(g, FX - 16, 0, 32, 250, 0, '#a8923a'); g.strokeStyle = '#a8923a'; g.lineWidth = 22; g.beginPath(); g.moveTo(FX - 260, 60); g.lineTo(FX - 16, 150); g.moveTo(FX + 260, 60); g.lineTo(FX + 16, 150); g.stroke();
      for (let x = 24; x < SW; x += 56) sk.ell(g, x, 243, 6, 6, '#d6c06a');
      sk.lens(g, '#1c2420', 58, 52); for (let k = -3; k <= 3; k++){ sk.rr(g, FX - 82 - 50, EY + k*13 - 3, 100, 6, 3, '#e9e1f5'); sk.rr(g, FX + 82 - 50, EY + k*13 - 3, 100, 6, 3, '#e9e1f5'); }
      sk.band(g, 254, 150, '#8fbf7a'); sk.rr(g, FX - 210, 300, 420, 64, 30, '#6f9a5c'); sk.rr(g, FX - 190, 312, 380, 40, 18, '#1a1410');
      for (let k = 0; k < 9; k++) sk.poly(g, [[FX-120+k*28,352],[FX-106+k*28,322],[FX-92+k*28,352]], '#e8c98a');
      [-1, 1].forEach(s => sk.poly(g, [[FX+s*150-30,356],[FX+s*150,240],[FX+s*150+30,356]], '#f0d9a8'));
      sk.band(g, 404, 26, '#a8923a'); sk.band(g, 430, 210, '#55655a'); sk.zig(g, 430, 40, 70, '#7a3a55', 40);
      for (let y = 520; y < SH; y += 30) for (let x = (y/30 % 2)*20; x < SW; x += 40) sk.ell(g, x, y, 5, 5, '#2f3a33'); } },
];

const THIRD = new Set(["Stormtrooper","Darth Vader","R2-D2","Homem-Aranha","Homem de Ferro","Capitão América","Hulk","Thor","Pantera Negra","Wolverine","Deadpool"]);
export const DEFAULT_SKINS: Skin[] = RAW.map((s) => ({ ...s, pack: THIRD.has(s.name) ? 'terceiros' : 'base' }));
