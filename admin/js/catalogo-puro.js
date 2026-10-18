// ── Lo puro del editor del catálogo (tanda 885) ──
//
// Sin DOM ni Supabase: lo importan `catalogo-cartas.js` y `colecciones.js`
// (el panel) y las pruebas (Node). Lo que decide QUÉ se manda a la base
// vive aquí para poder probarse sin navegador.

// «Esa función no existe»: la migración 885 no está puesta. Misma lectura
// que `faltaLaRpc` de los torneos.
export function faltaLaMigracion(error) {
  if (!error) return false
  return (
    error.code === 'PGRST202' || error.code === '42883' || error.code === '42P01' ||
    /could not find the function|does not exist/i.test(String(error.message || ''))
  )
}
export const AVISO_MIGRACION = 'Falta ejecutar supabase-migration-885-catalogo-correcciones.sql en el SQL Editor: hasta entonces no se puede corregir el catálogo.'

// ── Lo puro: qué se manda ──

// De un formulario y la fila cargada, SOLO lo que cambia. Compara por
// valor (JSON) porque hay columnas que son listas y objetos.
export function loQueCambia(fila, valores) {
  const cambios = {}
  for (const [k, v] of Object.entries(valores)) {
    const antes = fila?.[k] === undefined ? null : fila[k]
    if (JSON.stringify(antes ?? null) !== JSON.stringify(v ?? null)) cambios[k] = v
  }
  return cambios
}

// Lo que se escribe en una caja de texto → lo que se guarda. Vacío es
// null (no la cadena vacía), un número es un número, una lista separada
// por comas es una lista.
export function leerCampo(tipo, texto) {
  const t = String(texto ?? '').trim()
  if (t === '') return null
  if (tipo === 'numero') { const n = Number(t); return Number.isFinite(n) ? n : null }
  if (tipo === 'lista') return t.split(',').map((x) => x.trim()).filter(Boolean)
  if (tipo === 'numeros') return t.split(',').map((x) => Number(x.trim())).filter((n) => Number.isFinite(n))
  if (tipo === 'json') return JSON.parse(t)
  return t
}

// Las impresiones: cuatro casillas → el objeto `variants` de TCGdex (solo
// las que están marcadas; ninguna marcada = null, que es «no se sabe»).
export function variantesDe(marcadas) {
  const v = {}
  for (const k of ['normal', 'reverse', 'holo', 'firstEdition']) if (marcadas[k]) v[k] = true
  return Object.keys(v).length ? v : null
}

// Los campos de la ficha, en el orden en que se enseñan. `tipo` dice cómo
// se lee la caja; `ancho` cuáles van de dos en dos.
export const CAMPOS = [
  { col: 'name', rotulo: 'Nombre (el de la carta)', tipo: 'texto' },
  { col: 'name_en', rotulo: 'Nombre en inglés', tipo: 'texto' },
  { col: 'name_es', rotulo: 'Nombre en español', tipo: 'texto' },
  { col: 'local_id', rotulo: 'Número', tipo: 'texto', ancho: 'medio' },
  { col: 'rarity', rotulo: 'Rareza', tipo: 'texto', ancho: 'medio' },
  { col: 'rarity_en', rotulo: 'Rareza (inglés, de TCGGO)', tipo: 'texto', ancho: 'medio' },
  { col: 'category', rotulo: 'Categoría', tipo: 'texto', ancho: 'medio', pista: 'Pokemon, Trainer o Energy' },
  { col: 'hp', rotulo: 'PS', tipo: 'numero', ancho: 'medio' },
  { col: 'types', rotulo: 'Tipos (separados por comas)', tipo: 'lista', ancho: 'medio', pista: 'Darkness, Dragon' },
  { col: 'stage', rotulo: 'Fase', tipo: 'texto', ancho: 'medio', pista: 'Basic, Stage1, Stage2' },
  { col: 'evolve_from', rotulo: 'Evoluciona de', tipo: 'texto', ancho: 'medio' },
  { col: 'retreat', rotulo: 'Retirada', tipo: 'numero', ancho: 'medio' },
  { col: 'regulation_mark', rotulo: 'Marca de regulación', tipo: 'texto', ancho: 'medio' },
  { col: 'illustrator', rotulo: 'Ilustrador', tipo: 'texto' },
  { col: 'dex_ids', rotulo: 'Pokédex (números, separados por comas)', tipo: 'numeros', pista: '149' },
  { col: 'trainer_type', rotulo: 'Tipo de Entrenador', tipo: 'texto', ancho: 'medio', pista: 'Item, Supporter, Stadium, Tool' },
  { col: 'energy_type', rotulo: 'Tipo de Energía', tipo: 'texto', ancho: 'medio', pista: 'Basic, Special' },
  { col: 'cm_id_product_propio', rotulo: 'Id de producto en Cardmarket', tipo: 'numero', ancho: 'medio' },
  { col: 'tp_id_product_propio', rotulo: 'Id de producto en TCGplayer', tipo: 'numero', ancho: 'medio' },
  { col: 'description', rotulo: 'Texto (Entrenador o Energía)', tipo: 'texto', largo: true },
  { col: 'attacks', rotulo: 'Ataques (JSON)', tipo: 'json', largo: true, avanzado: true },
  { col: 'abilities', rotulo: 'Habilidades (JSON)', tipo: 'json', largo: true, avanzado: true },
  { col: 'weaknesses', rotulo: 'Debilidades (JSON)', tipo: 'json', largo: true, avanzado: true },
  { col: 'resistances', rotulo: 'Resistencias (JSON)', tipo: 'json', largo: true, avanzado: true },
]
