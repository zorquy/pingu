// Las propuestas: cada una es CSS (y un poco de DOM) que se inyecta sobre la
// web real del stub para fotografiar el «después». No es código de producción.

// ——— A1: el esqueleto del móvil. Las páginas de la sección en una fila de
// pestañas pegada bajo la barra de arriba, en vez de la burbuja flotante.
export const SHELL = {
  css: `
  .pd-tabs{position:static;display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;padding:8px 16px;margin:0;background:color-mix(in srgb,var(--bg) 94%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
  .pd-tabs::-webkit-scrollbar{display:none}
  .pd-tabs a,.pd-tabs button{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 12px;border-radius:999px;border:0;background:transparent;color:var(--text-mid);font-family:inherit;font-size:var(--t-xs);font-weight:600;line-height:1;text-decoration:none;white-space:nowrap;cursor:pointer}
  .pd-tabs svg{width:18px;height:18px;flex:0 0 auto}
  .pd-tabs [aria-current],.pd-tabs .activa{background:var(--navy-solid);color:var(--blanco-fijo)}
  .pd-tabs .bm-texto,.pd-tabs .mc-menu-texto{position:static!important;width:auto!important;height:auto!important;clip:auto!important;overflow:visible!important;font-size:inherit}
  .pd-tabs .bm-ajena:first-of-type{margin-left:4px;padding-left:14px;border-left:1px solid var(--border);border-radius:999px}
  html.con-burbuja-movil body,html.con-barra-movil body:has(> .bm){padding-bottom:calc(72px + env(safe-area-inset-bottom))}
  .mc-pagina{padding-bottom:calc(24px + env(safe-area-inset-bottom))}
  html.con-barra-movil .page-content{padding-top:12px}
  `,
  js: () => {
    const b = document.querySelector('.bm-burbuja') || document.querySelector('.mc-pestanias.mc-menu')
    if (!b) return
    const fila = document.createElement('nav'); fila.className = 'pd-tabs'; fila.setAttribute('aria-label', 'Páginas de la sección')
    for (const a of b.querySelectorAll('.bm-burbuja-item, .mc-pestania, .bm-ajena')) fila.appendChild(a.cloneNode(true))
    b.remove()
    const nav = document.querySelector('#navbar'); if (nav) nav.appendChild(fila); else document.body.insertBefore(fila, document.querySelector('main'))
  },
}

const SIN_TABS = () => { const b = document.querySelector('.bm-burbuja'); if (b) b.remove(); document.documentElement.classList.remove('con-burbuja-movil') }

const CAB = {
  css: `@media (max-width:900px){
    .nav-inner .bm-pastilla,.nav-inner .nav-right,.nav-inner .nav-logo{display:none!important}
    .pd-cab{display:flex;align-items:center;gap:4px;flex:1 1 auto;min-width:0;height:44px}
    .pd-cab button{display:inline-grid;place-items:center;width:44px;height:44px;border:0;background:transparent;color:var(--text);border-radius:999px;padding:0}
    .pd-cab b{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--t-sm);font-weight:700;text-align:center}
    .pd-cab b small{display:block;font-size:var(--t-2xs);color:var(--text-mid);font-weight:600;letter-spacing:.04em;text-transform:uppercase}
    .breadcrumb,.foro-migas,.carta-migas{display:none!important}
    html.con-barra-movil .page-content{padding-top:12px}
  }`,
  js: (movil) => {
    if (!movil) return
    const b = document.querySelector('.bm-burbuja'); if (b) b.remove(); document.documentElement.classList.remove('con-burbuja-movil')
    const inner = document.querySelector('.nav-inner'); if (!inner) return
    const volver = document.querySelector('.breadcrumb a:last-of-type, .foro-migas a:last-of-type, .carta-migas a')
    const h1 = [...document.querySelectorAll('h1')].find((h) => h.getBoundingClientRect().height > 0)
    const titulo = () => { if (!h1) return ''; const c = h1.cloneNode(true); c.querySelectorAll('.foro-chapa, .chip, .torneo-chapa, [class*="chapa"]').forEach((x) => x.remove()); return c.textContent.trim().replace(/\s+/g, ' ').slice(0, 48) }
    const cab = document.createElement('div'); cab.className = 'pd-cab'
    cab.innerHTML = '<button aria-label="Volver"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>'
      + '<b><small>' + (volver ? volver.textContent.trim() : 'Volver') + '</small>' + titulo() + '</b>'
      + '<button aria-label="Compartir"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg></button>'
      + '<button aria-label="Más"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>'
    inner.appendChild(cab)
  },
}
const ACENTO = (color) => `
  :root{--acento:${color}}
  .bm a[aria-current]{color:var(--acento)}
  .pd-tabs [aria-current]{background:var(--acento);color:#0b1219}
  .page-header h1::after,.torneos-heroe h1::after{content:'';display:block;width:28px;height:4px;border-radius:2px;background:var(--acento);margin-top:6px}
  .btn-primary{background:var(--acento)!important;color:#0b1219!important}
  .lat-activa .lat-seccion-enlace{color:var(--acento)}
  .lat-activa .lat-paginas a[aria-current],.lat-activa .lat-paginas .lat-actual{color:var(--acento)}
`
export const PROPUESTAS = [
  // A1 — pestañas en vez de burbuja (tres páginas de lista)
  { id: 'a1-aprender', ruta: '/aprender', scroll: { movil: 0 } },
  { id: 'a1-mazos', ruta: '/mazos' },
  { id: 'a1-torneos', ruta: '/torneos', scroll: { movil: 280 },
    // D5 va aparte; aquí solo el esqueleto.
  },
  // D4 — foro: el botón rosa se va a la cabecera (móvil y PC)
  { id: 'd4-foro', ruta: '/foro',
    css: `
    .foro-fab{position:static;width:auto;height:44px;min-width:44px;border-radius:999px;padding:0 14px 0 12px;display:inline-flex;align-items:center;gap:8px;background:var(--navy-solid);color:var(--blanco-fijo);box-shadow:none;font:600 var(--t-xs)/1 inherit;margin-left:8px}
    .foro-fab svg{width:18px;height:18px}
    .page-header.foro-cabecera{display:flex;align-items:center;justify-content:space-between;gap:8px}
    .foro-cabecera-derecha{display:flex;align-items:center;gap:8px}
    @media (min-width:901px){.foro-fab.foro-fab-foro{display:inline-flex}}
    `,
    js: (movil) => {
      const fab = document.querySelector('.foro-fab'); if (!fab) return
      const s = document.createElement('span'); s.textContent = 'Escribir'; fab.appendChild(s)
      const sitio = movil ? document.querySelector('.foro-cabecera') : document.querySelector('.foro-cabecera-derecha')
      if (!sitio) return
      if (movil) { const dcha = document.querySelector('.foro-cabecera > div:last-child'); const caja = document.createElement('div'); caja.style.cssText = 'display:flex;align-items:center;gap:4px'; if (dcha && dcha !== document.querySelector('.foro-cabecera > div:first-child')) { dcha.replaceWith(caja); caja.appendChild(dcha) } else sitio.appendChild(caja); caja.appendChild(fab) }
      else sitio.appendChild(fab)
    },
  },
  // D1 — el Panel: acciones en cuatro losetas iguales, la línea de pública/privada en una fila, sin hueco al final
  { id: 'd1-panel', ruta: '/mi-coleccion', scroll: { movil: 1330, pc: 0 }, extra: () => { window.__FAKE_PERFIL__ && (window.__FAKE_PERFIL__.coleccion_publica = true) },
    css: `
    .mc-acciones-rejilla{display:grid!important;grid-template-columns:repeat(4,1fr);gap:8px}
    .mc-accion-loseta{display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:68px;padding:10px 4px!important;text-align:center;font-size:var(--t-2xs)}
    .mc-accion-loseta > span:last-child{white-space:nowrap;font-size:var(--t-2xs)}
    .mc-compartir{display:flex!important;align-items:center;gap:8px;flex-wrap:nowrap}
    .mc-compartir > *{min-width:0}
    .mc-compartir p,.mc-compartir span{flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0}
    .mc-compartir .btn-secondary{flex:0 0 auto;min-height:36px;padding:0 12px;font-size:var(--t-2xs);white-space:nowrap}
    #mcMasEstadisticas .mc-vistazo{margin-bottom:0}
    .mc-compartir p::before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--success);margin-right:6px;vertical-align:middle}
    `,
    js: () => { const c = document.querySelector('#mcCompartir'); if (!c) return; for (const b of c.querySelectorAll('button, a')) { if (/Copiar/.test(b.textContent)) b.textContent = 'Copiar enlace'; if (/Ajustes/.test(b.textContent)) b.textContent = 'Ajustes' }; const p = c.querySelector('p, span'); if (p && /pública|privada/.test(p.textContent)) p.textContent = p.textContent.replace('Tu colección es ', 'Colección ') },
  },
  // D2 — una expansión abierta: sin la cabecera del catálogo, la tira del set en una fila, marcas pequeñas
  { id: 'd2-set', ruta: '/cartas?ver=album&set=sv08&catalogo=WEST', shell: false,
    css: `
    @media (max-width:900px){
      #mcHero{display:none}
      .mc-album-barra.con-logo{display:grid;grid-template-columns:44px 1fr 44px;align-items:center;gap:8px;min-height:56px;margin-top:4px}
      .mc-album-fondo{display:none}
      .mc-album-nombre{display:flex;align-items:center;gap:10px;min-width:0}
      .mc-album-logo{flex:0 0 auto;width:84px;height:36px;margin:0}
      .mc-album-logo img{width:100%;height:100%;object-fit:contain}
      .mc-album-nombre-texto{min-width:0;margin:0}
      .mc-album-nombre-texto > *{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .mc-album-busca{margin-top:12px}
      .mc-bolsillo .mc-tengo-marca,.mc-bolsillo .mc-marca-tengo,.mc-bolsillo [class*="marca"]{transform:scale(.6);transform-origin:center}
    }
    `,
  },
  // D3 — el catálogo: buscador y Orden en una fila, chips y cuenta en otra
  { id: 'd3-cartas', ruta: '/cartas',
    css: `
    @media (max-width:900px){
      .mc-estanteria-barra{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center}
      .mc-estanteria-cabeza{grid-area:1/2;margin:0}
      #mcEstanteriaBusca{grid-area:1/1;margin:0}
      .mc-estanteria-que{grid-area:2/1;margin:0}
      .mc-estanteria-fila2{display:none}
      .mc-estanteria-que{grid-column:1/-1}
      .mc-estanteria-orden{padding-inline:12px}
      .mc-estanteria-orden span{display:none}
    }
    `,
  },
  // D5 — torneos: una fila de chips (deslizable) y la semana compacta; el conmutador Lista/Calendario como icono
  { id: 'd5-torneos', ruta: '/torneos',
    css: `
    .torneo-pestanas-chips{display:flex;flex-wrap:nowrap!important;overflow-x:auto;scrollbar-width:none;gap:6px;margin-inline:-24px;padding-inline:24px;min-height:0;height:auto}
    .torneo-pestanas-chips::-webkit-scrollbar{display:none}
    .torneo-pestanas-chips .chip-filtro{flex:0 0 auto}
    @media (max-width:900px){
      .torneo-vista-conmutador{display:none}
      .torneos-semana{display:flex;gap:6px;margin:8px 0 12px}
      .tsem-dia{flex:1 1 0;min-width:0;padding:6px 0;height:auto}
      .tsem-dia b{font-size:var(--t-sm)}
      .tsem-dia small{display:none}
      .pd-cal{display:inline-grid;place-items:center;width:44px;height:44px;border-radius:999px;background:var(--ice);color:var(--navy);border:0;margin-right:8px}
    }
    @media (min-width:901px){
      .pd-fila{display:flex;align-items:center;gap:16px;margin:8px 0 16px}
      .pd-fila .torneo-vista-conmutador{margin:0;flex:0 0 auto}
      .pd-fila .torneos-semana{flex:1 1 auto;display:flex;gap:6px;margin:0}
      .pd-fila .tsem-dia{flex:1 1 0;padding:6px 0;height:auto}
      .torneo-pie{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px}
      .torneo-pie-quien{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:auto}
    }
    `,
    js: (movil) => {
      if (movil) {
        const acc = document.querySelector('.torneos-heroe-acciones'); if (!acc) return
        const b = document.createElement('button'); b.className = 'pd-cal'; b.setAttribute('aria-label', 'Ver como calendario')
        b.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>'
        acc.prepend(b)
      } else {
        const c = document.querySelector('.torneo-vista-conmutador'), s = document.querySelector('.torneos-semana'); if (!c || !s) return
        const f = document.createElement('div'); f.className = 'pd-fila'; c.replaceWith(f); f.appendChild(c); f.appendChild(s)
      }
    },
  },
  // D6 — constructor: una sola barra de acciones pegada a la de abajo; cabecera corta
  { id: 'd6-constructor', ruta: '/constructor?mazo=mazo-1', shell: false, scroll: { movil: 0 },
    css: `
    @media (max-width:900px){
      .cm-cabecera-pagina{display:none}
      .breadcrumb{margin-bottom:4px}
      .cm-acciones{bottom:calc(72px + env(safe-area-inset-bottom) + 8px)!important}
      .cm-pestanias{top:70px}
    }
    `,
  },

  // ——— A2: cabecera de detalle en el móvil (volver + contexto + acciones), sin migas en el contenido
  ...['tema|/tema/tema-2', 'guia|/guia/charizard-ex', 'torneo|/torneo?slug=liga-fdn-otono'].map((x) => { const [n, ruta] = x.split('|'); return {
    id: `a2-${n}`, ruta, shell: false, css: CAB.css + (n === 'torneo' ? `
    @media (max-width:900px){
      .torneo-formato{display:grid;grid-template-columns:1fr 1fr;gap:8px;height:auto}
      .torneo-dato{margin:0}
      .torneo-cabecera{margin-top:8px}
      .torneo-viva{margin-top:12px}
    }` : ''), js: CAB.js } }),
  // ——— A3: el pie del móvil en una línea
  { id: 'a3-pie', ruta: '/sobre', scroll: { movil: 99999, pc: 99999 },
    css: `@media (max-width:900px){.footer .pie-rejilla{display:none}.footer{padding:16px 24px 24px}.pd-pie{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center;font-size:var(--t-2xs);color:var(--text-mid)}.pd-pie a{color:var(--text-mid);text-decoration:none;font-weight:600}.pd-pie .pd-marca{font-family:var(--font-marca);font-weight:700;color:var(--text);font-size:var(--t-sm);margin-right:4px}.pd-pie .pd-marca b{color:var(--navy)}.footer .pie-abajo,.footer .pie-legal{display:none}}`,
    js: (movil) => { if (!movil) return; const f = document.querySelector('.footer'); if (!f) return; const d = document.createElement('div'); d.className = 'pd-pie'; d.innerHTML = '<span class="pd-marca">Poke<b>Doc</b></span><a href="/sobre">Sobre</a><a href="/colabora">Colabora</a><a href="/novedades">Novedades</a><a href="/privacidad">Privacidad</a><a href="https://ko-fi.com/">Apoyar</a><span style="flex-basis:100%">© 2026 PokeDoc · Hecho para coleccionistas y jugadores</span>'; f.prepend(d) },
  },
  // ——— B: la letra (misma portada con cuatro familias en los títulos)
  { id: 'b1-fredoka', ruta: '/', css: `:root{--font-display:'Fredoka','Inter',sans-serif}`, tras: 1500 },
  { id: 'b2-outfit', ruta: '/', fuentes: 'Outfit:wght@500;600;700;800', css: `:root{--font-display:'Outfit','Inter',sans-serif;--font-marca:'Outfit','Fredoka',sans-serif}`, tras: 2500 },
  { id: 'b3-sora', ruta: '/', fuentes: 'Sora:wght@500;600;700;800', css: `:root{--font-display:'Sora','Inter',sans-serif;--font-marca:'Sora','Fredoka',sans-serif}`, tras: 2500 },
  { id: 'b4-manrope', ruta: '/', fuentes: 'Manrope:wght@500;600;700;800', css: `:root{--font-display:'Manrope','Inter',sans-serif}`, tras: 2500 },
  // ——— C: el color de cada sección
  { id: 'c1-aprender', ruta: '/aprender', css: ACENTO('#2fb47c') },
  { id: 'c1-torneos', ruta: '/torneos', css: ACENTO('#9b7bff') },
  // ——— D7: mis partidas en el PC, una fila por partida
  { id: 'd7-partidas', ruta: '/mis-partidas', solo: 'pc', scroll: { pc: 300 },
    css: `.partidas-fila{display:grid!important;grid-template-columns:minmax(0,1fr) 24px 220px auto;align-items:center;gap:8px 16px;padding:10px 20px!important;min-height:0}
    .partidas-fila-mazos{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:8px;height:auto}
    .partidas-fila-donde{white-space:nowrap}
    .partidas-fila-guardado{display:none}
    .partidas-fila-notas{grid-column:1/-1;margin:0;padding-left:0}
    .partidas-fila-acciones{display:flex;gap:4px;justify-content:flex-end;width:auto;height:auto}
    .partidas-fila-acciones .btn-outline{min-height:36px;padding:0 10px;font-size:var(--t-2xs)}
    .partidas-fila-acciones .btn-outline:not(.partidas-borrar):first-child{font-size:0}
    .partidas-fila-acciones .btn-outline:not(.partidas-borrar):first-child::before{content:'↗';font-size:14px}`,
  },
  // ——— D8: la llamada al curso dentro de la guía, con el texto legible
  { id: 'd8-guia', ruta: '/guia/charizard-ex', scroll: { movil: 330, pc: 120 },
    css: `.guia-cta-curso{display:grid;grid-template-columns:1fr auto;align-items:center;gap:12px 16px}
    .guia-cta-curso > div{min-width:0}
    .guia-cta-curso h2{font-size:var(--t-md);margin:0}
    .guia-cta-curso .subtext{color:var(--blanco-fijo)!important;opacity:.85;margin:2px 0 0}
    .guia-cta-curso .btn-primary{background:var(--blanco-fijo);color:var(--navy-solid);width:auto;min-width:0;white-space:nowrap}
    @media (max-width:900px){.guia-cta-curso{grid-template-columns:1fr}.guia-cta-curso .btn-primary{justify-self:start}}`,
  },
  // ——— D9: el medallero de Aprender sin ceros
  { id: 'd9-aprender', ruta: '/aprender', css: `.medallero .medalla-chip{display:none}.medallero-restante{font-weight:600;color:var(--text)}`,
    js: () => { const m = document.querySelector('.medallero'); if (!m) return; const chips = [...m.querySelectorAll('.medalla-chip')]; if (chips.every((c) => c.textContent.trim() === '0')) { const r = m.querySelector('.medallero-restante'); if (r) r.textContent = r.textContent.replace('por jugar', 'cursos por jugar') } },
  },
  // ——— D11: la comunidad en el PC: cifras que no parten palabras
  { id: 'd11-comunidad', ruta: '/usuarios', solo: 'pc',
    css: `.com-cifra span{display:block;width:auto!important;white-space:nowrap}.com-cifra .cab-largo{display:block}.com-cifra{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.com-chip{min-height:40px}`,
  },
]
