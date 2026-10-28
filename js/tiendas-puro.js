// Lo puro de las tiendas (tanda 1067): sin base ni pantalla, para que lo
// usen /tiendas, /alta-tienda, /tienda y /admin, y se pruebe en Node.

// La solicitud de /tiendas: lo mínimo para no mandar una que la base
// rechazaría (la base lo vuelve a mirar: esto solo ayuda a rellenar).
export function validarSolicitud({ nombre, ciudad, email }) {
  if (String(nombre || '').trim().length < 2) return 'Escribe el nombre de la tienda.'
  if (String(ciudad || '').trim().length < 2) return 'Escribe la ciudad de la tienda.'
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

// Los primeros pasos del panel: lo hecho y lo que llega.
export function primerosPasos(tienda) {
  const datos = !!(tienda?.ciudad && tienda?.direccion)
  return [
    { hecho: true, texto: 'Crear la cuenta de la tienda' },
    { hecho: datos, texto: 'Rellenar los datos de la tienda', ir: 'datos', nota: datos ? null : 'Dirección y horario, para que te encuentren.' },
    { hecho: false, texto: 'Meter tu stock', nota: 'Llega en la siguiente parte del panel.' },
    { hecho: false, texto: 'Imprimir el QR del mostrador', nota: 'Llega con el escaparate.' },
  ]
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
