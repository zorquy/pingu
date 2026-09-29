// El canal RSS de PokeDoc (tanda 271).
//
// POR QUÉ. Una parte grande del tráfico de las webs de noticias de TCG no
// entra por Google: entra por agregadores, por lectores de feeds y por
// bots de Discord y Telegram que reenvían cada entrada a un canal. Todo
// eso habla RSS y nada más. Sin canal, PokeDoc no está en ninguna de esas
// conversaciones por buenas que sean las noticias.
//
// Se genera EN LA PETICIÓN, igual que el sitemap y por lo mismo: las
// direcciones salen de Supabase y este sitio no tiene paso de compilación.
// La ruta /rss.xml está reescrita a esta función en netlify.toml.
//
// Solo lee filas públicas, así que va con la clave publicable — la misma
// que ya viaja en js/supabase.js.

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const SUPABASE_KEY = 'sb_publishable_ohfCPNNVCoqcVBainTbDlg_04mJliQZ'
const SITIO = 'https://pokedoc.es'

// Cuántas entradas lleva el canal. Un lector solo enseña lo que hay
// dentro, así que con las 30 últimas cualquiera que pase una vez al día
// —o una vez a la semana— lo ve todo.
const CUANTAS = 30

const escapar = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

// RSS 2.0 pide fechas en formato de correo (RFC 822), no ISO. Un lector
// que no entiende la fecha ordena las entradas como le parece.
const fechaRss = (valor) => {
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d.toUTCString()
}

async function consultar(ruta) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`supabase ${res.status}`)
  return res.json()
}

// La dirección de un artículo, que depende de qué es. Repetida a
// propósito y no importada de js/articulos.js: esto corre en el servidor
// y aquello es un módulo del navegador que arrastra sus propios imports.
const enlace = (fila) =>
  fila.kind === 'torneo'
    ? `${SITIO}/torneo?slug=${encodeURIComponent(fila.slug)}`
    : fila.kind === 'news'
      ? `${SITIO}/noticias/${encodeURIComponent(fila.slug)}`
      : `${SITIO}/guia/${encodeURIComponent(fila.slug)}`

const CATEGORIA = { torneo: 'Torneos', news: 'Noticias' }

// El `guid` de cada entrada es su identidad para el lector: es lo que usa
// para saber si ya la ha enseñado. Tiene que ser estable aunque el título
// cambie, así que se usa la dirección.
export function documento(entradas, { ahora = new Date() } = {}) {
  const items = entradas
    .map((e) => {
      const url = enlace(e)
      const fecha = fechaRss(e.published_at)
      return `    <item>
      <title>${escapar(e.title)}</title>
      <link>${escapar(url)}</link>
      <guid isPermaLink="true">${escapar(url)}</guid>
      ${fecha ? `<pubDate>${escapar(fecha)}</pubDate>` : ''}
      <description>${escapar(e.description || '')}</description>
      <category>${escapar(CATEGORIA[e.kind] || 'Guías')}</category>
    </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>PokeDoc — Pokémon TCG en español</title>
    <link>${SITIO}/noticias</link>
    <description>Noticias y guías del juego de cartas Pokémon, en español: cartas reveladas, sets, torneos y cambios de formato.</description>
    <language>es-ES</language>
    <lastBuildDate>${escapar(ahora.toUTCString())}</lastBuildDate>
    <!-- Se dice dónde vive el propio canal. Sin esto, un lector que
         reciba el fichero por otro camino no sabe a qué dirección volver
         para actualizarse. -->
    <atom:link href="${SITIO}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`
}

// ── Los torneos también son novedades (tanda 363) ──
//
// El canal llevaba solo artículos, y lo que más movimiento trae a PokeDoc
// es un torneo abierto: es lo que la gente comparte y por donde entra
// quien no conoce la web. Que salga en el RSS es además lo que permite
// que un puente lo publique solo en redes, sin que nadie se acuerde.
//
// Dos condiciones:
//
//   · `registration_open`: un borrador no existe todavía y uno cerrado ya
//     no admite a nadie. El canal es para lo que se puede hacer HOY.
//   · Que no haya empezado: anunciar un torneo que era ayer es ruido.
//
// Los de CÓDIGO sí entran (tanda 367). Antes no, y con razón: eran
// invisibles hasta por la API, así que sacarlos por aquí habría contado
// lo que nadie quería contar. Desde que se ven como cualquier otro, el
// canal no puede decir una cosa distinta de la web — un RSS que esconde
// lo que la web enseña es un RSS que miente. Lo que sí se dice es que
// hace falta código, para que nadie llegue a la ficha a ciegas.
//
// La consulta va con la clave publicable, o sea que quien decide lo que
// sale es la POLÍTICA de la base, no este filtro. Por eso aquí ya no hay
// ninguno: si algún día vuelve a esconderse un torneo, se esconderá solo.
//
// La FECHA de la entrada es `created_at` y no `start_at`: un lector
// ordena por cuándo se publicó la novedad, no por cuándo se juega. Si
// fuera `start_at`, un torneo creado hoy para dentro de un mes saldría
// por delante de todo lo demás y volvería a subir al principio cada vez.
async function torneosAbiertos() {
  const filas = await consultar(
    'tournaments?status=eq.registration_open' +
      `&start_at=gte.${encodeURIComponent(new Date().toISOString())}` +
      `&select=slug,name,description,start_at,created_at,max_players,is_private&order=created_at.desc&limit=10`
  ).catch(() =>
    // Sin la columna (migración sin ejecutar) no se cae el canal entero:
    // se piden sin ella, que es como estaba antes de que existiera.
    consultar(
      'tournaments?status=eq.registration_open' +
        `&start_at=gte.${encodeURIComponent(new Date().toISOString())}` +
        `&select=slug,name,description,start_at,created_at,max_players&order=created_at.desc&limit=10`
    )
  )
  return (filas || []).map((t) => ({
    kind: 'torneo',
    slug: t.slug,
    title: `Torneo: ${t.name}`,
    // La descripción del torneo la escribe alguien con el editor de texto
    // rico, así que puede traer HTML. En un RSS eso se escapa —el lector
    // lo enseñaría en crudo—, y aquí basta con lo que hace falta para
    // decidir si te apuntas: cuándo se juega y cuánta gente cabe.
    description:
      `Se juega el ${fechaLarga(t.start_at)}` +
      (t.max_players ? ` · ${t.max_players} plazas` : '') +
      '. Inscripción abierta en PokeDoc' +
      (t.is_private ? ', con el código que da quien lo organiza.' : '.'),
    published_at: t.created_at || t.start_at,
  }))
}

// «el 4 de octubre a las 19:00», en español y en la zona de España, que
// es donde está la gente que juega estos torneos.
function fechaLarga(iso) {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
    }).format(new Date(iso))
  } catch {
    return String(iso).slice(0, 10)
  }
}

export default async () => {
  let entradas = []
  try {
    // Noticias primero y guías después, todo por fecha: quien se suscribe
    // quiere enterarse de lo que publica PokeDoc, sea lo que sea.
    //
    // `kind` con vuelta atrás: mientras la migración de noticias no esté
    // puesta la columna no existe, y pedirla dejaría el canal VACÍO en vez
    // de devolver las guías de siempre.
    entradas = await consultar(
      `guides?published_at=not.is.null&select=slug,title,description,published_at,kind&order=published_at.desc&limit=${CUANTAS}`
    ).catch(() =>
      consultar(
        `guides?published_at=not.is.null&select=slug,title,description,published_at&order=published_at.desc&limit=${CUANTAS}`
      )
    )
  } catch (e) {
    // Un canal vacío es un canal: el lector lo lee, no se rompe y vuelve
    // a mirar más tarde. Un error 500 hace que algunos lectores se den de
    // baja solos.
    console.warn('rss: no se ha podido leer de Supabase', e?.message || e)
  }

  // Los torneos van en su propia consulta y con su propio `catch`: si la
  // tabla falla, el canal sale con los artículos en vez de vacío.
  let torneos = []
  try {
    torneos = await torneosAbiertos()
  } catch (e) {
    console.warn('rss: no se han podido leer los torneos', e?.message || e)
  }

  // Todo junto y por fecha de publicación, que es como lo ordena un
  // lector. El tope es el mismo de siempre: un canal es una ventana a lo
  // último, no un archivo.
  const todo = [...(entradas || []), ...torneos]
    .sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0))
    .slice(0, CUANTAS)

  return new Response(documento(todo), {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      // Diez minutos de caché. Un lector no necesita el segundo exacto, y
      // así una entrada en un agregador con mucha gente no se convierte en
      // mil consultas a la base.
      'cache-control': 'public, max-age=600',
    },
  })
}
