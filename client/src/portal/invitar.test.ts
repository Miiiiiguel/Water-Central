import { describe, expect, it } from 'vitest';
import { mensajeWhatsApp } from './invitar';
import { leerEnlaceToken } from '@/pages/ResetPassword';

describe('enlace de invitación', () => {
  it('lee el token y manda al casillero', () => {
    expect(leerEnlaceToken('?token_hash=abc12345XYZ&tipo=invite&destino=casillero')).toEqual({ tokenHash: 'abc12345XYZ', tipo: 'invite', destino: '/casillero' });
  });
  it('sin destino conocido, al dashboard; nunca a una dirección de afuera', () => {
    expect(leerEnlaceToken('?token_hash=abc12345XYZ&tipo=recovery&destino=https://malo.co')?.destino).toBe('/dashboard');
  });
  it('ignora tipos y tokens raros', () => {
    expect(leerEnlaceToken('?token_hash=abc12345XYZ&tipo=signup')).toBeNull();
    expect(leerEnlaceToken('?token_hash=<script>&tipo=invite')).toBeNull();
    expect(leerEnlaceToken('')).toBeNull();
  });
  it('el mensaje de WhatsApp lleva el código y el enlace', () => {
    expect(mensajeWhatsApp('https://x.co/l', 'DM5')).toBe('Hola, te invitamos a tu casillero de Easycomex (código DM5). Crea tu contraseña aquí: https://x.co/l');
  });
});
