import { useEffect } from 'react';

// El casillero es de DMatrixUSA aunque viva en la misma app que Easycomex.
// El servidor ya sirve el <head> correcto en estas rutas (server/seo.ts);
// esto cubre la navegación dentro de la página (sin recargar) y vuelve a
// poner lo de Easycomex al salir.
export function useMarcaDMatrix(titulo = 'DMatrixUSA | Casillero en Miami') {
  useEffect(() => {
    const icono = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const tema = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const antes = { titulo: document.title, icono: icono?.href, tema: tema?.content };
    document.title = titulo;
    if (icono) icono.href = '/dmatrix/favicon.png';
    if (tema) tema.content = '#b01c2e';
    return () => {
      document.title = antes.titulo;
      if (icono && antes.icono) icono.href = antes.icono;
      if (tema && antes.tema) tema.content = antes.tema;
    };
  }, [titulo]);
}

/** Rutas con marca DMatrixUSA: no llevan el chat ni los adornos de Easycomex. */
export const esRutaDMatrix = (ruta: string) => /^\/(casillero|rastreo|dmatrix)(\/|$)/.test(ruta);
