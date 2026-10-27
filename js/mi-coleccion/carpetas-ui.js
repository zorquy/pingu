// LAS CARPETAS DE MI COLECCIÓN, aparte (tanda 1011): la pestaña (lo que
// queda de las carpetas viejas, 759) y el diálogo de
// cambiarlas (`dialogo-adorno`, que arrastra la Pokédex de especies y los
// sprites: 28 KB que el catálogo público no necesita). Entra por import() al
// abrir la pestaña; el estado de las
// carpetas (el módulo de consultas, la lista, el resumen, la abierta) sigue
// en mi-coleccion.js, que lo comparten la lateral y el Panel, y llega en
// `ctx` con getters y setters (895).
import { escapeHtml } from '../app.js'
import { showToast } from '../toast.js'
import { normalizeSearch } from '../texto.js'
import { nombreDeSet, nombresDeCartaParaBuscar } from '../catalogo-series.js'
import { migasHtml } from './migas.js'
import { iniciarDialogoAdorno, abrirDialogoAdorno } from './dialogo-adorno.js'

const $ = (id) => document.getElementById(id)

// Lo compartido con mi-coleccion.js llega aquí (ver `ctxCarpetas` allí).
let ctx = null
export function montar(c) {
  ctx = c
  enganchar()
}

// ── Las carpetas (tanda 402) ──
//
// Se cargan la primera vez que se abre la pestaña, como los álbumes
// soñados: quien nunca entra no se baja el módulo ni hace las dos
// consultas.

export async function abrirCarpetas() {
  const caja = $('mcCarpetasPanel')
  if (!caja) return
  if (!ctx.carpetas) {
    // Sin esqueleto (981): las carpetas viejas casi nunca tienen nada (desde
    // la 759 pasan a álbumes solas), y un bloque de 200 px que se iba al
    // cargar subía «Mis álbumes» de golpe.
    try {
      ctx.carpetas = await import('./carpetas.js')
    } catch (err) {
      caja.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`
      return
    }
  }
  await recargarCarpetas()
}

export async function recargarCarpetas() {
  const caja = $('mcCarpetasPanel')
  const lista = await ctx.carpetas.listarCarpetas().catch(() => null)
  // `null` = la migración no está puesta. Es distinto de «no tienes
  // ninguna»: lo primero se arregla ejecutando un SQL y lo segundo
  // creando una carpeta, y decir lo que no es manda a la gente a buscar
  // un botón que no existe.
  if (lista === null) {
    // Sin carpetas en la base no hay nada que enseñar aquí: los álbumes
    // son lo de abajo (759).
    caja.innerHTML = ''
    return
  }
  ctx.carpetasLista = lista
  ctx.carpetasResumen = await ctx.carpetas.resumenDeCarpetas().catch(() => new Map())
  pintarCarpetas()
}

function pintarCarpetas() {
  const caja = $('mcCarpetasPanel')
  const migas = $('mcCarpetaMigas')
  const barra = $('mcCarpetaBarra')
  const buscador = $('mcCarpetaBuscadorCaja')
  if (ctx.carpetaAbierta) {
    const c = ctx.carpetasLista.find((x) => x.id === ctx.carpetaAbierta)
    if (!c) {
      ctx.carpetaAbierta = null
      return pintarCarpetas()
    }
    const hijas = ctx.carpetasLista.filter((x) => x.parent_id === c.id).map((x) => ({ ...x, hijas: [] }))
    // La miga, en su forma CORTA desde la tanda 477: el nombre lo dice el
    // título grande de debajo, como en una expansión, y repetirlo en la
    // miga era decir dos veces lo mismo en dos renglónes seguidos.
    migas.innerHTML = migasHtml([{ texto: 'Álbumes', id: 'mcCarpetaVolver' }])
    $('mcCarpetaTitulo').textContent = c.nombre
    barra.classList.remove('hidden')
    buscador.classList.remove('hidden')
    // Dentro de una carpeta lo que se crea es una SUBcarpeta, y eso vive
    // en el ⋮: dos botones que crean cosas distintas con el mismo rótulo
    // es justo cómo se pulsa el que no era.
    caja.innerHTML = (hijas.length ? ctx.carpetas.rejillaHtml(hijas, ctx.carpetasResumen) : '') +
      '<div class="mc-cartas" id="mcCarpetaCartas"></div>'
    pintarCartasDeCarpeta(c.id)
    return
  }
  migas.textContent = ''
  barra.classList.add('hidden')
  buscador.classList.add('hidden')
  // Al salir se olvida lo buscado: un filtro que sobrevive a la pantalla
  // que lo puso deja la siguiente medio vacía sin decir por qué.
  if ($('mcCarpetaBuscar')) $('mcCarpetaBuscar').value = ''
  // Las que queden son las que no se han podido pasar a binder (759): sin
  // ninguna, nada (ni el «todavía no tienes carpetas», que mandaba a crear
  // una con un botón que ya no existe).
  caja.innerHTML = ctx.carpetasLista.length ? ctx.carpetas.rejillaHtml(ctx.carpetas.arbolDeCarpetas(ctx.carpetasLista), ctx.carpetasResumen) : ''
}

// Las de dentro se piden UNA vez y se guardan: el buscador de la 477
// filtra en memoria, y volver a preguntar en cada tecla sería una consulta
// por letra.
let lineasDeLaCarpeta = []

async function pintarCartasDeCarpeta(id) {
  const hueco = $('mcCarpetaCartas')
  if (!hueco) return
  const ids = new Set(await ctx.carpetas.lineasDeCarpeta(id).catch(() => []))
  lineasDeLaCarpeta = ctx.lineas.filter((l) => ids.has(l.id))
  pintarCartasDeCarpetaFiltradas()
}

function pintarCartasDeCarpetaFiltradas() {
  const hueco = $('mcCarpetaCartas')
  if (!hueco) return
  const texto = normalizeSearch($('mcCarpetaBuscar')?.value || '').trim()
  // Por nombre y por colección, igual que el buscador de la pestaña
  // «Cartas»: dentro de una carpeta de 200 cartas, llegar a una a ojo es
  // lo mismo de imposible que dentro de una expansión (la lección de la
  // 417).
  const dentro = texto
    ? lineasDeLaCarpeta.filter((l) => {
        const c = ctx.cartas.get(l.card_id)
        return normalizeSearch(`${nombresDeCartaParaBuscar(c)} ${c?.local_id || ''} ${nombreDeSet(c?.tcg_sets)}`).includes(texto)
      })
    : lineasDeLaCarpeta
  hueco.innerHTML = dentro.length
    ? dentro.map(ctx.lineaHtml).join('')
    // Y el vacío DICE CUÁL de los dos vacíos es: una carpeta sin cartas no
    // es lo mismo que una búsqueda sin resultados, y la primera frase
    // mandaba a la ficha de una carta cuando el problema era lo escrito.
    : texto
      ? '<p class="empty-state">Ninguna carta de esta carpeta encaja con lo que buscas.</p>'
      : '<p class="empty-state">Esta carpeta todavía no tiene cartas. Ábrelas desde tu colección y métela en una carpeta desde su ficha.</p>'
}

function enganchar() {
  // ── Las carpetas (tandas 402 y 411) ──
  //
  // El `window.prompt` se fue en la 411: pedía el nombre y nada más, así
  // que una carpeta nacía sin cara y había que ir a editarla para
  // ponérsela. Ahora el diálogo pregunta las tres cosas de una vez.
  iniciarDialogoAdorno()
  // Sin «Nueva carpeta» desde la 759: lo que se crea son álbumes (las
  // carpetas que había pasan a binders solas, en albumes.js).
  // ── El ⋮ de una carpeta abierta (tanda 477) ──
  //
  // Las dos acciones que antes solo existían desde FUERA: crear dentro
  // —que era pulsar «Nueva carpeta» estando dentro, y no lo decía ninguna
  // palabra— y cambiarla, que pedía salir, buscar su burbuja y pulsar su
  // engranaje.
  $('mcCarpetaEditar')?.addEventListener('click', () => {
    const c = ctx.carpetasLista.find((x) => x.id === ctx.carpetaAbierta)
    if (c) editarCarpeta(c)
  })
  $('mcCarpetaBuscar')?.addEventListener('input', pintarCartasDeCarpetaFiltradas)

  $('mcCarpetasPanel').addEventListener('click', async (e) => {
    const abrir = e.target.closest('[data-abrir]')
    if (abrir) {
      ctx.carpetaAbierta = abrir.dataset.abrir
      return pintarCarpetas()
    }
    const editar = e.target.closest('[data-ajustes]')
    if (!editar) return
    const c = ctx.carpetasLista.find((x) => x.id === editar.dataset.ajustes)
    if (!c) return
    editarCarpeta(c)
  })

  // El diálogo de cambiar una carpeta, en una función: lo abren el
  // engranaje de su burbuja y el ⋮ de dentro (tanda 477), y escribirlo dos
  // veces es como se separan dos cosas que tenían que ser una.
  function editarCarpeta(c) {
    abrirDialogoAdorno({
      titulo: 'Cambiar la carpeta',
      boton: 'Guardar',
      valores: { nombre: c.nombre, icono: c.icono, dex_id: c.dex_id, emoji: c.emoji, color: c.color },
      alGuardar: async (v) => {
        try {
          await ctx.carpetas.renombrarCarpeta(c.id, v)
          await recargarCarpetas()
        } catch (err) {
          showToast(err.message, 'error')
        }
      },
      alBorrar: async () => {
        // Borrar se lleva las SUBcarpetas, así que se avisa de eso y no
        // de «se borrará la carpeta» a secas. Las cartas no se tocan:
        // viven en tu colección, no en la carpeta.
        const hijas = ctx.carpetasLista.filter((x) => x.parent_id === c.id).length
        const aviso = hijas
          ? `¿Borrar «${c.nombre}» y sus ${hijas} subcarpetas? Las cartas se quedan en tu colección.`
          : `¿Borrar «${c.nombre}»? Las cartas se quedan en tu colección.`
        if (!window.confirm(aviso)) return
        try {
          await ctx.carpetas.borrarCarpeta(c.id)
          if (ctx.carpetaAbierta === c.id) ctx.carpetaAbierta = c.parent_id || null
          await recargarCarpetas()
        } catch (err) {
          showToast(err.message, 'error')
        }
      },
    })
  }

  $('mcCarpetaMigas').addEventListener('click', (e) => {
    // Por ID desde la tanda 474: la miga ya no lleva `data-volver-carpetas`
    // —el molde común pone un identificador y nada más—, y el viejo se
    // queda admitido por si alguna prueba o algún sitio lo usa todavía.
    if (!e.target.closest('#mcCarpetaVolver, [data-volver-carpetas]')) return
    const c = ctx.carpetasLista.find((x) => x.id === ctx.carpetaAbierta)
    ctx.carpetaAbierta = c?.parent_id || null
    pintarCarpetas()
  })
  // Las chips de la ficha se fueron en la 1052: «En tus álbumes» es
  // js/en-tus-albumes.js.
}
