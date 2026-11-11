import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { enlaceInvitacion, invitacionSchema, invitacionesPendientes, invitarCliente } from './invitar';
import { invitacionCasillero } from './correo';

type Perfil = { id: string; role: 'cliente' | 'vendedor'; casillero_codigo: string | null } | null;

function falso(o: { perfiles?: Perfil[]; ultimoIngreso?: string | null; errorInvite?: string; usuarios?: Array<{ id: string; invited_at?: string; last_sign_in_at?: string }> } = {}) {
  const perfiles = [...(o.perfiles ?? [null])];
  const ilike = vi.fn(() => ({ maybeSingle: async () => ({ data: perfiles.length > 1 ? perfiles.shift() : perfiles[0] }) }));
  const generateLink = vi.fn(async ({ type }: { type: string }) => {
    if (type === 'invite' && o.errorInvite) return { data: { properties: null, user: null }, error: { message: o.errorInvite } };
    return { data: { properties: { hashed_token: `hash-${type}` }, user: { id: 'u-nuevo' } }, error: null };
  });
  const admin = {
    from: () => ({ select: () => ({ ilike }) }),
    auth: {
      admin: {
        generateLink,
        getUserById: vi.fn(async () => ({ data: { user: { last_sign_in_at: o.ultimoIngreso ?? null } } })),
        listUsers: vi.fn(async () => ({ data: { users: o.usuarios ?? [] }, error: null })),
      },
    },
  };
  return { admin: admin as unknown as SupabaseClient, generateLink, ilike };
}

const BASE = 'https://easycomex.com';
const datos = (email: string, extra: Record<string, string> = {}) => invitacionSchema.parse({ email, ...extra });

describe('invitar a un cliente', () => {
  it('normaliza el correo y rechaza lo que no es correo', () => {
    expect(invitacionSchema.parse({ email: '  Ana@Empresa.CO ' }).email).toBe('ana@empresa.co');
    expect(invitacionSchema.safeParse({ email: 'no-es-correo' }).success).toBe(false);
  });

  it('una persona nueva: crea la cuenta como invitada y devuelve el enlace a /restablecer', async () => {
    const f = falso({ perfiles: [null, { id: 'u-nuevo', role: 'cliente', casillero_codigo: 'DM120' }] });
    const r = await invitarCliente(f.admin, datos('ana@empresa.co', { nombre: 'Ana', empresa: 'Sudafin' }), BASE);
    expect(r).toMatchObject({ estado: 'invitado', userId: 'u-nuevo', codigo: 'DM120' });
    expect(f.generateLink).toHaveBeenCalledWith({
      type: 'invite',
      email: 'ana@empresa.co',
      options: { data: { full_name: 'Ana', company: 'Sudafin', es_empresa: true, invitado: true } },
    });
    expect('enlace' in r && r.enlace).toBe('https://easycomex.com/restablecer?token_hash=hash-invite&tipo=invite&destino=casillero');
  });

  it('ya invitado y nunca entró: un enlace nuevo de recuperación, sin crear otra cuenta', async () => {
    const f = falso({ perfiles: [{ id: 'u1', role: 'cliente', casillero_codigo: 'DM7' }], ultimoIngreso: null });
    const r = await invitarCliente(f.admin, datos('ana@empresa.co'), BASE);
    expect(r).toMatchObject({ estado: 'reenviado', userId: 'u1', codigo: 'DM7' });
    expect(f.generateLink).toHaveBeenCalledWith({ type: 'recovery', email: 'ana@empresa.co' });
  });

  it('ya entra con su cuenta: no se le manda nada', async () => {
    const f = falso({ perfiles: [{ id: 'u1', role: 'cliente', casillero_codigo: 'DM7' }], ultimoIngreso: '2026-10-01T00:00:00Z' });
    const r = await invitarCliente(f.admin, datos('ana@empresa.co'), BASE);
    expect(r).toMatchObject({ estado: 'ya_tiene_cuenta', enlace: null });
    expect(f.generateLink).not.toHaveBeenCalled();
  });

  it('alguien del equipo no se invita como cliente', async () => {
    const f = falso({ perfiles: [{ id: 'u2', role: 'vendedor', casillero_codigo: null }] });
    expect(await invitarCliente(f.admin, datos('yo@easycomex.com'), BASE)).toMatchObject({ estado: 'es_equipo', enlace: null });
    expect(f.generateLink).not.toHaveBeenCalled();
  });

  it('existe en Auth sin ficha: cae a un enlace nuevo en vez de fallar', async () => {
    const f = falso({ errorInvite: 'A user with this email address has already been registered' });
    expect(await invitarCliente(f.admin, datos('ana@empresa.co'), BASE)).toMatchObject({ estado: 'reenviado' });
  });

  it('busca el correo literal: _ no es comodín', async () => {
    const f = falso();
    await invitarCliente(f.admin, datos('a_b@x.co'), BASE);
    expect(f.ilike).toHaveBeenCalledWith('email', 'a\\_b@x.co');
  });

  it('pendientes = invitados que nunca entraron', async () => {
    const f = falso({ usuarios: [{ id: 'a', invited_at: 'x' }, { id: 'b', invited_at: 'x', last_sign_in_at: 'y' }, { id: 'c' }] });
    expect(await invitacionesPendientes(f.admin)).toEqual(['a']);
  });

  it('el enlace no repite barras', () => {
    expect(enlaceInvitacion('https://x.co/', 'h', 'recovery')).toBe('https://x.co/restablecer?token_hash=h&tipo=recovery&destino=casillero');
  });
});

describe('correo de invitación', () => {
  it('escapa lo que escribió el equipo y lleva el enlace en HTML y en texto', () => {
    const m = invitacionCasillero({ to: 'a@b.co', nombre: '<i>Ana</i>', codigo: 'DM9', enlace: 'https://x.co/restablecer?token_hash=h&tipo=invite' });
    expect(m.html).not.toContain('<i>Ana</i>');
    expect(m.html).toContain('DM9');
    expect(m.html).toContain('token_hash=h&amp;tipo=invite');
    expect(m.text).toContain('https://x.co/restablecer?token_hash=h&tipo=invite');
    expect(m.subject).not.toMatch(/[\r\n]/);
  });
});
