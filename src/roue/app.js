/* Roue : tableau de service. Interface. Tout reste sur l'appareil ; partage par QR, lien, fichier ou PDF. */
'use strict';
(() => {
const E = RoueEngine;
const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const fDT = t => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const fHM = t => { const d = new Date(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const fDay = t => { const d = new Date(t); return `${DAYS[d.getDay()]} ${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`; };
const fDur = m => { m = Math.round(m); const hh = Math.floor(m / 60), mm = m % 60; return hh ? (mm ? `${hh} h ${pad2(mm)}` : `${hh} h`) : `${mm} min`; };
const dayKey = t => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const RULES0 = { rest: 240, nightFrom: '22:00', nightTo: '06:00', nightW: 1.5, method: 'equite', pairs: false, maxDay: 0 };

function newPlan(name) {
  const a = new Date(); a.setHours(18, 0, 0, 0); const b = new Date(a); b.setDate(b.getDate() + 1); b.setHours(6, 0, 0, 0);
  return { id: uid(), name: name || 'Tableau de service', start: fDT(a), end: fDT(b), people: [], posts: [{ id: uid(), n: 'Garde', k: 2, dur: 120, from: '', to: '', w: 1 }], rules: Object.assign({}, RULES0), seed: 1, locks: {}, assign: null };
}
const store = makeStore('roue.v1', { plans: [], cur: '', tab: 'tab', view: 'chrono' });
const D = store.data;
function fixPlan(p) {
  if (!p || typeof p !== 'object') return null;
  const q = newPlan(typeof p.name === 'string' ? p.name.slice(0, 60) : '');
  q.id = typeof p.id === 'string' ? p.id : q.id;
  if (Number.isFinite(E.ts(p.start))) q.start = p.start; if (Number.isFinite(E.ts(p.end))) q.end = p.end;
  q.people = (Array.isArray(p.people) ? p.people : []).filter(x => x && typeof x.n === 'string').slice(0, 300).map(x => ({ id: typeof x.id === 'string' ? x.id : uid(), n: x.n.slice(0, 40), g: typeof x.g === 'string' ? x.g.slice(0, 20) : '', off: (Array.isArray(x.off) ? x.off : []).filter(o => o && E.ts(o.b) > E.ts(o.a)).map(o => ({ a: o.a, b: o.b })), no: (Array.isArray(x.no) ? x.no : []).filter(s => typeof s === 'string') }));
  const posts = (Array.isArray(p.posts) ? p.posts : []).filter(x => x && typeof x.n === 'string').slice(0, 20).map(x => ({ id: typeof x.id === 'string' ? x.id : uid(), n: x.n.slice(0, 30), k: clamp(Math.round(+x.k) || 1, 1, 20), dur: clamp(Math.round(+x.dur) || 120, 15, 1440), from: E.hm(x.from) != null ? x.from : '', to: E.hm(x.to) != null ? x.to : '', w: clamp(+x.w || 1, 0.5, 3) }));
  if (posts.length) q.posts = posts;
  const r = p.rules || {};
  q.rules = { rest: clamp(Math.round(+r.rest) || 0, 0, 2880), nightFrom: E.hm(r.nightFrom) != null ? r.nightFrom : '22:00', nightTo: E.hm(r.nightTo) != null ? r.nightTo : '06:00', nightW: clamp(+r.nightW || 1, 1, 3), method: r.method === 'roue' ? 'roue' : 'equite', pairs: !!r.pairs, maxDay: clamp(Math.round(+r.maxDay) || 0, 0, 24) };
  q.seed = Math.round(+p.seed) || 1;
  q.locks = p.locks && typeof p.locks === 'object' ? p.locks : {};
  q.assign = p.assign && typeof p.assign === 'object' ? p.assign : null;
  return q;
}
D.plans = D.plans.map(fixPlan).filter(Boolean);
if (!D.plans.length) D.plans.push(newPlan());
if (!D.plans.some(p => p.id === D.cur)) D.cur = D.plans[0].id;
const cur = () => D.plans.find(p => p.id === D.cur);
const person = id => cur().people.find(p => p.id === id);
const post = id => cur().posts.find(p => p.id === id);
const drop = (arr, x) => { const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); };

/* résultat courant : places, affectations, contrôles */
let R = null;
function refresh() {
  const p = cur(), slots = E.buildSlots(p);
  if (!p.assign) { R = { slots, assign: null, issues: [], stats: null }; return; }
  const keys = new Set(slots.map(s => s.key)), ids = new Set(p.people.map(x => x.id)), a = {};
  for (const k of keys) a[k] = ids.has(p.assign[k]) ? p.assign[k] : null;
  const c = E.check(p, slots, a);
  R = { slots, assign: a, issues: c.issues, stats: c.stats };
}
function generate(reseed) {
  const p = cur();
  if (!p.people.length) { toast('Ajouter d’abord des personnes'); setTab('people'); return; }
  if (!(E.ts(p.end) > E.ts(p.start))) { toast('La fin doit venir après le début'); return; }
  if (reseed) p.seed = (p.seed || 1) + 1;
  const r = E.solve(p);
  if (!r.slots.length) { toast('Aucun tour dans cette période'); return; }
  p.assign = r.assign; store.save(); refresh(); render();
  const holes = r.issues.filter(i => i.t === 'hole').length, rest = r.issues.filter(i => i.t === 'rest').length;
  toast(holes ? `${holes} place${holes > 1 ? 's' : ''} sans personne : effectif insuffisant` : rest ? `Tableau complet, ${rest} repos réduit${rest > 1 ? 's' : ''}` : 'Tableau complet, repos respectés');
}
/* un changement de personnes, de postes ou de période rend le tableau à refaire : il est gardé, mais signalé */
let stale = false;
const touch = () => { if (cur().assign) stale = true; store.save(); };

/* ---------- ossature ---------- */
const app = $('#app'); app.classList.add('tabbed');
const titleEl = h('h1'), mainEl = h('div', { class: 'main' });
const head = h('header', { class: 'head' }, titleEl,
  h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Partager et exporter', html: icon('share'), onclick: openExport }),
  h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Tableaux', html: icon('list'), onclick: openPlans }));
const TABS = [['tab', 'Tableau', 'grid'], ['people', 'Personnes', 'people'], ['posts', 'Postes', 'clock'], ['bilan', 'Bilan', 'chart']];
if (!TABS.some(t => t[0] === D.tab)) D.tab = 'tab';
let tabsEl = tabsBar(TABS, D.tab, setTab);
app.append(head, mainEl, tabsEl);
function setTab(k) { D.tab = k; store.save(); for (const b of tabsEl.children) b.classList.toggle('on', b.dataset.k === k); render(); mainEl.scrollTop = 0; }
function render() {
  const keep = mainEl.scrollTop;
  titleEl.textContent = cur().name;
  mainEl.replaceChildren(...({ tab: viewTab, people: viewPeople, posts: viewPosts, bilan: viewBilan }[D.tab])());
  mainEl.scrollTop = keep;
}

/* ---------- Tableau ---------- */
function dtField(val, onSet, label) {
  const f = h('input', { class: 'field time', type: 'datetime-local', value: val, 'aria-label': label });
  f.addEventListener('change', () => { if (Number.isFinite(E.ts(f.value))) onSet(f.value); else f.value = val; });
  return f;
}
function viewTab() {
  const p = cur(), out = [];
  out.push(h('div', { class: 'card period' },
    frow('Début', null, dtField(p.start, v => { p.start = v; if (!(E.ts(p.end) > E.ts(v))) p.end = fDT(E.ts(v) + 12 * 3600000); touch(); refresh(); render(); }, 'Début')),
    frow('Fin', null, dtField(p.end, v => { p.end = v; touch(); refresh(); render(); }, 'Fin'))));
  const nP = p.people.length, nS = R.slots.length, need = R.slots.reduce((a, s) => a + s.mins, 0);
  if (!nP) {
    out.push(h('div', { class: 'empty' }, h('b', { text: 'Personne pour l’instant' }), 'Le tableau se calcule à partir de la liste des personnes et des postes à tenir.',
      h('div', { class: 'acts', style: 'justify-content:center' }, h('button', { type: 'button', class: 'btn', text: 'Ajouter des personnes', onclick: () => { setTab('people'); openPaste(); } }))));
    return out;
  }
  out.push(h('p', { class: 'note', text: `${nS} place${nS > 1 ? 's' : ''} à tenir, ${fDur(need)} au total, soit ${fDur(need / nP)} par personne en moyenne (${nP} personne${nP > 1 ? 's' : ''}).` }));
  out.push(h('div', { class: 'acts' },
    h('button', { type: 'button', class: 'btn', html: icon('play') + `<span>${p.assign ? 'Recalculer' : 'Calculer le tableau'}</span>`, onclick: () => { stale = false; generate(false); } }),
    p.assign ? h('button', { type: 'button', class: 'btn sec', style: 'flex:0 0 auto', html: icon('dice') + '<span>Autre tirage</span>', onclick: () => { stale = false; generate(true); } }) : null));
  if (!p.assign) return out;
  if (stale) out.push(h('p', { class: 'warn', text: 'Personnes, postes ou période modifiés depuis le dernier calcul : recalculer pour en tenir compte.' }));
  const holes = R.issues.filter(i => i.t === 'hole').length, rest = R.issues.filter(i => i.t === 'rest').length, bad = R.issues.filter(i => i.t === 'bad').length;
  out.push(h('div', { class: 'chips', style: 'margin-top:12px' },
    h('span', { class: 'badge ' + (holes ? 'red' : 'green'), text: holes ? `${holes} place${holes > 1 ? 's' : ''} vide${holes > 1 ? 's' : ''}` : 'Complet' }),
    bad ? h('span', { class: 'badge red', text: `${bad} conflit${bad > 1 ? 's' : ''}` }) : null,
    h('span', { class: 'badge ' + (rest ? 'amber' : 'green'), text: rest ? `${rest} repos réduit${rest > 1 ? 's' : ''}` : 'Repos respectés' }),
    h('span', { class: 'badge', text: `Écart ${fDur(R.stats.spread)}` })));
  out.push(h('div', { style: 'margin-top:14px' }, seg([['chrono', 'Par heure'], ['person', 'Par personne']], D.view, v => { D.view = v; store.save(); render(); })));
  const isBad = new Map(R.issues.map(i => [i.key, i.t]));
  if (D.view === 'person') {
    for (const pe of p.people) {
      const st = R.stats.per.find(x => x.id === pe.id);
      out.push(h('div', { class: 'label' }, pe.n, h('span', { class: 'r', style: 'color:var(--muted)', text: st.n ? `${st.n} tour${st.n > 1 ? 's' : ''} · ${fDur(st.mins)}` : 'aucun tour' })));
      if (st.list.length) out.push(h('div', { class: 'list' }, ...st.list.map(sl => h('button', { type: 'button', class: 'row', onclick: () => openSeat(sl) },
        h('div', { class: 't' }, h('b', { text: `${fDay(sl.a)} · ${fHM(sl.a)} à ${fHM(sl.b)}` }), h('small', { text: post(sl.post).n + (sl.night ? ` · ${fDur(sl.night)} de nuit` : '') })),
        isBad.get(sl.key) === 'rest' ? h('span', { class: 'badge amber', text: 'Repos réduit' }) : isBad.get(sl.key) === 'bad' ? h('span', { class: 'badge red', text: 'Conflit' }) : null))));
    }
    return out;
  }
  /* par heure : un bloc par jour, une ligne par tour */
  const tours = new Map();
  for (const sl of R.slots) { const k = sl.a + '|' + sl.pi; if (!tours.has(k)) tours.set(k, []); tours.get(k).push(sl); }
  let day = 0, list = null;
  for (const seats of tours.values()) {
    const s0 = seats[0];
    if (dayKey(s0.a) !== day) { day = dayKey(s0.a); out.push(h('div', { class: 'label', text: fDay(s0.a) })); list = h('div', { class: 'list' }); out.push(list); }
    list.append(h('div', { class: 'row tour' },
      h('div', { class: 'when' }, h('b', { text: fHM(s0.a) }), h('small', { text: fHM(s0.b) })),
      h('div', { class: 't' }, h('small', { text: post(s0.post).n }), h('div', { class: 'seats' }, ...seats.map(sl => {
        const id = R.assign[sl.key], pe = id && person(id), t = isBad.get(sl.key);
        return h('button', { type: 'button', class: 'seat' + (pe ? '' : ' hole') + (t === 'rest' ? ' soft' : t === 'bad' ? ' bad' : ''), onclick: () => openSeat(sl) },
          p.locks[sl.key] ? h('i', { class: 'lk', html: icon('lock') }) : null, h('span', { text: pe ? pe.n : 'À pourvoir' }));
      })))));
  }
  return out;
}
function setSeat(sl, id, lock) {
  const p = cur();
  p.assign[sl.key] = id;
  if (lock && id) p.locks[sl.key] = id; else delete p.locks[sl.key];
  store.save(); refresh(); render();
}
function openSeat(sl) {
  const p = cur(), cands = E.candidates(p, R.slots, R.assign, sl), now = R.assign[sl.key];
  const WHY = ['', 'Repos réduit', 'Impossible'];
  const body = [h('p', { class: 'note', style: 'margin-top:0', text: 'Un choix fait à la main est verrouillé : il est conservé aux prochains calculs.' })];
  const list = h('div', { class: 'list', style: 'margin-top:10px' });
  for (const c of cands) {
    const sel = c.p.id === now;
    list.append(h('button', { type: 'button', class: 'row', disabled: c.fit === 2 && !sel ? true : null, style: c.fit === 2 && !sel ? 'opacity:.45' : null, onclick: () => { closeSheet(); setSeat(sl, c.p.id, true); } },
      h('div', { class: 't' }, h('b', { text: c.p.n }), h('small', { text: `${fDur(c.s.mins)} · ${c.s.n} tour${c.s.n > 1 ? 's' : ''}${c.s.night ? ` · ${fDur(c.s.night)} de nuit` : ''}` })),
      c.fit ? h('span', { class: 'badge ' + (c.fit === 1 ? 'amber' : 'red'), text: WHY[c.fit] }) : null,
      sel ? h('span', { class: 'chev', style: 'color:var(--blue);opacity:1', html: icon('check') }) : null));
  }
  body.push(list);
  const acts = h('div', { class: 'acts' });
  if (p.locks[sl.key]) acts.append(h('button', { type: 'button', class: 'btn sec', html: icon('lock') + '<span>Retirer le verrou</span>', onclick: () => { closeSheet(); delete p.locks[sl.key]; store.save(); render(); } }));
  if (now) acts.append(h('button', { type: 'button', class: 'btn danger', text: 'Laisser vide', onclick: () => { closeSheet(); setSeat(sl, null, false); } }));
  body.push(acts);
  openSheet(`${post(sl.post).n} · ${fDay(sl.a)} ${fHM(sl.a)} à ${fHM(sl.b)}`, body);
}

/* ---------- Personnes ---------- */
function viewPeople() {
  const p = cur(), out = [];
  out.push(h('div', { class: 'acts', style: 'margin-top:4px' },
    h('button', { type: 'button', class: 'btn', html: icon('plus') + '<span>Ajouter</span>', onclick: () => { const x = { id: uid(), n: '', g: '', off: [], no: [] }; p.people.push(x); openPerson(x, true); } }),
    h('button', { type: 'button', class: 'btn sec', html: icon('import') + '<span>Coller une liste</span>', onclick: openPaste })));
  if (!p.people.length) { out.push(h('div', { class: 'empty' }, h('b', { text: 'Liste vide' }), 'Coller une liste de noms (un par ligne) ou les ajouter un à un.')); return out; }
  out.push(h('div', { class: 'label', text: `${p.people.length} personne${p.people.length > 1 ? 's' : ''}` }));
  out.push(h('div', { class: 'list' }, ...p.people.map(x => {
    const nx = x.no.filter(id => post(id)).length;
    const bits = [x.g, x.off.length ? `${x.off.length} indisponibilité${x.off.length > 1 ? 's' : ''}` : '', nx ? `${nx} poste${nx > 1 ? 's' : ''} exclu${nx > 1 ? 's' : ''}` : ''].filter(Boolean);
    return h('button', { type: 'button', class: 'row', onclick: () => openPerson(x) }, h('div', { class: 't' }, h('b', { text: x.n || 'Sans nom' }), bits.length ? h('small', { text: bits.join(' · ') }) : null), h('span', { class: 'chev', html: icon('chev') }));
  })));
  out.push(h('p', { class: 'note', text: 'Les noms restent sur cet appareil. Ils ne quittent le téléphone que par un partage volontaire (QR, lien, fichier ou PDF).' }));
  return out;
}
function openPaste() {
  const p = cur(); let txt = '';
  const ta = textField('', v => { txt = v; }, { area: true, rows: 8, ph: 'Un nom par ligne.\nGroupe facultatif après une virgule :\nSdt Favre, Gr 1', max: 20000, caps: 'words' });
  openSheet('Coller une liste', [ta, h('div', { class: 'acts' }, h('button', { type: 'button', class: 'btn wide', text: 'Ajouter à la liste', onclick: () => {
    const have = new Set(p.people.map(x => x.n.toLowerCase())); let n = 0;
    for (const line of txt.split(/\r?\n/)) { const [a, g] = line.split(/[,;\t]/).map(s => s.trim()); if (a && !have.has(a.toLowerCase()) && p.people.length < 300) { p.people.push({ id: uid(), n: a.slice(0, 40), g: (g || '').slice(0, 20), off: [], no: [] }); have.add(a.toLowerCase()); n++; } }
    closeSheet(); touch(); refresh(); render(); toast(n ? `${n} personne${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''}` : 'Aucun nouveau nom');
  } }))]);
  setTimeout(() => ta.focus(), 350);
}
function openPerson(x, fresh) {
  const p = cur(), body = [];
  const name = textField(x.n, v => { x.n = v.trim().slice(0, 40); touch(); }, { ph: 'Grade et nom', caps: 'words', max: 40 });
  body.push(name, h('div', { style: 'margin-top:8px' }, textField(x.g, v => { x.g = v.trim().slice(0, 20); touch(); }, { ph: 'Groupe (facultatif)', max: 20 })));
  const offBox = h('div');
  const drawOff = () => offBox.replaceChildren(...x.off.map((o, i) => h('div', { class: 'card', style: 'margin-top:8px;padding:10px 12px' },
    frow('Du', null, dtField(o.a, v => { o.a = v; if (!(E.ts(o.b) > E.ts(v))) o.b = fDT(E.ts(v) + 4 * 3600000); touch(); drawOff(); }, 'Début')),
    frow('Au', null, dtField(o.b, v => { o.b = v; touch(); }, 'Fin'), h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Retirer', html: icon('trash'), onclick: () => { x.off.splice(i, 1); touch(); drawOff(); } })))));
  drawOff();
  body.push(h('div', { class: 'label' }, 'Indisponibilités', h('button', { type: 'button', class: 'r', text: 'Ajouter', onclick: () => { x.off.push({ a: p.start, b: fDT(E.ts(p.start) + 4 * 3600000) }); touch(); drawOff(); } })), offBox,
    h('p', { class: 'note', text: 'Congé, service commandé ailleurs, visite médicale : aucun tour n’est placé dans ces plages.' }));
  body.push(h('div', { class: 'label', text: 'Postes tenus' }), h('div', { class: 'list' }, ...p.posts.map(q => h('div', { class: 'row' }, h('div', { class: 't' }, h('b', { text: q.n })),
    sw(!x.no.includes(q.id), v => { x.no = x.no.filter(id => id !== q.id); if (!v) x.no.push(q.id); touch(); })))));
  body.push(h('div', { class: 'acts' }, h('button', { type: 'button', class: 'btn danger wide', text: 'Retirer de la liste', onclick: () => { drop(p.people, x); closeSheet(); } })));
  openSheet(fresh ? 'Nouvelle personne' : (x.n || 'Personne'), body, () => { if (!x.n) drop(p.people, x); touch(); refresh(); render(); });
  if (fresh) setTimeout(() => name.focus(), 350);
}

/* ---------- Postes et règles ---------- */
const DURS = [30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 1440];
function viewPosts() {
  const p = cur(), r = p.rules, out = [];
  out.push(h('div', { class: 'label' }, 'Postes à tenir', h('button', { type: 'button', class: 'r', text: 'Ajouter', onclick: () => { if (p.posts.length >= 20) return; const q = { id: uid(), n: '', k: 1, dur: 120, from: '', to: '', w: 1 }; p.posts.push(q); openPost(q, true); } })));
  out.push(h('div', { class: 'list' }, ...p.posts.map(q => h('button', { type: 'button', class: 'row', onclick: () => openPost(q) },
    h('div', { class: 't' }, h('b', { text: q.n || 'Sans nom' }), h('small', { text: `${q.k} personne${q.k > 1 ? 's' : ''} · tours de ${fDur(q.dur)} · ${q.from && q.to ? `de ${q.from} à ${q.to}` : 'toute la période'}${q.w !== 1 ? ` · pénibilité × ${String(q.w).replace('.', ',')}` : ''}` })), h('span', { class: 'chev', html: icon('chev') })))));
  out.push(h('div', { class: 'label', text: 'Règles' }));
  const hours = v => String(v / 60).replace('.', ',');
  out.push(h('div', { class: 'card' },
    h('div', { class: 'frow', style: 'margin-top:0' }, h('div', { class: 'flab' }, 'Méthode')),
    h('div', { style: 'margin-top:8px' }, seg([['equite', 'Équité'], ['roue', 'Rotation simple']], r.method, v => { r.method = v; touch(); render(); })),
    h('p', { class: 'note', style: 'margin:8px 0 0', text: r.method === 'roue' ? 'Chacun son tour, dans l’ordre de la liste. Simple à expliquer, mais la charge peut différer d’une personne à l’autre.' : 'À chaque place, la personne la moins chargée qui a eu son repos. Les heures, les nuits et le nombre de tours sont ensuite équilibrés par échanges.' }),
    frow('Repos minimal entre deux tours', null, numField(r.rest / 60, v => { r.rest = Math.round(v * 60); touch(); }, { dec: true, step: 0.5, max: 48, label: 'Repos minimal en heures' }), h('span', { class: 'unit', text: 'h' })),
    frow('Nuit', 'Les heures de nuit pèsent plus lourd', h('input', { class: 'field time', type: 'time', value: r.nightFrom, 'aria-label': 'Début de la nuit', onchange: e => { if (E.hm(e.target.value) != null) { r.nightFrom = e.target.value; touch(); } } }), h('input', { class: 'field time', type: 'time', value: r.nightTo, 'aria-label': 'Fin de la nuit', onchange: e => { if (E.hm(e.target.value) != null) { r.nightTo = e.target.value; touch(); } } })),
    h('div', { style: 'margin-top:8px' }, seg([[1, 'Nuit × 1'], [1.5, '× 1,5'], [2, '× 2']], r.nightW, v => { r.nightW = v; touch(); })),
    frow('Tours par 24 h, au plus', '0 : pas de limite', numField(r.maxDay, v => { r.maxDay = v; touch(); }, { max: 24, label: 'Tours par 24 heures au plus' })),
    frow('Garder les groupes ensemble', 'Sur un poste à plusieurs, de préférence des personnes du même groupe', sw(r.pairs, v => { r.pairs = v; touch(); }))));
  out.push(h('p', { class: 'note', text: `Repos demandé : ${hours(r.rest)} h. Si l’effectif ne suffit pas, le tableau reste complet et les repos réduits sont signalés en orange.` }));
  return out;
}
function openPost(q, fresh) {
  const p = cur(), body = [];
  const name = textField(q.n, v => { q.n = v.trim().slice(0, 30); touch(); }, { ph: 'Nom du poste (garde, planton, patrouille…)', max: 30 });
  const win = h('div', { hidden: !(q.from && q.to) },
    frow('De', null, h('input', { class: 'field time', type: 'time', value: q.from || '06:00', 'aria-label': 'Début de la plage', onchange: e => { q.from = e.target.value; touch(); } })),
    frow('À', null, h('input', { class: 'field time', type: 'time', value: q.to || '22:00', 'aria-label': 'Fin de la plage', onchange: e => { q.to = e.target.value; touch(); } })));
  const durSel = h('select', { class: 'field', style: 'width:auto', 'aria-label': 'Durée du tour', onchange: e => { q.dur = +e.target.value; touch(); } }, ...[...new Set([...DURS, q.dur])].sort((a, b) => a - b).map(d => h('option', { value: d, selected: d === q.dur ? true : null, text: fDur(d) })));
  body.push(name,
    frow('Personnes en même temps', null, numField(q.k, v => { q.k = v; touch(); }, { min: 1, max: 20, label: 'Effectif' })),
    frow('Durée d’un tour', null, durSel),
    frow('Seulement à certaines heures', 'Sinon le poste est tenu toute la période', sw(!!(q.from && q.to), v => { win.hidden = !v; if (v) { q.from = q.from || '06:00'; q.to = q.to || '22:00'; } else { q.from = ''; q.to = ''; } touch(); })), win,
    h('div', { class: 'label', text: 'Pénibilité' }), seg([[1, 'Normale'], [1.25, '× 1,25'], [1.5, '× 1,5'], [2, '× 2']], q.w, v => { q.w = v; touch(); }),
    h('p', { class: 'note', text: 'Un poste plus pénible compte davantage dans la charge de chacun.' }));
  if (p.posts.length > 1) body.push(h('div', { class: 'acts' }, h('button', { type: 'button', class: 'btn danger wide', text: 'Supprimer ce poste', onclick: () => { drop(p.posts, q); closeSheet(); } })));
  openSheet(fresh ? 'Nouveau poste' : (q.n || 'Poste'), body, () => { if (!q.n && p.posts.includes(q)) { if (fresh && p.posts.length > 1) drop(p.posts, q); else q.n = 'Poste'; } touch(); refresh(); render(); });
  if (fresh) setTimeout(() => name.focus(), 350);
}

/* ---------- Bilan ---------- */
function viewBilan() {
  const p = cur(), out = [];
  if (!p.assign || !R.stats) { out.push(h('div', { class: 'empty' }, h('b', { text: 'Pas encore de tableau' }), 'Le bilan montre la charge de chacun une fois le tableau calculé.')); return out; }
  const per = R.stats.per.slice().sort((a, b) => b.w - a.w), max = Math.max(1, ...per.map(x => x.w));
  const rests = per.map(x => x.minRest).filter(x => x != null);
  out.push(h('div', { class: 'card' },
    h('div', { class: 'big', text: `Écart de charge : ${fDur(R.stats.spread)}` }),
    h('p', { class: 'note', style: 'margin:4px 0 0', text: `Entre la personne la plus chargée et la moins chargée, nuits et pénibilité comprises. Repos le plus court : ${rests.length ? fDur(Math.min(...rests)) : 'sans objet'}.` })));
  out.push(h('div', { class: 'label', text: 'Charge par personne' }));
  out.push(h('div', { class: 'list' }, ...per.map(x => { const pe = person(x.id); return h('div', { class: 'row', style: 'flex-direction:column;align-items:stretch;gap:6px' },
    h('div', { style: 'display:flex;gap:10px;align-items:baseline' }, h('b', { style: 'flex:1;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', text: pe.n }), h('span', { class: 'v', text: fDur(x.mins) })),
    h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(100 * x.w / max)}%;background:${x.w === max && per.length > 1 && R.stats.spread > 0 ? 'var(--orange)' : 'var(--green)'}` })),
    h('small', { style: 'color:var(--muted);font-size:12.5px', text: `${x.n} tour${x.n > 1 ? 's' : ''}${x.night ? ` · ${fDur(x.night)} de nuit` : ''}${x.minRest != null ? ` · repos le plus court ${fDur(x.minRest)}` : ''}` })); })));
  if (R.issues.length) {
    out.push(h('div', { class: 'label', text: 'À regarder' }));
    const by = new Map(R.slots.map(s => [s.key, s]));
    out.push(h('div', { class: 'list' }, ...R.issues.slice(0, 60).map(i => { const sl = by.get(i.key), pe = i.id && person(i.id);
      return h('button', { type: 'button', class: 'row', onclick: () => openSeat(sl) }, h('div', { class: 't' }, h('b', { text: i.t === 'hole' ? 'Place vide' : i.t === 'rest' ? `Repos réduit : ${pe.n}` : `Conflit : ${pe.n}` }), h('small', { text: `${post(sl.post).n} · ${fDay(sl.a)} ${fHM(sl.a)} à ${fHM(sl.b)}` })), h('span', { class: 'chev', html: icon('chev') })); })));
  }
  return out;
}

/* ---------- export, partage, plans ---------- */
function asText() {
  const p = cur(), L = [p.name, `${fDay(E.ts(p.start))} ${fHM(E.ts(p.start))} au ${fDay(E.ts(p.end))} ${fHM(E.ts(p.end))}`, ''];
  let day = 0; const tours = new Map();
  for (const sl of R.slots) { const k = sl.a + '|' + sl.pi; if (!tours.has(k)) tours.set(k, []); tours.get(k).push(sl); }
  for (const seats of tours.values()) { const s = seats[0]; if (dayKey(s.a) !== day) { day = dayKey(s.a); L.push('', fDay(s.a).toUpperCase()); }
    L.push(`${fHM(s.a)}-${fHM(s.b)}  ${post(s.post).n} : ${seats.map(x => (person(R.assign[x.key]) || { n: 'À POURVOIR' }).n).join(', ')}`); }
  return L.join('\n').replace(/\n{3,}/g, '\n\n');
}
function asCsv() {
  const q = s => `"${String(s).replace(/"/g, '""')}"`, L = ['Jour;Début;Fin;Poste;Place;Personne'];
  for (const sl of R.slots) L.push([fDay(sl.a), fHM(sl.a), fHM(sl.b), q(post(sl.post).n), sl.seat + 1, q((person(R.assign[sl.key]) || { n: '' }).n)].join(';'));
  return '﻿' + L.join('\r\n');
}
function doPrint() {
  const p = cur(), nodes = [h('h1', { text: p.name }), h('div', { class: 'meta', text: `Du ${fDay(E.ts(p.start))} ${fHM(E.ts(p.start))} au ${fDay(E.ts(p.end))} ${fHM(E.ts(p.end))} · repos minimal ${fDur(p.rules.rest)}` })];
  const tours = new Map();
  for (const sl of R.slots) { const k = sl.a + '|' + sl.pi; if (!tours.has(k)) tours.set(k, []); tours.get(k).push(sl); }
  let day = 0, tb = null;
  for (const seats of tours.values()) { const s = seats[0];
    if (dayKey(s.a) !== day) { day = dayKey(s.a); nodes.push(h('h2', { text: fDay(s.a) })); tb = h('tbody'); nodes.push(h('table', null, h('thead', null, h('tr', null, h('th', { style: 'width:22%', text: 'Heure' }), h('th', { style: 'width:24%', text: 'Poste' }), h('th', { text: 'Personnes' }))), tb)); }
    tb.append(h('tr', null, h('td', { text: `${fHM(s.a)} à ${fHM(s.b)}` }), h('td', { text: post(s.post).n }), h('td', { text: seats.map(x => (person(R.assign[x.key]) || { n: 'À pourvoir' }).n).join(', ') }))); }
  nodes.push(h('h2', { text: 'Par personne' }), h('table', null, h('thead', null, h('tr', null, h('th', { style: 'width:26%', text: 'Personne' }), h('th', { style: 'width:14%', text: 'Total' }), h('th', { text: 'Tours' }))),
    h('tbody', null, ...R.stats.per.map(x => h('tr', null, h('td', { text: person(x.id).n }), h('td', { text: fDur(x.mins) }), h('td', { text: x.list.map(sl => `${fDay(sl.a)} ${fHM(sl.a)}-${fHM(sl.b)} ${post(sl.post).n}`).join(' ; ') }))))));
  nodes.push(h('div', { class: 'foot', text: 'Établi avec Roue. Écart de charge : ' + fDur(R.stats.spread) + '.' }));
  printDoc(nodes);
}
function openExport() {
  const p = cur();
  if (!p.assign) { toast('Calculer d’abord le tableau'); return; }
  const slug = p.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'tableau';
  openSheet('Partager et exporter', [h('div', { class: 'list' },
    actRow('print', 'Imprimer ou enregistrer en PDF', 'Tableau par jour et par personne', () => { closeSheet(true); doPrint(); }),
    actRow('copy', 'Copier en texte', 'Pour une messagerie', () => { closeSheet(); copyText(asText(), 'Tableau copié'); }),
    actRow('share', 'QR ou lien', 'Pour ouvrir le tableau dans Roue sur un autre téléphone', () => shareSheet('Partager le tableau', 'roue', exportPlan(p), slug + '.json')),
    actRow('file', 'Tableur (CSV)', 'Une ligne par place', () => { closeSheet(); saveFile(slug + '.csv', asCsv(), 'text/csv'); })),
    h('p', { class: 'note', text: 'Le QR et le lien contiennent les noms : à ne montrer qu’aux personnes concernées.' })]);
}
const actRow = (i, t, s, fn) => h('button', { type: 'button', class: 'row', onclick: fn }, h('span', { class: 'ic', html: icon(i) }), h('div', { class: 't' }, h('b', { text: t }), h('small', { text: s })), h('span', { class: 'chev', html: icon('chev') }));
/* pour tenir dans un QR : le tableau voyage sans ses verrous, et les affectations sous forme compacte (une personne par place, dans l'ordre des places) */
const exportPlan = p => ({ name: p.name, start: p.start, end: p.end, people: p.people, posts: p.posts, rules: p.rules, seed: p.seed, a: E.buildSlots(p).map(s => p.people.findIndex(x => x.id === p.assign[s.key])) });
function importPlan(d) {
  const q = fixPlan(Object.assign({}, d, { id: uid(), locks: {}, assign: null }));
  if (!q) { toast('Tableau illisible'); return; }
  if (Array.isArray(d.a)) { q.assign = {}; E.buildSlots(q).forEach((s, i) => { const x = q.people[d.a[i]]; q.assign[s.key] = x ? x.id : null; }); }
  confirmSheet('Tableau reçu', `« ${q.name} » : ${q.people.length} personne${q.people.length > 1 ? 's' : ''}, ${q.posts.length} poste${q.posts.length > 1 ? 's' : ''}. L’ajouter aux tableaux de cet appareil ?`, 'Ajouter', () => { D.plans.unshift(q); D.cur = q.id; stale = false; store.save(); refresh(); setTab('tab'); });
}
function openPlans() {
  const p = cur(), body = [];
  body.push(textField(p.name, v => { p.name = v.trim().slice(0, 60) || 'Tableau de service'; titleEl.textContent = p.name; store.save(); }, { ph: 'Nom du tableau', max: 60 }));
  body.push(h('div', { class: 'label', text: 'Tableaux sur cet appareil' }), h('div', { class: 'list' }, ...D.plans.map(q => h('button', { type: 'button', class: 'row', onclick: () => { D.cur = q.id; stale = false; store.save(); closeSheet(); refresh(); render(); } },
    h('div', { class: 't' }, h('b', { text: q.name }), h('small', { text: `${fDay(E.ts(q.start))} · ${q.people.length} personne${q.people.length > 1 ? 's' : ''}` })), q.id === D.cur ? h('span', { class: 'chev', style: 'color:var(--blue);opacity:1', html: icon('check') }) : null))));
  body.push(h('div', { class: 'acts' },
    h('button', { type: 'button', class: 'btn sec', html: icon('plus') + '<span>Nouveau</span>', onclick: () => { const q = newPlan(); D.plans.unshift(q); D.cur = q.id; stale = false; store.save(); closeSheet(); refresh(); setTab('tab'); } }),
    h('button', { type: 'button', class: 'btn sec', html: icon('copy') + '<span>Dupliquer</span>', onclick: () => { const q = fixPlan(JSON.parse(JSON.stringify(p))); q.id = uid(); q.name = (p.name + ' (copie)').slice(0, 60); q.assign = null; q.locks = {}; D.plans.unshift(q); D.cur = q.id; stale = false; store.save(); closeSheet(); refresh(); setTab('tab'); toast('Copie créée : mêmes personnes, postes et règles'); } }),
    h('button', { type: 'button', class: 'btn sec', html: icon('import') + '<span>Ouvrir un fichier</span>', onclick: async () => { const f = await pickFile('.json,application/json'); if (!f) return; const d = readFileData('roue', f.text); closeSheet(); if (d) importPlan(d); else toast('Ce fichier n’est pas un tableau Roue'); } })));
  body.push(h('div', { class: 'acts' }, h('button', { type: 'button', class: 'btn danger wide', text: 'Supprimer ce tableau', onclick: () => confirmSheet('Supprimer ce tableau ?', `« ${p.name} » sera effacé de cet appareil.`, 'Supprimer', () => { D.plans.splice(D.plans.indexOf(p), 1); if (!D.plans.length) D.plans.push(newPlan()); D.cur = D.plans[0].id; stale = false; store.save(); refresh(); render(); }, true) })));
  openSheet('Tableaux', body);
}

refresh(); render(); bootSW();
readIncoming('roue', importPlan);
})();
