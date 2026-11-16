// Tanda 1382 — las menciones del foro (PINGU: «las menciones en el foro no
// funcionan bien y ya ves que sergio.m no lo reconoce por el punto»):
//   · al PINTAR se enlazan todas, no las cinco primeras del tema (el tope de
//     cinco es para avisar);
//   · «@Sergio.M» es sergio-m (o sergiom, o quien se llama «Sergio.M»), no
//     «@sergio» con «.M» suelto; solo si no hay nadie así, lo de antes del
//     punto; el punto del final de una frase no es del nombre;
//   · la base (`menciones_de`, el correo) resuelve igual.
import { readFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { chromium, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const REPO = process.env.PD_RAIZ || '/home/user/pingu'

console.log('── La web: enlazar ──')
{
  const b = await chromium.launch()
  const page = await b.newPage()
  await page.goto(`${BASE}/foro`, { waitUntil: 'domcontentloaded' })
  const r = await page.evaluate(async () => {
    const m = await import('/js/menciones.js')
    const quince = ['devy', 'ganodrak', 'freaklaz6', 'mcmtuber', 'yosidex', 'juan', 'infan', 'andrea-de-la-fuente', 'davi-retrogame', 'alejandro9', 'pokecata', 'soyfedeegb', 'karumi-tcg', 'darth-dei', 'otro1']
    const perfiles = [...quince.map((u, i) => ({ id: `u${i}`, username: u })), { id: 's', username: 'sergio' }, { id: 'sm', username: 'sergio-m', display_name: 'Sergio.M' }, { id: 'a', username: 'ash' }]
    const html = quince.map((u) => `<details><summary>@${u}</summary><p>x</p></details>`).join('') + '<p>y @sergio.M también, gracias @ash. Y @ash.hola</p>'
    const div = document.createElement('div')
    div.innerHTML = m.enlazarMenciones(html, m.porNombre(perfiles))
    const enlaces = [...div.querySelectorAll('a.mencion')].map((a) => a.textContent)
    const ultimo = div.lastElementChild
    // Sin «sergio-m»: lo de antes del punto, y el resto en texto.
    const div2 = document.createElement('div')
    div2.innerHTML = m.enlazarMenciones('<p>hola @sergio.M</p>', m.porNombre([{ id: 's', username: 'sergio' }]))
    // Con quien se llama «Sergio.M» de cara a la gente.
    const div3 = document.createElement('div')
    div3.innerHTML = m.enlazarMenciones('<p>hola @Sergio.M</p>', m.porNombre([{ id: 's', username: 'sergio' }, { id: 'z', username: 'sm99', display_name: 'Sergio.M' }]))
    return {
      enlaces,
      ultimo: ultimo.innerHTML,
      sinGuion: div2.querySelector('p').innerHTML,
      porNombreVisible: div3.querySelector('a')?.getAttribute('href') || '',
      nombresPintar: m.nombresMencionados(quince.map((u) => '@' + u).join(' '), { tope: 400 }).length,
      nombresAvisar: m.nombresMencionados(quince.map((u) => '@' + u).join(' ')).length,
      punto: m.nombresMencionados('gracias @ash. y @Sergio.M'),
      correo: m.nombresMencionados('escribe a hola@pokedoc.es'),
      cands: m.candidatosDe('Sergio.M'),
    }
  })
  check('las quince del tema, todas enlazadas (no las cinco primeras)', r.enlaces.filter((t) => !/sergio|ash/.test(t)).length === 15, r.enlaces.join(' '))
  check('«@sergio.M» es @sergio-m, entero (sin «.M» suelto)', r.enlaces.includes('@sergio-m') && !r.enlaces.includes('@sergio') && !/\.M/.test(r.ultimo), r.ultimo)
  check('«@ash.» de final de frase: enlace a ash y el punto fuera', /<a[^>]*>@ash<\/a>\. Y/.test(r.ultimo), r.ultimo)
  check('«@ash.hola» sin nadie así: solo @ash, «.hola» en texto', /<a[^>]*>@ash<\/a>\.hola/.test(r.ultimo), r.ultimo)
  check('sin sergio-m, lo de antes del punto (y «.M» en texto)', /<a[^>]*>@sergio<\/a>\.M/.test(r.sinGuion), r.sinGuion)
  check('con alguien que se llama «Sergio.M», ese', /sm99/.test(r.porNombreVisible), r.porNombreVisible)
  check('pintar: sin tope; avisar: cinco', r.nombresPintar === 15 && r.nombresAvisar === 5, `${r.nombresPintar} / ${r.nombresAvisar}`)
  check('nombres: el punto del final fuera, el de dentro se queda', JSON.stringify(r.punto) === '["ash","sergio.m"]', JSON.stringify(r.punto))
  check('un correo sigue sin ser mención', r.correo.length === 0)
  check('candidatos de «Sergio.M»: sergio-m, sergiom, sergio', JSON.stringify(r.cands) === '["sergio-m","sergiom","sergio"]', JSON.stringify(r.cands))
  await b.close()
}

console.log('── Quien avisa pide el tope; quien pinta, no ──')
{
  const tema = readFileSync(`${REPO}/js/tema.js`, 'utf8')
  const guia = readFileSync(`${REPO}/js/guide-forum.js`, 'utf8')
  check('el aviso del foro y el de las guías, con { avisar: true }', /perfilesMencionados\(cuerpo \|\| '', \{ avisar: true \}\)/.test(tema) && /perfilesMencionados\(escapeHtml\(body \|\| ''\), \{ avisar: true \}\)/.test(guia))
  check('al pintar el tema, sin tope', /perfilesMencionados\(lista\.map\(\(m\) => m\.body_html \|\| ''\)\.join\(' '\)\)\)/.test(tema))
}

console.log('── La base: menciones_de ──')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1382'
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`])
  psql(['-c', `create database ${BD}`])
  const r = psql(['-d', BD, '-c', `create table user_profiles (id serial, username text, display_name text);
    insert into user_profiles (username, display_name) values ('sergio', 'Sergio'), ('sergio-m', 'Sergio.M'), ('ash', 'Ash'), ('sm99', 'Pepe.J'),
      ('a1', null), ('a2', null), ('a3', null), ('a4', null), ('a5', null), ('a6', null);`])
  check('el andamio carga', r.status === 0, r.stderr)
  const mig = readFileSync(`${REPO}/supabase-migration-1382-menciones-con-punto.sql`, 'utf8')
  check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
  const cuerpo = mig.replace(/^\s*(begin|commit);\s*$/gim, '')
  const sentencias = cuerpo.split(/;\s*\n(?=comment|create|drop|grant)/i).map((x) => x.trim()).filter((x) => x && !/^(--[^\n]*\n?)+$/.test(x))
  let bien = true
  for (let v = 0; v < 2; v++) for (const st of sentencias) {
    const x = psql(['-d', BD, '-c', st.endsWith(';') ? st : st + ';'])
    if (x.status !== 0) { bien = false; console.log(x.stderr) }
  }
  check('la 1382 entra sentencia a sentencia, y otra vez encima', bien, sentencias.length)
  const q = (t) => psql(['-At', '-d', BD, '-c', `select menciones_de($$${t}$$)`]).stdout.trim()
  check('«@sergio.M» → sergio-m (no sergio)', q('hola @sergio.M que tal') === '{sergio-m}', q('hola @sergio.M que tal'))
  check('«@Pepe.J» → quien se llama así (sm99)', q('hola @Pepe.J') === '{sm99}', q('hola @Pepe.J'))
  check('«@ash.» → ash', q('gracias @ash.') === '{ash}', q('gracias @ash.'))
  check('«@nadie.x» sin nadie: nada', q('hola @nadie.x') === '{}', q('hola @nadie.x'))
  check('como mucho cinco, en orden', q('@a1 @a2 @a3 @a4 @a5 @a6') === '{a1,a2,a3,a4,a5}', q('@a1 @a2 @a3 @a4 @a5 @a6'))
  check('un correo no es una mención', q('escribe a hola@pokedoc.es') === '{}')
  check('la misma persona dos veces, una', q('@ash y @ash') === '{ash}')
  psql(['-c', `drop database if exists ${BD}`])
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
