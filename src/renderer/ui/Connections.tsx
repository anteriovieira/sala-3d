// Tela "Conexões": adicionar, ligar/desligar, editar e remover plataformas; acesso pela rede local.
// Só existe dentro do app. Segredos são enviados ao processo principal e nunca voltam para cá.

import { useCallback, useEffect, useState } from 'react';
import type { ConfigField, ConnectionEntry, ConnectorKindInfo, LanInfo } from '@shared/types';
import { useUI } from '../store';

interface Draft {
  id?: string;
  kind: string;
  label: string;
  enabled: boolean;
  config: Record<string, unknown>;
  secrets: Record<string, string | null | undefined>;
  secretsSet: string[];
}

function Field({ f, d, set }: { f: ConfigField; d: Draft; set: (d: Draft) => void }) {
  const stop = (e: React.KeyboardEvent) => e.stopPropagation();
  if (f.type === 'secret') {
    const saved = d.secretsSet.includes(f.key) && d.secrets[f.key] === undefined;
    const multiline = f.key.toLowerCase().includes('hooks');
    const common = {
      value: (d.secrets[f.key] as string) ?? '',
      placeholder: saved ? '•••• guardado (digite para trocar)' : f.placeholder ?? '',
      onKeyDown: stop,
      autoComplete: 'off',
      spellCheck: false,
    };
    return (
      <label className="field">
        <span>{f.label}{f.required ? ' *' : ''}</span>
        {multiline ? (
          <textarea {...common} rows={3} onChange={(e) => set({ ...d, secrets: { ...d.secrets, [f.key]: e.target.value } })} />
        ) : (
          <input type="password" {...common} onChange={(e) => set({ ...d, secrets: { ...d.secrets, [f.key]: e.target.value } })} />
        )}
        {saved ? <button className="link" onClick={() => set({ ...d, secrets: { ...d.secrets, [f.key]: null }, secretsSet: d.secretsSet.filter((k) => k !== f.key) })}>apagar</button> : null}
        {f.help ? <em>{f.help}</em> : null}
      </label>
    );
  }
  if (f.type === 'boolean') {
    const v = !!d.config[f.key];
    return <div className={'opt' + (v ? ' on' : '')} onClick={() => set({ ...d, config: { ...d.config, [f.key]: !v } })}><span>{f.label}</span><span className="sw2" /></div>;
  }
  const v = d.config[f.key] ?? f.default ?? '';
  return (
    <label className="field">
      <span>{f.label}{f.required ? ' *' : ''}</span>
      {f.type === 'textarea' ? (
        <textarea rows={3} value={String(v)} onKeyDown={stop} onChange={(e) => set({ ...d, config: { ...d.config, [f.key]: e.target.value } })} />
      ) : (
        <input type={f.type === 'number' ? 'number' : 'text'} value={String(v)} placeholder={f.placeholder} onKeyDown={stop} onChange={(e) => set({ ...d, config: { ...d.config, [f.key]: e.target.value } })} />
      )}
      {f.help ? <em>{f.help}</em> : null}
    </label>
  );
}

export function Connections() {
  const open = useUI((s) => s.connectionsOpen);
  const setOpen = useUI((s) => s.setConnectionsOpen);
  const states = useUI((s) => s.room.connectors);
  const [kinds, setKinds] = useState<ConnectorKindInfo[]>([]);
  const [list, setList] = useState<ConnectionEntry[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState('');
  const [lan, setLan] = useState<LanInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const bridge = window.sala;

  const reload = useCallback(async () => {
    if (!bridge) return;
    const [k, l, n] = await Promise.all([bridge.kinds(), bridge.connections(), bridge.lan()]);
    setKinds(k);
    setList(l);
    setLan(n);
  }, [bridge]);

  useEffect(() => { if (open) void reload(); }, [open, reload]);
  if (!open || !bridge) return null;

  const kindOf = (k: string) => kinds.find((x) => x.kind === k);
  const startNew = (k: ConnectorKindInfo) => {
    const config: Record<string, unknown> = {};
    for (const f of k.fields) if (f.type !== 'secret' && f.default !== undefined) config[f.key] = f.default;
    setErr('');
    setDraft({ kind: k.kind, label: k.label, enabled: true, config, secrets: {}, secretsSet: [] });
  };
  const edit = (c: ConnectionEntry) => { setErr(''); setDraft({ id: c.id, kind: c.kind, label: c.label, enabled: c.enabled, config: { ...c.config }, secrets: {}, secretsSet: c.secretsSet }); };
  const save = async (d: Draft) => {
    setBusy(true);
    const r = await bridge.saveConnection({ id: d.id, kind: d.kind, label: d.label, enabled: d.enabled, config: d.config, secrets: d.secrets });
    setBusy(false);
    if (!r.ok) return setErr(r.error || 'erro');
    setDraft(null);
    void reload();
  };
  const toggle = async (c: ConnectionEntry) => {
    await bridge.saveConnection({ id: c.id, kind: c.kind, label: c.label, enabled: !c.enabled, config: c.config, secrets: {} });
    void reload();
  };
  const remove = async (c: ConnectionEntry) => {
    if (!confirm(`Remover a conexão "${c.label}"? Os agentes dela saem da sala.`)) return;
    await bridge.removeConnection(c.id);
    void reload();
  };
  const setLanOn = async (on: boolean) => {
    const r = await bridge.setLan(on);
    if (r.error) setErr(r.error);
    setLan(r);
  };

  return (
    <div className="backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="composeBox conns-panel" onWheel={(e) => e.stopPropagation()}>
        <div className="top">
          <div><h2>Conexões</h2><div className="sub">Plataformas cujos agentes aparecem na sala. As credenciais ficam só neste computador.</div></div>
          <button className="x" title="Fechar" onClick={() => setOpen(false)}>✕</button>
        </div>
        {err ? <div className="note red">{err}</div> : null}
        {draft ? (
          <div className="form">
            <h3>{(draft.id ? 'Editar · ' : 'Adicionar · ') + (kindOf(draft.kind)?.label ?? draft.kind)}</h3>
            <p className="desc">{kindOf(draft.kind)?.description}</p>
            <label className="field"><span>Nome na sala</span><input value={draft.label} maxLength={60} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></label>
            {(kindOf(draft.kind)?.fields ?? []).map((f) => <Field key={f.key} f={f} d={draft} set={setDraft} />)}
            <div className="row">
              <button className="qbtn" onClick={() => setDraft(null)}>Cancelar</button>
              <button className="qbtn sel" disabled={busy} onClick={() => save(draft)}>{busy ? 'Conectando…' : 'Salvar e conectar'}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="clist">
              {list.length ? list.map((c) => {
                const st = states.find((s) => s.id === c.id);
                return (
                  <div key={c.id} className="citem">
                    <i className={'cdot ' + (c.enabled ? st?.state ?? 'connecting' : 'off')} />
                    <div className="ctx">
                      <b>{c.label}</b>
                      <span>{kindOf(c.kind)?.label ?? c.kind} · {c.enabled ? (st?.state === 'online' ? 'ligada' : st?.state === 'error' ? 'erro: ' + (st.error ?? '') : 'conectando…') : 'desligada'}</span>
                    </div>
                    <div className={'opt mini' + (c.enabled ? ' on' : '')} onClick={() => toggle(c)} title={c.enabled ? 'Desligar' : 'Ligar'}><span className="sw2" /></div>
                    <button className="qbtn" onClick={() => edit(c)}>Editar</button>
                    <button className="qbtn" onClick={() => remove(c)}>Remover</button>
                  </div>
                );
              }) : <div className="empty">Nenhuma conexão ainda.</div>}
            </div>
            <h3>Adicionar conexão</h3>
            <div className="kinds">
              {kinds.map((k) => {
                const blocked = !k.multiple && list.some((c) => c.kind === k.kind);
                return (
                  <button key={k.kind} className="kind" disabled={blocked} onClick={() => startNew(k)} title={blocked ? 'Já existe uma conexão deste tipo' : ''}>
                    <b>{k.label}</b><span>{k.description}</span>
                  </button>
                );
              })}
            </div>
            <p className="desc">OpenBot, agents.chat e GrokBot ainda não têm conector próprio: as APIs deles não foram verificadas. Um adaptador que fale o formato da sala entra pela Ponte HTTP.</p>
            <h3>Abrir em outro aparelho</h3>
            <div className={'opt' + (lan?.enabled ? ' on' : '')} onClick={() => setLanOn(!lan?.enabled)}><span>Acesso pela rede local (tablet, celular, TV) com chave</span><span className="sw2" /></div>
            <p className="desc">Neste computador: {lan?.localUrl}</p>
            {lan?.enabled ? (
              lan.urls.length ? lan.urls.map((u) => (
                <div key={u} className="lanurl">
                  <code>{u.replace(/k=[^&]+/, 'k=••••')}</code>
                  <button className="qbtn" onClick={() => bridge.copy(u)}>Copiar link com a chave</button>
                </div>
              )) : <p className="desc">Nenhuma rede local encontrada.</p>
            ) : null}
            {lan?.enabled ? <p className="desc">Abra o link uma vez no aparelho: a chave fica guardada nele. Em rede aberta, prefira HTTPS por um proxy.</p> : null}
          </>
        )}
      </div>
    </div>
  );
}
