# Sala 3D

App Electron + React + TypeScript em que agentes de várias plataformas convivem na mesma sala 3D.
Especificação: `sala-3d-handoff/sala-3d-especificacao.md`. Estado do trabalho e próximos passos: [HANDOFF.md](HANDOFF.md).

## Rodar

```bash
npm install
npm run dev        # app com recarga ao vivo (electron-vite)
npm run build      # compila main, preload e renderer em out/
npm start          # abre o app compilado
npm test           # testes (vitest): regra de status, layout, agregador, demo, OpenMausBot × sala_watch.py
npm run typecheck
npm run smoke      # depois do build: abre o app isolado com 2 conexões demo, salva capturas e result.json
```

Na primeira execução o app cria uma conexão **Demonstração** (ligada) e cadastra, desligadas, as plataformas que
encontrar neste computador. Ligue/edite em **Conexões** (ícone de tomada na barra da esquerda).

## Plataformas

| Plataforma | Como lê | Envia mensagens |
|---|---|---|
| OpenMausBot | pasta `~/.openmausbot` (só leitura) | sim, pelos endereços de entrada |
| OpenBot | banco local do app (só leitura) | ainda não |
| Tucano | banco local do espaço de trabalho escolhido (só leitura) | ainda não |
| Grok Bot | cache local do app; atualiza só com o Grok Bot aberto | ainda não |
| Ponte HTTP | GET devolve o estado, POST recebe comandos | sim |

Os conectores locais leem formatos internos desses apps, que podem mudar a cada versão; quando o formato não bate,
a conexão mostra erro em vez de inventar status. Detalhes em [HANDOFF.md](HANDOFF.md).

Variáveis de ambiente: `SALA_USER_DATA` (pasta de dados do app), `SALA_KEY` (chave da rede local, ≥ 20 caracteres),
`SALA_SMOKE`/`SALA_SMOKE_SECONDS` (teste de fumaça).

## Acesso por outro aparelho

- Neste computador: `http://127.0.0.1:8765/` (sem chave, só aceita Host local).
- Rede local: ligue em **Conexões → Acesso pela rede local**. Porta 8766; o link `?k=<chave>` vira cookie
  `HttpOnly; SameSite=Strict` no aparelho. Conexões e credenciais só pela janela do app.

## Licença

Código sob a licença [MIT](LICENSE). As skins do pacote "terceiros" (Star Wars e Marvel) são desenhos inspirados em
personagens cujas marcas pertencem aos seus donos; não fazem parte da licença do código e podem ser desligadas em
**Configurações → Skins de personagens de terceiros**.
