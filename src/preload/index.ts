import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type SalaBridge } from '@shared/api';
import type { RoomState } from '@shared/types';

const bridge: SalaBridge = {
  getState: () => ipcRenderer.invoke(IPC.getState),
  onState: (fn) => {
    const h = (_e: unknown, s: RoomState) => fn(s);
    ipcRenderer.on(IPC.state, h);
    return () => ipcRenderer.removeListener(IPC.state, h);
  },
  send: (cmd) => ipcRenderer.invoke(IPC.send, cmd),
  kinds: () => ipcRenderer.invoke(IPC.kinds),
  connections: () => ipcRenderer.invoke(IPC.connections),
  saveConnection: (c) => ipcRenderer.invoke(IPC.saveConnection, c),
  removeConnection: (id) => ipcRenderer.invoke(IPC.removeConnection, id),
  lan: () => ipcRenderer.invoke(IPC.lan),
  setLan: (enabled) => ipcRenderer.invoke(IPC.setLan, enabled),
  copy: (text) => ipcRenderer.invoke(IPC.copy, text),
};

contextBridge.exposeInMainWorld('sala', bridge);
