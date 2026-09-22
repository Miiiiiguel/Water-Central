import type { DatosGenericos } from './generico';
import { leerEtiqueta } from './composicion';
import { leerPrenda, terminosDePrenda, FIBRA_EN_INGLES } from './prenda';

// Qué información hace falta para clasificar ESTE producto.
//
// El arancel tiene 98 capítulos. Los textiles, que fue por donde
// empezamos, son menos del 9% de las partidas: la mayoría del arancel
// son máquinas, químicos, alimentos, metales, madera. Cada familia se
// clasifica por datos distintos, y preguntar los de textil sobre una
// lata de atún no lleva a ninguna parte.
//
// Por eso cada familia está declarada como DATO: qué palabras la
// identifican, en qué capítulos vive y qué atributos deciden su
// partida. Agregar una familia nueva es agregar una entrada a esta
// lista; no se toca ni el OCR, ni el lector genérico, ni la ruta.
//
// Lo que un atributo "decisivo" significa: sin él no se puede llegar a
// una partida correcta, así que se pregunta. El material del corte de
// un zapato decide entre 6403 y 6404 igual que el tejido decide entre
// 61 y 62 en una prenda.

export interface OpcionAtributo {
  valor: string;
  etiqueta: string;
  /** Cómo aparece escrito en una etiqueta real, en los idiomas que sea. */
  sinonimos: string[];
  /** Lo que aporta a la búsqueda en el arancel, que está en inglés. */
  termino?: string;
}

/**
 * Lo que un lector saca del texto. Cuando viene marcado `supuesto`, no
 * estaba escrito: se dedujo de una costumbre del oficio (una camiseta
 * es de punto salvo rarezas) y la pantalla lo deja confirmar.
 */
export type Extraido = string | { valor: string; supuesto: boolean };

export interface Atributo {
  id: string;
  pregunta: string;
  /** Sin este dato no hay partida: se pregunta sí o sí. */
  decisivo: boolean;
  /** Cuando las respuestas son cerradas, la pantalla muestra botones. */
  opciones?: OpcionAtributo[];
  /**
   * Lector propio. Para los datos que no son de opción múltiple, y
   * también como segundo intento cuando ninguna opción coincide.
   */
  extraer?: (texto: string, generico: DatosGenericos) => Extraido | null;
  /** Qué aporta a la búsqueda un valor extraído libremente. */
  termino?: (valor: string) => string;
}

export interface Familia {
  id: string;
  nombre: string;
  /** Capítulos del arancel donde vive esta familia. */
  capitulos: string[];
  /** Palabras que delatan la familia en la etiqueta. */
  senales: string[];
  /**
   * Lo que delata la familia sin ser una palabra: "120V", "60Hz",
   * "5% Alc. Vol.". Vale lo mismo que una señal escrita.
   */
  senalesRegex?: RegExp[];
  /** Términos que siempre van a la búsqueda del arancel. */
  terminosBase: string[];
  atributos: Atributo[];
}

const opcion = (valor: string, etiqueta: string, sinonimos: string[], termino?: string): OpcionAtributo => ({
  valor, etiqueta, sinonimos, termino,
});

export const FAMILIAS: Familia[] = [
  {
    id: 'textil',
    nombre: 'Ropa y textiles',
    capitulos: ['61', '62', '63'],
    senales: ['algodon', 'cotton', 'poliester', 'polyester', 'elastano', 'spandex', 'camiseta', 't-shirt',
      'pantalon', 'jean', 'blusa', 'camisa', 'vestido', 'chaqueta', 'sueter', 'lavar a maquina', 'machine wash',
      'talla', 'size', 'prenda', 'viscosa', 'rayon', 'lana', 'wool', 'tejido'],
    // "95% ALGODON 5% ELASTANO": la composición con porcentajes es la
    // firma inconfundible de una etiqueta textil.
    senalesRegex: [/\d{1,3}\s*%\s*(?:algod|cotton|poli|polyest|elast|span|nylon|lana|wool|visc|rayon|acril|lino|seda|silk)/i],
    terminosBase: [],
    atributos: [
      {
        id: 'tejido',
        pregunta: '¿La tela es de punto (elástica, tipo camiseta) o plana (rígida, tipo camisa de vestir)? De eso depende el capítulo del arancel.',
        decisivo: true,
        opciones: [
          opcion('punto', 'De punto (elástica)', ['punto', 'knit', 'knitted', 'jersey', 'malha'], 'knitted crocheted'),
          opcion('plano', 'Plana (rígida)', ['plano', 'woven', 'denim', 'popelina', 'twill'], 'woven not knitted'),
        ],
        // Cuando la etiqueta no lo dice, vale la costumbre del oficio:
        // una camiseta es de punto y un jean es plano. Queda marcado
        // como supuesto para que se pueda corregir de un toque.
        extraer: (texto) => {
          const p = leerPrenda(texto);
          return p.tejido ? { valor: p.tejido, supuesto: p.origenDelTejido !== 'etiqueta' } : null;
        },
      },
      {
        id: 'genero',
        pregunta: '¿Para quién es? En el arancel de EE. UU. cada uno tiene su propia partida.',
        decisivo: true,
        opciones: [
          opcion('hombre', 'Hombre', ['hombre', 'men', "men's", 'caballero', 'masculino'], "men's boys'"),
          opcion('mujer', 'Mujer', ['mujer', 'women', "women's", 'dama', 'femenino', 'ladies'], "women's girls'"),
          opcion('nina_nino', 'Niño o niña', ['nino', 'nina', 'kids', 'boys', 'girls', 'infantil'], "boys' girls'"),
          opcion('bebe', 'Bebé', ['bebe', 'baby', 'infant', 'recien nacido'], 'babies'),
        ],
        extraer: (texto) => leerPrenda(texto).genero,
      },
      {
        id: 'prenda',
        pregunta: '¿Qué prenda es? (camiseta, pantalón, vestido, chaqueta…)',
        decisivo: true,
        extraer: (texto) => leerPrenda(texto).prenda?.tipo ?? null,
        termino: (valor) => terminosDePrenda(valor) ?? valor,
      },
      {
        id: 'fibra',
        pregunta: '¿Qué fibra pesa más en la tela exterior? (no la del forro: esa no clasifica)',
        decisivo: true,
        extraer: (texto) => leerEtiqueta(texto).fibraPrincipal?.fibra ?? null,
        termino: (valor) => FIBRA_EN_INGLES[valor] ?? valor,
      },
    ],
  },

  {
    id: 'calzado',
    nombre: 'Calzado',
    capitulos: ['64'],
    senales: ['calzado', 'footwear', 'zapato', 'shoe', 'shoes', 'tenis', 'sneaker', 'bota', 'boot', 'sandalia',
      'sandal', 'zapatilla', 'suela', 'outsole', 'corte', 'upper', 'plantilla', 'insole', 'tacon'],
    terminosBase: ['footwear'],
    atributos: [
      {
        id: 'material_corte',
        pregunta: '¿De qué es el corte (la parte de arriba, la que cubre el pie)? Ese material decide la partida.',
        decisivo: true,
        opciones: [
          opcion('cuero', 'Cuero', ['cuero', 'leather', 'couro', 'piel'], 'uppers of leather'),
          opcion('textil', 'Textil / tela', ['textil', 'textile', 'tela', 'canvas', 'lona', 'mesh'], 'uppers of textile materials'),
          opcion('caucho_plastico', 'Caucho o plástico', ['caucho', 'rubber', 'plastico', 'plastic', 'pvc', 'sintetico'], 'uppers of rubber or plastics'),
        ],
      },
      {
        id: 'material_suela',
        pregunta: '¿De qué es la suela?',
        decisivo: true,
        opciones: [
          opcion('caucho_plastico', 'Caucho o plástico', ['caucho', 'rubber', 'plastico', 'eva', 'tpr', 'pu'], 'outer soles of rubber plastics'),
          opcion('cuero', 'Cuero', ['cuero', 'leather'], 'outer soles of leather'),
          opcion('otro', 'Otro material', ['madera', 'corcho', 'cuerda', 'yute'], ''),
        ],
      },
      {
        id: 'tipo',
        pregunta: '¿Qué tipo de calzado es?',
        decisivo: false,
        opciones: [
          opcion('deportivo', 'Deportivo / tenis', ['tenis', 'sneaker', 'deportivo', 'sports', 'running', 'training'], 'sports footwear athletic'),
          opcion('bota', 'Bota', ['bota', 'boot', 'botin'], 'boots covering the ankle'),
          opcion('sandalia', 'Sandalia / chancla', ['sandalia', 'sandal', 'chancla', 'flip flop', 'ojota'], 'sandals thong'),
          opcion('formal', 'Zapato formal', ['formal', 'vestir', 'dress shoe', 'mocasin'], ''),
        ],
      },
    ],
  },

  {
    id: 'alimento',
    nombre: 'Alimentos',
    capitulos: ['04', '07', '08', '09', '11', '15', '16', '17', '18', '19', '20', '21'],
    senales: ['ingredientes', 'ingredients', 'informacion nutricional', 'nutrition facts', 'valor nutricional',
      'consumir antes', 'conservar', 'refrigerar', 'calorias', 'proteina', 'azucares', 'sodio', 'alimento',
      'contenido neto', 'gluten', 'alergenos', 'pasteurizado'],
    terminosBase: [],
    atributos: [
      {
        id: 'presentacion',
        pregunta: '¿Cómo viene el producto? El arancel separa fresco, congelado, en conserva y preparado.',
        decisivo: true,
        opciones: [
          opcion('fresco', 'Fresco o refrigerado', ['fresco', 'fresh', 'refrigerado', 'chilled'], 'fresh chilled'),
          opcion('congelado', 'Congelado', ['congelado', 'frozen', 'ultracongelado'], 'frozen'),
          opcion('conserva', 'En conserva / enlatado', ['conserva', 'enlatado', 'canned', 'en lata', 'al natural', 'en aceite'], 'prepared or preserved airtight containers'),
          opcion('seco', 'Seco o deshidratado', ['seco', 'dried', 'deshidratado', 'polvo', 'powder'], 'dried'),
          opcion('preparado', 'Preparado / listo para consumir', ['preparado', 'listo', 'ready to eat', 'instantaneo'], 'preparations'),
        ],
      },
      {
        id: 'ingrediente_principal',
        pregunta: '¿Cuál es el ingrediente principal? Es el primero de la lista de ingredientes.',
        decisivo: true,
        extraer: (texto) => primerIngrediente(texto),
        termino: (valor) => valor,
      },
      {
        id: 'azucar_cacao',
        pregunta: '¿Lleva azúcar o cacao añadido? En varias partidas cambia la tarifa.',
        decisivo: false,
        opciones: [
          opcion('con_azucar', 'Con azúcar añadido', ['azucar', 'sugar', 'endulzado', 'sweetened'], 'containing added sugar'),
          opcion('con_cacao', 'Con cacao', ['cacao', 'cocoa', 'chocolate'], 'containing cocoa'),
          opcion('sin', 'Sin azúcar ni cacao', ['sin azucar', 'no sugar', 'unsweetened'], 'not containing added sugar'),
        ],
      },
    ],
  },

  {
    id: 'bebida',
    nombre: 'Bebidas',
    capitulos: ['22'],
    senales: ['bebida', 'beverage', 'jugo', 'juice', 'gaseosa', 'soda', 'cerveza', 'beer', 'vino', 'wine',
      'licor', 'ron', 'whisky', 'vodka', 'tequila', 'alc vol', 'alcohol vol', 'agua mineral', 'refresco'],
    senalesRegex: [/\d{1,2}(?:[.,]\d)?\s*%\s*(?:alc|vol)/i],
    terminosBase: ['beverages'],
    atributos: [
      {
        id: 'tipo',
        pregunta: '¿Qué tipo de bebida es?',
        decisivo: true,
        opciones: [
          opcion('agua', 'Agua', ['agua', 'water', 'mineral'], 'waters'),
          opcion('jugo', 'Jugo de fruta', ['jugo', 'juice', 'nectar', 'zumo'], 'fruit juices'),
          opcion('gaseosa', 'Gaseosa / refresco', ['gaseosa', 'soda', 'refresco', 'soft drink'], 'waters containing added sugar flavored'),
          opcion('cerveza', 'Cerveza', ['cerveza', 'beer', 'lager', 'ale'], 'beer made from malt'),
          opcion('vino', 'Vino', ['vino', 'wine'], 'wine of fresh grapes'),
          opcion('destilado', 'Licor destilado', ['ron', 'whisky', 'vodka', 'tequila', 'ginebra', 'aguardiente', 'licor'], 'spirits liqueurs'),
        ],
      },
      {
        id: 'alcohol',
        pregunta: '¿Qué grado de alcohol tiene? (si no tiene, decilo: cambia la partida)',
        decisivo: true,
        extraer: (texto) => {
          const m = /(\d{1,2}(?:[.,]\d)?)\s*%?\s*(?:alc|vol|alcohol)/i.exec(texto);
          return m ? m[1].replace(',', '.') : null;
        },
        termino: (valor) => (parseFloat(valor) > 0.5 ? 'alcoholic' : 'non-alcoholic'),
      },
    ],
  },

  {
    id: 'cosmetico',
    nombre: 'Cosméticos y cuidado personal',
    capitulos: ['33'],
    senales: ['cosmetico', 'cosmetic', 'crema', 'cream', 'shampoo', 'champu', 'acondicionador', 'locion',
      'perfume', 'fragancia', 'maquillaje', 'labial', 'lipstick', 'serum', 'aqua', 'parfum', 'uso externo',
      'desodorante', 'protector solar', 'inci'],
    terminosBase: [],
    atributos: [
      {
        id: 'funcion',
        pregunta: '¿Para qué sirve el producto?',
        decisivo: true,
        opciones: [
          opcion('capilar', 'Cabello (shampoo, acondicionador, tinte)', ['shampoo', 'champu', 'acondicionador', 'cabello', 'hair', 'tinte'], 'preparations for use on the hair'),
          opcion('piel', 'Piel (crema, loción, protector solar)', ['crema', 'cream', 'locion', 'piel', 'skin', 'protector solar', 'sunscreen'], 'beauty or make-up preparations skin care'),
          opcion('maquillaje', 'Maquillaje', ['maquillaje', 'make-up', 'labial', 'lipstick', 'rimel', 'mascara', 'base'], 'beauty make-up preparations lips eyes'),
          opcion('perfume', 'Perfume o fragancia', ['perfume', 'fragancia', 'eau de toilette', 'colonia'], 'perfumes and toilet waters'),
          opcion('bucal', 'Higiene bucal', ['dental', 'crema dental', 'toothpaste', 'enjuague bucal'], 'preparations for oral dental hygiene'),
        ],
      },
    ],
  },

  {
    id: 'aseo',
    nombre: 'Jabones y productos de limpieza',
    capitulos: ['34'],
    senales: ['detergente', 'detergent', 'jabon', 'soap', 'limpiador', 'cleaner', 'desinfectante',
      'suavizante', 'blanqueador', 'lavaplatos', 'quitamanchas'],
    terminosBase: [],
    atributos: [
      {
        id: 'tipo',
        pregunta: '¿Qué tipo de producto es?',
        decisivo: true,
        opciones: [
          opcion('jabon', 'Jabón', ['jabon', 'soap'], 'soap'),
          opcion('detergente', 'Detergente para ropa', ['detergente', 'detergent', 'lavar ropa'], 'washing preparations surface-active'),
          opcion('limpiador', 'Limpiador o desinfectante', ['limpiador', 'cleaner', 'desinfectante', 'multiusos'], 'cleaning preparations'),
        ],
      },
      {
        id: 'forma',
        pregunta: '¿Viene líquido, en polvo o en barra?',
        decisivo: true,
        opciones: [
          opcion('liquido', 'Líquido', ['liquido', 'liquid', 'gel'], 'liquid'),
          opcion('polvo', 'Polvo', ['polvo', 'powder'], 'powder'),
          opcion('barra', 'Barra o pastilla', ['barra', 'bar', 'pastilla'], 'bars cakes molded'),
        ],
      },
    ],
  },

  {
    id: 'electrico',
    nombre: 'Aparatos eléctricos y electrónicos',
    capitulos: ['84', '85'],
    senales: ['voltaje', 'volt', 'watts', 'hertz', 'bateria', 'battery', 'cargador', 'charger', 'motor',
      'input', 'output', 'licuadora', 'nevera', 'lavadora', 'televisor', 'parlante', 'audifonos',
      'celular', 'telefono', 'computador', 'laptop', 'electrodomestico', 'recargable'],
    // Los datos de placa: "120V~ 60Hz 600W". Ninguna etiqueta que los
    // lleve es de otra cosa.
    senalesRegex: [/\b\d{2,3}\s*-?\s*\d{0,3}\s*v\b/i, /\b\d{1,5}\s*(?:w|watts?|kw)\b/i, /\b\d{2,3}\s*hz\b/i],
    terminosBase: [],
    atributos: [
      {
        id: 'funcion',
        pregunta: '¿Qué hace el aparato? (describilo: licuadora, parlante, taladro…)',
        decisivo: true,
        // Nada que extraer con honestidad: el modelo "LC-600" no dice
        // qué hace el aparato. Se pregunta.
        termino: (valor) => valor,
      },
      {
        id: 'alimentacion',
        pregunta: '¿Funciona enchufado a la red, con batería, o las dos?',
        decisivo: true,
        opciones: [
          opcion('red', 'Enchufado a la red', ['110v', '220v', 'ac', 'corriente'], 'electro-mechanical'),
          opcion('bateria', 'Con batería', ['bateria', 'battery', 'recargable', 'litio', 'lithium'], 'battery powered cordless'),
          opcion('ambos', 'Las dos cosas', ['recargable', 'dual'], ''),
        ],
      },
    ],
  },

  {
    id: 'plastico',
    nombre: 'Artículos de plástico',
    capitulos: ['39'],
    senales: ['plastico', 'plastic', 'polipropileno', 'polietileno', 'pvc', 'pet', 'acrilico',
      'libre de bpa', 'bpa free', 'apto microondas', 'recipiente', 'envase plastico'],
    terminosBase: ['of plastics'],
    atributos: [
      {
        id: 'articulo',
        pregunta: '¿Qué artículo es? (recipiente, vaso, caja, bolsa, juguete…)',
        decisivo: true,
        termino: (valor) => valor,
      },
    ],
  },

  {
    id: 'marroquineria',
    nombre: 'Cuero y marroquinería',
    capitulos: ['42'],
    senales: ['cuero', 'leather', 'bolso', 'handbag', 'billetera', 'wallet', 'cinturon', 'belt',
      'mochila', 'backpack', 'maleta', 'suitcase', 'morral', 'cartera'],
    terminosBase: [],
    atributos: [
      {
        id: 'articulo',
        pregunta: '¿Qué artículo es?',
        decisivo: true,
        opciones: [
          opcion('bolso', 'Bolso o cartera', ['bolso', 'handbag', 'cartera'], 'handbags'),
          opcion('billetera', 'Billetera o monedero', ['billetera', 'wallet', 'monedero'], 'wallets purses pocket'),
          opcion('maleta', 'Maleta o mochila', ['maleta', 'suitcase', 'mochila', 'backpack', 'morral'], 'trunks suitcases backpacks travel'),
          opcion('cinturon', 'Cinturón', ['cinturon', 'belt', 'correa'], 'belts bandoliers'),
        ],
      },
      {
        id: 'material',
        pregunta: '¿La superficie exterior es de cuero, de plástico o de tela?',
        decisivo: true,
        opciones: [
          opcion('cuero', 'Cuero', ['cuero', 'leather', 'piel'], 'outer surface of leather'),
          opcion('plastico', 'Plástico o cuero sintético', ['sintetico', 'pu', 'pvc', 'plastico'], 'outer surface of sheeting of plastics'),
          opcion('textil', 'Tela', ['tela', 'textil', 'lona', 'canvas', 'nylon'], 'outer surface of textile materials'),
        ],
      },
    ],
  },

  {
    id: 'mueble_madera',
    nombre: 'Muebles y artículos de madera',
    capitulos: ['44', '94'],
    senales: ['madera', 'wood', 'mdf', 'aglomerado', 'mueble', 'furniture', 'silla', 'chair', 'mesa',
      'table', 'escritorio', 'estante', 'cama', 'colchon', 'armario', 'lampara'],
    terminosBase: [],
    atributos: [
      {
        id: 'articulo',
        pregunta: '¿Qué artículo es? (silla, mesa, estante, colchón…)',
        decisivo: true,
        termino: (valor) => valor,
      },
      {
        id: 'material',
        pregunta: '¿De qué está hecho principalmente?',
        decisivo: true,
        opciones: [
          opcion('madera', 'Madera', ['madera', 'wood', 'mdf', 'aglomerado', 'pino', 'roble'], 'of wood'),
          opcion('metal', 'Metal', ['metal', 'acero', 'aluminio', 'hierro'], 'of metal'),
          opcion('plastico', 'Plástico', ['plastico', 'plastic', 'resina'], 'of plastics'),
        ],
      },
    ],
  },

  {
    id: 'cocina_hogar',
    nombre: 'Artículos de cocina y hogar',
    capitulos: ['69', '70', '73', '76', '82'],
    senales: ['acero inoxidable', 'stainless', 'aluminio', 'ceramica', 'porcelana', 'vidrio', 'glass',
      'olla', 'sarten', 'cuchillo', 'knife', 'cubiertos', 'vajilla', 'taza', 'plato', 'copa', 'termo'],
    terminosBase: [],
    atributos: [
      {
        id: 'articulo',
        pregunta: '¿Qué artículo es? (olla, sartén, cuchillo, vajilla, taza…)',
        decisivo: true,
        termino: (valor) => valor,
      },
      {
        id: 'material',
        pregunta: '¿De qué material es?',
        decisivo: true,
        opciones: [
          opcion('acero', 'Acero inoxidable o hierro', ['acero', 'stainless', 'hierro', 'steel'], 'of iron or steel'),
          opcion('aluminio', 'Aluminio', ['aluminio', 'aluminum'], 'of aluminum'),
          opcion('ceramica', 'Cerámica o porcelana', ['ceramica', 'porcelana', 'ceramic', 'porcelain'], 'ceramic porcelain'),
          opcion('vidrio', 'Vidrio', ['vidrio', 'glass', 'cristal'], 'of glass'),
        ],
      },
    ],
  },

  {
    id: 'juguete',
    nombre: 'Juguetes y juegos',
    capitulos: ['95'],
    senales: ['juguete', 'toy', 'juego', 'game', 'muneca', 'doll', 'peluche', 'plush', 'no apto para menores',
      'anos', 'edad recomendada', 'bloques', 'rompecabezas', 'puzzle'],
    terminosBase: ['toys'],
    atributos: [
      {
        id: 'tipo',
        pregunta: '¿Qué tipo de juguete es?',
        decisivo: true,
        opciones: [
          opcion('muneca', 'Muñeca o figura', ['muneca', 'doll', 'figura', 'action figure'], 'dolls representing human beings'),
          opcion('peluche', 'Peluche', ['peluche', 'plush', 'stuffed'], 'stuffed toys representing animals'),
          opcion('construccion', 'Bloques o construcción', ['bloques', 'blocks', 'construccion', 'lego'], 'construction sets building blocks'),
          opcion('rodante', 'Con ruedas para montar', ['triciclo', 'patineta', 'scooter', 'carro de pedales'], 'wheeled toys ride-on'),
          opcion('juego_mesa', 'Juego de mesa o rompecabezas', ['rompecabezas', 'puzzle', 'juego de mesa', 'board game'], 'puzzles games'),
        ],
      },
      {
        id: 'edad',
        pregunta: '¿Para qué edad es? (aparece como "+3 años" o similar)',
        decisivo: false,
        extraer: (texto) => {
          const m = /\+?\s*(\d{1,2})\s*(?:\+)?\s*(?:anos|años|years|meses|months)/i.exec(texto);
          return m ? m[0].trim() : null;
        },
      },
    ],
  },

  {
    id: 'joyeria',
    nombre: 'Joyería y bisutería',
    capitulos: ['71'],
    senales: ['plata', 'silver', 'oro', 'gold', '925', '18k', '14k', 'bisuteria', 'joya', 'jewelry',
      'anillo', 'ring', 'collar', 'necklace', 'arete', 'pulsera', 'bracelet', 'acero quirurgico'],
    senalesRegex: [/\b(?:9(?:25|99)|1[048]\s*k|24\s*k)\b/i],
    terminosBase: [],
    atributos: [
      {
        id: 'material',
        pregunta: '¿De qué metal es? Joyería y bisutería son partidas muy distintas.',
        decisivo: true,
        opciones: [
          opcion('oro', 'Oro', ['oro', 'gold', '18k', '14k', '10k'], 'articles of jewelry of gold'),
          opcion('plata', 'Plata', ['plata', 'silver', '925', 'sterling'], 'articles of jewelry of silver'),
          opcion('bisuteria', 'Bisutería (metal común, chapado)', ['bisuteria', 'imitation', 'chapado', 'acero quirurgico', 'laton'], 'imitation jewelry'),
        ],
      },
    ],
  },

  {
    id: 'papeleria',
    nombre: 'Papel y papelería',
    capitulos: ['48', '49'],
    senales: ['papel', 'paper', 'cuaderno', 'notebook', 'libreta', 'agenda', 'carton', 'cardboard',
      'servilleta', 'toalla de papel', 'higienico', 'impreso', 'libro'],
    terminosBase: ['of paper'],
    atributos: [
      {
        id: 'articulo',
        pregunta: '¿Qué artículo es? (cuaderno, papel higiénico, caja, libro…)',
        decisivo: true,
        termino: (valor) => valor,
      },
    ],
  },
];

/** El primer ingrediente de la lista: en alimentos define la partida. */
function primerIngrediente(texto: string): string | null {
  const m = /ingredientes?\s*:?\s*([^\n.]{3,80})/i.exec(texto);
  if (!m) return null;
  const primero = m[1].split(/[,;(]/)[0].trim();
  return primero.length >= 3 ? primero.toLowerCase() : null;
}

export interface Deteccion {
  familia: Familia;
  puntaje: number;
}

function normalizar(texto: string): string {
  return ' ' + texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%+\s-]/g, ' ').replace(/\s+/g, ' ') + ' ';
}

/**
 * Qué familia de producto es. Devuelve las candidatas ordenadas: si la
 * primera no le saca ventaja clara a la segunda, hay que preguntar en
 * vez de elegir.
 */
export function detectarFamilias(texto: string): Deteccion[] {
  const heno = normalizar(texto || '');
  const encontradas: Deteccion[] = [];
  for (const familia of FAMILIAS) {
    let puntaje = 0;
    for (const senal of familia.senales) {
      if (heno.includes(' ' + senal + ' ') || heno.includes(' ' + senal + 's ')) puntaje += 2;
      else if (senal.includes(' ') && heno.includes(senal)) puntaje += 2;
    }
    for (const patron of familia.senalesRegex ?? []) {
      if (patron.test(texto || '')) puntaje += 2;
    }
    if (puntaje) encontradas.push({ familia, puntaje });
  }
  encontradas.sort((a, b) => b.puntaje - a.puntaje);
  return encontradas;
}

/** ¿Se puede dar por buena la familia detectada, o hay que preguntar? */
export function familiaSegura(detecciones: Deteccion[]): boolean {
  if (!detecciones.length) return false;
  if (detecciones.length === 1) return detecciones[0].puntaje >= 2;
  // Una ventaja corta sobre la segunda candidata no alcanza: una
  // billetera de cuero da señales de marroquinería y de textil a la vez.
  return detecciones[0].puntaje >= 4 && detecciones[0].puntaje >= detecciones[1].puntaje * 2;
}

export interface ValorAtributo {
  atributo: Atributo;
  valor: string | null;
  /**
   * De dónde salió. `supuesto` es el único que la pantalla tiene que
   * marcar: no estaba escrito, se dedujo, y conviene confirmarlo.
   */
  origen: 'etiqueta' | 'supuesto' | 'respuesta' | null;
  /** Cómo se llama el valor en pantalla, cuando es de opción cerrada. */
  etiqueta: string | null;
}

/**
 * Saca del texto los atributos que esta familia necesita, y marca los
 * que faltan. Lo que la persona ya contestó manda sobre lo leído.
 */
export function leerAtributos(
  familia: Familia,
  texto: string,
  generico: DatosGenericos,
  respuestas: Record<string, string> = {}
): ValorAtributo[] {
  const heno = normalizar(texto || '');
  return familia.atributos.map((atributo): ValorAtributo => {
    const nombrar = (valor: string | null): string | null => {
      if (!valor) return null;
      return atributo.opciones?.find((o) => o.valor === valor)?.etiqueta ?? null;
    };

    const contestado = respuestas[atributo.id];
    if (contestado) {
      return { atributo, valor: contestado, origen: 'respuesta', etiqueta: nombrar(contestado) };
    }

    // Primero las opciones escritas tal cual en la etiqueta; después,
    // el lector propio del atributo. Ese orden importa: lo impreso gana
    // sobre lo deducido.
    for (const op of atributo.opciones ?? []) {
      if (op.sinonimos.some((s) => (s.includes(' ') ? heno.includes(s) : heno.includes(' ' + s + ' ')))) {
        return { atributo, valor: op.valor, origen: 'etiqueta', etiqueta: op.etiqueta };
      }
    }

    const leido = atributo.extraer ? atributo.extraer(texto, generico) : null;
    if (!leido) return { atributo, valor: null, origen: null, etiqueta: null };
    const valor = typeof leido === 'string' ? leido : leido.valor;
    const origen = typeof leido === 'string' || !leido.supuesto ? 'etiqueta' : 'supuesto';
    return { atributo, valor, origen, etiqueta: nombrar(valor) };
  });
}

/**
 * Los términos con los que se busca en el arancel. Se arma en inglés y
 * sin rellenar nada: lo que no se sabe, no entra.
 */
export function terminosDeBusqueda(familia: Familia, valores: ValorAtributo[]): string {
  const partes = [...familia.terminosBase];
  for (const { atributo, valor } of valores) {
    if (!valor) continue;
    if (atributo.opciones) {
      const op = atributo.opciones.find((o) => o.valor === valor);
      if (op?.termino) partes.push(op.termino);
    } else if (atributo.termino) {
      partes.push(atributo.termino(valor));
    }
  }
  return partes.filter(Boolean).join(' ');
}
