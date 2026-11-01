// Lo puro de «Con quién podrías hablar» (1167): sin importar nada, para
// que lo pruebe Node y lo importe el módulo que pide a la base.
const TOPE = 6

// Pura: de las tres listas, las personas en orden de motivo (cruce >
// seguida > torneo), sin repetir a nadie, con UNA frase cada una.
export function sugerir({ tienen = [], seguidas = [], torneos = [], yo = null, tope = TOPE } = {}) {
  const vistos = new Set(yo ? [yo] : [])
  const salida = []
  const meter = (p, motivo) => {
    if (!p?.user_id || vistos.has(p.user_id) || salida.length >= tope) return
    vistos.add(p.user_id)
    salida.push({ user_id: p.user_id, username: p.username || '', display_name: p.display_name || p.username || 'Usuario', avatar_url: p.avatar_url || null, is_admin: p.is_admin === true, is_moderator: p.is_moderator === true, motivo })
  }
  // Cruces: cuántas de tus cartas tiene cada persona, de más a menos.
  const porPersona = new Map()
  for (const f of tienen) {
    const x = porPersona.get(f.user_id) || { ...f, cartas: new Set() }
    x.cartas.add(f.card_id)
    porPersona.set(f.user_id, x)
  }
  for (const p of [...porPersona.values()].sort((a, b) => b.cartas.size - a.cartas.size)) {
    const n = p.cartas.size
    meter(p, n === 1 ? 'tiene 1 carta que buscas' : `tiene ${n} cartas que buscas`)
  }
  for (const p of seguidas) meter(p, 'la sigues')
  for (const p of torneos) meter(p, `en ${p.torneo} contigo`)
  return salida
}

