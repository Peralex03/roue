/* Socle commun : petits outils d'interface, enregistrement local, partage par QR. Aucun serveur. */
'use strict';
const $ = (s, r) => (r || document).querySelector(s);
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'hidden') e.hidden = !!v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', chev: '<path d="M9 5l7 7-7 7"/>', back: '<path d="M15 5l-7 7 7 7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  share: '<path d="M12 15V3M8 7l4-4 4 4M5 12v8h14v-8"/>', print: '<path d="M7 8V3h10v5M7 17H4v-7a2 2 0 012-2h12a2 2 0 012 2v7h-3M7 14h10v7H7z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.500M16 4.900a3.2 3.2 0 010 6.200M18 14.800c2 .7 3.2 2.4 3.5 5.2"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h.01M15 15h.01M15 9h.01M9 15h.01M12 12h.01"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>', map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>',
  route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3.5 3.5 0 000-7H9a3.5 3.5 0 010-7h6.5"/>',
  truck: '<path d="M2 6h11v10H2zM13 9h4.500L21 12.500V16h-8z"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.500l4 4"/>', file: '<path d="M6 3h8l4 4v14H6zM14 3v4h4"/>',
  cards: '<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 6V4h12a2 2 0 012 2v12h-2"/>', bolt: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>', book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19V5M19 19v2H6"/>',
  eye: '<path d="M2 12s3.6-6.5 10-6.500S22 12 22 12s-3.6 6.5-10 6.500S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', undo: '<path d="M9 7L4 12l5 5M4 12h10a6 6 0 010 12h-2" transform="translate(0 -3)"/>',
  import: '<path d="M12 3v12M8 11l4 4 4-4M5 17v3h14v-3"/>', swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.500h.01"/>',
  play: '<path d="M7 4.500v15l12-7.500z"/>', star: '<path d="M12 3l2.7 5.8 6.3.8-4.6 4.4 1.2 6.300L12 17.200l-5.6 3.1 1.2-6.300L3 9.600l6.3-.800z"/>'
};
const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICONS[n] || '')}</svg>`;
const ic = (n, cls) => h('span', { class: cls || '', html: icon(n) }).firstChild;

/* ---------- enregistrement local ---------- */
function makeStore(key, defaults) {
  let data;
  try { data = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { data = null; }
  if (!data || typeof data !== 'object') data = {};
  for (const k in defaults) if (!(k in data)) data[k] = JSON.parse(JSON.stringify(defaults[k]));
  let t = 0;
  const flush = () => { t = 0; try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { toast('Enregistrement impossible : mémoire de l’appareil pleine'); } };
  const save = () => { if (!t) t = setTimeout(flush, 150); };
  window.addEventListener('pagehide', () => { if (t) { clearTimeout(t); flush(); } });
  return { data, save, flush };
}
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad2 = n => String(n).padStart(2, '0');
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- toast ---------- */
let toastEl = null, toastT = 0;
function toast(msg, opt) {
  if (toastEl) toastEl.remove();
  clearTimeout(toastT);
  const el = toastEl = h('div', { class: 'toast', role: 'status' }, h('span', { text: msg }));
  if (opt && opt.action) el.append(h('button', { type: 'button', text: opt.action, onclick: () => { el.remove(); opt.fn(); } }));
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('in'));
  toastT = setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 250); }, opt && opt.action ? 5000 : 2400);
}

/* ---------- tiroir ---------- */
let sheetCur = null;
function openSheet(title, body, onClose) {
  closeSheet(true);
  const scrim = h('div', { class: 'scrim' }), sbody = h('div', { class: 'sbody' }, body);
  const el = h('div', { class: 'sheet', role: 'dialog', 'aria-label': title },
    h('div', { class: 'shead' }, h('h2', { text: title }), h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Fermer', html: icon('x'), onclick: () => closeSheet() })), sbody);
  scrim.addEventListener('click', () => closeSheet());
  document.body.append(scrim, el);
  sheetCur = { scrim, el, onClose };
  requestAnimationFrame(() => { scrim.classList.add('in'); el.classList.add('in'); });
  return sbody;
}
function closeSheet(now) {
  const s = sheetCur; if (!s) return;
  sheetCur = null;
  if (document.activeElement && s.el.contains(document.activeElement)) document.activeElement.blur();
  s.scrim.classList.remove('in'); s.el.classList.remove('in');
  if (now) { s.scrim.remove(); s.el.remove(); } else setTimeout(() => { s.scrim.remove(); s.el.remove(); }, 340);
  if (s.onClose) s.onClose();
}
function confirmSheet(title, text, okLabel, fn, danger) {
  openSheet(title, [h('p', { class: 'note', style: 'font-size:15px;color:var(--text2);margin:0 2px 14px', text }),
    h('div', { class: 'acts' }, h('button', { type: 'button', class: 'btn sec', text: 'Annuler', onclick: () => closeSheet() }),
      h('button', { type: 'button', class: 'btn' + (danger ? ' danger' : ''), text: okLabel, onclick: () => { closeSheet(); fn(); } }))]);
}

/* ---------- petits composants ---------- */
function seg(opts, val, onSet) {
  const el = h('div', { class: 'seg', role: 'tablist' });
  for (const [v, t] of opts) el.append(h('button', { type: 'button', class: v === val ? 'on' : '', text: t, onclick: e => { for (const b of el.children) b.classList.toggle('on', b === e.currentTarget); onSet(v); } }));
  return el;
}
function sw(on, onSet) {
  const el = h('button', { type: 'button', class: 'switch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(!!on) });
  el.addEventListener('click', e => { e.stopPropagation(); const v = !el.classList.contains('on'); el.classList.toggle('on', v); el.setAttribute('aria-checked', String(v)); onSet(v); });
  return el;
}
function numField(val, onSet, opt) {
  opt = opt || {};
  const f = h('input', { class: 'field num', type: 'number', inputmode: opt.dec ? 'decimal' : 'numeric', step: opt.step || 1, min: opt.min == null ? 0 : opt.min, max: opt.max, 'aria-label': opt.label });
  f.value = String(val);
  f.addEventListener('change', () => { let v = parseFloat(String(f.value).replace(',', '.')); if (!Number.isFinite(v)) v = val; v = clamp(v, opt.min == null ? 0 : opt.min, opt.max == null ? 1e9 : opt.max); if (!opt.dec) v = Math.round(v); f.value = String(v); onSet(v); });
  f.addEventListener('keydown', e => { if (e.key === 'Enter') f.blur(); });
  return f;
}
function textField(val, onSet, opt) {
  opt = opt || {};
  const f = h(opt.area ? 'textarea' : 'input', { class: 'field', type: opt.area ? null : (opt.type || 'text'), placeholder: opt.ph, maxlength: opt.max || 400, rows: opt.area ? (opt.rows || 2) : null, autocomplete: 'off', autocapitalize: opt.caps || 'sentences', spellcheck: opt.spell ? 'true' : 'false', enterkeyhint: opt.area ? null : 'done', 'aria-label': opt.label || opt.ph });
  f.value = val || '';
  const grow = () => { if (opt.area) { f.style.height = 'auto'; f.style.height = Math.max(42, f.scrollHeight) + 'px'; } };
  f.addEventListener('input', () => { grow(); onSet(f.value); });
  if (!opt.area) f.addEventListener('keydown', e => { if (e.key === 'Enter') f.blur(); });
  if (opt.area) setTimeout(grow, 0);
  return f;
}
function frow(label, sub, ...ctl) { return h('div', { class: 'frow' }, h('div', { class: 'flab' }, label, sub ? h('small', { text: sub }) : null), ...ctl); }
function tabsBar(defs, cur, onSet) {
  const el = h('nav', { class: 'tabs' });
  for (const [k, t, i] of defs) el.append(h('button', { type: 'button', class: k === cur ? 'on' : '', 'data-k': k, html: icon(i) + `<span>${esc(t)}</span>`, onclick: () => { for (const b of el.children) b.classList.toggle('on', b.dataset.k === k); onSet(k); } }));
  return el;
}
async function copyText(t, ok) {
  try { await navigator.clipboard.writeText(t); toast(ok || 'Copié'); }
  catch (e) { const a = h('textarea', { style: 'position:fixed;opacity:0' }); a.value = t; document.body.append(a); a.select(); try { document.execCommand('copy'); toast(ok || 'Copié'); } catch (e2) { toast('Copie impossible'); } a.remove(); }
}
function saveFile(name, text, type) {
  const blob = new Blob([text], { type: type || 'application/json' }), file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file] }).catch(() => {}); return; }
  const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
function pickFile(accept) {
  return new Promise(res => { const f = h('input', { type: 'file', accept, style: 'display:none' }); f.addEventListener('change', async () => { const x = f.files[0]; f.remove(); res(x ? { name: x.name, text: await x.text() } : null); }); document.body.append(f); f.click(); });
}
/* impression : remplit le bloc .print puis ouvre la boîte d'impression (« Enregistrer en PDF » sur téléphone) */
function printDoc(nodes) {
  let p = $('.print'); if (!p) { p = h('div', { class: 'print' }); document.body.append(p); }
  p.replaceChildren(...[].concat(nodes));
  setTimeout(() => window.print(), 60);
}

/* ---------- partage sans serveur : les données voyagent dans le lien (après le #), jamais vers un serveur ---------- */
const b64u = { enc: u8 => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }, dec: s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); const b = atob(s + '==='.slice((s.length + 3) % 4)); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; } };
async function pipe(u8, T, mode) { const s = new Blob([u8]).stream().pipeThrough(new T(mode)); return new Uint8Array(await new Response(s).arrayBuffer()); }
async function packData(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === 'function') { try { return 'z' + b64u.enc(await pipe(raw, CompressionStream, 'deflate-raw')); } catch (e) {} }
  return 'j' + b64u.enc(raw);
}
async function unpackData(s) {
  const u = b64u.dec(s.slice(1));
  const raw = s[0] === 'z' ? await pipe(u, DecompressionStream, 'deflate-raw') : u;
  return JSON.parse(new TextDecoder().decode(raw));
}
const QR_MAX = 2300;   /* au-delà, le QR devient illisible sur un écran de téléphone */
function qrSvg(text) {
  try {
    const q = qrcode(0, 'L'); q.addData(text, 'Byte'); q.make();
    const n = q.getModuleCount(); let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges"><path fill="#000" d="${d}"/></svg>`;
  } catch (e) { return null; }
}
async function shareSheet(title, kind, obj, fileName, fileObj) {
  const packed = await packData({ k: kind, d: obj });
  const url = location.origin + location.pathname + '#p=' + packed;
  const body = [];
  if (url.length <= QR_MAX) {
    const svg = qrSvg(url);
    if (svg) body.push(h('div', { class: 'qrbox', html: svg }), h('p', { class: 'note', style: 'text-align:center', text: 'À viser avec l’appareil photo d’un autre téléphone. Les données sont dans le QR lui-même : rien ne passe par un serveur.' }));
  } else body.push(h('p', { class: 'warn', text: 'Trop de données pour un seul QR : envoyer le fichier ou le lien.' }));
  body.push(h('div', { class: 'acts' },
    h('button', { type: 'button', class: 'btn sec', html: icon('copy') + '<span>Copier le lien</span>', onclick: () => copyText(url, 'Lien copié') }),
    h('button', { type: 'button', class: 'btn sec', html: icon('file') + '<span>Fichier</span>', onclick: () => saveFile(fileName || kind + '.json', JSON.stringify({ k: kind, d: fileObj || obj })) })));
  openSheet(title, body);
}
/* à l'ouverture : un lien reçu (#p=…) propose l'import, puis le lien est retiré de la barre d'adresse */
async function readIncoming(kind, onData) {
  const m = /[#&]p=([A-Za-z0-9_-]+)/.exec(location.hash || '');
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  try { const o = await unpackData(m[1]); if (o && o.k === kind && o.d) onData(o.d); else toast('Ce lien ne correspond pas à cette app'); }
  catch (e) { toast('Lien illisible'); }
}
function readFileData(kind, text) { try { const o = JSON.parse(text); return o && o.k === kind && o.d ? o.d : null; } catch (e) { return null; } }
/* l'app s'ouvre ensuite sans réseau */
function bootSW() { if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {}); }
