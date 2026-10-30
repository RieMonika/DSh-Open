'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('petWin', {
  move: (dx, dy) => ipcRenderer.send('pet:move', dx, dy),
  dragStart: () => ipcRenderer.send('pet:dragStart'),
  dragMove: () => ipcRenderer.send('pet:dragMove'),
  dragEnd: () => ipcRenderer.send('pet:dragEnd'),
  hold: (on) => ipcRenderer.send('pet:hold', !!on),
  react: () => ipcRenderer.send('pet:react-done'),
  menu: () => ipcRenderer.send('pet:menu'),
  onSay: (fn) => { ipcRenderer.on('pet:say', () => fn()); },
});