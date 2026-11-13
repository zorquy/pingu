// Los torneos de una tienda (tanda 1331, G11 del plan 2027). Puro: lo importan
// /torneos, la ficha, el editor, el panel de la tienda y su escaparate, y se
// prueba en node.
//
// Un torneo es «de tienda» cuando lo creó una cuenta de tipo tienda (no hay
// columna aparte: lo dice `user_profiles.tipo` de `admin_id`). Su precio es
// INFORMATIVO: se paga en persona y PokeDoc no cobra (seguimos sin pagos).

const fmt = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

export const esTorneoDeTienda = (t, gente = {}) => Boolean(t?.admin_id && gente[t.admin_id]?.tipo === 'tienda')

// «10 € en tienda», «Gratis», «5,50 € inscripción» o null si no se dice.
export function textoDePrecio(precio, { deTienda = false } = {}) {
  if (precio == null || precio === '') return null
  const n = Number(precio)
  if (!Number.isFinite(n) || n < 0) return null
  if (n === 0) return 'Gratis'
  return `${fmt.format(n)} € ${deTienda ? 'en tienda' : 'inscripción'}`
}

// Lo escrito en el campo: '' → null (no se dice), «10,5» → 10.5; lo que no
// es un precio (negativo, más de 1.000, letras) → undefined, y no se guarda.
export function precioDelCampo(valor) {
  const t = String(valor ?? '').trim().replace(/\s*€$/, '').replace(',', '.')
  if (!t) return null
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return undefined
  const n = Number(t)
  return n <= 1000 ? n : undefined
}

const DIA = 86400000

// Lo que viene: los torneos que no han acabado, del más cercano al más lejano
// (uno en juego va primero). Los borradores no salen en el escaparate.
export function proximosDeTienda(torneos, { ahora = new Date(), conBorradores = false } = {}) {
  return (torneos || [])
    .filter((t) => t.status !== 'finished' && t.status !== 'cancelled' && (conBorradores || t.status !== 'draft'))
    .sort((a, b) => (a.status === 'in_progress') !== (b.status === 'in_progress') ? (a.status === 'in_progress' ? -1 : 1) : new Date(a.start_at) - new Date(b.start_at))
}

const diaDe = (fecha) => new Date(fecha).toISOString().slice(0, 10)

// Las tres cifras del panel: torneos este mes, jugadores distintos (de todos
// sus torneos) y cuánto más se vende un día de torneo que un día cualquiera
// (media por día con ventas). `inscritos`: filas { tournament_id, user_id };
// `ventas`: filas { creado (fecha), total }. Sin días de los dos tipos, null:
// «no se sabe» no se pinta como un cero (la 319).
export function cifrasDeTorneos(torneos, inscritos, ventas, { ahora = new Date() } = {}) {
  const mes = diaDe(ahora).slice(0, 7)
  const esteMes = (torneos || []).filter((t) => t.status !== 'draft' && String(t.start_at || '').slice(0, 7) === mes).length
  const mios = new Set((torneos || []).map((t) => t.id))
  const jugadores = new Set((inscritos || []).filter((r) => mios.has(r.tournament_id)).map((r) => r.user_id)).size
  const diasDeTorneo = new Set((torneos || []).filter((t) => t.status !== 'draft' && new Date(t.start_at) <= ahora).map((t) => diaDe(t.start_at)))
  const porDia = new Map()
  for (const v of ventas || []) {
    if (!v?.creado) continue
    const d = diaDe(v.creado)
    porDia.set(d, (porDia.get(d) || 0) + (Number(v.total) || 0))
  }
  const media = (dias) => (dias.length ? dias.reduce((s, d) => s + porDia.get(d), 0) / dias.length : null)
  const dias = [...porDia.keys()].filter((d) => new Date(d) >= new Date(ahora.getTime() - 90 * DIA))
  const enTorneo = media(dias.filter((d) => diasDeTorneo.has(d)))
  const otros = media(dias.filter((d) => !diasDeTorneo.has(d)))
  const mejora = enTorneo != null && otros ? Math.round(((enTorneo - otros) / otros) * 100) : null
  return { esteMes, jugadores, mejora }
}
