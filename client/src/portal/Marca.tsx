import { ReactNode } from 'react';
import { Logo } from './ui';

/** Pantalla dividida de las páginas de entrada: panel de marca a la izquierda y el formulario a la derecha. */
export default function PantallaMarca({ children, ancho = 'max-w-md' }: { children: ReactNode; ancho?: string }) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-[#262470] to-[#1B1A45] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent/30 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" aria-hidden="true" />
        <Logo className="relative text-3xl" claro />
        <div className="relative">
          <h2 className="font-heading text-4xl font-black leading-tight">Tus compras de EE. UU.,<br />en tus manos.</h2>
          <ul className="mt-6 space-y-3 text-white/80">
            {['Casillero en Miami con tu código personal', 'Despachos pagados con tu wallet', 'Inventario conectado a Shopify y WordPress'].map((t) => (
              <li key={t} className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-black">✓</span>{t}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/45">© {new Date().getFullYear()} Easycomex</p>
      </aside>
      <main className="flex items-center justify-center px-5 py-10">
        <div className={`w-full ${ancho}`}>
          <div className="mb-8 flex justify-center lg:hidden"><Logo className="text-3xl" /></div>
          {children}
        </div>
      </main>
    </div>
  );
}
