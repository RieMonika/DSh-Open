import fs from 'node:fs';
const PORT = process.env.DSH_OPEN_DEBUG_PORT || '9223';
const expr = process.argv.slice(2).join(' ');
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const pages = list.filter((t) => t.type === 'page' && t.webSocketDebuggerUrl);
const app = pages.filter((t) => String(t.url || '').includes('index.html'));
const target = app[0] || pages[0];
if (!target) { console.error('没有可用的页面'); process.exit(1); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
const out = await new Promise((resolve, reject) => {
  const id = 1;
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id !== id) return;
    if (msg.result && msg.result.exceptionDetails) {
      resolve({ err: msg.result.exceptionDetails.exception && msg.result.exceptionDetails.exception.description || msg.result.exceptionDetails.text });
    } else resolve({ val: msg.result && msg.result.result });
  };
  ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true, includeCommandLineAPI: true } }));
  setTimeout(() => reject(new Error('timeout')), 120000);
});
ws.close();
if (out.err) { console.error('表达式出错：', out.err); process.exit(1); }
const v = out.val && out.val.value;
console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 2));