// ANTES DE ESCRIBIR en /buscar (1147, B2). Va aparte de `buscador.js`, que
// solo BUSCA (y la 909 vigila que no pregunte él a tcg_cards: las cartas se
// buscan con `buscarComoEnCartas`); esto trae cartas por su id, no busca.
import { supabase } from './supabase.js'
import { precioDeFila, valorDe } from './cardmarket.js'
import { setsDelCatalogo } from './sets-catalogo.js'
import { urlDeLogo } from './carta-ruta.js'
import { acabaDeSalir } from './buscador-puro.js'
import { COLUMNAS_CARTA } from './buscador.js'

// La expansión que acaba de salir (de la
// lista de sets que ya baja la web) y las últimas cartas de «La quiero», con
// su precio, para mirarlas de un vistazo. Cada una devuelve null si no se
// puede saber: entonces su bloque no sale.
export async function loQueAcabaDeSalir() {
  const sets = await setsDelCatalogo('WEST', { cliente: supabase }).catch(() => null)
  const s = sets ? acabaDeSalir(sets) : null
  if (s) s.logosDelSet = [s.logo_tcggo, s.logo_scrydex, urlDeLogo(s.logo_path, 'WEST'), s.symbol_scrydex].filter(Boolean)
  return s
}

export async function ultimosDeseos(userId, n = 3) {
  if (!userId) return null
  const { data: deseos, error } = await supabase.from('user_wants').select('card_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(n * 3)
  if (error) return null
  const ids = [...new Set((deseos || []).map((d) => d.card_id))].slice(0, n)
  if (!ids.length) return []
  const { data: cartas, error: e2 } = await supabase.from('tcg_cards').select(COLUMNAS_CARTA).in('id', ids)
  if (e2) return null
  const { data: precios } = await supabase.from('tcg_card_prices').select('*').in('card_id', ids)
  const porId = new Map((precios || []).map((p) => [p.card_id, p]))
  const orden = new Map(ids.map((id, i) => [id, i]))
  return (cartas || []).map((c) => ({ ...c, valor: valorDe(precioDeFila(porId.get(c.id)), 'es') })).sort((a, b) => orden.get(a.id) - orden.get(b.id))
}

