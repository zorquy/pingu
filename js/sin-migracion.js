// «Esa función (o esa tabla) no existe todavía»: lo que contesta PostgREST
// (PGRST202, PGRST205) o PostgreSQL (42P01, 42883) entre que se sube el
// código y un humano ejecuta la migración en el SQL Editor. Quien lo pregunta
// hace lo de antes mientras tanto, sin ruido. Puro, sin dependencias.
export const sinMigracion = (e) =>
  !!e && (['PGRST202', 'PGRST205', '42P01', '42883'].includes(e.code) || /could not find the function|could not find the table|does not exist|schema cache/i.test(e.message || ''))
