/* Roue : calcul du tableau de service. Fonctions pures, sans interface (testées à part).
   Un plan : période, personnes (indisponibilités, postes exclus), postes (effectif, durée du tour, plage, pénibilité),
   règles (repos minimal, nuit, méthode). Résultat : une personne par place de chaque tour, ou un trou signalé. */
'use strict';
const RoueEngine = (() => {
  const MIN = 60000;
  const ts = s => { const d = new Date(s); return Number.isFinite(d.getTime()) ? d.getTime() : NaN; };
  const hm = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; };
  const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const addDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
  /* générateur pseudo-aléatoire reproductible : même graine, même tableau */
  const rng = seed => { let a = (seed >>> 0) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

  /* minutes d'un intervalle [a,b[ qui tombent dans la plage quotidienne [from,to[ (qui peut passer minuit) */
  function overlapDaily(a, b, from, to) {
    if (from == null || to == null || from === to) return 0;
    let tot = 0;
    for (let d = addDays(dayStart(a), -1); d < b; d = addDays(d, 1)) {
      const s = d + from * MIN, e = (to > from ? d : addDays(d, 1)) + to * MIN;
      tot += Math.max(0, Math.min(b, e) - Math.max(a, s));
    }
    return tot / MIN;
  }
  /* fenêtres d'activité d'un poste dans la période : toute la période, ou sa plage quotidienne */
  function windows(post, A, B) {
    const f = hm(post.from), t = hm(post.to);
    if (f == null || t == null || f === t) return [[A, B]];
    const out = [];
    for (let d = addDays(dayStart(A), -1); d < B; d = addDays(d, 1)) {
      const s = Math.max(A, d + f * MIN), e = Math.min(B, (t > f ? d : addDays(d, 1)) + t * MIN);
      if (e > s) out.push([s, e]);
    }
    return out;
  }
  function buildSlots(plan) {
    const A = ts(plan.start), B = ts(plan.end), R = plan.rules, nf = hm(R.nightFrom), nt = hm(R.nightTo), slots = [];
    if (!(B > A)) return slots;
    plan.posts.forEach((post, pi) => {
      const dur = Math.max(15, post.dur || 120) * MIN, k = Math.max(1, post.k || 1);
      for (const [s, e] of windows(post, A, B)) {
        for (let a = s; a < e; a += dur) {
          let b = Math.min(e, a + dur);
          if (e - b > 0 && e - b < dur / 2 && e - b <= 30 * MIN) b = e;   /* un reste trop court rejoint le dernier tour */
          const night = overlapDaily(a, b, nf, nt), mins = (b - a) / MIN;
          const w = ((mins - night) + night * (R.nightW || 1)) * (post.w || 1);
          for (let seat = 0; seat < k; seat++) slots.push({ key: `${post.id}|${a}|${seat}`, post: post.id, pi, a, b, seat, mins, night, w });
          if (b === e) break;
        }
      }
    });
    slots.sort((x, y) => x.a - y.a || x.pi - y.pi || x.seat - y.seat);
    return slots;
  }

  const offOf = p => (p.off || []).map(o => [ts(o.a), ts(o.b)]).filter(o => o[1] > o[0]);
  function makeState(plan, slots) {
    const P = new Map();
    for (const p of plan.people) P.set(p.id, { p, off: offOf(p), no: new Set(p.no || []), slots: [], w: 0, night: 0, mins: 0 });
    return { P, who: new Map(), rest: Math.max(0, plan.rules.rest || 0) * MIN, maxDay: plan.rules.maxDay || 0 };
  }
  /* 0 : possible ; 1 : possible mais repos réduit ; 2 : impossible (chevauchement, indisponibilité, poste exclu, maximum par 24 h) */
  function fit(S, id, sl, ignore) {
    const st = S.P.get(id);
    if (!st || st.no.has(sl.post)) return 2;
    for (const [a, b] of st.off) if (a < sl.b && b > sl.a) return 2;
    let soft = 0, day = 0;
    for (const o of st.slots) {
      if (o === sl || o === ignore) continue;
      if (o.a < sl.b && o.b > sl.a) return 2;
      const gap = o.a >= sl.b ? o.a - sl.b : sl.a - o.b;
      if (gap > 0 && gap < S.rest) soft = 1;   /* deux tours qui se suivent sans pause comptent aussi comme repos réduit, sauf si le repos demandé est nul */
      if (gap === 0 && S.rest > 0) soft = 1;
      if (Math.abs(o.a - sl.a) < 24 * 60 * MIN) day++;
    }
    if (S.maxDay && day >= S.maxDay) return 2;
    return soft;
  }
  function put(S, sl, id) {
    const old = S.who.get(sl.key);
    if (old) { const o = S.P.get(old); o.slots.splice(o.slots.indexOf(sl), 1); o.w -= sl.w; o.night -= sl.night; o.mins -= sl.mins; }
    if (id) { const n = S.P.get(id); n.slots.push(sl); n.w += sl.w; n.night += sl.night; n.mins += sl.mins; S.who.set(sl.key, id); } else S.who.delete(sl.key);
  }
  const mates = (S, sl, byTour) => (byTour.get(sl.post + '|' + sl.a) || []).filter(o => o !== sl).map(o => S.who.get(o.key)).filter(Boolean);

  /* coût global : écarts de charge, de nuit et de nombre de tours entre personnes, repos réduits, trous */
  function cost(S, slots) {
    const L = [...S.P.values()], n = L.length || 1;
    const dev = f => { const m = L.reduce((a, x) => a + f(x), 0) / n; return L.reduce((a, x) => a + (f(x) - m) ** 2, 0) / n; };
    let soft = 0, holes = 0;
    for (const sl of slots) { const id = S.who.get(sl.key); if (!id) holes++; else if (fit(S, id, sl) === 1) soft++; }
    return dev(x => x.w) + 0.6 * dev(x => x.night) + 900 * dev(x => x.slots.length) + soft * 20000 + holes * 1e7;
  }

  function solve(plan) {
    const slots = buildSlots(plan), S = makeState(plan, slots), rnd = rng(plan.seed || 1), locks = plan.locks || {};
    const byTour = new Map();
    for (const sl of slots) { const k = sl.post + '|' + sl.a; if (!byTour.has(k)) byTour.set(k, []); byTour.get(k).push(sl); }
    const ids = plan.people.map(p => p.id), grp = new Map(plan.people.map(p => [p.id, (p.g || '').trim()]));
    const locked = new Set();
    for (const sl of slots) { const id = locks[sl.key]; if (id && S.P.has(id) && fit(S, id, sl) < 2) { put(S, sl, id); locked.add(sl.key); } }
    const free = slots.filter(sl => !locked.has(sl.key));
    if (!ids.length) return finish(plan, slots, S, locked);

    if (plan.rules.method === 'roue') {
      /* rotation simple : chacun son tour dans l'ordre de la liste ; qui ne peut pas passe son tour et reste en tête */
      const queue = ids.slice();
      for (const sl of free) {
        let pick = -1, lvl = 2;
        for (let i = 0; i < queue.length; i++) { const f = fit(S, queue[i], sl); if (f === 0) { pick = i; lvl = 0; break; } if (f === 1 && lvl === 2) { pick = i; lvl = 1; } }
        if (pick >= 0) { const id = queue.splice(pick, 1)[0]; queue.push(id); put(S, sl, id); }
      }
      return finish(plan, slots, S, locked);
    }

    /* équité : pour chaque place, la personne la moins chargée qui peut la tenir ; le repos passe avant la charge */
    for (const sl of free) {
      let best = null, bs = Infinity;
      const m = plan.rules.pairs ? mates(S, sl, byTour).map(x => grp.get(x)) : [];
      for (const id of ids) {
        const f = fit(S, id, sl); if (f === 2) continue;
        const st = S.P.get(id);
        let last = -Infinity; for (const o of st.slots) if (o.b <= sl.a && o.b > last) last = o.b;
        const sinceH = last === -Infinity ? 48 : Math.min(48, (sl.a - last) / 3600000);
        let s = st.w + f * 1e6 + (sl.night ? st.night * 0.8 : 0) + st.slots.length * 20 - sinceH * 4 + rnd() * 6;
        if (m.length && grp.get(id) && m.includes(grp.get(id))) s -= 45;
        if (s < bs) { bs = s; best = id; }
      }
      if (best) put(S, sl, best);
    }
    /* amélioration : échanges et remplacements qui font baisser le coût */
    let c = cost(S, slots);
    const iters = Math.min(6000, 60 * free.length + 400);
    for (let i = 0; i < iters && free.length > 1; i++) {
      const s1 = free[Math.floor(rnd() * free.length)], a = S.who.get(s1.key) || null;
      if (rnd() < 0.45) {
        const b = ids[Math.floor(rnd() * ids.length)];
        if (b === a) continue;
        put(S, s1, null);
        if (fit(S, b, s1) === 2) { put(S, s1, a); continue; }
        put(S, s1, b);
        const c2 = cost(S, slots);
        if (c2 < c - 1e-9) c = c2; else put(S, s1, a);
      } else {
        const s2 = free[Math.floor(rnd() * free.length)], b = S.who.get(s2.key) || null;
        if (s1 === s2 || a === b) continue;
        put(S, s1, null); put(S, s2, null);
        const ok = (!b || fit(S, b, s1) < 2), ok2 = () => (!a || fit(S, a, s2) < 2);
        if (ok) { put(S, s1, b); if (ok2()) { put(S, s2, a); const c2 = cost(S, slots); if (c2 < c - 1e-9) { c = c2; continue; } } }
        put(S, s1, null); put(S, s2, null); put(S, s1, a); put(S, s2, b);
      }
    }
    return finish(plan, slots, S, locked);
  }

  function finish(plan, slots, S, locked) {
    const assign = {}, issues = [];
    for (const sl of slots) {
      const id = S.who.get(sl.key) || null;
      assign[sl.key] = id;
      if (!id) issues.push({ t: 'hole', key: sl.key });
      else if (fit(S, id, sl) === 1) issues.push({ t: 'rest', key: sl.key, id });
    }
    return { slots, assign, issues, stats: stats(plan, slots, assign), locked: [...locked] };
  }
  function stats(plan, slots, assign) {
    const M = new Map(plan.people.map(p => [p.id, { id: p.id, n: 0, mins: 0, night: 0, w: 0, minRest: null, list: [] }]));
    for (const sl of slots) { const x = M.get(assign[sl.key]); if (x) { x.n++; x.mins += sl.mins; x.night += sl.night; x.w += sl.w; x.list.push(sl); } }
    for (const x of M.values()) {
      x.list.sort((a, b) => a.a - b.a);
      for (let i = 1; i < x.list.length; i++) { const g = (x.list[i].a - x.list[i - 1].b) / MIN; if (x.minRest == null || g < x.minRest) x.minRest = g; }
    }
    const L = [...M.values()], ws = L.map(x => x.w);
    return { per: L, spread: L.length ? (Math.max(...ws) - Math.min(...ws)) : 0, mean: L.length ? ws.reduce((a, b) => a + b, 0) / L.length : 0 };
  }
  /* vérifie un tableau (après une retouche à la main) sans le recalculer */
  function check(plan, slots, assign) {
    const S = makeState(plan, slots), issues = [];
    const by = new Map(slots.map(s => [s.key, s]));
    for (const k in assign) { const sl = by.get(k), id = assign[k]; if (sl && id && S.P.has(id)) { const st = S.P.get(id); st.slots.push(sl); S.who.set(k, id); } }
    for (const sl of slots) {
      const id = S.who.get(sl.key);
      if (!id) { issues.push({ t: 'hole', key: sl.key }); continue; }
      const f = fit(S, id, sl);
      if (f === 1) issues.push({ t: 'rest', key: sl.key, id }); else if (f === 2) issues.push({ t: 'bad', key: sl.key, id });
    }
    return { issues, stats: stats(plan, slots, assign), S };
  }
  /* pour le choix à la main : chaque personne avec son aptitude à tenir cette place */
  function candidates(plan, slots, assign, sl) {
    const { S } = check(plan, slots, Object.assign({}, assign, { [sl.key]: null }));
    const st = stats(plan, slots, assign).per;
    return plan.people.map(p => ({ p, fit: fit(S, p.id, sl), s: st.find(x => x.id === p.id) })).sort((a, b) => a.fit - b.fit || a.s.w - b.s.w);
  }
  return { buildSlots, solve, check, candidates, stats, overlapDaily, ts, hm, MIN };
})();
if (typeof module !== 'undefined') module.exports = RoueEngine;
