// Tanda 273: el foro de Noticias y el hilo automático de cada noticia.
//
// Lo pidió PINGU: un subforo de noticias, y que cada noticia abra su hilo
// sola —con un resumen y el enlace al artículo— como los torneos. Con dos
// diferencias sacadas de ver funcionar el de los torneos: automático (si
// hay que acordarse de pulsar un botón, la mitad se quedan sin hilo) y
// guardando CUÁL es el hilo (el torneo lo busca por el título, y en
// cuanto alguien lo renombra desde moderación cree que no tiene).
import { mensajeDelHilo, abrirHiloDeNoticia, FORO_NOTICIAS } from '/home/user/pingu/js/noticias-foro.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 130) : ''}`)
}

// Un doble de Supabase que apunta lo que se le pide y lo que se escribe.
function montarSupabase({ hayForo = true, fallaHilo = false, fallaMensaje = false } = {}) {
  const escrito = { threads: [], posts: [], updates: [], borrados: [] }
  const api = {
    from(tabla) {
      return {
        select: () => ({
          eq: (col, val) => ({
            maybeSingle: async () => {
              if (tabla === 'forum_boards') {
                return { data: hayForo && val === FORO_NOTICIAS ? { id: 'foro-noticias' } : null }
              }
              return { data: null }
            },
          }),
        }),
        insert(filas) {
          const fila = Array.isArray(filas) ? filas[0] : filas
          if (tabla === 'forum_threads') {
            escrito.threads.push(fila)
            return {
              select: () => ({
                single: async () =>
                  fallaHilo ? { data: null, error: { message: 'no se puede' } } : { data: { id: 'hilo-1' }, error: null },
              }),
            }
          }
          escrito.posts.push(fila)
          return Promise.resolve(fallaMensaje ? { error: { message: 'no se puede' } } : { error: null })
        },
        update(campos) {
          return {
            eq: async (_c, id) => {
              escrito.updates.push({ ...campos, id })
              return { error: null }
            },
          }
        },
        delete() {
          return {
            eq: async (_c, id) => {
              escrito.borrados.push(id)
              return { error: null }
            },
          }
        },
      }
    },
  }
  return { api, escrito }
}

const NOTICIA = {
  id: 'n1',
  kind: 'news',
  slug: 'cartas-30-aniversario',
  title: 'Reveladas las cartas del 30 aniversario',
  description: 'Todas las cartas, una por una, con lo que significan para el metajuego.',
  cover_image: 'https://pokedoc.es/portada.png',
  published_at: '2026-09-11T09:00:00Z',
  forum_thread_id: null,
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El mensaje del hilo ──')
{
  const html = mensajeDelHilo(NOTICIA)
  check('lleva el resumen', html.includes('Todas las cartas, una por una'), html)
  check('y el enlace a la noticia completa', html.includes('https://pokedoc.es/noticias/cartas-30-aniversario'))
  check('con la portada', html.includes('<img src="https://pokedoc.es/portada.png"'))
  // Es un RESUMEN a propósito: si el texto entero estuviera en el foro,
  // dos páginas tuyas se pelearían por la misma búsqueda en Google.
  check('invita a comentar', html.includes('Se comenta por aquí'))
  const sinNada = mensajeDelHilo({ title: 'x', slug: 's' })
  check('sin descripción ni portada, sigue valiendo', sinNada.includes('/noticias/s') && !sinNada.includes('<img'))
  // Nada de lo que escriba nadie puede colarse como HTML.
  const veneno = mensajeDelHilo({ title: 'x', description: '<script>alert(1)</script>', slug: 's' })
  check('lo que se escribe se escapa', !veneno.includes('<script>'), veneno)
  const urlRara = mensajeDelHilo({ title: 'x', slug: 'a b&c' })
  check('y el slug se codifica', urlRara.includes('a%20b%26c'), urlRara)
}

console.log('\n── 2. Se abre el hilo al publicar ──')
{
  const { api, escrito } = montarSupabase()
  const id = await abrirHiloDeNoticia(api, { guia: NOTICIA, autorId: 'admin-1' })
  check('devuelve el hilo', id === 'hilo-1', String(id))
  check('en el foro de noticias', escrito.threads[0]?.board_id === 'foro-noticias')
  check('con el título de la noticia', escrito.threads[0]?.title === NOTICIA.title)
  check('y su etiqueta', escrito.threads[0]?.prefix === 'Noticia')
  check('con su primer mensaje', escrito.posts.length === 1 && escrito.posts[0].thread_id === 'hilo-1')
  // Lo que hace que no se abran dos: se apunta cuál es.
  check('y se apunta en la noticia', escrito.updates[0]?.forum_thread_id === 'hilo-1' && escrito.updates[0]?.id === 'n1')
}

console.log('\n── 3. Cuándo NO se abre ──')
{
  const casos = [
    ['una guía normal', { ...NOTICIA, kind: 'guide' }],
    ['una noticia sin publicar', { ...NOTICIA, published_at: null }],
    ['una que ya tiene hilo', { ...NOTICIA, forum_thread_id: 'hilo-viejo' }],
  ]
  for (const [que, guia] of casos) {
    const { api, escrito } = montarSupabase()
    const id = await abrirHiloDeNoticia(api, { guia, autorId: 'admin-1' })
    check(`${que}: no abre nada`, id === null && escrito.threads.length === 0)
  }
  // Guardar dos veces no abre dos hilos: es el caso de verdad, porque una
  // noticia se corrige tres o cuatro veces el día que se publica.
  const { api, escrito } = montarSupabase()
  const primera = await abrirHiloDeNoticia(api, { guia: NOTICIA, autorId: 'admin-1' })
  const segunda = await abrirHiloDeNoticia(api, { guia: { ...NOTICIA, forum_thread_id: primera }, autorId: 'admin-1' })
  check('guardar dos veces abre UN hilo', escrito.threads.length === 1 && segunda === null)
}

console.log('\n── 4. Cuando algo falla, la noticia ya está guardada ──')
{
  // Esto corre justo DESPUÉS de guardar: si lanzara, parecería que la
  // noticia no se ha guardado. No puede lanzar nunca.
  const sinForo = montarSupabase({ hayForo: false })
  const a = await abrirHiloDeNoticia(sinForo.api, { guia: NOTICIA, autorId: 'admin-1' })
  check('sin el foro creado, no revienta', a === null && sinForo.escrito.threads.length === 0)

  const malHilo = montarSupabase({ fallaHilo: true })
  const b = await abrirHiloDeNoticia(malHilo.api, { guia: NOTICIA, autorId: 'admin-1' })
  check('si no se puede abrir el hilo, tampoco', b === null)

  // Un hilo sin primer mensaje sale en el índice del foro como si tuviera
  // algo y al entrar no hay nada: se deshace.
  const malMensaje = montarSupabase({ fallaMensaje: true })
  const c = await abrirHiloDeNoticia(malMensaje.api, { guia: NOTICIA, autorId: 'admin-1' })
  check('un hilo sin mensaje se deshace', c === null && malMensaje.escrito.borrados.includes('hilo-1'))
  check('y no se apunta nada en la noticia', malMensaje.escrito.updates.length === 0)

  const roto = { from: () => { throw new Error('red caída') } }
  const d = await abrirHiloDeNoticia(roto, { guia: NOTICIA, autorId: 'admin-1' })
  check('con la red caída, devuelve null sin lanzar', d === null)

  check('sin datos, tampoco lanza', (await abrirHiloDeNoticia(montarSupabase().api, { guia: null, autorId: null })) === null)
}

console.log('\n── 5. La migración deja el foro como debe ──')
{
  const sql = (await import('node:fs')).readFileSync('/home/user/pingu/supabase-migration-noticias-foro.sql', 'utf8')
  check('crea la columna del hilo', /add column if not exists forum_thread_id/.test(sql))
  check('sin llevarse la noticia si se borra el hilo', /on delete set null/.test(sql))
  check('crea el foro «noticias»', /'Noticias', 'noticias'/.test(sql))
  // Solo el equipo abre temas (los abre la web sola), pero RESPONDER es
  // de todo el mundo: forum_posts_insert no mira post_policy.
  check('donde solo el equipo abre temas', /'staff'/.test(sql))
  check('y no se duplica al ejecutarlo dos veces', /not exists \(select 1 from public\.forum_boards b where b\.slug = 'noticias'\)/.test(sql))
  check('avisa a PostgREST de la columna nueva', /notify pgrst/.test(sql))
}

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
