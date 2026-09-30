// Diagnóstico de madurez — las acciones recomendadas, palabra por palabra.
//
// Viven SOLO en el servidor a propósito: son lo que el cliente compra.
// La versión original las mandaba al navegador y las tapaba con CSS (se
// leían en devtools). Acá salen de /api/diagnostic/:ref únicamente cuando
// la fila ya está marcada como pagada.
//
// Indexadas por la posición de la pregunta en FLAT (client/src/lib/
// diagnosticContent.ts); la pregunta abierta no tiene acción. El test de
// al lado comprueba que cada pregunta puntuada tenga la suya.

/** Recommended action per scored question, by flat index. */
export const ACTIONS: Record<number, string> = {
  0: 'Su actividad económica debe estar registrada en Estados Unidos, como mínimo mediante DUNS, LLC o Corp. Para más información, le recomendamos consultar en <a href="https://www.irs.gov" target="_blank" rel="noopener">irs.gov</a>.',
  1: 'Registre su marca validando primero que no exista en el sistema TESS (<a href="https://tmsearch.uspto.gov" target="_blank" rel="noopener">tmsearch.uspto.gov</a>) y luego realice el proceso en el TEAS (<a href="https://www.uspto.gov/trademarks" target="_blank" rel="noopener">uspto.gov/trademarks</a>).',
  2: 'Identifique los requisitos y procesos para llegar de forma eficiente a USA usando el código de la partida arancelaria. Puede consultar en <a href="https://hts.usitc.gov" target="_blank" rel="noopener">hts.usitc.gov</a> o <a href="https://mygts.dhl.com" target="_blank" rel="noopener">mygts.dhl.com</a>.',
  3: 'Antes de iniciar su proceso exportador, utilice la partida arancelaria para consultar requisitos y costos de ingreso en <a href="https://hts.usitc.gov" target="_blank" rel="noopener">hts.usitc.gov</a> o <a href="https://mygts.dhl.com" target="_blank" rel="noopener">mygts.dhl.com</a>.',
  4: 'Para vender por canales digitales, la mejor opción es contar con un centro de procesamiento (PrepCenter), que reduce los costos logísticos cerca de un 70%. Contáctenos para asesorarlo en el proceso.',
  5: 'Cada canal de ventas implica una estrategia distinta según los resultados que busque. Contáctenos y le ayudamos a analizar qué canales le convienen.',
  6: 'Es prioritario conocer el terreno. Le recomendamos herramientas como <a href="https://www.junglescout.com" target="_blank" rel="noopener">junglescout.com</a> o <a href="https://www.kalodata.com" target="_blank" rel="noopener">kalodata.com</a> para obtener referencias.',
  7: 'Las redes sociales son indispensables para crear comunidad. Le recomendamos especialmente abrir una cuenta en TikTok para lograr un mejor posicionamiento.',
  8: 'Le recomendamos listar sus productos en estas plataformas para dar mayor visibilidad a su marca y más confianza a los compradores.',
  9: 'Conviértase en experto en el manejo de estos canales o contrate especialistas que se encarguen de este proceso tan importante.',
  10: 'Defina un presupuesto diario de inversión en pauta. Si requiere acompañamiento en este aspecto, no dude en contactarnos.',
  11: 'Tome medidas para fortalecer su comunidad a través de las diferentes redes. Si requiere apoyo, contáctenos.',
  12: 'Sin inversión no será visible. Elabore un plan de mercadeo con un presupuesto realista que contemple estrategia de comunicación, plan de acción a 90 días y generación de contenido, entre otros.',
  13: 'Tome medidas para optimizar su comunidad a través de las diferentes redes. Si requiere apoyo, contáctenos.',
  14: 'El siguiente paso natural es estructurar sus canales. Le recomendamos agendar un diagnóstico 1 a 1 para trazar el plan.',
  15: 'Definamos juntos un presupuesto de pauta acorde a sus objetivos para maximizar los resultados.',
};
