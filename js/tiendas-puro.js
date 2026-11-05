// Lo puro de las tiendas (tanda 1067): sin base ni pantalla, para que lo
// usen /tiendas, /alta-tienda, /tienda y /admin, y se pruebe en Node.

// La solicitud de /tiendas: lo mínimo para no mandar una que la base
// rechazaría (la base lo vuelve a mirar: esto solo ayuda a rellenar).
// La ciudad es opcional desde la 1074 (PINGU: «no hace falta que sea una
// tienda física»: un particular que se dedica a la compraventa también).
export function validarSolicitud({ nombre, ciudad, email }) {
  if (String(nombre || '').trim().length < 2) return 'Escribe el nombre de la tienda.'
  const c = String(ciudad || '').trim()
  if (c && c.length < 2) return 'Escribe la ciudad entera, o déjala vacía.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())) return 'Revisa que el email sea correcto.'
  return null
}

// La forma de un @ que acepta la base (la misma regla que `tienda_alta`).
export const FORMA_DE_USUARIO = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/

// Por qué una invitación no vale, como lo dice `tienda_invitacion`.
export const MOTIVOS_DE_INVITACION = {
  no_existe: 'El enlace no es de ninguna invitación. Cópialo entero del correo o pide acceso otra vez.',
  usada: 'Esta invitación ya se usó: la tienda ya tiene su cuenta. Entra desde «Entrar» con el email de la tienda.',
  caducada: 'Esta invitación ha caducado (duran 14 días). Pide acceso otra vez y te mandamos otra.',
}

// El token de /alta-tienda: el de la dirección manda; si no viene (la
// confirmación del correo o Google pueden volver sin él), el apuntado.
export function tokenDeAlta(search, guardado) {
  const t = new URLSearchParams(search || '').get('i') || guardado || ''
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t) ? t.toLowerCase() : null
}

// Qué cara de /tienda le toca a quien la abre.
export function caraDelPanel({ sesion, perfil }) {
  if (!sesion) return 'tdEntrar'
  if (perfil?.tipo === 'tienda') return 'tdPanel'
  if (perfil?.is_admin) return 'tdEquipo'
  return 'tdCerrado'
}

// /admin → Tiendas: cuántas hay de cada estado.
export function cuentaDeSolicitudes(lista) {
  const c = { pendiente: 0, aceptada: 0, usada: 0, rechazada: 0 }
  for (const f of lista || []) if (f.estado in c) c[f.estado]++
  return c
}

// Una aceptada cuya invitación caducó sin usarse (se reenvía con «Aceptar»).
export function invitacionCaducada(f, ahora = Date.now()) {
  return f?.estado === 'aceptada' && !!f.caduca && new Date(f.caduca).getTime() < ahora
}

// ── El stock (1068) ──

// El margen sobre lo pagado: (precio − coste) / coste. Sin coste o sin
// precio no hay margen (la 319: un cero que no es cero miente).
export function margenDe(precio, coste) {
  const p = Number(precio)
  const c = Number(coste)
  if (precio == null || coste == null || !Number.isFinite(p) || !Number.isFinite(c) || c <= 0) return null
  return { euros: Math.round((p - c) * 100) / 100, pct: Math.round(((p - c) / c) * 100) }
}

// Una oferta (1082) de una línea del stock: el precio rebajado mientras dure
// (sin fecha, hasta que se quite), el de siempre y cuánto baja. La regla de
// `tienda_precio_de` en la base. `null` si no hay oferta o ya acabó.
export function ofertaDe(linea, ahora = Date.now()) {
  if (!linea || linea.oferta_precio == null || linea.oferta_precio === '') return null
  const hasta = linea.oferta_hasta ? new Date(linea.oferta_hasta).getTime() : null
  if (hasta != null && !(hasta > ahora)) return null
  const precio = Number(linea.oferta_precio)
  const antes = linea.precio == null ? null : Number(linea.precio)
  const pct = antes > 0 && precio < antes ? Math.round((1 - precio / antes) * 100) : null
  return { precio, antes, pct, hasta: linea.oferta_hasta || null }
}

// El precio que cuenta para vender o enseñar: el de la oferta si la hay.
export function precioQueCuenta(linea, ahora = Date.now()) {
  const o = ofertaDe(linea, ahora)
  if (o) return o.precio
  return linea?.precio == null ? null : Number(linea.precio)
}

// La rebaja de una oferta en bloque: un tanto por ciento sobre SU precio, a
// céntimos. Sin precio no hay de qué rebajar.
export function precioRebajado(precio, pct) {
  if (precio == null || !Number.isFinite(Number(precio)) || !Number.isFinite(Number(pct))) return null
  return Math.max(0, Math.round(Number(precio) * (1 - Number(pct) / 100) * 100) / 100)
}

// El redondeo del precio en bloque, el mismo que `tienda_redondear` en la
// base: «95» es el ,95 de arriba (12,40 → 12,95; 12,97 → 13,95), «99» igual,
// «entero» el euro de arriba y «centimo» tal cual.
export function redondearPrecio(v, modo = 'centimo') {
  if (v == null || !Number.isFinite(Number(v))) return null
  const n = Number(v)
  const fija = (x) => Math.round(x * 100) / 100
  if (modo === '95' || modo === '99') {
    const cola = Number(modo) / 100
    const base = Math.floor(n)
    return fija(Math.max(n - base > cola + 1e-9 ? base + 1 + cola : base + cola, cola))
  }
  if (modo === 'entero') return Math.ceil(n - 1e-9)
  return fija(n)
}

export const precioSugerido = (cm, pct = 0, modo = 'centimo') =>
  cm == null || !(Number(cm) > 0) ? null : redondearPrecio(Number(cm) * (1 + Number(pct || 0) / 100), modo)

// Los grupos de filtros de lista y los de una sola opción, para pintar las
// chapas de «lo que está puesto» y para quitarlas de una en una.
export const GRUPOS_LISTA = ['catalogo', 'sets', 'idioma', 'estado', 'variante', 'rareza', 'margen', 'contra', 'dias', 'unidades', 'gradeadas', 'visible', 'ubicacion']
export const RANGOS = [['precio_min', 'precio_max', 'Tu precio'], ['cm_min', 'cm_max', 'Cardmarket'], ['coste_min', 'coste_max', 'Coste']]

export function alternarFiltro(filtros, grupo, valor) {
  const f = { ...(filtros || {}) }
  const lista = new Set(f[grupo] || [])
  if (lista.has(valor)) lista.delete(valor)
  else lista.add(valor)
  if (lista.size) f[grupo] = [...lista]
  else delete f[grupo]
  return f
}

// Las chapas de lo puesto: {grupo, valor, texto}. `nombre(grupo, valor)` es
// quien sabe cómo se llama cada cosa (el nombre de un set, «Español»…).
export function chapasDeFiltros(filtros, nombre = (g, v) => v) {
  const f = filtros || {}
  const chapas = []
  if (f.q) chapas.push({ grupo: 'q', valor: f.q, texto: `«${f.q}»` })
  for (const g of GRUPOS_LISTA) for (const v of f[g] || []) chapas.push({ grupo: g, valor: v, texto: nombre(g, v) })
  const euros = (x) => `${String(x).replace('.', ',')} €`
  for (const [min, max, texto] of RANGOS) {
    if (f[min] != null && f[max] != null) chapas.push({ grupo: min, valor: max, texto: `${texto}: ${euros(f[min])}–${euros(f[max])}` })
    else if (f[min] != null) chapas.push({ grupo: min, valor: null, texto: `${texto}: desde ${euros(f[min])}` })
    else if (f[max] != null) chapas.push({ grupo: max, valor: null, texto: `${texto}: hasta ${euros(f[max])}` })
  }
  return chapas
}

export function quitarChapa(filtros, { grupo, valor }) {
  const f = { ...(filtros || {}) }
  if (grupo === 'q') delete f.q
  else if (GRUPOS_LISTA.includes(grupo)) return alternarFiltro(f, grupo, valor)
  else {
    delete f[grupo]
    if (valor && /_max$/.test(valor)) delete f[valor]
  }
  return f
}

// El CSV del stock: con las cabeceras que el propio importador reconoce,
// para que lo exportado se pueda volver a meter.
export const CABECERA_STOCK = ['id', 'producto', 'nombre', 'expansion', 'numero', 'idioma', 'estado', 'variante', 'gradeo', 'unidades', 'coste', 'pvp', 'cardmarket', 'ubicacion', 'visible', 'notas']
export function csvDeStock(filas, nombreDeSet = (id) => id || '') {
  const celda = (v) => {
    if (v == null) return ''
    const t = typeof v === 'number' ? String(v).replace('.', ',') : String(v)
    return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const lineas = [CABECERA_STOCK.join(';')]
  for (const f of filas || []) {
    lineas.push([
      f.card_id, f.product_id, f.nombre, f.set_id ? nombreDeSet(f.set_id) : '', f.numero, f.idioma, f.product_id ? '' : f.estado,
      f.product_id ? '' : f.variante, f.gradeo, f.unidades, f.coste, f.precio, f.cm, f.ubicacion, f.visible === false ? 'no' : 'si', f.notas,
    ].map(celda).join(';'))
  }
  return lineas.join('\n')
}

// ── Web e Instagram (1074) ──
//
// Dos campos desde la 1074 (PINGU: «la web por un lado y el Instagram, por si
// tienen»). Antes era uno, «Web o Instagram», así que una `web` que es un @ o
// un enlace de Instagram se lee como Instagram.

// El usuario de Instagram de lo que alguien escribe (`@tienda`,
// `instagram.com/tienda`, con o sin https), o null si no lo es. Sus usuarios:
// letras, números, punto y guion bajo, hasta 30.
export function instagramDe(texto) {
  const t = String(texto || '').trim()
  const m = t.match(/^@([A-Za-z0-9._]{1,30})$/) || t.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:\?.*)?$/i)
  return m ? m[1] : null
}

// La web como enlace: solo http(s); sin esquema, https. Lo demás, nada.
export function webDe(texto) {
  const t = String(texto || '').trim()
  if (!t || instagramDe(t) || /\s/.test(t)) return null
  const con = /^https?:\/\//i.test(t) ? t : /^[a-z][a-z0-9+.-]*:/i.test(t) ? null : `https://${t}`
  if (!con) return null
  try {
    const u = new URL(con)
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null
    return { href: u.href, texto: (u.hostname + u.pathname).replace(/^www\./, '').replace(/\/$/, '') }
  } catch {
    return null
  }
}

// Los enlaces que enseña su escaparate, en orden: la web y su Instagram.
export function enlacesDeTienda(t) {
  const fuera = []
  const web = webDe(t?.web)
  if (web) fuera.push({ tipo: 'web', ...web })
  const ig = instagramDe(t?.instagram ? (/^@|instagram\.com/i.test(t.instagram) ? t.instagram : `@${t.instagram}`) : null) || instagramDe(t?.web)
  if (ig) fuera.push({ tipo: 'instagram', href: `https://www.instagram.com/${ig}/`, texto: `@${ig}` })
  return fuera
}

// «Cómo llegar» (1069): el mapa con la dirección de la tienda. Sin dirección
// no hay botón (una ciudad sola lleva al centro, que no es la tienda).
export function enlaceAMapa(direccion, ciudad) {
  const d = String(direccion || '').trim()
  if (!d) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([d, String(ciudad || '').trim()].filter(Boolean).join(', '))}`
}

// ── Las ventas (1072) ──

// Dónde se vendió (PINGU eligió apuntarlo): los mismos que acepta la base.
export const DONDE_VENTA = [['mostrador', 'Mostrador'], ['cardmarket', 'Cardmarket'], ['evento', 'Evento'], ['otro', 'Otro']]
// Los nombres de TODOS los sitios de venta: lo vendido por una oferta (1250)
// dice «PokeDoc», pero no se elige en Vender.
export const DONDE_NOMBRE = Object.fromEntries([...DONDE_VENTA, ['pokedoc', 'PokeDoc']])

// Lo que suma una venta antes de apuntarla, con la cuenta de `tienda_vender`:
// el beneficio solo de lo que tiene coste, y sin ninguna con coste no hay
// beneficio (null, no un cero). El margen, sobre lo pagado.
export function cuentaDeVenta(lineas) {
  let unidades = 0
  let importe = 0
  let coste = 0
  let beneficio = 0
  let conCoste = 0
  let sinCoste = 0
  for (const l of lineas || []) {
    const n = Number(l.unidades)
    const p = Number(l.precio)
    if (!(n > 0) || l.precio == null || l.precio === '' || !Number.isFinite(p)) continue
    unidades += n
    importe += p * n
    if (l.coste == null || !Number.isFinite(Number(l.coste))) {
      sinCoste++
      continue
    }
    conCoste++
    coste += Number(l.coste) * n
    beneficio += (p - Number(l.coste)) * n
  }
  const r = (x) => Math.round(x * 100) / 100
  return { unidades, importe: r(importe), beneficio: conCoste ? r(beneficio) : null, margen: coste > 0 ? Math.round((beneficio / coste) * 100) : null, sinCoste }
}

// Los periodos de Ventas (y de Hoy, 1073), en la hora de quien mira:
// `desde` incluido y `hasta` sin incluir, como los pide la base.
export const PERIODOS = [['hoy', 'Hoy'], ['semana', '7 días'], ['mes', 'Este mes'], ['anio', 'Este año'], ['todo', 'Todo']]
export function rangoDePeriodo(periodo, ahora = new Date()) {
  const dia = (a, m, d) => new Date(a, m, d)
  const a = ahora.getFullYear()
  const m = ahora.getMonth()
  const d = ahora.getDate()
  const r = {
    hoy: [dia(a, m, d), dia(a, m, d + 1)],
    semana: [dia(a, m, d - 6), dia(a, m, d + 1)],
    mes: [dia(a, m, 1), dia(a, m + 1, 1)],
    anio: [dia(a, 0, 1), dia(a + 1, 0, 1)],
  }[periodo]
  return r ? { desde: r[0].toISOString(), hasta: r[1].toISOString() } : { desde: null, hasta: null }
}

// ── El cierre del mes (1094) ──

// Los meses que se ofrecen: este y los once de antes, del más nuevo al más
// viejo. `clave` es «2026-10».
export function mesesDeCierre(ahora = new Date(), cuantos = 12) {
  const r = []
  for (let i = 0; i < cuantos; i++) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
    r.push({ clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, nombre: d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) })
  }
  return r
}

// El mes entero en la hora de quien mira: del día 1 a las 0:00 al día 1 del
// siguiente.
export function rangoDeMes(clave) {
  const [a, m] = String(clave).split('-').map(Number)
  return { desde: new Date(a, m - 1, 1).toISOString(), hasta: new Date(a, m, 1).toISOString(), dias: new Date(a, m, 0).getDate() }
}

// Las cuentas del cierre, de las filas de las ventas y las compras del mes:
// lo vendido, lo que costó (solo lo que tiene coste) y lo que dejó, cada día,
// por dónde (ventas = tickets) y lo más vendido. El beneficio, como en Ventas:
// sin coste, la venta queda fuera de la cuenta (no es un cero).
export function cierreDelMes(ventas, compras, clave) {
  const r2 = (v) => Math.round(v * 100) / 100
  const { dias } = rangoDeMes(clave)
  const porDia = Array.from({ length: dias }, (_, i) => ({ dia: i + 1, importe: 0 }))
  const porDonde = {}
  const top = new Map()
  const tickets = new Set()
  let importe = 0
  let coste = 0
  let conCoste = 0
  let sinCoste = 0
  let unidades = 0
  for (const v of ventas || []) {
    const n = Number(v.unidades) || 0
    const total = Number(v.precio) * n
    importe += total
    unidades += n
    tickets.add(v.ticket)
    if (v.coste == null) sinCoste++
    else {
      coste += Number(v.coste) * n
      conCoste += total
    }
    const d = new Date(v.vendida_el).getDate()
    if (porDia[d - 1]) porDia[d - 1].importe += total
    const dd = (porDonde[v.donde] ||= { tickets: new Set(), importe: 0 })
    dd.tickets.add(v.ticket)
    dd.importe += total
    const k = `${v.card_id || ''}|${v.product_id || ''}`
    const t = top.get(k) || { nombre: v.nombre || 'Producto', set_id: v.set_id || null, numero: v.numero || null, unidades: 0, importe: 0 }
    t.unidades += n
    t.importe += total
    top.set(k, t)
  }
  const comprado = (compras || []).reduce((s, c) => s + Number(c.coste) * (Number(c.unidades) || 0), 0)
  const beneficio = conCoste - coste
  return {
    importe: r2(importe), coste: r2(coste), beneficio: r2(beneficio), margen: coste > 0 ? Math.round((beneficio / coste) * 100) : null,
    sinCoste, unidades, ventas: tickets.size,
    comprado: r2(comprado), compras: new Set((compras || []).map((c) => c.ticket)).size, unidadesCompradas: (compras || []).reduce((s, c) => s + (Number(c.unidades) || 0), 0),
    porDia: porDia.map((d) => ({ ...d, importe: r2(d.importe) })),
    porDonde: Object.fromEntries(Object.entries(porDonde).map(([k, v]) => [k, { ventas: v.tickets.size, importe: r2(v.importe) }])),
    top: [...top.values()].sort((a, b) => b.importe - a.importe || b.unidades - a.unidades).slice(0, 10).map((t) => ({ ...t, importe: r2(t.importe) })),
  }
}

// El CSV de las ventas, con punto y coma y la coma decimal, como el del stock.
export const CABECERA_VENTAS = ['fecha', 'venta', 'id', 'producto', 'nombre', 'expansion', 'numero', 'idioma', 'estado', 'variante', 'gradeo', 'unidades', 'precio', 'coste', 'beneficio', 'donde']
export function csvDeVentas(filas, nombreDeSet = (id) => id || '') {
  const celda = (v) => {
    if (v == null) return ''
    const t = typeof v === 'number' ? String(v).replace('.', ',') : String(v)
    return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const lineas = [CABECERA_VENTAS.join(';')]
  for (const f of filas || []) {
    const beneficio = f.coste == null ? null : Math.round((Number(f.precio) - Number(f.coste)) * Number(f.unidades) * 100) / 100
    lineas.push([
      f.vendida_el, f.ticket, f.card_id, f.product_id, f.nombre, f.set_id ? nombreDeSet(f.set_id) : '', f.numero, f.idioma,
      f.product_id ? '' : f.estado, f.product_id ? '' : f.variante, f.gradeo, f.unidades, Number(f.precio), f.coste == null ? null : Number(f.coste), beneficio,
      DONDE_NOMBRE[f.donde] || f.donde,
    ].map(celda).join(';'))
  }
  return lineas.join('\n')
}

// ── Comprar a un cliente (1091) ──

// Lo que paga la tienda por unidad: un tanto por ciento de lo que vale en
// Cardmarket (orientativo), al céntimo. Sin precio de Cardmarket, `null`: lo
// pone ella a mano.
export function pagoDeCompra(cm, pct) {
  const v = Number(cm)
  const p = Number(pct)
  if (cm == null || cm === '' || !(v > 0) || !Number.isFinite(p) || p < 0) return null
  return Math.round(v * p) / 100
}

// Un total redondo («te doy 40 € por todo»), repartido por unidad según lo
// que vale cada una; lo que no tiene precio de Cardmarket cuenta como la media
// de las que sí (y si ninguna tiene, a partes iguales). Los céntimos que sobran
// del redondeo van a una línea de UNA unidad, para que la suma sea el total
// exacto; si no hay ninguna, se reparten por unidades y puede quedar un
// céntimo arriba o abajo (la cuenta de abajo dice el de verdad).
export function repartirTotal(lineas, total) {
  const t = Math.round(Number(total) * 100)
  const ls = (lineas || []).map((l) => ({ n: Math.max(0, Math.round(Number(l.unidades) || 0)), cm: Number(l.cm) > 0 ? Number(l.cm) : null }))
  if (!(t >= 0) || !ls.length || !ls.some((l) => l.n > 0)) return ls.map(() => null)
  const conCm = ls.filter((l) => l.cm != null && l.n > 0)
  const media = conCm.length ? conCm.reduce((s, l) => s + l.cm, 0) / conCm.length : 1
  const pesos = ls.map((l) => (l.n > 0 ? (l.cm ?? media) * l.n : 0))
  const suma = pesos.reduce((s, p) => s + p, 0)
  const porUnidad = ls.map((l, i) => (l.n > 0 ? Math.floor((t * pesos[i]) / suma / l.n) : 0))
  let resto = t - porUnidad.reduce((s, c, i) => s + c * ls[i].n, 0)
  const una = ls.findIndex((l) => l.n === 1)
  if (una >= 0) porUnidad[una] += resto
  else {
    for (let i = 0; i < ls.length && resto >= ls[i].n; i++) {
      if (!ls[i].n) continue
      const k = Math.floor(resto / ls[i].n)
      porUnidad[i] += k
      resto -= k * ls[i].n
    }
  }
  return porUnidad.map((c, i) => (ls[i].n > 0 ? c / 100 : null))
}

// Lo que suma una compra antes de cerrarla: lo que pagas, lo que valía en
// Cardmarket lo que tiene precio, y el tanto por ciento que es (de eso).
export function cuentaDeCompra(lineas) {
  let unidades = 0
  let total = 0
  let cm = 0
  let pagadoConCm = 0
  for (const l of lineas || []) {
    const n = Number(l.unidades)
    const p = Number(l.pagas)
    if (!(n > 0) || l.pagas == null || l.pagas === '' || !Number.isFinite(p)) continue
    unidades += n
    total += p * n
    if (Number(l.cm) > 0) {
      cm += Number(l.cm) * n
      pagadoConCm += p * n
    }
  }
  const r = (v) => Math.round(v * 100) / 100
  return { unidades, total: r(total), cm: r(cm), pct: cm > 0 ? Math.round((pagadoConCm / cm) * 100) : null }
}

export const CABECERA_COMPRAS = ['fecha', 'compra', 'id', 'producto', 'nombre', 'expansion', 'numero', 'idioma', 'estado', 'variante', 'gradeo', 'unidades', 'pagado', 'cardmarket', 'cliente']
export function csvDeCompras(filas, nombreDeSet = (id) => id || '') {
  const celda = (v) => {
    if (v == null) return ''
    const t = typeof v === 'number' ? String(v).replace('.', ',') : String(v)
    return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const lineas = [CABECERA_COMPRAS.join(';')]
  for (const f of filas || []) {
    lineas.push([
      f.comprada_el, f.ticket, f.card_id, f.product_id, f.nombre, f.set_id ? nombreDeSet(f.set_id) : '', f.numero, f.idioma,
      f.product_id ? '' : f.estado, f.product_id ? '' : f.variante, f.gradeo, f.unidades, Number(f.coste), f.cm == null ? null : Number(f.cm), f.cliente,
    ].map(celda).join(';'))
  }
  return lineas.join('\n')
}

// ── Hoy (1073) ──

// El periodo de Hoy y el anterior, cortado A LA MISMA ALTURA: hoy contra
// ayer hasta esta hora, el mes contra el mes pasado hasta este día. Comparar
// un mes a medias con uno entero diría siempre «vendes menos».
export const PERIODOS_HOY = [['hoy', 'Hoy'], ['semana', 'Semana'], ['mes', 'Mes'], ['anio', 'Año']]
export function periodoDeHoy(periodo, ahora = new Date()) {
  const a = ahora.getFullYear()
  const m = ahora.getMonth()
  const d = ahora.getDate()
  const dia = (x, y, z) => new Date(x, y, z)
  const corre = ahora.getTime() - dia(a, m, d).getTime()
  const iso = (x) => x.toISOString()
  if (periodo === 'semana') {
    const desde = dia(a, m, d - 6)
    return { desde: iso(desde), hasta: iso(dia(a, m, d + 1)), antesDesde: iso(dia(a, m, d - 13)), antesHasta: iso(new Date(dia(a, m, d - 7).getTime() + corre)), paso: 'day', frente: 'que los 7 días de antes' }
  }
  if (periodo === 'mes') {
    const dias = new Date(a, m, 0).getDate()
    return { desde: iso(dia(a, m, 1)), hasta: iso(dia(a, m + 1, 1)), antesDesde: iso(dia(a, m - 1, 1)), antesHasta: iso(new Date(dia(a, m - 1, Math.min(d, dias)).getTime() + corre)), paso: 'day', frente: 'que el mes pasado a estas alturas' }
  }
  if (periodo === 'anio') {
    return { desde: iso(dia(a, 0, 1)), hasta: iso(dia(a + 1, 0, 1)), antesDesde: iso(dia(a - 1, 0, 1)), antesHasta: iso(new Date(dia(a - 1, m, Math.min(d, new Date(a - 1, m + 1, 0).getDate())).getTime() + corre)), paso: 'month', frente: 'que el año pasado a estas alturas' }
  }
  return { desde: iso(dia(a, m, d)), hasta: iso(dia(a, m, d + 1)), antesDesde: iso(dia(a, m, d - 1)), antesHasta: iso(new Date(dia(a, m, d - 1).getTime() + corre)), paso: 'hour', frente: 'que ayer a esta hora' }
}

// «+18 % que ayer a esta hora». Sin nada antes no hay porcentaje (de cero a
// algo no es «+∞ %»): «Nada ayer a esta hora».
export function comparacion(ahora, antes, frente) {
  const x = Number(ahora) || 0
  const y = Number(antes) || 0
  if (antes == null) return null
  if (!y) return x ? { texto: `Nada ${frente.replace(/^que /, '')}`, sube: true } : null
  const pct = Math.round(((x - y) / y) * 100)
  if (!pct) return { texto: `Igual ${frente.replace(/^que /, 'que ')}`, sube: null }
  return { texto: `${pct > 0 ? '+' : '−'}${Math.abs(pct)} % ${frente}`, sube: pct > 0 }
}

// El recibo de una venta (1084): un PDF de una página con la imagen del
// recibo dentro, sin librerías. Un JPEG va tal cual en un PDF (DCTDecode),
// así que basta con escribir los objetos y la tabla de dónde empieza cada
// uno. La página mide lo que la imagen, a 80 mm de ancho (un ticket).
export function pdfDeJpeg(jpeg, ancho, alto) {
  const W = 226.77 // 80 mm en puntos
  return pdfDeImagenes([{ jpeg, ancho, alto }], { anchoPt: W, altoPt: Math.round((W * alto) / ancho * 100) / 100 })
}

// Varias páginas (las etiquetas, 1093), cada una una imagen a página entera
// del tamaño que se diga en puntos. Con una sola, los mismos cinco objetos y
// en el mismo orden que el recibo de siempre.
export const PUNTOS_POR_MM = 72 / 25.4
export function pdfDeImagenes(paginas, { anchoPt, altoPt }) {
  const enc = new TextEncoder()
  const W = anchoPt
  const H = altoPt
  const contenido = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`
  const trozos = []
  const posiciones = []
  let largo = 0
  const poner = (x) => {
    const b = typeof x === 'string' ? enc.encode(x) : x
    trozos.push(b)
    largo += b.length
  }
  const objeto = (n, cuerpo) => {
    posiciones[n] = largo
    poner(`${n} 0 obj\n${cuerpo}\nendobj\n`)
  }
  const total = 2 + paginas.length * 3
  poner('%PDF-1.4\n')
  objeto(1, '<< /Type /Catalog /Pages 2 0 R >>')
  objeto(2, `<< /Type /Pages /Kids [${paginas.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] /Count ${paginas.length} >>`)
  paginas.forEach(({ jpeg, ancho, alto }, i) => {
    const n = 3 + i * 3
    objeto(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${n + 1} 0 R >> >> /Contents ${n + 2} 0 R >>`)
    posiciones[n + 1] = largo
    poner(`${n + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${ancho} /Height ${alto} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`)
    poner(jpeg)
    poner('\nendstream\nendobj\n')
    objeto(n + 2, `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`)
  })
  const xref = largo
  poner(`xref\n0 ${total + 1}\n0000000000 65535 f \n${posiciones.slice(1).map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  const pdf = new Uint8Array(largo)
  let i = 0
  for (const b of trozos) {
    pdf.set(b, i)
    i += b.length
  }
  return pdf
}

// ── Etiquetas (1093) ──

// Los dos formatos: la hoja A4 de 24 (3 × 8, 70 × 37 mm, las de papelería) y
// una por página para impresora de etiquetas (rollo de 62 × 29 mm).
export const FORMATOS_ETIQUETA = {
  a4: { nombre: 'Hoja A4 de 24 (70 × 37 mm)', paginaMm: [210, 297], cols: 3, filas: 8, anchoMm: 70, altoMm: 37.125 },
  rollo: { nombre: 'Una por carta (62 × 29 mm)', paginaMm: [62, 29], cols: 1, filas: 1, anchoMm: 62, altoMm: 29 },
}

// Una etiqueta por línea, o una por cada unidad (para las fundas).
export function etiquetasDeLineas(filas, { porUnidad = false } = {}) {
  const r = []
  for (const f of filas || []) {
    const n = porUnidad ? Math.max(1, Math.min(200, Number(f.unidades) || 1)) : 1
    for (let i = 0; i < n; i++) r.push(f)
  }
  return r
}

// Dónde cae cada etiqueta: página y esquina en mm. `saltar` deja libres las
// primeras de una hoja empezada (solo en la hoja de 24).
export function colocarEtiquetas(n, formato, saltar = 0) {
  const f = FORMATOS_ETIQUETA[formato] || FORMATOS_ETIQUETA.a4
  const porHoja = f.cols * f.filas
  const desde = formato === 'a4' ? Math.max(0, Math.min(porHoja - 1, Math.round(Number(saltar) || 0))) : 0
  const sitios = []
  for (let i = 0; i < n; i++) {
    const k = i + desde
    const pagina = Math.floor(k / porHoja)
    const enHoja = k % porHoja
    sitios.push({ pagina, x: (enHoja % f.cols) * f.anchoMm, y: Math.floor(enHoja / f.cols) * f.altoMm })
  }
  return { sitios, paginas: n ? sitios[sitios.length - 1].pagina + 1 : 0 }
}

// Las cuentas de un recibo: cada línea con su importe y el total. Del coste
// y el beneficio, nada: el recibo es para quien compra.
export function cuentaDeRecibo(lineas) {
  const filas = (lineas || []).map((l) => {
    const unidades = Number(l.unidades) || 0
    const precio = Number(l.precio) || 0
    return { ...l, unidades, precio, importe: Math.round(unidades * precio * 100) / 100 }
  })
  return { filas, unidades: filas.reduce((n, l) => n + l.unidades, 0), total: Math.round(filas.reduce((n, l) => n + l.importe, 0) * 100) / 100 }
}

// ── El horario (1244): «Abierta · hasta 20:30» ──
// El horario lo escribe la tienda a mano en Datos («L–S · 10:30–20:30»,
// «L-V 10-14 y 17-20:30, S 10-14», «lunes a sábado de 10:00 a 20:00»). Se lee
// lo que se entiende y, si algo no se entiende, NO se dice nada: un «cerrada»
// de una tienda abierta es peor que ninguna chapa (PINGU eligió la chapa con
// esa condición). Los días van de 0 (domingo) a 6 (sábado), como Date.
const DIAS_DE_HORARIO = [
  [/^(?:domingos?|dom|do|d)$/, 0], [/^(?:lunes|lun|lu|l)$/, 1], [/^(?:martes|mar|ma|m)$/, 2],
  [/^(?:miercoles|mie|mi|x)$/, 3], [/^(?:jueves|jue|ju|j)$/, 4], [/^(?:viernes|vie|vi|v)$/, 5],
  [/^(?:sabados?|sab|sa|s)$/, 6],
]
const diaDeHorario = (p) => DIAS_DE_HORARIO.find(([re]) => re.test(p))?.[1] ?? null
const NOMBRE_DE_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const horaDe = (h, m) => (Number(h) <= 24 && Number(m || 0) < 60 ? Number(h) * 60 + Number(m || 0) : null)
export const textoDeHora = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

// { día: [[desde, hasta], …] } en minutos, o null si no se entiende entero.
export function leerHorario(texto) {
  let t = String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (!t.trim()) return null
  t = t.replace(/[–—−]/g, '-').replace(/\bh(?:oras)?\b\.?/g, ' ').replace(/(\d)\s*h\b/g, '$1')
  if (/todos los dias|diario|a diario/.test(t)) t = t.replace(/todos los dias|a diario|diario/g, ' l-d ')
  const horario = {}
  let dias = []
  let conHoras = false
  let entendido = false
  // Una ficha: un tramo de horas, un rango de días o un día suelto.
  const fichas = /(\d{1,2})(?:[:.](\d{2}))?\s*(?:-|a|hasta)\s*(\d{1,2})(?:[:.](\d{2}))?|([a-z]+)\s*(?:-|\ba\b|\bal\b|hasta)\s*([a-z]+)|([a-z]+)|(\d+)/g
  for (const f of t.matchAll(fichas)) {
    if (f[1] != null) {
      const desde = horaDe(f[1], f[2])
      const hasta = horaDe(f[3], f[4])
      if (desde == null || hasta == null || hasta <= desde || !dias.length) return null
      for (const d of dias) (horario[d] ||= []).push([desde, hasta])
      conHoras = true
      entendido = true
      continue
    }
    if (f[5] != null) {
      const a = diaDeHorario(f[5])
      const b = diaDeHorario(f[6])
      if (a == null || b == null) return null
      if (conHoras) { dias = []; conHoras = false }
      for (let d = a, n = 0; n < 7; d = (d + 1) % 7, n++) { dias.push(d); if (d === b) break }
      continue
    }
    if (f[7] != null) {
      const d = diaDeHorario(f[7])
      if (d != null) {
        if (conHoras) { dias = []; conHoras = false }
        dias.push(d)
        continue
      }
      // Palabras que acompañan sin cambiar nada; «cerrado» deja esos días sin horas.
      if (/^(de|y|e|por|la|las|manana|tarde|tardes|mananas|abierto|horario|del|al|a|cerrado|festivos?)$/.test(f[7])) {
        if (f[7] === 'cerrado') { dias = []; conHoras = false }
        continue
      }
      return null
    }
    if (f[8] != null) return null
  }
  return entendido ? horario : null
}

// Lo que dice la chapa ahora: { abierta: true, hasta } o { abierta: false,
// abre: 'hoy 17:00' | 'mañana 10:00' | 'el lunes 10:00' }, o null.
export function estadoDeHorario(texto, ahora = new Date()) {
  const h = leerHorario(texto)
  if (!h) return null
  const hoy = ahora.getDay()
  const min = ahora.getHours() * 60 + ahora.getMinutes()
  const tramo = (h[hoy] || []).find(([a, b]) => min >= a && min < b)
  if (tramo) return { abierta: true, hasta: textoDeHora(tramo[1]) }
  for (let n = 0; n < 8; n++) {
    const d = (hoy + n) % 7
    const sig = (h[d] || []).filter(([a]) => n > 0 || a > min).sort((x, y) => x[0] - y[0])[0]
    if (sig) return { abierta: false, abre: `${n === 0 ? 'hoy' : n === 1 ? 'mañana' : `el ${NOMBRE_DE_DIA[d]}`} ${textoDeHora(sig[0])}` }
  }
  return null
}

// La chapa de la portada de /tiendas (`null` = no se dice nada) y lo que
// filtran sus chips, sobre lo que ya ha llegado (1244).
export function chapaDeEstado(t, ahora = new Date()) {
  const e = t?.horario ? estadoDeHorario(t.horario, ahora) : null
  if (!e) return null
  return e.abierta ? { abierta: true, texto: `Abierta · hasta ${e.hasta}` } : { abierta: false, texto: `Cerrada · abre ${e.abre}` }
}

export function filtrarTiendas(tiendas, { lista, local, online, abiertas } = {}, ciudad = '', ahora = new Date()) {
  return tiendas.filter((t) => (!lista || Number(t.de_tu_lista) > 0)
    && (!local || t.con_local)
    && (!online || !t.con_local)
    && (!abiertas || chapaDeEstado(t, ahora)?.abierta === true)
    && (!ciudad || String(t.ciudad || '').toLowerCase() === ciudad.toLowerCase()))
}


// Tanda 1245 — Fuera de una lista de gente las tiendas de pruebas, salvo la
// propia (quien la usa para probar se sigue viendo).
export const sinFantasmas = (perfiles, fantasmas, yo = null) =>
  (Array.isArray(perfiles) ? perfiles : []).filter((p) => !fantasmas?.has?.(p?.id) || p.id === yo)

// EL SKU DE UNA LÍNEA (1249, PINGU: «un SKU por cada artículo»; eligió el
// GENERAL: el mismo en todas las tiendas, y el QR pone la tienda). Se calcula,
// no se guarda: colección (su código de TCG Live, o su id), número impreso,
// idioma, estado o gradeo, y la versión si no es la normal. «ASC-276-ES-NM-H».
// Una gradeada no dice estado («ASC-276-ES-PSA10»), y lo sellado es
// «SEL-<producto>-<idioma>». La base hace lo mismo en la 1253 (`tienda_sku`):
// si cambias una regla, cámbiala en los dos.
const VERSION_CORTA = { normal: '', reverse: 'R', holo: 'H', primera: '1E' }
const limpio = (t) => String(t ?? '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '')
export function versionCorta(variante) {
  const v = String(variante || 'normal').toLowerCase()
  if (v in VERSION_CORTA) return VERSION_CORTA[v]
  // Una de TCGGO o de TCGdex (`poke-ball`, `master-ball`): sus iniciales.
  return v.split(/[^a-z0-9]+/).filter(Boolean).map((p) => (/^\d/.test(p) ? p : p[0])).join('').toUpperCase()
}
export function skuDe(linea, codigoSet = '') {
  const l = linea || {}
  const idioma = limpio(l.idioma || 'es')
  if (l.product_id) return ['SEL', limpio(l.product_id), idioma].join('-')
  const set = limpio(codigoSet) || limpio(l.set_id) || 'X'
  // El número tal como va impreso, sin el total ni los ceros de delante:
  // «276/217» y «0276» son la 276; «TG01» se queda «TG01».
  const n = String(l.numero ?? '').split('/')[0]
  const numero = /^\d+$/.test(n) ? String(Number(n)) : limpio(n) || '0'
  const estado = l.gradeo ? limpio(l.gradeo) : limpio(l.estado || 'NM')
  return [set, numero, idioma, estado, versionCorta(l.variante)].filter(Boolean).join('-')
}

// ── COMPRARLE A UNA TIENDA (1250) ──
// Cómo cobra una tienda (`tienda_cobros`): en efectivo, solo en mano.
export const PAGOS_TIENDA = [['bizum', 'Bizum'], ['paypal', 'PayPal'], ['efectivo', 'Efectivo']]
export const NOMBRE_PAGO = Object.fromEntries(PAGOS_TIENDA)
// Lo menos que se puede ofrecer con el mínimo de la tienda (en %), como en la
// base (`tienda_oferta_enviar`): redondeado al céntimo. Sin mínimo, nada.
export function minimoDeOferta(pide, minimo) {
  const p = Number(pide)
  const m = Number(minimo)
  if (!(p > 0) || !(m > 0)) return null
  return Math.round(p * m) / 100
}
// «Pedir» es a su precio (o más, que la base deja en el suyo); por debajo, «ofrecer».
export const queEsLaOferta = (precio, pide) => (pide != null && Number(precio) >= Number(pide) ? 'pide' : 'ofrece')
// Lo que pagas: las cartas y el envío.
export const totalDeOferta = ({ precio, unidades = 1, envio_precio = 0 }) => Math.round((Number(precio) * (Number(unidades) || 1) + (Number(envio_precio) || 0)) * 100) / 100

// En qué punto está una oferta, dicho para quien mira (`soy`: 'tienda' o
// 'comprador'): la chapa, su clase de color y la frase del siguiente paso.
export function puntoDeOferta(o, soy) {
  const mio = o.turno === soy
  switch (o.estado) {
    case 'abierta':
      if (mio) return { chapa: soy === 'tienda' ? 'Te toca' : 'Te contraofertan', clase: 'toca', frase: soy === 'tienda' ? 'Acéptala, haz una contraoferta o recházala.' : 'Acepta su precio u ofrece otro.' }
      return { chapa: soy === 'tienda' ? 'Esperando respuesta' : 'Esperando a la tienda', clase: 'espera', frase: 'Si nadie contesta en 48 horas, caduca.' }
    case 'aceptada': return { chapa: 'Aceptada', clase: 'ok', frase: soy === 'tienda' ? 'Está reservada. Márcala como pagada cuando te llegue el pago.' : 'Está reservada para ti. Paga y la tienda te la prepara.' }
    case 'pagada': return { chapa: 'Pagada', clase: 'ok', frase: soy === 'tienda' ? (o.envio === 'correo' ? 'Mándala y apunta el seguimiento.' : 'Entrégala cuando quedéis.') : (o.envio === 'correo' ? 'La tienda te la manda.' : 'Ya solo queda recogerla.') }
    case 'hecha': return { chapa: o.envio === 'correo' ? 'Enviada' : 'Hecha', clase: 'ok', frase: o.seguimiento ? `Seguimiento: ${o.seguimiento}` : '' }
    case 'rechazada': return { chapa: 'Rechazada', clase: 'fin', frase: '' }
    case 'retirada': return { chapa: 'Retirada', clase: 'fin', frase: '' }
    case 'cancelada': return { chapa: 'Cancelada', clase: 'fin', frase: 'La carta volvió a la tienda.' }
    case 'caducada': return { chapa: 'Caducada', clase: 'fin', frase: 'Pasó el plazo sin respuesta.' }
    default: return { chapa: o.estado || '', clase: 'fin', frase: '' }
  }
}
// Un paso de la historia en una línea: «Ofreciste · 35,00 €», «RyuCards
// contraofertó · 38,00 €». `soy` dice quién es «tú».
const PASO_TU = { pide: 'Pediste a su precio', ofrece: 'Ofreciste', contraoferta: 'Contraofertaste', acepta: 'Aceptaste', rechaza: 'Rechazaste', retira: 'Retiraste la oferta', pagada: 'Marcaste el pago', entregada: 'La entregaste', enviada: 'La enviaste', cancela: 'Cancelaste' }
const PASO_EL = { pide: 'pidió a tu precio', ofrece: 'ofreció', contraoferta: 'contraofertó', acepta: 'aceptó', rechaza: 'rechazó', retira: 'retiró la oferta', pagada: 'recibió el pago', entregada: 'la entregó', enviada: 'la envió', cancela: 'canceló' }
const CON_PRECIO = new Set(['pide', 'ofrece', 'contraoferta', 'acepta'])
export function textoDePaso(p, { soy, nombreTienda = 'La tienda', nombreComprador = 'Quien compra' } = {}) {
  if (p.quien === 'nadie') return p.que === 'caducada' ? 'Caducó sin respuesta' : 'Venció la reserva'
  const euros = CON_PRECIO.has(p.que) && p.precio != null ? ` · ${Number(p.precio).toFixed(2).replace('.', ',')} €` : ''
  if (p.quien === soy) return `${PASO_TU[p.que] || p.que}${euros}`
  return `${p.quien === 'tienda' ? nombreTienda : nombreComprador} ${PASO_EL[p.que] || p.que}${euros}`
}
