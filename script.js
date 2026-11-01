(() => {
  const $ = s => document.querySelector(s);
  const screen = $('#screen'), home = $('#home'), appEl = $('#app'), body = $('#appbody'),
    lock = $('#lock'), status = $('#statusbar'), ind = $('#indicator'), island = $('#island');
  let S = 1, current = null, cleanups = [], dm = false;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad = n => String(n).padStart(2, '0');

  /* ---------- Island Notification Animation ---------- */
  function notifyIsland(text, duration = 2000) {
    island.innerHTML = `<span style="font-weight:600">${text}</span><div class="pill-dot"></div>`;
    island.classList.add('expanded');
    setTimeout(() => {
      island.classList.remove('expanded');
      setTimeout(() => island.innerHTML = '', 450);
    }, duration);
  }

  /* ---------- Device Fit (Mobile Optimized) ---------- */
  function fit() {
    if (innerWidth <= 600) {
      S = 1;
      $('#device').style.setProperty('--s', 1);
      return;
    }
    S = Math.min(innerHeight * 0.8 / 876, (innerWidth - 16) / 417);
    $('#device').style.setProperty('--s', S);
  }
  addEventListener('resize', fit); fit();

  /* ---------- Clock ---------- */
  function tick() {
    const d = new Date();
    $('#time').textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/ ?[AP]M/i, '');
    $('#ltime').textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: false });
    $('#ldate').textContent = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }
  tick(); setInterval(tick, 1000);

  /* ---------- Shared data ---------- */
  const photos = Array.from({ length: 18 }, (_, i) => {
    const h = (i * 47) % 360;
    return { bg: `linear-gradient(${h}deg,hsl(${h},70%,60%),hsl(${(h + 60) % 360},70%,40%))` };
  });
  const notesData = [{ t: 'Welcome', b: 'Tap + to add a note. Notes stay until you reload the page.' }];
  const walls = ['#ff9a6b 0%,#c94b8a 38%,#3b2a8c 72%,#12183a 100%', '#43cea2,#185a9d', '#f6d365,#fda085', '#3a3d46,#0b0c14'];

  /* ---------- Apps ---------- */
  const apps = [
    { id: 'calc', name: 'Calculator', icon: '🧮', bg: '#ff9f0a', render: calc, dark: true },
    { id: 'notes', name: 'Notes', icon: '📝', bg: '#f7c948', render: notes },
    { id: 'clock', name: 'Clock', icon: '🕒', bg: '#222', render: clock },
    { id: 'photos', name: 'Photos', icon: '🌄', bg: '#fff', render: gallery },
    { id: 'set', name: 'Settings', icon: '⚙️', bg: '#8e8e93', render: settings },
    { id: 'web', name: 'Browser', icon: '🧭', bg: '#2f80ed', render: browser },
    { id: 'cam', name: 'Camera', icon: '📷', bg: '#555', render: camera, dark: true },
    { id: 'maps', name: 'Maps', icon: '🗺️', bg: '#34c759', render: maps },
  ];
  const dockIds = ['web', 'notes', 'calc', 'set'];

  function icon(a, i) {
    const el = document.createElement('div'); el.className = 'ico'; el.style.setProperty('--i', i);
    el.innerHTML = `<div class="tile" style="background:${a.bg}">${a.icon}</div><span>${a.name}</span>`;
    el.onclick = () => open(a, el); return el;
  }
  apps.filter(a => !dockIds.includes(a.id)).forEach((a, i) => $('#grid').append(icon(a, i)));
  dockIds.map(id => apps.find(a => a.id === id)).forEach((a, i) => $('#dock').append(icon(a, i + 4)));

  function bar() { status.classList.toggle('darkText', !!current && !current.dark && !dm); }

  function open(a, el) {
    if (current || lock.classList.contains('off') === false) return;
    current = a; body.innerHTML = ''; a.render(body);
    const sr = screen.getBoundingClientRect(), ir = el.querySelector('.tile').getBoundingClientRect();
    appEl.style.transformOrigin = `${(ir.left + ir.width / 2 - sr.left) / S}px ${(ir.top + ir.height / 2 - sr.top) / S}px`;
    appEl.classList.toggle('force', !!a.dark);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      appEl.classList.add('open'); home.classList.add('away'); bar();
    }));
  }

  function goHome() {
    if (!current) return;
    current = null;
    appEl.style.transition = 'transform .45s cubic-bezier(.175, .885, .32, 1.15), opacity .25s ease';
    appEl.style.transform = '';
    appEl.classList.remove('open');
    home.classList.remove('away');
    bar();
    const c = cleanups; cleanups = []; c.forEach(f => f());
  }

  /* ---------- Unlock & Gesture Animations (iOS 27 Style) ---------- */
  function unlock() {
    lock.style.transition = 'transform .65s var(--spring), opacity .5s ease, filter .5s ease';
    home.style.transition = 'transform .7s var(--spring), opacity .45s ease, filter .45s ease';

    lock.classList.add('off');
    home.classList.add('unlocked');
    home.classList.add('enter');

    setTimeout(() => {
      home.classList.remove('enter');
      home.style.transform = '';
      home.style.opacity = '';
      home.style.filter = '';
    }, 1000);
  }

  function relock() {
    goHome();
    lock.style.transition = 'transform .65s var(--spring), opacity .5s ease, filter .5s ease';
    home.style.transition = 'transform .5s var(--spring), opacity .4s ease, filter .4s ease';
    lock.classList.remove('off');
    home.classList.remove('unlocked');
  }

  let ly = null;
  lock.addEventListener('pointerdown', e => {
    ly = e.clientY;
    lock.style.transition = 'none';
    home.style.transition = 'none';
    lock.setPointerCapture(e.pointerId);
  });

  lock.addEventListener('pointermove', e => {
    if (ly === null) return;
    const d = (e.clientY - ly) / S;
    const dragY = Math.min(0, d);

    lock.style.transform = `translateY(${dragY}px)`;

    const progress = Math.min(1, Math.abs(dragY) / 350);
    lock.style.opacity = `${1 - (progress * 0.5)}`;
    lock.style.filter = `blur(${progress * 10}px)`;

    home.style.transform = `scale(${0.8 + (0.2 * progress)})`;
    home.style.opacity = `${progress}`;
    home.style.filter = `blur(${15 - (15 * progress)}px)`;
  });

  lock.addEventListener('pointerup', e => {
    if (ly === null) return;
    const d = (e.clientY - ly) / S; ly = null;

    lock.style.transition = '';
    lock.style.transform = '';
    lock.style.opacity = '';
    lock.style.filter = '';

    home.style.transition = '';

    if (d < -110) {
      unlock();
    } else {
      if (Math.abs(d) < 6) {
        lock.classList.remove('bounce'); void lock.offsetWidth; lock.classList.add('bounce');
      }
      home.style.transform = '';
      home.style.opacity = '';
      home.style.filter = '';
    }
  });

  $('#power').onclick = () => lock.classList.contains('off') ? relock() : unlock();

  /* ---------- Home indicator: drag up in an app to go home ---------- */
  let iy = null;
  ind.addEventListener('pointerdown', e => { iy = e.clientY; ind.setPointerCapture(e.pointerId); });
  ind.addEventListener('pointermove', e => {
    if (iy === null || !current) return;
    const d = Math.max(0, (iy - e.clientY) / S);
    appEl.style.transition = 'none';
    appEl.style.transform = `scale(${Math.max(.4, 1 - d / 450)}) translateY(${-d * .3}px)`;
  });
  ind.addEventListener('pointerup', e => {
    if (iy === null) return;
    const d = (iy - e.clientY) / S; iy = null;
    appEl.style.transition = ''; appEl.style.transform = '';
    if (!lock.classList.contains('off')) return unlock();
    if (d > 65 || Math.abs(d) < 6) goHome();
  });

  addEventListener('keydown', e => {
    if (e.key === 'Escape') goHome();
    if (e.key === 'Enter' && !lock.classList.contains('off')) unlock();
  });

  /* ---------- Calculator with Number Bump ---------- */
  function calc(el) {
    el.innerHTML = `<div class="calc"><div class="disp">0</div><div class="keys"></div></div>`;
    const d = el.querySelector('.disp'), k = el.querySelector('.keys');
    const keys = [['AC', 'fn'], ['±', 'fn'], ['%', 'fn'], ['÷', 'op'], 7, 8, 9, ['×', 'op'], 4, 5, 6, ['−', 'op'], 1, 2, 3, ['+', 'op'], ['0', 'z'], '.', ['=', 'op']];
    let cur = '0', prev = null, op = null, fresh = true, opBtn = null;
    const run = () => { const a = +prev, b = +cur; return { '+': a + b, '−': a - b, '×': a * b, '÷': b ? a / b : 'Error' }[op]; };

    const triggerBump = () => {
      d.classList.remove('bump');
      void d.offsetWidth;
      d.classList.add('bump');
    };

    keys.forEach(x => {
      const [l, c] = Array.isArray(x) ? x : [String(x), ''];
      const b = document.createElement('button'); b.textContent = l; b.className = c;
      b.onclick = () => {
        triggerBump();
        if (opBtn) opBtn.classList.remove('sel');
        if (/\d/.test(l)) { cur = (fresh || cur === '0') ? l : cur + l; fresh = false; }
        else if (l === '.') { if (fresh) cur = '0'; if (!cur.includes('.')) cur += '.'; fresh = false; }
        else if (l === 'AC') { cur = '0'; prev = op = null; fresh = true; }
        else if (l === '±') cur = String(-cur);
        else if (l === '%') cur = String(cur / 100);
        else if (l === '=') { if (op) { cur = String(run()); op = prev = null; fresh = true; } }
        else { if (op && !fresh) cur = String(run()); prev = cur; op = l; fresh = true; opBtn = b; b.classList.add('sel'); }
        if (cur !== 'Error' && cur !== '0.' && !cur.endsWith('.')) cur = String(+parseFloat(cur).toPrecision(10));
        d.textContent = cur.length > 9 ? (+cur).toExponential(3) : cur;
      };
      k.append(b);
    });
  }

  /* ---------- Notes ---------- */
  function notes(el) {
    const list = () => {
      el.innerHTML = `<div class="title">Notes <button class="plus">+</button></div><div class="group" id="nl"></div>`;
      const nl = el.querySelector('#nl');
      if (!notesData.length) nl.innerHTML = '<div class="row" style="color:#888">No notes yet. Tap + to add one.</div>';
      notesData.forEach((n, i) => {
        const r = document.createElement('div'); r.className = 'row';
        r.innerHTML = `<b>${esc(n.t || 'New note')}</b><span style="color:#888;font-size:13px">${esc(n.b.slice(0, 16))}</span>`;
        r.onclick = () => edit(i); nl.append(r);
      });
      el.querySelector('.plus').onclick = () => { notesData.unshift({ t: '', b: '' }); edit(0); };
    };
    const edit = i => {
      const n = notesData[i];
      el.innerHTML = `<div class="bar"><button class="link" id="nb">‹ Notes</button><button class="link" id="nd">Delete</button></div>
      <input class="ntitle" placeholder="Title" value="${esc(n.t)}"><textarea placeholder="Start typing…">${esc(n.b)}</textarea><div style="height:12px"></div>`;
      el.querySelector('.ntitle').oninput = e => n.t = e.target.value;
      el.querySelector('textarea').oninput = e => n.b = e.target.value;
      el.querySelector('#nb').onclick = () => { if (!n.t && !n.b) notesData.splice(i, 1); list(); };
      el.querySelector('#nd').onclick = () => { notesData.splice(i, 1); list(); };
    };
    list();
  }

  /* ---------- Clock / Stopwatch / Timer ---------- */
  function clock(el) {
    el.innerHTML = `<div class="title">Clock</div><div class="seg"><button class="on" data-t="c">Clock</button>
    <button data-t="s">Stopwatch</button><button data-t="t">Timer</button></div><div class="cv"></div>`;
    const cv = el.querySelector('.cv'); let stop = () => { };
    const views = {
      c() {
        cv.innerHTML = `<div class="analog"><i class="h"></i><i class="m"></i><i class="s"></i></div><div class="big" style="font-size:44px"></div>`;
        const [h, m, s] = cv.querySelectorAll('.analog i'), t = cv.querySelector('.big');
        const upd = () => {
          const d = new Date(), sec = d.getSeconds(), min = d.getMinutes() + sec / 60;
          s.style.transform = `rotate(${sec * 6}deg)`;
          m.style.transform = `rotate(${min * 6}deg)`;
          h.style.transform = `rotate(${(d.getHours() % 12 + min / 60) * 30}deg)`;
          t.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(sec)}`;
        };
        upd(); const id = setInterval(upd, 1000); return () => clearInterval(id);
      },
      s() {
        cv.innerHTML = `<div class="big">00:00.00</div><div class="btns"><button class="round grey">Reset</button><button class="round">Start</button></div>`;
        const disp = cv.querySelector('.big'), [rs, go] = cv.querySelectorAll('button');
        let t0 = 0, el0 = 0, id = null;
        const show = ms => disp.textContent = `${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms / 1000) % 60)}.${pad(Math.floor(ms / 10) % 100)}`;
        go.onclick = () => {
          if (id) {
            clearInterval(id); id = null; el0 += Date.now() - t0;
            go.textContent = 'Start'; go.classList.remove('red');
          } else {
            t0 = Date.now(); id = setInterval(() => show(el0 + Date.now() - t0), 30);
            go.textContent = 'Stop'; go.classList.add('red');
          }
        };
        rs.onclick = () => { clearInterval(id); id = null; el0 = 0; show(0); go.textContent = 'Start'; go.classList.remove('red'); };
        return () => clearInterval(id);
      },
      t() {
        cv.innerHTML = `<input class="numin" type="number" min="1" max="99" value="1"><div style="color:#888;margin-top:-12px">minutes</div>
        <div class="big" style="display:none"></div><button class="round">Start</button>`;
        const inp = cv.querySelector('input'), disp = cv.querySelector('.big'), go = cv.querySelector('button'); let id = null, end = 0;
        go.onclick = () => {
          if (id) { clearInterval(id); id = null; inp.style.display = ''; cv.children[1].style.display = ''; disp.style.display = 'none'; go.textContent = 'Start'; go.classList.remove('red'); return; }
          end = Date.now() + Math.max(1, +inp.value || 1) * 60000;
          inp.style.display = 'none'; cv.children[1].style.display = 'none'; disp.style.display = ''; go.textContent = 'Cancel'; go.classList.add('red');
          notifyIsland('Timer Started');
          const upd = () => {
            const left = Math.max(0, end - Date.now());
            disp.textContent = `${pad(Math.floor(left / 60000))}:${pad(Math.ceil(left / 1000) % 60)}`;
            if (!left) {
              clearInterval(id); id = null;
              disp.textContent = "Time's up"; disp.style.fontSize = '40px';
              go.textContent = 'Done';
              notifyIsland("Timer Completed!");
            }
          };
          upd(); id = setInterval(upd, 250);
        };
        return () => clearInterval(id);
      }
    };
    el.querySelectorAll('.seg button').forEach(b => b.onclick = () => {
      stop(); el.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x === b)); stop = views[b.dataset.t]();
    });
    stop = views.c(); cleanups.push(() => stop());
  }

  /* ---------- Photos Viewer Zoom ---------- */
  function gallery(el) {
    el.innerHTML = `<div class="title">Photos</div><div class="photos"></div>
    <div class="viewer"><div class="pic"></div><div class="vbar"><button id="pv">‹</button><button id="cl">Close</button><button id="nx">›</button></div></div>`;
    const grid = el.querySelector('.photos'), vw = el.querySelector('.viewer'), pic = vw.querySelector('.pic'); let idx = 0;
    photos.forEach((p, i) => {
      const d = document.createElement('div'); d.style.background = p.bg;
      d.onclick = () => {
        idx = i; pic.style.background = p.bg;
        const r = d.getBoundingClientRect(), br = el.getBoundingClientRect();
        vw.style.transformOrigin = `${(r.left + r.width / 2 - br.left) / S}px ${(r.top + r.height / 2 - br.top) / S}px`;
        vw.classList.add('show');
      };
      grid.append(d);
    });
    const go = n => { idx = (idx + n + photos.length) % photos.length; pic.style.background = photos[idx].bg; };
    vw.querySelector('#pv').onclick = () => go(-1); vw.querySelector('#nx').onclick = () => go(1);
    vw.querySelector('#cl').onclick = () => vw.classList.remove('show');
  }

  /* ---------- Camera with Pop & Island Alert ---------- */
  function camera(el) {
    el.innerHTML = `<div class="cam"><video autoplay playsinline muted></video><div class="flash"></div>
    <div class="camerr" hidden>Camera access is blocked or unavailable.<br>The shutter still saves a sample photo to Photos.</div>
    <div class="shutterbar"><div class="thumb"></div><button class="shutter"></button><span style="width:50px"></span></div></div>`;
    const v = el.querySelector('video'), fl = el.querySelector('.flash'), th = el.querySelector('.thumb'), er = el.querySelector('.camerr'); let stream = null;
    if (photos[0]) th.style.background = photos[0].bg;
    (navigator.mediaDevices?.getUserMedia ? navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } }) : Promise.reject())
      .then(s => { stream = s; v.srcObject = s; }).catch(() => er.hidden = false);
    cleanups.push(() => stream && stream.getTracks().forEach(t => t.stop()));

    el.querySelector('.shutter').onclick = () => {
      fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
      let bg;
      if (stream && v.videoWidth) {
        const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
        const x = c.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(v, 0, 0);
        bg = `url(${c.toDataURL('image/jpeg', .8)}) center/cover`;
      } else {
        const h = Math.floor(Math.random() * 360);
        bg = `linear-gradient(${h}deg,hsl(${h},70%,60%),hsl(${(h + 60) % 360},70%,40%))`;
      }
      photos.unshift({ bg });
      th.style.background = bg;
      th.classList.remove('updated'); void th.offsetWidth; th.classList.add('updated');
      notifyIsland('Photo Captured');
    };
  }

  /* ---------- Settings with Interactive Triggers ---------- */
  function settings(el) {
    el.innerHTML = `<div class="title">Settings</div>
  <div class="group">
    <div class="row">Dark mode <input class="sw" type="checkbox" id="dk"></div>
    <div class="row">Airplane mode <input class="sw" type="checkbox" id="ap"></div>
    <div class="row">Brightness <input type="range" id="br" min="40" max="100" value="${parseInt(screen.style.filter.replace(/\D/g, '')) || 100}"></div>
  </div>
  <div class="group"><div class="row" style="cursor:default"><span>Wallpaper</span><span id="ws" style="display:flex;gap:8px"></span></div></div>
  <div class="group"><div class="row" style="cursor:default"><span>Model</span><span style="color:#888">Simulator Pro</span></div></div>`;
    const dk = el.querySelector('#dk'), ap = el.querySelector('#ap');
    dk.checked = dm; ap.checked = screen.classList.contains('air');
    dk.onchange = () => { dm = dk.checked; screen.classList.toggle('dm', dm); bar(); };
    ap.onchange = () => {
      screen.classList.toggle('air', ap.checked);
      notifyIsland(ap.checked ? 'Airplane Mode On' : 'Airplane Mode Off');
    };
    el.querySelector('#br').oninput = e => screen.style.filter = `brightness(${e.target.value}%)`;
    walls.forEach(w => {
      const b = document.createElement('button');
      b.style.cssText = `width:32px;height:32px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #bbb;cursor:pointer;background:linear-gradient(160deg,${w});transition:transform .2s;`;
      b.onmouseover = () => b.style.transform = 'scale(1.15)';
      b.onmouseout = () => b.style.transform = 'scale(1)';
      b.onclick = () => {
        screen.style.setProperty('--wall', `linear-gradient(160deg,${w})`);
        notifyIsland('Wallpaper Updated');
      };
      el.querySelector('#ws').append(b);
    });
  }

  /* ---------- Browser ---------- */
  function browser(el) {
    el.innerHTML = `<div class="title">Browser</div>
    <div class="urlrow"><input class="urlin" placeholder="Enter a web address"><button class="gobtn">Go</button></div>
    <div class="chips"><button data-u="https://en.m.wikipedia.org">Wikipedia</button><button data-u="https://example.com">Example</button>
    <button data-u="https://www.openstreetmap.org">OpenStreetMap</button><button id="ext">Open in new tab ↗</button></div>
    <iframe></iframe>`;
    const f = el.querySelector('iframe'), u = el.querySelector('.urlin'); let last = '';
    const load = v => { v = v.trim(); if (!v) return; if (!/^https?:/.test(v)) v = 'https://' + v; u.value = v; last = v; f.removeAttribute('srcdoc'); f.src = v; };
    f.srcdoc = '<body style="font:15px sans-serif;color:#777;padding:20px;line-height:1.5">Pick a bookmark or type an address.<br><br>Some sites refuse to load inside a frame. If a page stays blank, use “Open in new tab”.</body>';
    el.querySelector('.gobtn').onclick = () => load(u.value);
    u.onkeydown = e => e.key === 'Enter' && load(u.value);
    el.querySelectorAll('.chips button[data-u]').forEach(b => b.onclick = () => load(b.dataset.u));
    el.querySelector('#ext').onclick = () => last && window.open(last, '_blank', 'noopener');
  }

  /* ---------- Maps ---------- */
  function maps(el) {
    const places = {
      'Delhi': ['77.10,28.55,77.30,28.70', '28.6139,77.2090'],
      'London': ['-0.20,51.48,0.00,51.54', '51.5072,-0.1276'],
      'New York': ['-74.05,40.68,-73.90,40.80', '40.7128,-74.0060'],
      'Tokyo': ['139.65,35.65,139.85,35.74', '35.6762,139.6503'],
    };
    el.innerHTML = `<div class="title">Maps</div><div class="chips"></div><iframe></iframe>`;
    const f = el.querySelector('iframe'), chips = el.querySelector('.chips');
    const show = n => {
      const [bb, mk] = places[n];
      f.src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bb)}&layer=mapnik&marker=${encodeURIComponent(mk)}`;
    };
    Object.keys(places).forEach(n => { const b = document.createElement('button'); b.textContent = n; b.onclick = () => show(n); chips.append(b); });
    show('Delhi');
  }
})();
