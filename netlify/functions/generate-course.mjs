const COURSE_BLOCK_SCHEMA = `
Tipos de bloque disponibles (usa solo estos "type", en este formato exacto):

- {"type":"hook","emoji":"👋","headline":"...","subtext":"..."} — engancha en 1-2 frases, no explica teoría.
- {"type":"concept"|"tip"|"warning"|"example","emoji":"💡","title":"...","body":"..."} — puente teórico muy breve (2-3 frases). Usa como mucho UNO en todo el curso.
- {"type":"quiz","question":"...","options":["...","..."],"correct_index":0,"explanation":"..."} — 2 a 4 opciones.
- {"type":"truefalse","statement":"...","is_true":true,"explanation":"..."}
- {"type":"fillblank","before":"texto antes del hueco","after":"texto después del hueco","options":["...","..."],"correct_option":"texto exacto de la opción correcta","explanation":"..."}
- {"type":"match","title":"...","pairs":[{"left":"...","right":"..."},{"left":"...","right":"..."}]} — 3 a 5 parejas.
- {"type":"order","title":"...","items":["paso 1","paso 2","paso 3"]} — items en el ORDEN CORRECTO (se mezclan solos al mostrarse), 3 a 5 pasos.
- {"type":"reward","next_guide_slug":""} — SIEMPRE el último bloque, exactamente una vez.
`

function buildPrompt({ title, description, referenceText, blockCount }) {
  return `Eres un diseñador instruccional que crea cursos interactivos estilo Duolingo para una app de coleccionismo de cartas Pokémon TCG en español (España).

Te doy el título, descripción y el contenido de referencia (la "guía") de un tema. Tu trabajo es generar los bloques de un CURSO PRÁCTICO sobre ese tema, NO un resumen de la guía. El curso no debe repetir la guía casi palabra por palabra: debe poner a prueba la comprensión con dinámicas variadas.

Reglas:
- Empieza siempre con exactamente 1 bloque "hook".
- Como mucho 1 bloque de teoría puente (concept/tip/warning/example), y solo si hace falta un empujón antes de practicar. Puedes omitirlo si el hook ya es suficiente.
- El resto de bloques (la mayoría) deben ser de práctica, MEZCLANDO varios tipos distintos entre quiz, truefalse, fillblank, match y order. No uses el mismo tipo de práctica más de 2 veces seguidas.
- Termina siempre con exactamente 1 bloque "reward" con "next_guide_slug" vacío.
- Genera un total aproximado de ${blockCount || 7} bloques (contando hook y reward).
- Todo el texto en español de España, tono cercano y motivador, sin tildes de "vos" ni "tú/usted" formal excesivo.
- Basa las preguntas y dinámicas en datos CONCRETOS del contenido de referencia (nombres, pasos, cifras, ejemplos), no generalidades vagas.
- No inventes datos que contradigan el contenido de referencia.

${COURSE_BLOCK_SCHEMA}

Título del tema: ${title}
Descripción: ${description || '(sin descripción)'}

Contenido de referencia (guía):
"""
${referenceText}
"""

Responde ÚNICAMENTE con un array JSON de bloques, sin texto adicional, sin markdown, sin backticks.`
}

const REQUIRED_FIELDS = {
  hook: ['headline'],
  concept: ['title', 'body'],
  tip: ['title', 'body'],
  warning: ['title', 'body'],
  example: ['title', 'body'],
  quiz: ['question', 'options', 'correct_index'],
  truefalse: ['statement'],
  fillblank: ['before', 'options', 'correct_option'],
  match: ['pairs'],
  order: ['items'],
  reward: [],
}

function validateBlocks(rawBlocks) {
  if (!Array.isArray(rawBlocks)) return []
  const valid = rawBlocks.filter((b) => {
    if (!b || typeof b !== 'object' || !REQUIRED_FIELDS[b.type]) return false
    return REQUIRED_FIELDS[b.type].every((f) => b[f] !== undefined && b[f] !== null && b[f] !== '')
  })

  const withoutReward = valid.filter((b) => b.type !== 'reward')
  const hookIndex = withoutReward.findIndex((b) => b.type === 'hook')
  const ordered = hookIndex > 0 ? [withoutReward[hookIndex], ...withoutReward.filter((_, i) => i !== hookIndex)] : withoutReward

  ordered.push({ type: 'reward', next_guide_slug: '' })
  return ordered
}

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_ohfCPNNVCoqcVBainTbDlg_04mJliQZ'

// Esta función llama a la API de pago de Anthropic, así que solo puede
// invocarla un admin autenticado — si no, cualquiera con la URL podría
// generar cursos gratis a costa de la cuenta del proyecto. Verificamos el
// token contra el propio Supabase (no hace falta la service role key: el
// endpoint /auth/v1/user valida el JWT y user_profiles.is_admin es de
// lectura pública) en vez de confiar en nada que mande el cliente.
async function requireAdminUserId(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
  })
  if (!userRes.ok) return null
  const user = await userRes.json()
  if (!user?.id) return null

  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${user.id}&select=is_admin`, {
    headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${token}` },
  })
  if (!profileRes.ok) return null
  const [profile] = await profileRes.json()
  return profile?.is_admin ? user.id : null
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405 })
  }

  const adminId = await requireAdminUserId(req)
  if (!adminId) {
    return new Response(JSON.stringify({ error: 'No autorizado.' }), { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Falta la variable de entorno ANTHROPIC_API_KEY en la configuración de Netlify.' }),
      { status: 500 }
    )
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido en la petición.' }), { status: 400 })
  }

  const { title, description, referenceText, blockCount } = body || {}
  if (!title || !referenceText || !referenceText.trim()) {
    return new Response(
      JSON.stringify({ error: 'Faltan datos: hace falta un título y contenido de referencia (guía) para generar el curso.' }),
      { status: 400 }
    )
  }

  let anthropicRes
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 4096,
        messages: [{ role: 'user', content: buildPrompt({ title, description, referenceText, blockCount }) }],
      }),
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: `No se pudo contactar con la API de Anthropic: ${err.message}` }), { status: 502 })
  }

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text()
    return new Response(JSON.stringify({ error: `Error de la API de Anthropic (${anthropicRes.status}): ${errText.slice(0, 500)}` }), {
      status: 502,
    })
  }

  const data = await anthropicRes.json()
  const text = data?.content?.[0]?.text || ''

  let rawBlocks
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    rawBlocks = JSON.parse(jsonMatch ? jsonMatch[0] : text)
  } catch {
    return new Response(JSON.stringify({ error: 'La IA no devolvió un JSON válido. Inténtalo de nuevo.' }), { status: 502 })
  }

  const blocks = validateBlocks(rawBlocks)
  if (blocks.length <= 1) {
    return new Response(JSON.stringify({ error: 'La IA no generó bloques válidos. Inténtalo de nuevo.' }), { status: 502 })
  }

  return new Response(JSON.stringify({ blocks }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}
