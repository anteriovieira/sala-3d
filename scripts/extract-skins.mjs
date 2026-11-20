// Gera src/renderer/skins/defaultPack.ts a partir do array SKINS da sala antiga (somente leitura).
import { readFileSync, writeFileSync } from 'node:fs';
const [src, dst] = process.argv.slice(2);
const lines = readFileSync(src, 'utf8').split('\n');
const start = lines.findIndex((l) => l.startsWith('const SKINS = ['));
const end = lines.findIndex((l, i) => i > start && l === '];');
if (start < 0 || end < 0) throw new Error('array SKINS não encontrado');
// tipagem: tuplas [cor, posição] que o TypeScript não deduz sozinho
const body = lines.slice(start + 1, end).join('\n').replace("['#b9bec8', 4]].forEach(", "['#b9bec8', 4]] as [string, number][]).forEach(").replace("[['#d8362d', 0],", "([['#d8362d', 0],");
const THIRD = ['Stormtrooper', 'Darth Vader', 'R2-D2', 'Homem-Aranha', 'Homem de Ferro', 'Capitão América', 'Hulk', 'Thor', 'Pantera Negra', 'Wolverine', 'Deadpool'];
const out = `// GERADO por scripts/extract-skins.mjs a partir de referencia/index.html (array SKINS). Não editar à mão.
// Skins marcadas pack:'terceiros' imitam personagens de terceiros: só para uso pessoal.
/* eslint-disable */
import { sk, FX, EY, SW, SH, type Skin } from './kit';
void EY;

const RAW: Skin[] = [
${body}
];

const THIRD = new Set(${JSON.stringify(THIRD)});
export const DEFAULT_SKINS: Skin[] = RAW.map((s) => ({ ...s, pack: THIRD.has(s.name) ? 'terceiros' : 'base' }));
`;
writeFileSync(dst, out);
console.log('skins:', (body.match(/\{ name:'/g) || []).length);
