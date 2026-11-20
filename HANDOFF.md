# Handoff — Sala 3D (Electron)

Data: 2026-11-20. Projeto: esta pasta (`sala-3d/`). Especificação e código de referência (somente leitura, não alterar):
`/Users/anteriovieira/.openmausbot/task-workspaces/98748862-b75f-4bf8-98bb-d5e462c84446/8a860dc6-5fd0-4040-b4a9-39dab01616a4/sala-3d-handoff/`
(`sala-3d-especificacao.md`, `referencia/index.html`, `referencia/sala_watch.py`, `referencia/skins_quadro.png`).

Pedido do dono: reescrever a sala conforme a especificação, **como app Electron**.

## Estado em uma linha

O app compila, abre e funciona com o conector de demonstração (duas conexões ao mesmo tempo, 24 agentes),
com o conector do OpenMausBot portado e validado contra o `sala_watch.py`; falta polimento, desempenho
do leitor do OpenMausBot, empacotamento e os conectores próprios de OpenBot/agents.chat/GrokBot.

## Verificado (com comando e resultado)

| O quê | Como | Resultado |
|---|---|---|
| Tipos | `npm run typecheck` | sem erros |
| Testes | `npm test` | 24/24 passam (status, comandos, layout, agregador, demo, OpenMausBot) |
| Critério 10 (mesmo estado que `sala_watch.py`) | `test/openmausbot.test.ts` roda o Python de referência (cópia temporária, `HOME` falso) sobre dados inventados e compara roster/bots/events/meet/rooms | igual |
| App abre e roda | `npm run build && npm run smoke` | 0 erros/avisos no console; 24 rótulos e 24 linhas na lista; "ao vivo"; janela de conversa abre |
| Servidor HTTP (modo navegador) | dentro do smoke | `/api/state` 200, `/` 200, POST com origem certa 200, origem errada 403, comando inválido 400 |
| Sem sobreposição | smoke mede a menor distância entre bots por 20 s | mín. 0,64 (corpo tem diâmetro 0,6; separação mira 0,8) |
| Leitor do OpenMausBot com dados reais desta máquina | teste temporário, só contagens | 16 agentes, 2 grupos, 3 departamentos, sem erro; **~0,95 s por leitura** |

Capturas do smoke ficam em `$TMPDIR/sala-smoke-*/shot-1.png` e `shot-2.png`.

## Não verificado

- Uso manual da interface: arrastar várias janelas, enviar em cada uma, menu de skins, baixar imagem, tela "Conexões"
  (adicionar/editar/remover, segredos), tema claro, tela cheia, toque em tablet/celular, acesso pela rede local com chave num aparelho real.
- Desempenho (critério 1: 60 fps notebook / 30 fps tablet com 20 agentes) — não medido.
- Teste de 10 minutos sem sobreposição (critério 3) — só 20 s medidos.
- Envio real para o OpenMausBot (precisa dos endereços de entrada, que são segredos do dono).
- `npm run dev` (só o build de produção foi rodado).

## Arquitetura

```
src/shared/      tipos (modelo v2), regra de status (decideStatus), validação de comandos, layout puro (computeLayout,
                 computeMeetings, zoneSlot, dockSlot), contrato IPC (api.ts)
src/main/        processo principal Electron
  index.ts       janela, IPC (só da própria janela), primeira execução, teste de fumaça (SALA_SMOKE)
  hub.ts         agregador: ids `conexão:id`, slots fixos (slots.json), previousStatus/statusSince, reconexão com espera
                 crescente (2 s → 60 s), erro isolado por conexão, roteamento de comandos
  config.ts      connections.json / server.json / slots.json / lan-key em userData (0600); segredos cifrados com
                 safeStorage (API assíncrona)
  server.ts      HTTP local 127.0.0.1:8765 + rede 0.0.0.0:8766 com chave; SSE /api/events, POST /api/command, arquivos de out/renderer
  registry.ts    tipos de conexão disponíveis
  connectors/    demo.ts (semente fixa), openmausbot.ts (porta de sala_watch.py, node:sqlite só leitura), httpBridge.ts (genérico)
src/preload/     window.sala (contextBridge, sandbox)
src/renderer/
  engine/        motor 3D em TS puro sobre three.js: engine.ts (cena, câmera, layout ao vivo, caminhada, separação,
                 fila de falas, reuniões, rótulos/balões), bot.ts (corpo, rosto, coroa, anel, tela), holo.ts (desktop falso), geometry.ts
  skins/         kit.ts, registry.ts (registerSkin, pacotes), defaultPack.ts (GERADO por scripts/extract-skins.mjs — 55 skins)
  ui/            painéis React (Panels, Roster, ChatWindow, ComposeBox, SkinMenu, Connections), actions.ts
  store.ts       zustand: estado da sala, preferências (localStorage 'sala.prefs'), janelas, mensagens otimistas (90 s)
  transport.ts   IPC no app; SSE + POST no navegador
test/            vitest
scripts/         smoke.mjs, extract-skins.mjs
```

## Decisões tomadas (podem ser revistas)

1. **three.js imperativo, sem @react-three/fiber.** A spec sugere R3F, mas exige que o motor não seja estado React;
   portar o código de referência como classe TS foi mais fiel e direto. O React só chama `engine.setRoom/setPrefs`.
2. **Processo principal = "servidor do app"** da seção 11.2: conectores, agregador e credenciais ficam nele;
   a janela usa IPC, outros aparelhos usam o servidor HTTP embutido.
3. **"Mostrar skins" começa desligado**, como no código de referência (a spec não diz o padrão).
4. **Letreiro** configurável, padrão "SALA 3D" (antes era fixo "ANTÉRIO HQ"). **Fuso** do aparelho, com campo opcional.
5. **Departamentos de mesmo nome** em plataformas diferentes: separados por padrão ("Vendas · Demo A"), opção "Juntar".
6. **Skins de terceiros** (Star Wars/Marvel) marcadas `pack:'terceiros'`, ligadas por padrão, com interruptor nos ajustes.
7. **OpenMausBot**: conexão cadastrada desligada na primeira execução. Envio: `message.agent` vai direto ao endereço do bot
   (só 127.0.0.1, como no original) ou cai na frase `[Sala 3D] …` para o bot principal. Pode importar os endereços do
   leitor antigo (pasta com `.sala_hook` e `.sala_hooks/`). O "QUIET_S" (agrupar mudanças a cada 180 s) do
   `sala_watch.py` **não** foi portado: só existia para evitar recarregar a página.
8. **OpenBot, agents.chat, GrokBot**: sem conector próprio (APIs não verificadas, conforme a spec). Criada a
   **Ponte HTTP** genérica (GET devolve `ConnectorSnapshot`, POST recebe `RoomCommand`).
9. Teste de fumaça próprio via Electron (`SALA_SMOKE`) em vez de Playwright.

## Divergências encontradas entre spec e código (seguido o código)

55 skins (spec diz 56) · rótulo extra "Consultando o Radar Scout" · `blur(38px)` vem da v3 (a v2 usava 30) ·
POST aceita até 8.000 bytes de corpo / 4.000 caracteres de texto.

## Próximos passos (em ordem)

1. **Tirar o leitor do OpenMausBot do processo principal** (~0,95 s síncrono a cada 3 s trava o IPC). Mover
   `OpenMausBotReader` para um `worker_threads` (ou `utilityProcess`) e/ou otimizar as consultas
   (`select thread_id, max(at) … group by 1` varre `messages` inteira; limitar por `at` ou usar índice existente).
2. **Testar a interface à mão** com `npm run dev` (lista "Não verificado" acima) e corrigir o que aparecer.
   Em especial: tela "Conexões" (salvar segredos, ligar/desligar, importar endereços), envio em grupo/departamento,
   "Tentar de novo", respostas de um toque, menu de skins e download.
3. **Medir desempenho** (critério 1) com 20 agentes; se preciso: limitar `pixelRatio`, sombras 1024, desligar sombras em
   tablet, dividir o bundle (renderer tem ~2,1 MB por causa do three; usar `manualChunks`/import dinâmico).
4. **Teste de 10 min sem sobreposição** (critério 3): rodar `node scripts/smoke.mjs 600 20` e conferir `minDistance ≥ 0,6`.
5. **Toque e tela cheia** num tablet pela rede local (critério 11); conferir o layout em telas estreitas (CSS `@media`).
6. **Empacotar** (electron-builder ou electron-forge), ícone, assinatura no macOS.
7. **Conectores OpenBot, agents.chat, GrokBot**: levantar as APIs pela documentação oficial (tabela da seção 12.4)
   e implementar como `ConnectorFactory` em `src/main/connectors/`, registrando em `registry.ts`. Regras de reserva já
   prontas em `src/shared/status.ts` (`decideStatus`, `fallbackStatus`). Nunca marcar `waiting` por adivinhação.
8. i18n de verdade (hoje um dicionário pt-BR em `src/renderer/i18n.ts`; alguns textos de painéis ainda estão direto no JSX).
9. Playwright (`_electron`) para um teste de interface, se quiserem além do smoke.

## Cuidados

- Não alterar nada na pasta `sala-3d-handoff/`. `scripts/extract-skins.mjs` só lê o `index.html`.
- Os endereços de entrada e a chave da rede são segredos: ficam cifrados em userData, nunca no repositório nem no navegador.
- Texto dos agentes é sempre renderizado como texto (nada de `innerHTML` com dado de agente).
- Não registrar conteúdo de conversa em log (o `log` do processo principal só recebe mensagens técnicas).
