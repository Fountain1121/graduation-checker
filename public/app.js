// ---- Edit these to customise wording ----
const CONTACT = 'Please contact the Training and Appointment Directorate for guidance.';
// -----------------------------------------

const $ = (id) => document.getElementById(id);
const ICONS = {
  good: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.500 4.500 4.500L19 7.500"/></svg>',
  bad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v6m0 4h.01"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.500 2"/></svg>',
};
const STATUS = {
  graduated: { tone: 'good', kicker: 'Graduation status', headline: 'Congratulations!', message: 'You have graduated from Foundation School. You met the 50% pass mark in all five subjects.', chip: 'Graduated · Eligible for Graduation' },
  not_eligible: { tone: 'bad', kicker: 'Graduation status', headline: 'Not graduated yet', message: null, chip: 'Not eligible for graduation' },
  incomplete: { tone: 'warn', kicker: 'Graduation status', headline: 'Results incomplete', message: null, chip: 'Awaiting complete results' },
};

const form = $('form'), input = $('sid'), errorEl = $('error'), btn = $('go');

function showError(msg) {
  errorEl.textContent = msg; errorEl.hidden = false;
  const f = input.parentElement; f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
}
input.addEventListener('input', () => { errorEl.hidden = true; });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = input.value.replace(/\s+/g, '');
  if (!/^\d{9}$/.test(id)) return showError('Please enter your 9-digit student ID.');
  btn.classList.add('loading');
  try {
    const res = await fetch('/api/result?id=' + encodeURIComponent(id));
    const data = await res.json();
    if (!res.ok) return showError(data.error || 'Something went wrong. Please try again.');
    render(data);
  } catch {
    showError('Could not reach the server. Check your connection and try again.');
  } finally { btn.classList.remove('loading'); }
});

function render(s) {
  const st = STATUS[s.status];
  $('banner').className = 'banner ' + st.tone;
  $('seal').innerHTML = ICONS[st.tone];
  $('kicker').textContent = st.kicker;
  $('headline').textContent = st.headline;
  $('message').textContent = st.message || `${s.reason}. ${CONTACT}`;
  $('sname').textContent = s.name;
  $('sidout').textContent = s.id;
  $('chip').innerHTML = '<i></i>';
  $('chip').append(st.chip);
  $('chip').style.setProperty('--accent', `var(--${st.tone === 'good' ? 'good' : st.tone === 'bad' ? 'bad' : 'warn'})`);

  $('gpa').textContent = s.gpa === null ? '–' : s.gpa.toFixed(2);
  $('avg').textContent = s.average === null ? '–' : s.average + '%';

  const list = $('subjects'); list.innerHTML = '';
  s.subjects.forEach((x) => {
    const li = document.createElement('li');
    const name = document.createElement('span'); name.className = 'sname'; name.textContent = x.subject;
    const score = document.createElement('span'); score.className = 'sscore';
    const b = document.createElement('b'); const l = document.createElement('span'); l.className = 'letter';
    const bar = document.createElement('div'); bar.className = 'bar'; const fill = document.createElement('i'); bar.append(fill);
    if (x.score === null) { b.textContent = 'No score'; l.textContent = '—'; l.classList.add('na'); }
    else {
      b.textContent = x.score + '%'; l.textContent = x.letter;
      if (x.score < 50) { l.classList.add('f'); fill.classList.add('low'); }
      requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = x.score + '%'; }));
    }
    score.append(b, l); li.append(name, score, bar); list.append(li);
  });

  $('lookup').hidden = true; $('result').hidden = false; window.scrollTo({ top: 0, behavior: 'smooth' });
  const arc = $('arc'); arc.style.strokeDashoffset = 326.7;
  if (s.gpa !== null) requestAnimationFrame(() => requestAnimationFrame(() => { arc.style.strokeDashoffset = 326.7 * (1 - s.gpa / 4); }));
  if (s.status === 'graduated') confetti();
}

$('again').addEventListener('click', () => {
  $('result').hidden = true; $('lookup').hidden = false; input.value = ''; input.focus();
});
$('print').addEventListener('click', () => window.print());

// Light confetti burst in blue / ice / gold
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = $('confetti'), ctx = c.getContext('2d'), dpr = devicePixelRatio || 1;
  c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.scale(dpr, dpr);
  const colors = ['#60a5fa', '#93c5fd', '#dbeafe', '#2563eb', '#f5d98b', '#ffffff'];
  const bits = Array.from({ length: 150 }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * 120, y: innerHeight * .3,
    vx: (Math.random() - .5) * 13, vy: -Math.random() * 11 - 3, w: 6 + Math.random() * 6, h: 4 + Math.random() * 5,
    r: Math.random() * 6, vr: (Math.random() - .5) * .35, col: colors[(Math.random() * colors.length) | 0],
  }));
  let frames = 0;
  (function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    bits.forEach((p) => {
      p.vy += .28; p.vx *= .992; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.max(0, 1 - frames / 170);
      ctx.fillStyle = p.col; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    });
    if (++frames < 170) requestAnimationFrame(tick); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })();
}
