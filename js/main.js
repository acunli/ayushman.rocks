(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;

  const mouse = { x: innerWidth / 2, y: innerHeight / 2, nx: 0.5, ny: 0.5 };
  addEventListener('pointermove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.nx = e.clientX / innerWidth; mouse.ny = e.clientY / innerHeight;
  }, { passive: true });

  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------- text splitting ---------- */
  $$('[data-split]').forEach(el => {
    const mode = el.dataset.split;
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    let i = 0;
    words.forEach((w, wi) => {
      const word = document.createElement('span');
      word.className = 'sp-line';
      word.style.display = 'inline-block';
      if (mode === 'chars') {
        [...w].forEach(ch => {
          const c = document.createElement('span');
          c.className = 'sp-char';
          c.textContent = ch;
          c.style.transitionDelay = `${i++ * 0.035}s`;
          word.appendChild(c);
        });
      } else {
        const c = document.createElement('span');
        c.className = 'sp-word';
        c.textContent = w;
        c.style.transitionDelay = `${wi * 0.028}s`;
        word.appendChild(c);
      }
      el.appendChild(word);
      if (wi < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  });

  /* ---------- grain ---------- */
  const grain = $('#grain');
  if (grain) {
    const c = document.createElement('canvas');
    const S = 220;
    c.width = c.height = S;
    const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    for (let p = 0; p < img.data.length; p += 4) {
      const v = Math.random() * 255;
      img.data[p] = img.data[p + 1] = img.data[p + 2] = v;
      img.data[p + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    grain.style.backgroundImage = `url(${c.toDataURL()})`;
  }

  /* ---------- WebGL shader backgrounds ---------- */
  const FRAG = `
    precision highp float;
    uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uVel; uniform float uMode;
    vec2 hash(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return -1.+2.*fract(sin(p)*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
      return mix(mix(dot(hash(i),f),dot(hash(i+vec2(1,0)),f-vec2(1,0)),u.x),
                 mix(dot(hash(i+vec2(0,1)),f-vec2(0,1)),dot(hash(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y);}
    float fbm(vec2 p){float v=0.,a=.5;mat2 r=mat2(.8,.6,-.6,.8);for(int i=0;i<5;i++){v+=a*noise(p);p=r*p*2.02;a*=.5;}return v;}
    void main(){
      vec2 uv=gl_FragCoord.xy/uRes; vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;
      float t=uTime*.07;
      vec2 m=(uMouse-.5)*vec2(uRes.x/uRes.y,-1.);
      float md=length(p-m);
      vec2 q=vec2(fbm(p*1.6+t),fbm(p*1.6-t+3.1));
      vec2 r=vec2(fbm(p*2.2+q*2.4+vec2(1.7,9.2)+t*1.3),fbm(p*2.2+q*2.4+vec2(8.3,2.8)-t));
      r+=.35*exp(-md*3.2)*vec2(sin(uTime*.9),cos(uTime*.7));
      float f=fbm(p*1.8+r*2.6+uVel*.02);
      vec3 ink=vec3(.031,.031,.039);
      vec3 acid=vec3(1.,.5,0.);
      vec3 flame=vec3(.85,.22,.02);
      vec3 col=ink;
      float a=smoothstep(.05,.62,f+.18*length(q));
      float b=smoothstep(.25,.9,length(r)*.8);
      col=mix(col,acid*.55,a*.55);
      col=mix(col,flame*.6,b*.35*(uMode>.5?1.2:.8));
      float lines=smoothstep(.48,.5,abs(fract(f*9.-uTime*.05)-.5));
      col+=acid*lines*.05*a;
      col+=acid*.18*exp(-md*5.);
      float vig=smoothstep(1.25,.25,length(uv-.5)*1.6);
      col*=vig;
      gl_FragColor=vec4(col,1.);
    }`;
  const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

  function shader(canvas, mode) {
    if (!canvas) return null;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = n => gl.getUniformLocation(prog, n);
    const U = { res: u('uRes'), time: u('uTime'), mouse: u('uMouse'), vel: u('uVel'), mode: u('uMode') };
    const sm = { x: .5, y: .5 };
    let visible = true;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
    const resize = () => {
      const dpr = Math.min(devicePixelRatio, 1.5) * 0.6;
      canvas.width = Math.max(1, canvas.clientWidth * dpr);
      canvas.height = Math.max(1, canvas.clientHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    addEventListener('resize', resize);
    return (time, vel) => {
      if (!visible) return;
      const rect = canvas.getBoundingClientRect();
      sm.x = lerp(sm.x, (mouse.x - rect.left) / rect.width, .05);
      sm.y = lerp(sm.y, (mouse.y - rect.top) / rect.height, .05);
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform1f(U.time, time);
      gl.uniform2f(U.mouse, sm.x, sm.y);
      gl.uniform1f(U.vel, vel);
      gl.uniform1f(U.mode, mode);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
  }
  const drawHero = shader($('#heroGL'), 0);
  const drawContact = shader($('#contactGL'), 1);

  /* ---------- loader canvas (falling code glyphs) ---------- */
  const lc = $('#loaderCanvas');
  let loaderRAF;
  if (lc) {
    const c = lc.getContext('2d');
    const glyphs = '01{}<>/=;()[]#$&*+ACUSHMN';
    let cols, drops, fs = 14;
    const size = () => {
      lc.width = innerWidth; lc.height = innerHeight;
      cols = Math.ceil(innerWidth / fs);
      drops = Array.from({ length: cols }, () => Math.random() * -60);
    };
    size();
    const tick = () => {
      c.fillStyle = 'rgba(8,8,10,.16)';
      c.fillRect(0, 0, lc.width, lc.height);
      c.font = `${fs}px JetBrains Mono, monospace`;
      for (let i = 0; i < cols; i++) {
        const ch = glyphs[(Math.random() * glyphs.length) | 0];
        c.fillStyle = Math.random() > .97 ? '#FF8000' : 'rgba(237,235,228,.22)';
        c.fillText(ch, i * fs, drops[i] * fs);
        if (drops[i] * fs > lc.height && Math.random() > .975) drops[i] = 0;
        drops[i] += .55;
      }
      loaderRAF = requestAnimationFrame(tick);
    };
    tick();
  }

  /* ---------- preloader ---------- */
  const loader = $('#loader');
  const lname = $('#loaderName');
  const scramble = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&$@01';
  const target = lname.textContent;
  lname.textContent = '';
  const lspans = [...target].map((ch, i) => {
    const s = document.createElement('span');
    s.textContent = ch;
    lname.appendChild(s);
    s.animate(
      [{ transform: 'translateY(110%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
      { duration: 900, delay: 250 + i * 55, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' }
    );
    return s;
  });

  let progress = 0;
  const countEl = $('#loaderCount'), statusEl = $('#loaderStatus');
  const lights = $$('#lights .light');
  const statuses = ['WARMING UP TYRES', 'ENGINE ON', 'FORMATION LAP', 'ON THE GRID', 'GRID READY'];
  const imgReady = new Promise(res => {
    const im = $('#heroImg');
    if (im.complete) res(); else { im.onload = res; im.onerror = res; }
  });
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  let assetsDone = false;
  Promise.all([imgReady, fontsReady]).then(() => { assetsDone = true; });

  const loadStep = () => {
    const cap = assetsDone ? 100 : 78;
    progress = Math.min(cap, progress + (assetsDone ? 1.6 : Math.random() * 1.5));
    const p = Math.floor(progress);
    countEl.textContent = String(p).padStart(3, '0');
    const lit = Math.min(5, Math.floor(p / 20));
    lights.forEach((l, i) => l.classList.toggle('on', i < lit));
    statusEl.textContent = statuses[Math.min(4, Math.max(0, lit - 1))];
    lspans.forEach((s, i) => {
      const settle = (i + 1) / lspans.length * 100;
      s.textContent = p >= settle ? target[i] : scramble[(Math.random() * scramble.length) | 0];
    });
    if (p >= 100) return finishLoad();
    setTimeout(loadStep, reduced ? 5 : 30);
  };
  setTimeout(loadStep, 400);

  const hero = $('#home');
  function finishLoad() {
    const hold = reduced ? 0 : 700 + Math.random() * 500;
    setTimeout(() => {
      $('#lights').classList.add('out');
      loader.classList.add('is-go');
      setTimeout(() => {
        loader.classList.add('is-done', 'is-gone');
        setTimeout(() => {
          document.body.classList.remove('is-loading');
          hero.classList.add('is-in');
          $$('.hero [data-split]').forEach(el => el.classList.add('split-in'));
          $$('.hero .reveal').forEach(el => setTimeout(() => el.classList.add('in'), 900));
        }, 550);
        setTimeout(() => { cancelAnimationFrame(loaderRAF); loader.remove(); }, 1600);
      }, reduced ? 0 : 650);
    }, hold);
  }

  /* ---------- reveals ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      if (el.hasAttribute('data-split')) el.classList.add('split-in');
      else if (el.hasAttribute('data-count')) countUp(el);
      else el.classList.add('in');
      io.unobserve(el);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
  $$('[data-split]:not(.hero [data-split]), .reveal:not(.hero .reveal), [data-count]').forEach(el => io.observe(el));

  function countUp(el) {
    const end = +el.dataset.count, suf = el.dataset.suffix || '', pre = el.dataset.prefix || '';
    const start = 0;
    const dur = 1600, t0 = performance.now();
    const step = now => {
      const k = clamp((now - t0) / dur, 0, 1);
      const eased = 1 - Math.pow(1 - k, 4);
      el.textContent = pre + Math.round(start + (end - start) * eased).toLocaleString('en-US') + suf;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- cursor ---------- */
  const cursor = $('#cursor');
  const ring = cursor && $('.cursor__ring', cursor);
  const dot = cursor && $('.cursor__dot', cursor);
  const ctext = cursor && $('.cursor__text', cursor);
  const cpos = { x: mouse.x, y: mouse.y };
  if (fine && cursor) {
    document.addEventListener('pointerover', e => {
      const t = e.target.closest('[data-cursor], a, button, input, textarea');
      cursor.classList.remove('is-hover', 'is-view');
      ctext.textContent = '';
      if (!t) return;
      if (t.matches('input, textarea')) return;
      if (t.dataset.cursor === 'view') { cursor.classList.add('is-view'); ctext.textContent = 'Explore'; }
      else cursor.classList.add('is-hover');
    });
    addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    addEventListener('pointerup', () => cursor.classList.remove('is-down'));
    document.addEventListener('mouseleave', () => cursor.style.opacity = 0);
    document.addEventListener('mouseenter', () => cursor.style.opacity = 1);
  }

  /* ---------- magnetic ---------- */
  if (fine) {
    $$('.magnetic').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * .28}px, ${dy * .38}px)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transition = 'transform .7s cubic-bezier(.22,1,.36,1)';
        el.style.transform = '';
        setTimeout(() => el.style.transition = '', 700);
      });
    });
  }

  /* ---------- project card glow + tilt ---------- */
  $$('.proj').forEach(card => {
    const glow = $('.proj__glow', card);
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (glow) { glow.style.left = x + 'px'; glow.style.top = y + 'px'; }
      const rx = (y / r.height - .5) * -8, ry = (x / r.width - .5) * 10;
      card.style.transform = `translateY(-8px) perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });

  /* ---------- HUD: clock + speed ---------- */
  const clockEl = $('#clock');
  const clockFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const tickClock = () => { clockEl.textContent = clockFmt.format(new Date()) + ' SGT'; };
  tickClock(); setInterval(tickClock, 1000);

  const speedEl = $('#speed'), spark = $('#spark');
  const sctx = spark.getContext('2d');
  const hist = new Array(60).fill(0);
  let lastMx = mouse.x, lastMy = mouse.y, speedV = 0;
  const drawSpark = () => {
    sctx.clearRect(0, 0, spark.width, spark.height);
    sctx.beginPath();
    hist.forEach((v, i) => {
      const x = i / (hist.length - 1) * spark.width;
      const y = spark.height - 2 - (v / 340) * (spark.height - 4);
      i ? sctx.lineTo(x, y) : sctx.moveTo(x, y);
    });
    sctx.strokeStyle = '#FF8000'; sctx.lineWidth = 1.5; sctx.stroke();
    sctx.lineTo(spark.width, spark.height); sctx.lineTo(0, spark.height); sctx.closePath();
    sctx.fillStyle = 'rgba(255,128,0,.12)'; sctx.fill();
  };

  /* ---------- pit wall: GitHub contributions ---------- */
  const pitwall = $('#pitwall');
  const renderContributions = data => {
    const days = data.days;
    if (!days || !days.length) return;
    const parse = d => new Date(d + 'T00:00:00Z');
    const fmt = (d, opts) => parse(d).toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });
    const plural = n => `${n} contribution${n === 1 ? '' : 's'}`;
    const tipText = d => `<b>${plural(d.count)}</b> · ${fmt(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}`;

    const map = $('#contribMap');
    const offset = (parse(days[0].date).getUTCDay() + 6) % 7;
    for (let i = 0; i < offset; i++) map.insertAdjacentHTML('beforeend', '<span class="cell cell--pad"></span>');
    days.forEach((d, i) => {
      const cell = document.createElement('span');
      cell.className = 'cell' + (i === days.length - 1 ? ' cell--today' : '');
      cell.dataset.l = d.level;
      cell.dataset.tip = tipText(d);
      cell.style.transitionDelay = `${(offset + i) * 0.018}s`;
      map.appendChild(cell);
    });
    map.setAttribute('aria-label', `${data.total} GitHub contributions in the last ${days.length} days`);

    const first = days[0].date, last = days[days.length - 1].date;
    $('#contribRange').textContent = `${fmt(first, { day: 'numeric', month: 'short' })} — ${fmt(last, { day: 'numeric', month: 'short', year: 'numeric' })}`;

    const active = days.filter(d => d.count > 0).length;
    const best = days.reduce((a, b) => (b.count > a.count ? b : a), days[0]);
    let longest = 0, run = 0;
    days.forEach(d => { run = d.count > 0 ? run + 1 : 0; longest = Math.max(longest, run); });
    let current = 0;
    const tail = days[days.length - 1].count > 0 ? days.length - 1 : days.length - 2;
    for (let i = tail; i >= 0 && days[i].count > 0; i--) current++;

    const stats = [
      ['Contributions', data.total, ''],
      ['Active days', active, `/ ${days.length}`],
      ['Best day', best.count, best.count ? fmt(best.date, { day: 'numeric', month: 'short' }) : ''],
      ['Longest streak', longest, longest === 1 ? 'day' : 'days'],
    ];
    $('#contribStats').innerHTML = stats
      .map(([label, value, note]) => `<div><dt>${label}</dt><dd data-to="${value}">0${note ? `<small>${note}</small>` : ''}</dd></div>`)
      .join('');

    const max = Math.max(1, ...days.map(d => d.count));
    const bars = $('#contribBars');
    days.forEach((d, i) => {
      const bar = document.createElement('span');
      bar.className = 'bar' + (d.count ? '' : ' bar--zero');
      if (d.count) bar.style.setProperty('--h', `${Math.max(4, (d.count / max) * 100)}%`);
      bar.dataset.tip = tipText(d);
      bar.style.transitionDelay = `${i * 0.025}s`;
      bars.appendChild(bar);
    });

    const updated = new Date(data.generatedAt);
    const breakdown = data.breakdown || {};
    $('#contribUpdated').innerHTML =
      `<span>${breakdown.commits ?? 0} commits · ${breakdown.pullRequests ?? 0} PRs · ${data.restricted ?? 0} in private repos</span>` +
      `<span>Updated ${updated.toLocaleString('en-GB', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} SGT</span>`;

    const tip = $('#contribTip');
    pitwall.addEventListener('pointerover', e => {
      const t = e.target.closest('[data-tip]');
      if (!t) { tip.classList.remove('on'); return; }
      tip.innerHTML = t.dataset.tip;
      tip.classList.add('on');
    });
    pitwall.addEventListener('pointermove', e => { tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px'; });
    pitwall.addEventListener('pointerleave', () => tip.classList.remove('on'));

    pitwall.hidden = false;
    new IntersectionObserver(([entry], obs) => {
      if (!entry.isIntersecting) return;
      pitwall.classList.add('is-live');
      $$('#contribStats dd').forEach(dd => {
        const to = +dd.dataset.to, t0 = performance.now();
        const step = now => {
          const k = clamp((now - t0) / 1400, 0, 1);
          dd.firstChild.textContent = Math.round(to * (1 - Math.pow(1 - k, 4)));
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      obs.disconnect();
    }, { threshold: 0.25 }).observe(pitwall);
  };
  fetch('data/contributions.json', { cache: 'no-cache' })
    .then(r => (r.ok ? r.json() : Promise.reject()))
    .then(renderContributions)
    .catch(() => {});

  /* ---------- nav / menu ---------- */
  const nav = $('#nav'), menu = $('#menu'), burger = $('#burger');
  const toggleMenu = open => {
    document.body.classList.toggle('menu-open', open);
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', !open);
    burger.setAttribute('aria-expanded', open);
  };
  burger.addEventListener('click', () => toggleMenu(!menu.classList.contains('is-open')));

  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const el = id.length > 1 && $(id);
    if (!el) return;
    e.preventDefault();
    toggleMenu(false);
    scrollTo({ top: el.getBoundingClientRect().top + scrollY, behavior: 'smooth' });
  }));

  /* ---------- copy email ---------- */
  const mc = $('#mailCopy');
  mc.addEventListener('click', async () => {
    const hint = $('.mailcopy__hint', mc);
    try {
      await navigator.clipboard.writeText(mc.dataset.mail);
      hint.textContent = 'Copied to clipboard ✓';
    } catch {
      location.href = 'mailto:' + mc.dataset.mail;
      hint.textContent = 'Opening mail app…';
    }
    mc.classList.add('copied');
    setTimeout(() => { hint.textContent = 'Click to copy'; mc.classList.remove('copied'); }, 2200);
  });

  /* ---------- contact form ---------- */
  const form = $('#contactForm'), note = $('#formNote');
  const FORM_ENDPOINT = '';
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fields = $$('input, textarea', form);
    let ok = true;
    fields.forEach(f => {
      const bad = !f.value.trim() || (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value));
      f.closest('.field').classList.toggle('err', bad);
      if (bad) ok = false;
    });
    note.classList.toggle('err', !ok);
    if (!ok) { note.textContent = 'Fill in all fields with a valid email.'; return; }

    const data = Object.fromEntries(new FormData(form));
    if (FORM_ENDPOINT) {
      note.textContent = 'Sending…';
      try {
        const r = await fetch(FORM_ENDPOINT, {
          method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!r.ok) throw 0;
        note.textContent = 'Sent. I\'ll get back to you soon ✓';
        form.reset();
      } catch {
        note.classList.add('err');
        note.textContent = 'Something broke — email me directly instead.';
      }
      return;
    }
    const subject = encodeURIComponent(`Hello from ${data.name}`);
    const body = encodeURIComponent(`${data.message}\n\n— ${data.name} (${data.email})`);
    location.href = `mailto:ayushman.chaudhuri@gmail.com?subject=${subject}&body=${body}`;
    note.textContent = 'Opening your mail app ✓';
  });

  /* ---------- scroll-driven engine ---------- */
  const work = $('#work'), workPin = $('#workPin'), workTrack = $('#workTrack'), workProg = $('#workProg');
  const heroBack = $('.hero__back'), heroName = $('.hero__name'), heroDriver = $('.hero__driver');
  const heroFront = $('.hero__front'), heroSurname = $('.hero__surname'), heroNumber = $('.hero__number');
  const hudL = $('.hud--l'), hudR = $('.hud--r'), heroScroll = $('.hero__scroll');
  const ticker = $('#ticker');
  const marquees = $$('.marquee__track');
  const megas = $$('.mega, .contact__title');
  const isMobile = () => innerWidth <= 760;

  const sizeWork = () => {
    if (isMobile()) { work.style.height = ''; return; }
    const dist = workTrack.scrollWidth - innerWidth;
    work.style.height = (innerHeight + Math.max(0, dist)) + 'px';
  };
  sizeWork();
  addEventListener('resize', sizeWork);
  addEventListener('load', sizeWork);

  let lastY = scrollY, vel = 0, smoothVel = 0, tickX = 0, marqX = 0, navY = 0, workX = 0;
  const hp = { x: 0, y: 0 };

  const frame = now => {
    const t = now / 1000;
    const y = scrollY;
    vel = y - lastY; lastY = y;
    smoothVel = lerp(smoothVel, vel, .1);

    if (fine && cursor) {
      cpos.x = lerp(cpos.x, mouse.x, .16);
      cpos.y = lerp(cpos.y, mouse.y, .16);
      dot.style.transform = `translate(${mouse.x - 3.5}px, ${mouse.y - 3.5}px)`;
      ring.style.left = cpos.x + 'px';
      ring.style.top = cpos.y + 'px';
    }

    if (!reduced) {
      drawHero && drawHero(t, smoothVel);
      drawContact && drawContact(t, smoothVel);

      const heroK = clamp(y / innerHeight, 0, 1);
      hp.x = lerp(hp.x, (mouse.nx - .5), .06);
      hp.y = lerp(hp.y, (mouse.ny - .5), .06);
      if (y < innerHeight * 1.2) {
        hero.style.setProperty('--mx', hp.x.toFixed(4));
        hero.style.setProperty('--my', hp.y.toFixed(4));
        heroBack.style.transform = `translate3d(${hp.x * 50}px, ${y * .45 + hp.y * 18}px, 0)`;
        heroName.style.letterSpacing = `${-.005 + heroK * .12}em`;
        heroDriver.style.transform =
          `translateX(calc(-50% + ${hp.x * -22}px)) translateY(${y * .1 + hp.y * -8}px) scale(${1 + heroK * .22})`;
        heroFront.style.transform = `translate3d(${hp.x * -60}px, ${y * -.25 + hp.y * -20}px, 0)`;
        heroFront.style.opacity = 1 - heroK * 2;
        heroSurname.style.transform = `translate3d(${hp.x * 30 + y * .5}px, ${y * .3}px, 0)`;
        heroNumber.style.transform = `translate3d(${hp.x * 20}px, ${y * .6}px, 0)`;
        hudL.style.opacity = hudR.style.opacity = heroScroll.style.opacity = clamp(1 - heroK * 3, 0, 1);
      }

      const mspeed = Math.hypot(mouse.x - lastMx, mouse.y - lastMy);
      lastMx = mouse.x; lastMy = mouse.y;
      speedV = lerp(speedV, Math.min(340, Math.abs(vel) * 6 + mspeed * 2.2), .08);
      hist.push(speedV); hist.shift();
      if ((now | 0) % 2 === 0) {
        speedEl.textContent = String(Math.round(speedV)).padStart(3, '0');
        drawSpark();
      }

      const dir = smoothVel >= 0 ? 1 : -1;
      tickX -= (1.2 + Math.abs(smoothVel) * .35) * dir;
      const tw = ticker.scrollWidth / 2;
      if (tickX <= -tw) tickX += tw;
      if (tickX > 0) tickX -= tw;
      ticker.style.transform = `translate3d(${tickX}px,0,0)`;

      marqX += (0.8 + Math.abs(smoothVel) * .3) * dir;
      marquees.forEach(m => {
        const w = m.scrollWidth / 2;
        const x = ((marqX % w) + w) % w;
        m.style.transform = `translate3d(${x - w}px,0,0)`;
      });

      const skew = clamp(smoothVel * .12, -7, 7);
      megas.forEach(m => m.style.transform = `skewY(${skew * .4}deg)`);
    }

    if (!isMobile()) {
      const r = work.getBoundingClientRect();
      const dist = workTrack.scrollWidth - innerWidth;
      const k = clamp(-r.top / (r.height - innerHeight || 1), 0, 1);
      workX = lerp(workX, -dist * k, reduced ? 1 : .12);
      workTrack.style.transform = `translate3d(${workX}px,0,0)`;
      workProg.style.width = (k * 100) + '%';
    }

    if (!document.body.classList.contains('menu-open')) {
      if (y > innerHeight * .6 && vel > 2) nav.classList.add('is-hidden');
      else if (vel < -2 || y < 80) nav.classList.remove('is-hidden');
    }

    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();
