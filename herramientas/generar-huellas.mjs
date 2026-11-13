// Las huellas de la web (tanda 1311, C4 del plan). Corre en el despliegue,
// detrás de antes-de-salir.mjs (`[build] command` de netlify.toml), y escribe
// en la raíz:
//
//   huellas.txt   — la huella de TODO (doce cifras): lo único que el service
//                   worker pregunta, como mucho una vez por minuto.
//   huellas.json  — { v, f: { "/js/app.js": "a1b2c3d4e5f6", … } }: la de cada
//                   fichero de css/, js/ y assets/. Se baja solo cuando
//                   huellas.txt cambia, es decir, tras un despliegue.
//
// Con eso el worker deja de preguntar fichero a fichero «¿ha cambiado?» en
// cada visita (eran 25 o 30 peticiones por pantalla) y, tras un despliegue,
// baja solo lo que ha cambiado de verdad.
//
// Se escribe EN EL DESPLIEGUE y no en un commit a propósito: unas huellas
// viejas dirían «no ha cambiado» de un fichero que sí, y el worker serviría
// el de antes. Generadas al publicar, son siempre las de lo publicado. Por eso
// tampoco van en el repo (.gitignore).
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'

const RAIZ = process.argv[2] ? resolve(process.argv[2]) : resolve(dirname(new URL(import.meta.url).pathname), '..')
export const CARPETAS = ['css', 'js', 'assets']
export const huella = (contenido) => createHash('sha1').update(contenido).digest('hex').slice(0, 12)

function ficheros(dir, fuera = []) {
  if (!existsSync(dir)) return fuera
  for (const n of readdirSync(dir).sort()) {
    if (n.startsWith('.')) continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) ficheros(p, fuera)
    else fuera.push(p)
  }
  return fuera
}

export function huellasDe(raiz) {
  const f = {}
  for (const c of CARPETAS) for (const p of ficheros(join(raiz, c))) f[p.slice(raiz.length).replace(/\\/g, '/')] = huella(readFileSync(p))
  const v = huella(Object.entries(f).map(([k, h]) => `${k} ${h}`).join('\n'))
  return { v, f }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const h = huellasDe(RAIZ)
  writeFileSync(join(RAIZ, 'huellas.json'), JSON.stringify(h))
  writeFileSync(join(RAIZ, 'huellas.txt'), h.v)
  console.log(`🔎 Huellas: ${Object.keys(h.f).length} ficheros, versión ${h.v}.`)
}
