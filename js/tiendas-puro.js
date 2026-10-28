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
      (DONDE_VENTA.find(([v]) => v === f.donde) || [])[1] || f.donde,
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
