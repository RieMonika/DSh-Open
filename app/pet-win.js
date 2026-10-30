'use strict';
// 鲸鱼小女仆（移植版）：待机循环 + 整只窗口随拖动做重力下坠 + 点一下挥手说话 + 表情包
const vid = document.getElementById('vid');
const bubble = document.getElementById('bubble');
const stage = document.getElementById('stage');
const memeImg = document.getElementById('meme');

let drag = null;
let vy = 0;
let gravity = 1500;
let bounce = 0.55;
let floorY = 0;
let raf = null;

function play(name, loop) {
  const src = 'assets/pet/' + name + '.webm';
  if (vid.getAttribute('src') === src) return;
  vid.setAttribute('src', src);
  vid.loop = !!loop;
  vid.play().catch(() => {});
}
const idle = () => play('idle', true);
let back = null;
function once(name) {
  play(name, false);
  clearTimeout(back);
  back = setTimeout(idle, 2400);
}
function say(text) {
  if (!text) return;
  bubble.textContent = text;
  bubble.classList.add('on');
  clearTimeout(say.t);
  say.t = setTimeout(() => bubble.classList.remove('on'), 7000);
  once('wave');
}

// 拖动：窗口整体跟着鼠标走，松手后按重力往下掉，落地弹两下
stage.addEventListener('pointerdown', async (e) => {
  once('drag');
  try {
    const start = await window.petAPI.beginDrag(e.screenX, e.screenY);
    drag = { ...start, ox: e.screenX - start.x, oy: e.screenY - start.y };
    cancelAnimationFrame(raf);
    stage.setPointerCapture(e.pointerId);
  } catch (_) {}
});
stage.addEventListener('pointermove', (e) => {
  if (!drag) return;
  window.petAPI.moveTo(Math.round(e.screenX - drag.ox), Math.round(e.screenY - drag.oy));
});
stage.addEventListener('pointerup', async () => {
  if (!drag) return;
  drag = null;
  vy = 0;
  const env = await window.petAPI.env();
  floorY = env.floorY;
  cancelAnimationFrame(raf);
  const tick = () => {
    vy += gravity / 60;
    const next = Math.round(vy / 60);
    window.petAPI.nudgeY(next).then((y) => {
      if (y >= floorY) {
        if (Math.abs(vy) > 260) {
          vy = -vy * bounce;
          window.petAPI.moveTo(null, floorY);
        } else {
          window.petAPI.moveTo(null, floorY);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    });
  };
  raf = requestAnimationFrame(tick);
});

document.addEventListener('dblclick', async () => { try { await window.petAPI.hide(); } catch (_) {} });
stage.addEventListener('click', async (e) => {
  if (e.detail > 1) return;
  try {
    const r = await window.petAPI.say();
    if (r && r.meme) {
      memeImg.src = 'assets/pet/memes/' + encodeURIComponent(r.meme);
      memeImg.classList.add('on');
      setTimeout(() => memeImg.classList.remove('on'), 4200);
    }
    if (r && r.text) say(r.text);
  } catch (_) {}
});
window.petAPI.onSay((t) => say(t));
vid.addEventListener('ended', idle);
idle();