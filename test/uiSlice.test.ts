import { describe, expect, it } from 'vitest';
import { ACTIVITY, LIST_DEFAULT, LIST_MAX, LIST_MIN, createUiStore } from '../src/renderer/uiSlice';

const mk = () => {
  const st = createUiStore();
  return { st, s: () => st.getState() };
};

describe('slice ui (layout da casca)', () => {
  it('começa com painel aberto, sem abas, em Atividade e com a largura padrão', () => {
    const { s } = mk();
    expect(s().panelOpen).toBe(true);
    expect(s().tabs).toEqual([]);
    expect(s().activeTab).toBe(ACTIVITY);
    expect(s().listWidth).toBe(LIST_DEFAULT);
  });

  it('abrir conversa cria uma aba por bot, ativa a aba e abre o painel', () => {
    const { s } = mk();
    s().setPanelOpen(false);
    s().openTab('a');
    s().openTab('b');
    s().openTab('a');
    expect(s().tabs).toEqual(['a', 'b']);
    expect(s().activeTab).toBe('a');
    expect(s().panelOpen).toBe(true);
  });

  it('fechar a aba ativa passa para a vizinha e, sem abas, volta para Atividade', () => {
    const { s } = mk();
    for (const id of ['a', 'b', 'c']) s().openTab(id);
    s().setActiveTab('b');
    s().closeTab('b');
    expect(s().activeTab).toBe('c');
    s().closeTab('c');
    expect(s().activeTab).toBe('a');
    s().closeTab('a');
    expect(s().tabs).toEqual([]);
    expect(s().activeTab).toBe(ACTIVITY);
  });

  it('fechar uma aba que não está ativa mantém a ativa', () => {
    const { s } = mk();
    s().openTab('a');
    s().openTab('b');
    s().closeTab('a');
    expect(s().tabs).toEqual(['b']);
    expect(s().activeTab).toBe('b');
  });

  it('ignora aba inexistente', () => {
    const { s } = mk();
    s().openTab('a');
    s().setActiveTab('zz');
    s().closeTab('zz');
    expect(s().activeTab).toBe('a');
    expect(s().tabs).toEqual(['a']);
  });

  it('limita a largura da lista', () => {
    const { s } = mk();
    s().setListWidth(10);
    expect(s().listWidth).toBe(LIST_MIN);
    s().setListWidth(9999);
    expect(s().listWidth).toBe(LIST_MAX);
    s().setListWidth(301.6);
    expect(s().listWidth).toBe(302);
    s().setListWidth(Number.NaN);
    expect(s().listWidth).toBe(LIST_DEFAULT);
  });

  it('tira abas de bots que saíram da sala', () => {
    const { s } = mk();
    s().openTab('a');
    s().openTab('b');
    s().keepTabs(new Set(['a']));
    expect(s().tabs).toEqual(['a']);
    expect(s().activeTab).toBe('a');
    s().keepTabs(new Set());
    expect(s().activeTab).toBe(ACTIVITY);
  });

  it('alterna o painel', () => {
    const { s } = mk();
    s().togglePanel();
    expect(s().panelOpen).toBe(false);
    s().togglePanel();
    expect(s().panelOpen).toBe(true);
  });
});
