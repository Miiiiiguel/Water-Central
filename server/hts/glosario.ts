// Del español del cliente al inglés del arancel.
//
// La USITC publica el arancel sólo en inglés. Quien busca "camiseta de
// algodón" no encuentra nada si se compara palabra por palabra contra
// "T-shirts, singlets, tank tops... Of cotton". Este glosario traduce
// las palabras con que se nombra un producto o su material. No clasifica
// nada: sólo pone la búsqueda en el idioma del arancel, y el código
// sigue saliendo de una fila que existe.
//
// Las claves van normalizadas (minúsculas, sin tildes). Las frases van
// primero en el orden de búsqueda: "ropa interior" antes que "ropa".

export const GLOSARIO: Record<string, string[]> = {
  // Materiales
  algodon: ['cotton'],
  lana: ['wool'],
  seda: ['silk'],
  lino: ['flax', 'linen'],
  poliester: ['polyester', 'synthetic'],
  sintetico: ['synthetic'],
  sintetica: ['synthetic'],
  nylon: ['nylon', 'synthetic'],
  cuero: ['leather'],
  piel: ['leather', 'furskins'],
  madera: ['wood', 'wooden'],
  bambu: ['bamboo'],
  plastico: ['plastics'],
  caucho: ['rubber'],
  vidrio: ['glass'],
  ceramica: ['ceramic'],
  porcelana: ['porcelain'],
  acero: ['steel'],
  hierro: ['iron'],
  aluminio: ['aluminum'],
  cobre: ['copper'],
  plata: ['silver'],
  oro: ['gold'],
  papel: ['paper'],
  carton: ['paperboard'],
  // Ropa
  'ropa interior': ['underwear', 'briefs', 'panties'],
  'traje de bano': ['swimwear'],
  'vestido de bano': ['swimwear'],
  camiseta: ['t-shirts', 'singlets'],
  camisetas: ['t-shirts', 'singlets'],
  camisa: ['shirts'],
  camisas: ['shirts'],
  blusa: ['blouses'],
  pantalon: ['trousers'],
  pantalones: ['trousers'],
  jean: ['trousers', 'denim'],
  jeans: ['trousers', 'denim'],
  short: ['shorts'],
  falda: ['skirts'],
  vestido: ['dresses'],
  vestidos: ['dresses'],
  chaqueta: ['jackets', 'anoraks'],
  abrigo: ['overcoats'],
  sueter: ['sweaters', 'pullovers'],
  buzo: ['sweatshirts', 'pullovers'],
  sudadera: ['sweatshirts'],
  leggings: ['trousers'],
  pijama: ['pajamas', 'nightdresses'],
  medias: ['hosiery', 'socks'],
  calcetines: ['socks', 'hosiery'],
  brasier: ['brassieres'],
  sosten: ['brassieres'],
  faja: ['girdles'],
  guantes: ['gloves'],
  bufanda: ['scarves', 'shawls'],
  corbata: ['ties'],
  sombrero: ['hats'],
  gorra: ['caps', 'hats'],
  bebe: ['babies'],
  hombre: ["men's", 'boys'],
  hombres: ["men's", 'boys'],
  mujer: ["women's", 'girls'],
  mujeres: ["women's", 'girls'],
  nino: ['boys'],
  nina: ['girls'],
  tejido: ['knitted', 'woven'],
  punto: ['knitted', 'crocheted'],
  // Calzado y accesorios
  zapato: ['footwear'],
  zapatos: ['footwear'],
  calzado: ['footwear'],
  tenis: ['footwear', 'sports'],
  sandalias: ['footwear', 'sandals'],
  botas: ['footwear', 'boots'],
  bolso: ['handbags'],
  bolsos: ['handbags'],
  cartera: ['handbags', 'wallets'],
  billetera: ['wallets'],
  mochila: ['backpacks'],
  maleta: ['suitcases', 'trunks'],
  cinturon: ['belts'],
  reloj: ['watches'],
  relojes: ['watches'],
  gafas: ['spectacles', 'sunglasses'],
  joya: ['jewelry'],
  joyas: ['jewelry'],
  aretes: ['jewelry'],
  collar: ['jewelry', 'necklaces'],
  pulsera: ['jewelry', 'bracelets'],
  esmeralda: ['emeralds'],
  esmeraldas: ['emeralds'],
  // Alimentos y bebidas
  'en lata': ['prepared', 'preserved', 'airtight'],
  enlatado: ['prepared', 'preserved', 'airtight'],
  enlatada: ['prepared', 'preserved', 'airtight'],
  conserva: ['prepared', 'preserved'],
  conservas: ['prepared', 'preserved'],
  congelado: ['frozen'],
  congelada: ['frozen'],
  fresco: ['fresh'],
  fresca: ['fresh'],
  seco: ['dried'],
  seca: ['dried'],
  tostado: ['roasted'],
  molido: ['ground', 'roasted'],
  cafe: ['coffee'],
  te: ['tea'],
  cacao: ['cocoa'],
  chocolate: ['chocolate'],
  azucar: ['sugar'],
  panela: ['sugar', 'cane'],
  miel: ['honey'],
  fruta: ['fruit'],
  frutas: ['fruit'],
  aguacate: ['avocados'],
  banano: ['bananas'],
  platano: ['plantains', 'bananas'],
  mango: ['mangoes'],
  pina: ['pineapples'],
  uchuva: ['fruit'],
  flores: ['flowers'],
  rosas: ['roses'],
  atun: ['tuna'],
  camaron: ['shrimps', 'prawns'],
  pescado: ['fish'],
  carne: ['meat'],
  pollo: ['chickens', 'poultry'],
  queso: ['cheese'],
  leche: ['milk'],
  galleta: ['biscuits', 'cookies'],
  galletas: ['biscuits', 'cookies'],
  dulce: ['confectionery'],
  dulces: ['confectionery'],
  arequipe: ['milk', 'caramel'],
  salsa: ['sauces'],
  salsas: ['sauces'],
  mermelada: ['jams'],
  jugo: ['juice'],
  jugos: ['juice'],
  pulpa: ['fruit', 'puree'],
  snack: ['prepared'],
  arroz: ['rice'],
  harina: ['flour'],
  pasta: ['pasta'],
  especias: ['spices'],
  aceite: ['oil'],
  cerveza: ['beer'],
  vino: ['wine'],
  ron: ['rum'],
  aguardiente: ['spirits', 'liqueurs'],
  tequila: ['tequila'],
  mezcal: ['spirits'],
  agua: ['waters'],
  // Cuidado personal y hogar
  champu: ['shampoos'],
  shampoo: ['shampoos'],
  jabon: ['soap'],
  crema: ['beauty', 'skin'],
  cremas: ['beauty', 'skin'],
  perfume: ['perfumes'],
  perfumes: ['perfumes'],
  maquillaje: ['make-up'],
  labial: ['lip'],
  esmalte: ['nail'],
  desodorante: ['deodorants'],
  vela: ['candles'],
  velas: ['candles'],
  mueble: ['furniture'],
  muebles: ['furniture'],
  silla: ['seats'],
  sillas: ['seats'],
  mesa: ['tables', 'furniture'],
  cama: ['beds', 'furniture'],
  colchon: ['mattresses'],
  lampara: ['lamps'],
  hamaca: ['hammocks'],
  toalla: ['towels'],
  toallas: ['towels'],
  sabana: ['bed linen'],
  cojin: ['cushions'],
  alfombra: ['carpets'],
  canasta: ['basketwork'],
  juguete: ['toys'],
  juguetes: ['toys'],
  muneca: ['dolls'],
  libro: ['books'],
  libros: ['books'],
  botella: ['bottles'],
  bolsa: ['bags'],
  bolsas: ['bags'],
  suplemento: ['food preparations'],
  suplementos: ['food preparations'],
  vitaminas: ['vitamins'],
  mascota: ['dogs', 'cats'],
  perro: ['dog'],
  gato: ['cat'],
};

const FRASES = Object.keys(GLOSARIO).sort((a, b) => b.split(' ').length - a.split(' ').length || b.length - a.length);

export function normalizar(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9%\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * La consulta en inglés: las palabras traducidas y, además, las que no
 * se tradujeron (puede que ya estuvieran en inglés: "t-shirt", "jeans").
 */
export function aIngles(consulta: string): { terminos: string[]; traducidas: number } {
  let resto = ` ${normalizar(consulta)} `;
  const terminos: string[] = [];
  let traducidas = 0;
  for (const frase of FRASES) {
    const aguja = ` ${frase} `;
    if (resto.includes(aguja)) {
      terminos.push(...GLOSARIO[frase]);
      traducidas++;
      resto = resto.split(aguja).join(' ');
    }
  }
  const sueltas = resto.split(' ').filter((w) => w.length > 2 && !VACIAS_ES.has(w));
  return { terminos: Array.from(new Set([...terminos, ...sueltas])), traducidas };
}

const VACIAS_ES = new Set([
  'de', 'del', 'para', 'con', 'sin', 'los', 'las', 'una', 'uno', 'por', 'que', 'mis', 'tus', 'sus',
  'producto', 'productos', 'marca', 'hecho', 'hecha', 'tipo',
]);
