// Los arquetipos de Limitless para `tcg_archetypes` (tanda 1460).
//
// Se pega ENTERO en la consola de https://pokedoc.es (sin sesión vale: todo
// lo que lee es público) y deja en `window.__compacto` una línea por
// arquetipo, que `generar-migracion.py` convierte en la migración:
//
//   id|nombre|SET,num,nombre;SET,num,nombre|Nombre^Nombre es*copias~…
//
// De dónde sale cada cosa:
//   · Qué arquetipos y cómo se llaman: `meta_arquetipos` (los que la pasada
//     de Limitless ha visto en los últimos dos meses). Fuera el «other» y los
//     Basic Box (la web ya reconoce el Basic Box sola, 1443).
//   · Sus reglas: de las listas enteras de `meta_resultados` (unas 5.000) y,
//     si un arquetipo tiene menos de 3, de `meta_cartas_dia`.
//   · Cada uno pide las cartas de sus ICONOS (las que dan nombre al mazo, con
//     un 85 % de sus listas) y, si así se acierta más en TODAS las listas,
//     alguna más o un mínimo de copias, con la misma regla que la web: gana el
//     de más requisitos y, a igualdad, el id alfabético. Al final, a los pares
//     que se siguen confundiendo se les añade de una vez lo que haga falta.
//   · Los nombres en español, del catálogo (`name_es` de la misma carta).
//
// Tarda unos minutos y congela la pestaña mientras cuenta: es normal. El
// resultado de la 1460: 148 arquetipos, el 96 % de las listas con el mismo
// arquetipo que les pone Limitless.
;(async () => {
  const { supabase } = await import('/js/supabase.js')
  const log = (...a) => console.log('[arquetipos]', ...a)
  const clave = (n) => String(n ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[‘’]/g, "'").replace(/[-–—_]+/g, ' ').replace(/\s+/g, ' ').trim()
  const BASICA = /^(basic )?(grass|fire|water|lightning|psychic|fighting|darkness|metal|fairy|dragon) energy$/
  const FUERA = (id) => id === 'other' || /^basic-box/.test(id)

  // ── 1. Los datos ──
  const listas = []
  for (let desde = 0; ; desde += 1000) {
    const r = await supabase.from('meta_resultados').select('arquetipo,lista').not('lista', 'is', null).range(desde, desde + 999)
    if (r.error) throw r.error
    listas.push(...r.data)
    if (r.data.length < 1000) break
  }
  const { data: metaArq } = await supabase.from('meta_arquetipos').select('*').limit(1000)
  const meta = new Map(metaArq.map((m) => [m.id, m]))
  log(listas.length, 'listas,', metaArq.length, 'arquetipos')
  const L = listas.map((x) => {
    const f = new Map()
    for (const s of ['pokemon', 'trainer', 'energy']) for (const c of x.lista?.[s] || []) {
      const k = clave(c.name)
      if (s === 'energy' && BASICA.test(k)) continue
      f.set(k, (f.get(k) || 0) + (Number(c.count) || 0))
    }
    return { a: x.arquetipo, f }
  })
  const porArq = new Map()
  for (const x of L) { if (!porArq.has(x.a)) porArq.set(x.a, []); porArq.get(x.a).push(x) }
  // Lo de meta_cartas_dia de los que tienen pocas listas.
  const cdia = {}
  for (const id of metaArq.map((m) => m.id).filter((id) => !FUERA(id) && (porArq.get(id)?.length || 0) < 3)) {
    const r = await supabase.from('meta_cartas_dia').select('dia,seccion,nombre,set_codigo,numero,mazos').eq('arquetipo', id).limit(1000)
    cdia[id] = r.data || []
  }
  // Los Pokémon jugados por arquetipo (para los iconos) y su impresión más jugada.
  const jugado = new Map()
  for (const [a, ls] of porArq) {
    const m = new Map()
    for (const x of listas.filter((y) => y.arquetipo === a)) for (const c of x.lista?.pokemon || []) { const k = clave(c.name); const e = m.get(k) || { mazos: 0, nombre: c.name }; e.mazos++; m.set(k, e) }
    jugado.set(a, { decks: ls.length, cartas: m, deListas: ls.length >= 3 })
  }
  for (const [a, filas] of Object.entries(cdia)) {
    const porDia = new Map()
    for (const f of filas) porDia.set(f.dia, Math.max(porDia.get(f.dia) || 0, f.mazos))
    const decks = [...porDia.values()].reduce((p, q) => p + q, 0)
    const m = new Map()
    for (const f of filas) { if (f.seccion !== 'pokemon') continue; const k = clave(f.nombre); const e = m.get(k) || { mazos: 0, nombre: f.nombre }; e.mazos += f.mazos; m.set(k, e) }
    jugado.set(a, { decks, cartas: m, deListas: false })
  }
  const impresion = new Map()
  for (const x of listas) for (const c of x.lista?.pokemon || []) { const k = `${clave(c.name)}|${c.set}|${c.number}`; impresion.set(k, (impresion.get(k) || 0) + 1) }
  const impresionDe = (k) => { let mejor = null; for (const [ks, n] of impresion) { const [nom, set, num] = ks.split('|'); if (nom === k && (!mejor || n > mejor.n)) mejor = { set, num, n } } return mejor }
  const ids = [...jugado.keys()].filter((a) => !FUERA(a) && meta.has(a) && jugado.get(a).decks >= 3)

  // ── 2. Las reglas ──
  const umbral = 0.85
  const candidatas = (a) => {
    const ls = porArq.get(a) || []
    if (ls.length < 3) {
      const { decks, cartas } = jugado.get(a)
      return [...cartas.entries()].filter(([, e]) => e.mazos / decks >= umbral).map(([n]) => ({ n, m: 1 }))
    }
    const cuenta = new Map()
    for (const x of ls) for (const [k, v] of x.f) { if (!cuenta.has(k)) cuenta.set(k, []); cuenta.get(k).push(v) }
    const out = []
    for (const [k, vs] of cuenta) {
      if (vs.length / ls.length < umbral) continue
      const todos = [...vs, ...Array(ls.length - vs.length).fill(0)].sort((p, q) => q - p)
      const corte = Math.max(1, todos[Math.max(0, Math.ceil(umbral * ls.length) - 1)])
      for (let m = 1; m <= corte; m++) out.push({ n: k, m })
    }
    return out
  }
  const cumple = (x, regla) => regla.every((r) => (x.f.get(r.n) || 0) >= r.m)
  const reglas = new Map()
  const ganador = (x) => { let mejor = null; for (const [id, regla] of reglas) { if (!regla.length || !cumple(x, regla)) continue; if (!mejor || regla.length > mejor.len || (regla.length === mejor.len && id < mejor.id)) mejor = { id, len: regla.length } } return mejor?.id || null }
  const aciertos = (lista) => { let n = 0; for (const x of lista) if (ganador(x) === x.a) n++; return n }
  const cartaDeIcono = (a, slug) => {
    const tokens = String(slug).toLowerCase().split('-').filter(Boolean)
    const m = jugado.get(a).cartas
    const casa = (k, ts) => { const ws = k.split(' ').map((w) => w.replace(/'s$/, '')); return ts.every((t) => ws.includes(t)) }
    let c = [...m.entries()].filter(([k]) => casa(k, tokens)).sort((p, q) => q[1].mazos - p[1].mazos)
    if (!c.length) { const base = tokens.filter((t) => !['mega', 'ex', 'v', 'vmax', 'vstar'].includes(t)).slice(0, 1); c = [...m.entries()].filter(([k]) => casa(k, base)).sort((p, q) => q[1].mazos - p[1].mazos) }
    return c[0]?.[0] || null
  }
  const anclas = new Map()
  for (const a of ids) {
    const cands = new Set(candidatas(a).filter((c) => c.m === 1).map((c) => c.n))
    let ancla = [...new Set((meta.get(a).iconos || []).map((s) => cartaDeIcono(a, s)).filter(Boolean))].filter((k) => cands.has(k))
    if (!ancla.length) { const c = candidatas(a).filter((x) => x.m === 1); if (c.length) ancla = [c[0].n] }
    anclas.set(a, ancla)
    reglas.set(a, ancla.map((n) => ({ n, m: 1 })))
  }
  for (const a of ids) if (!reglas.get(a).length) reglas.delete(a)
  log('con solo los iconos:', aciertos(L), 'de', L.length)
  for (let vuelta = 0; vuelta < 8; vuelta++) {
    let mejoro = false
    for (const a of [...reglas.keys()]) {
      if (!jugado.get(a).deListas) continue
      const regla = reglas.get(a)
      const afectadas = L.filter((x) => cumple(x, regla))
      const base = aciertos(afectadas)
      let mejor = null
      for (const c of candidatas(a)) {
        if (regla.some((r) => r.n === c.n && r.m >= c.m)) continue
        const nueva = [...regla.filter((r) => r.n !== c.n), c]
        if (nueva.length > 5) continue
        reglas.set(a, nueva)
        const d = aciertos(afectadas) - base
        reglas.set(a, regla)
        if (d > 0 && (!mejor || d > mejor.d)) mejor = { d, nueva }
      }
      if (mejor) { reglas.set(a, mejor.nueva); mejoro = true }
    }
    if (!mejoro) break
  }
  // Los pares que se siguen confundiendo: al que pierde, de una vez, lo que
  // le haga falta para tener más requisitos que el que gana.
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    const conf = new Map()
    for (const x of L) { const g = ganador(x); if (g && g !== x.a && reglas.has(x.a)) conf.set(`${x.a}>${g}`, (conf.get(`${x.a}>${g}`) || 0) + 1) }
    let mejoro = false
    for (const [par, n] of [...conf].sort((p, q) => q[1] - p[1])) {
      if (n < 5) break
      const [A, B] = par.split('>')
      const ra = reglas.get(A), rb = reglas.get(B)
      const falta = rb.length - ra.length + (A < B ? 0 : 1)
      if (falta <= 0 || ra.length + falta > 7) continue
      const extra = candidatas(A).filter((c) => c.m === 1 && !ra.some((r) => r.n === c.n)).slice(0, falta)
      if (extra.length < falta) continue
      const antes = aciertos(L)
      reglas.set(A, [...ra, ...extra])
      if (aciertos(L) > antes) mejoro = true
      else reglas.set(A, ra)
    }
    if (!mejoro) break
  }
  const sinFuera = L.filter((x) => !FUERA(x.a))
  log('final:', aciertos(sinFuera), 'de', sinFuera.length)

  // Dos ids con la MISMA regla (Limitless renombra): el visto más tarde.
  const firma = (r) => r.map((x) => `${x.n}*${x.m}`).sort().join('~')
  for (const a of [...reglas.keys()]) for (const b of [...reglas.keys()]) {
    if (a < b && reglas.has(a) && reglas.has(b) && firma(reglas.get(a)) === firma(reglas.get(b))) reglas.delete(String(meta.get(a).visto_at) < String(meta.get(b).visto_at) ? a : b)
  }

  // ── 3. Nombres bonitos, en español y los iconos ──
  const visto = new Map()
  for (const x of listas) for (const s of ['pokemon', 'trainer', 'energy']) for (const c of x.lista?.[s] || []) if (!visto.has(clave(c.name))) visto.set(clave(c.name), c.name)
  for (const filas of Object.values(cdia)) for (const f of filas) if (!visto.has(clave(f.nombre))) visto.set(clave(f.nombre), f.nombre)
  const bonito = (k) => visto.get(k) || k
  const ingleses = [...new Set([...reglas.values()].flat().map((r) => bonito(r.n)))]
  const es = new Map()
  for (let i = 0; i < ingleses.length; i += 80) {
    const t = ingleses.slice(i, i + 80)
    const [a, b] = await Promise.all([
      supabase.from('tcg_cards').select('name,name_en,name_es').eq('market', 'WEST').in('name_en', t).limit(1000),
      supabase.from('tcg_cards').select('name,name_en,name_es').eq('market', 'WEST').in('name', t).limit(1000),
    ])
    for (const c of [...(a.data || []), ...(b.data || [])]) {
      const en = t.find((n) => n === c.name_en) || t.find((n) => n === c.name)
      if (!en) continue
      const s = es.get(en) || new Set()
      for (const o of [c.name_es, c.name]) if (o && clave(o) !== clave(en) && o.trim().length >= 3) s.add(o.trim().replace(/\.+$/, ''))
      es.set(en, s)
    }
  }
  const lineas = []
  for (const [id, regla] of reglas) {
    const m = meta.get(id)
    const iconos = [...new Set((m.iconos || []).map((s) => cartaDeIcono(id, s)).filter(Boolean))].slice(0, 2).map((k) => { const p = impresionDe(k); return [p?.set || '', p?.num || '', bonito(k)].join(',') })
    const req = regla.map((r) => { const en = bonito(r.n); return [en, ...(es.get(en) || [])].join('^') + (r.m > 1 ? `*${r.m}` : '') })
    lineas.push([id, m.nombre, iconos.join(';'), req.join('~')].join('|'))
  }
  window.__compacto = lineas.join('\n')
  log('listo:', lineas.length, 'arquetipos en window.__compacto (cópialo con copy(window.__compacto)). OJO: revisa a mano los nombres en español raros (la 1460 quitó «Zamazenta» del Typhlosion de Eco, una fila mal del catálogo).')
})()
