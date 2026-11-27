import { useEffect, useState } from 'react';
import { enEspanol, traducirDescripciones } from './hts';

/**
 * Las descripciones del arancel en español: pide las que se están
 * mostrando y vuelve a pintar cuando llegan. Mientras tanto, como vienen.
 */
export function useEspanol(es: boolean, textos: string[]): (t: string) => string {
  const [, setVersion] = useState(0);
  const clave = textos.join('\n');
  useEffect(() => {
    if (!es || !textos.length) return;
    const control = new AbortController();
    void traducirDescripciones(textos, control.signal).then((nuevas) => {
      if (nuevas && !control.signal.aborted) setVersion((v) => v + 1);
    });
    return () => control.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [es, clave]);
  return es ? enEspanol : (t) => t;
}
