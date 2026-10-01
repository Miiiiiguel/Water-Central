// Las cuentas maestras: las de los dueños. No pagan por consulta (ni de
// inteligencia de mercado ni de lectura de etiquetas) y son las únicas
// que administran a los revendedores.
//
// Se definen por correo en la variable de entorno CUENTAS_MAESTRAS
// (separados por coma), no en la base: así nadie puede dárselo a sí
// mismo editando su perfil, y cambiarlo es cosa de quien tiene acceso al
// servidor. Además el correo tiene que estar confirmado: si alguien se
// registra con el correo de un dueño sin poder abrir ese buzón, no entra
// como maestro.

export interface QuienPide {
  email?: string | null;
  email_confirmed_at?: string | null;
}

export function correosMaestros(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.CUENTAS_MAESTRAS || '')
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.includes('@'));
}

export function esCuentaMaestra(user: QuienPide | null | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!user?.email || !user.email_confirmed_at) return false;
  return correosMaestros(env).includes(user.email.trim().toLowerCase());
}
