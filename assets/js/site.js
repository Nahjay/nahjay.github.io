(() => {
  const doc = document;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Footer year */
  const year = doc.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* Nav border on scroll */
  const nav = doc.querySelector('.nav');
  const onScroll = () => nav && nav.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* Reveal on scroll */
  const revealables = doc.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window) || reduce) {
    revealables.forEach((el) => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealables.forEach((el) => io.observe(el));
  }

  /* Active section in nav */
  const links = new Map();
  doc.querySelectorAll('.nav-links a[href^="#"]').forEach((a) => links.set(a.getAttribute('href').slice(1), a));
  if ('IntersectionObserver' in window && links.size) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.remove('active'));
        const a = links.get(e.target.id);
        if (a) a.classList.add('active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach((_, id) => { const s = doc.getElementById(id); if (s) spy.observe(s); });
  }

  /* Card spotlight follows the pointer */
  doc.querySelectorAll('.project').forEach((card) => {
    card.addEventListener('pointermove', (ev) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${ev.clientX - r.left}px`);
      card.style.setProperty('--my', `${ev.clientY - r.top}px`);
    });
  });

  /* Hero timing diagram */
  const svg = doc.getElementById('wave');
  if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const C = 24;            // px per clock cycle
  const N = 48;            // cycles per repeating pattern
  const W = C * N;         // pattern width
  const LH = 34;           // lane height
  const PAD = 9;           // vertical padding in lane
  const S = 4;             // bus slant

  const el = (tag, attrs, parent) => {
    const n = doc.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const runs = (r) => r.flatMap(([n, v]) => Array(n).fill(v));

  svg.setAttribute('width', W * 2);
  svg.setAttribute('viewBox', `0 0 ${W * 2} ${LH * 5}`);

  // lane separators (static)
  for (let i = 1; i < 5; i++) el('line', { x1: 0, x2: W * 2, y1: i * LH + 0.5, y2: i * LH + 0.5, class: 'w-lane' }, svg);

  const track = el('g', { class: 'wave-track' }, svg);
  svg.style.setProperty('--wave-w', `${W}px`);

  const hi = (lane) => lane * LH + PAD;
  const lo = (lane) => (lane + 1) * LH - PAD;

  // clk
  {
    let d = `M0 ${lo(0)}`;
    for (let i = 0; i < N * 2; i++) {
      const x = i * C;
      d += ` L${x} ${hi(0)} L${x + C / 2} ${hi(0)} L${x + C / 2} ${lo(0)} L${x + C} ${lo(0)}`;
    }
    el('path', { d, class: 'w-clk' }, track);
  }

  // binary lanes
  const bin = (lane, vals) => {
    const v = vals.concat(vals);
    const y = (b) => (b ? hi(lane) : lo(lane));
    let d = `M0 ${y(v[0])}`;
    for (let i = 1; i < v.length; i++) {
      if (v[i] !== v[i - 1]) d += ` L${i * C - 1.5} ${y(v[i - 1])} L${i * C + 1.5} ${y(v[i])}`;
    }
    d += ` L${v.length * C} ${y(v[v.length - 1])}`;
    el('path', { d, class: 'w-bin' }, track);
  };
  bin(1, runs([[3, 0], [10, 1], [4, 0], [8, 1], [6, 0], [13, 1], [4, 0]]));
  bin(2, runs([[5, 1], [3, 0], [14, 1], [2, 0], [16, 1], [2, 0], [6, 1]]));

  // bus lanes
  const bus = (lane, segs, cls, txtCls, idle) => {
    const top = hi(lane), bot = lo(lane), mid = (top + bot) / 2;
    for (let copy = 0; copy < 2; copy++) {
      let x = copy * W;
      segs.forEach(([n, label]) => {
        const a = x, b = x + n * C;
        const isIdle = label === idle;
        el('path', {
          d: `M${a} ${mid} L${a + S} ${top} L${b - S} ${top} L${b} ${mid} L${b - S} ${bot} L${a + S} ${bot} Z`,
          class: isIdle ? 'w-bus-idle' : cls,
        }, track);
        const t = el('text', { x: (a + b) / 2, y: mid + 0.5, class: isIdle ? `${txtCls} w-txt-idle` : txtCls }, track);
        t.textContent = isIdle ? 'xx' : label;
        x = b;
      });
    }
  };
  bus(3, [[3, '00'], [2, 'A7'], [3, '3F'], [2, 'C1'], [3, '5E'], [4, '00'], [2, '9B'], [3, 'E2'], [3, '14'], [6, '00'], [3, '7D'], [2, 'F0'], [4, '2A'], [2, 'B8'], [2, '61'], [4, '00']], 'w-bus', 'w-txt', '00');
  bus(4, [[6, '0x0000'], [8, '0x01F4'], [5, '0x03A2'], [9, '0x0FFE'], [7, '0x1C40'], [13, '0x2B9D']], 'w-bus2', 'w-txt2', null);

  // simulated time readout (10 ns clock → 100 MHz)
  const tcount = doc.getElementById('tcount');
  const DUR = 28; // seconds per pattern, matches CSS default
  track.style.setProperty('--wave-dur', `${DUR}s`);
  if (tcount && !reduce) {
    const t0 = performance.now();
    const tick = (now) => {
      const cycles = Math.floor(((now - t0) / 1000) * (N / DUR));
      tcount.textContent = (cycles * 10).toLocaleString('en-US');
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
})();
