'use strict';

const $ = (id) => document.getElementById(id);

async function boot() {
  try {
    const info = await window.dsh.info();

    $('valVersion').textContent = 'v' + info.appVersion;
    $('valRuntime').textContent = 'Electron ' + info.electron;
    $('valData').textContent = info.dataRoot;
    $('valCache').textContent = info.cacheRoot;
    $('valData').title = info.dataRoot;
    $('valCache').title = info.cacheRoot;

    $('chipRuntime').textContent = `${info.platform}` + SP.g2 + `Chrome ${info.chrome.split('.')[0]}`;
    $('sideStatus').textContent = '内核就绪';
  } catch (err) {
    $('chipRuntime').textContent = '运行时信息读取失败';
    $('sideStatus').textContent = '异常';
    console.error(err);
  }
}

window.addEventListener('DOMContentLoaded', boot);
