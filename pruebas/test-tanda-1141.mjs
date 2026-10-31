// Tanda 1141 — mensajes privados: responder, reacciones, fijar y archivar.
// La migración contra PostgreSQL de verdad, con la RLS: dos veces encima, la
// respuesta solo dentro de la conversación, las reacciones (una por persona,
// nunca a lo tuyo, solo quien está en la conversación las ve) y fijar/
// archivar en tu fila y no en la del otro.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1141'
  const mig = readFileSync(`${REPO}/supabase-migration-1141-mensajes-responder-reaccionar.sql`, 'utf8')
  const base = readFileSync(`${REPO}/supabase-migration-private-messages.sql`, 'utf8')
  check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
  if (hay.status === 0) {
    psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
    const A = '00000000-0000-0000-0000-0000000000a1'
    const B = '00000000-0000-0000-0000-0000000000b2'
    const C = '00000000-0000-0000-0000-0000000000c3'
    const C1 = '10000000-0000-0000-0000-000000000001'
    const C2 = '10000000-0000-0000-0000-000000000002'
    const M1 = '20000000-0000-0000-0000-000000000001' // de A en la 1
    const M2 = '20000000-0000-0000-0000-000000000002' // de B en la 1
    const M3 = '20000000-0000-0000-0000-000000000003' // de C en la 2
    let r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
      create schema if not exists auth; create table auth.users (id uuid primary key);
      grant usage on schema auth to anon, authenticated;
      create or replace function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
      grant usage on schema public to anon, authenticated;
      insert into auth.users values ('${A}'), ('${B}'), ('${C}');`])
    check('el andamio carga', r.status === 0, r.stderr)
    r = psql(['-d', BD, '-c', base.replace(/notify pgrst[^;]*;/g, '')])
    check('la base de mensajes entra', r.status === 0, r.stderr)
    r = psql(['-d', BD, '-c', `alter table private_messages add column if not exists adjuntos jsonb not null default '[]'::jsonb;
      alter table private_messages add column if not exists deleted_at timestamptz;
      grant select, insert, update, delete on conversations, conversation_participants, private_messages to authenticated;
      insert into conversations (id) values ('${C1}'), ('${C2}');
      insert into conversation_participants (conversation_id, user_id) values ('${C1}', '${A}'), ('${C1}', '${B}'), ('${C2}', '${A}'), ('${C2}', '${C}');
      insert into private_messages (id, conversation_id, sender_id, body) values ('${M1}', '${C1}', '${A}', '¿Lo tienes en español?'), ('${M2}', '${C1}', '${B}', 'Sí'), ('${M3}', '${C2}', '${C}', 'Hola');`])
    check('con las fotos de la 891 y tres mensajes', r.status === 0, r.stderr)
    const sinNotify = mig.replace(/notify pgrst[^;]*;/g, '')
    r = psql(['-d', BD, '-c', sinNotify])
    check('la 1141 entra', r.status === 0, r.stderr)
    check('  …y otra vez encima', psql(['-d', BD, '-c', sinNotify]).status === 0)
    const como = (uid, sql) => { const x = psql(['-At', '-d', BD, '-c', `set role authenticated; set prueba.uid = '${uid}'; ${sql}`]); return { ok: x.status === 0, out: (x.stdout || '').trim(), err: (x.stderr || '').trim() } }

    let x = como(B, `insert into private_messages (conversation_id, sender_id, body, reply_to_id) values ('${C1}', '${B}', 'En español y NM', '${M1}') returning reply_to_id`)
    check('responder a un mensaje de la misma conversación', x.ok && x.out.includes(M1), x.err)
    x = como(A, `insert into private_messages (conversation_id, sender_id, body, reply_to_id) values ('${C1}', '${A}', 'cuela', '${M3}')`)
    check('  …y no a uno de otra conversación (se enseñaría un trozo ajeno)', !x.ok && /misma conversación/.test(x.err), x.err)

    x = como(B, `insert into private_message_reactions (message_id, conversation_id, user_id, kind) values ('${M1}', '${C1}', '${B}', 'love')`)
    check('B reacciona al mensaje de A', x.ok, x.err)
    x = como(A, `insert into private_message_reactions (message_id, conversation_id, user_id, kind) values ('${M1}', '${C1}', '${A}', 'like')`)
    check('  …A no puede reaccionar a lo suyo', !x.ok, x.out)
    x = como(B, `insert into private_message_reactions (message_id, conversation_id, user_id, kind) values ('${M1}', '${C1}', '${B}', 'like')`)
    check('  …una por persona y mensaje (la segunda choca)', !x.ok && /duplicate|unique|pkey/i.test(x.err), x.err)
    x = como(B, `update private_message_reactions set kind = 'laugh' where message_id = '${M1}' and user_id = '${B}' returning kind`)
    check('  …cambiarla es actualizarla', x.ok && x.out === 'laugh', x.err)
    x = como(C, `insert into private_message_reactions (message_id, conversation_id, user_id, kind) values ('${M1}', '${C2}', '${C}', 'wow')`)
    check('  …con la conversación cambiada no cuela (C no está en la del mensaje)', !x.ok, x.out)
    x = como(B, `insert into private_message_reactions (message_id, conversation_id, user_id, kind) values ('${M1}', '${C1}', '${B}', 'risa')`)
    check('  …solo las cuatro del foro', !x.ok, x.out)
    check('A ve la reacción de B en su conversación', como(A, `select kind from private_message_reactions where message_id = '${M1}'`).out === 'laugh')
    check('  …C, que no está en ella, no ve nada', como(C, `select count(*) from private_message_reactions`).out === '0')
    x = como(B, `delete from private_message_reactions where message_id = '${M1}' returning kind`)
    check('  …y B la quita', x.ok && x.out === 'laugh', x.err)

    x = como(A, `update conversation_participants set fijada_at = now(), archivada_at = null where conversation_id = '${C1}' and user_id = '${A}' returning fijada_at is not null`)
    check('A fija la conversación en SU fila', x.ok && x.out === 't', x.err)
    x = como(A, `update conversation_participants set archivada_at = now() where conversation_id = '${C1}' and user_id = '${B}' returning 1`)
    check('  …y no puede archivarla en la de B', x.ok && x.out === '', x.out)

    como(B, `insert into private_message_reactions (message_id, conversation_id, user_id, kind) values ('${M1}', '${C1}', '${B}', 'like')`)
    psql(['-d', BD, '-c', `delete from private_messages where id = '${M1}'`])
    check('borrar un mensaje se lleva sus reacciones, y la respuesta se queda sin cita', psql(['-At', '-d', BD, '-c', `select (select count(*) from private_message_reactions) || ',' || (select count(*) from private_messages where body = 'En español y NM' and reply_to_id is null)`]).stdout.trim() === '0,1')
    psql(['-c', `drop database if exists ${BD}`])
  }
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
