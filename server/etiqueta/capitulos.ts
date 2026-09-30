// Los 97 capítulos del Sistema Armonizado, como dato.
//
// Las familias de familias.ts saben preguntar: al calzado, por el
// material del corte; a una bebida, por el grado de alcohol. Pero son
// catorce, y el arancel tiene 97 capítulos de producto. Un reloj, unas
// gafas de sol o un alimento para perros no caían en ninguna, y la
// única salida era elegir entre catorce opciones que no eran.
//
// Esta tabla es la garantía de cobertura. Cada capítulo tiene:
//   - un nombre que una persona reconoce ("Relojes", no "Capítulo 91"),
//   - las palabras que lo delatan en una etiqueta, en español e inglés,
//   - los términos en inglés con que se buscará en el arancel.
//
// Los capítulos que ya tienen una familia hecha a mano le suman sus
// palabras a esa familia. Los demás se convierten en una familia propia
// de un solo capítulo. Nada de eso se decide acá: lo arma familias.ts.
//
// La regla para las palabras, que es la que evita que esto clasifique
// mal: tienen que nombrar lo que el producto ES, nunca algo de lo que
// está hecho o que lo acompaña. "Trigo" aparece en la lista de
// ingredientes de cualquier galleta; "caucho" en la suela de cualquier
// zapato; "glicerina" en cualquier crema. Si esas palabras delataran un
// capítulo, la galleta, el zapato y la crema caerían donde no van.
//
// Quedan afuera el 77 (reservado, no tiene productos) y el 98 y 99 del
// arancel de EE. UU., que no dicen qué es un producto sino cómo se
// trata (devoluciones, sobretasas): importan para el cálculo del
// impuesto, no para saber qué se está exportando.
//
// Las palabras van ya normalizadas: minúsculas, sin tildes, sin eñes.
// El detector compara contra el texto normalizado de la misma forma.

export interface Capitulo {
  codigo: string;
  nombre: string;
  senales: string[];
  senalesRegex?: RegExp[];
  /** En inglés, como las descripciones del arancel. */
  terminos: string[];
}

export interface Seccion {
  /** En romanos, como las numera la OMA. */
  id: string;
  nombre: string;
  capitulos: string[];
}

/** Las 21 secciones del Sistema Armonizado. Todo producto cae en una. */
export const SECCIONES: Seccion[] = [
  { id: 'I', nombre: 'Animales y productos animales', capitulos: ['01', '02', '03', '04', '05'] },
  { id: 'II', nombre: 'Plantas, frutas, café y cereales', capitulos: ['06', '07', '08', '09', '10', '11', '12', '13', '14'] },
  { id: 'III', nombre: 'Grasas y aceites', capitulos: ['15'] },
  { id: 'IV', nombre: 'Alimentos preparados, bebidas y tabaco', capitulos: ['16', '17', '18', '19', '20', '21', '22', '23', '24'] },
  { id: 'V', nombre: 'Minerales y combustibles', capitulos: ['25', '26', '27'] },
  { id: 'VI', nombre: 'Químicos, medicamentos y cosméticos', capitulos: ['28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38'] },
  { id: 'VII', nombre: 'Plástico y caucho', capitulos: ['39', '40'] },
  { id: 'VIII', nombre: 'Cuero, pieles y marroquinería', capitulos: ['41', '42', '43'] },
  { id: 'IX', nombre: 'Madera, corcho y cestería', capitulos: ['44', '45', '46'] },
  { id: 'X', nombre: 'Papel, cartón y libros', capitulos: ['47', '48', '49'] },
  { id: 'XI', nombre: 'Telas, hilos y ropa', capitulos: ['50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63'] },
  { id: 'XII', nombre: 'Calzado, sombreros, paraguas y pelucas', capitulos: ['64', '65', '66', '67'] },
  { id: 'XIII', nombre: 'Piedra, cerámica y vidrio', capitulos: ['68', '69', '70'] },
  { id: 'XIV', nombre: 'Joyería y metales preciosos', capitulos: ['71'] },
  { id: 'XV', nombre: 'Metales y artículos de metal', capitulos: ['72', '73', '74', '75', '76', '78', '79', '80', '81', '82', '83'] },
  { id: 'XVI', nombre: 'Máquinas y aparatos eléctricos', capitulos: ['84', '85'] },
  { id: 'XVII', nombre: 'Vehículos, aviones y barcos', capitulos: ['86', '87', '88', '89'] },
  { id: 'XVIII', nombre: 'Óptica, medicina, relojes y música', capitulos: ['90', '91', '92'] },
  { id: 'XIX', nombre: 'Armas y municiones', capitulos: ['93'] },
  { id: 'XX', nombre: 'Muebles, juguetes y artículos varios', capitulos: ['94', '95', '96'] },
  { id: 'XXI', nombre: 'Arte y antigüedades', capitulos: ['97'] },
];

const c = (
  codigo: string,
  nombre: string,
  senales: string[],
  terminos: string[],
  senalesRegex?: RegExp[]
): Capitulo => ({ codigo, nombre, senales, terminos, senalesRegex });

export const CAPITULOS: Capitulo[] = [
  // I. Animales
  c('01', 'Animales vivos',
    ['animal vivo', 'animales vivos', 'live animal', 'live animals', 'ganado en pie', 'aves vivas', 'live poultry',
      'peces ornamentales', 'ornamental fish'],
    ['live animals']),
  c('02', 'Carne',
    ['carne de res', 'carne de cerdo', 'carne de pollo', 'pechuga de pollo', 'beef', 'pork', 'chicken breast',
      'carne fresca', 'carne congelada', 'fresh meat', 'frozen meat', 'cortes de carne'],
    ['meat edible offal']),
  c('03', 'Pescados y mariscos',
    ['pescado fresco', 'pescado congelado', 'fresh fish', 'frozen fish', 'camaron', 'camarones', 'shrimp',
      'langostino', 'langostinos', 'prawns', 'filete de pescado', 'fish fillet', 'mariscos', 'seafood', 'tilapia',
      'trucha', 'trout', 'pulpo', 'octopus', 'calamar', 'squid'],
    ['fish crustaceans molluscs']),
  c('04', 'Lácteos, huevos y miel',
    ['leche', 'milk', 'queso', 'cheese', 'yogur', 'yogurt', 'mantequilla', 'butter', 'huevos', 'eggs', 'miel',
      'honey', 'lacteo', 'lacteos', 'dairy'],
    ['dairy produce eggs honey']),
  c('05', 'Otros productos animales',
    ['cerdas naturales', 'natural bristles', 'tripa natural', 'tripas naturales', 'natural casings',
      'crin de caballo', 'horsehair', 'marfil', 'ivory', 'coral natural'],
    ['products of animal origin']),

  // II. Vegetales
  c('06', 'Plantas vivas y flores',
    ['planta viva', 'plantas vivas', 'live plant', 'live plants', 'flores frescas', 'fresh flowers',
      'flores cortadas', 'cut flowers', 'ramo de flores', 'bouquet', 'bulbos de flores', 'flower bulbs', 'esquejes', 'orquidea',
      'orquideas', 'orchid', 'orchids', 'suculenta', 'suculentas', 'succulent'],
    ['live trees plants cut flowers']),
  c('07', 'Hortalizas y legumbres',
    ['hortaliza', 'hortalizas', 'vegetales', 'vegetables', 'papas', 'potatoes', 'tomates', 'tomatoes', 'cebolla',
      'cebollas', 'onions', 'zanahoria', 'zanahorias', 'carrots', 'yuca', 'cassava', 'frijol', 'frijoles', 'beans',
      'lentejas', 'lentils', 'garbanzos', 'chickpeas'],
    ['vegetables']),
  c('08', 'Frutas y frutos secos',
    ['fruta', 'frutas', 'fruit', 'fruits', 'banano', 'bananas', 'mango', 'mangos', 'aguacate', 'aguacates',
      'avocado', 'avocados', 'pina', 'pineapple', 'fresas', 'strawberries', 'uchuva', 'uchuvas', 'goldenberries',
      'maracuya', 'passion fruit', 'nueces', 'nuts', 'almendras', 'almonds', 'maranon', 'cashews', 'uvas pasas',
      'raisins', 'fruta deshidratada', 'dried fruit'],
    ['fruit nuts']),
  c('09', 'Café, té y especias',
    ['cafe', 'coffee', 'cafe molido', 'ground coffee', 'cafe en grano', 'coffee beans', 'arabica', 'tea',
      'te verde', 'green tea', 'te negro', 'black tea', 'yerba mate', 'pimienta', 'pepper', 'canela', 'cinnamon',
      'especias', 'spices', 'comino', 'cumin', 'oregano', 'jengibre', 'ginger', 'curcuma', 'turmeric'],
    ['coffee tea spices']),
  c('10', 'Cereales',
    ['arroz', 'rice', 'arroz blanco', 'arroz integral', 'brown rice', 'quinoa', 'quinua', 'maiz en grano',
      'cebada', 'barley', 'sorgo', 'sorghum', 'avena en grano'],
    ['cereals']),
  c('11', 'Harinas y almidones',
    ['harina', 'flour', 'harina de trigo', 'wheat flour', 'harina de maiz', 'corn flour', 'masarepa', 'fecula',
      'almidon', 'starch', 'avena en hojuelas', 'rolled oats', 'malta', 'malt'],
    ['milling industry flour starch malt']),
  c('12', 'Semillas y plantas medicinales',
    ['semillas', 'seeds', 'chia', 'linaza', 'flaxseed', 'mani', 'peanuts', 'ajonjoli', 'sesame', 'soya', 'soybeans',
      'moringa', 'plantas medicinales', 'medicinal plants', 'manzanilla', 'chamomile', 'hierbas aromaticas'],
    ['oil seeds miscellaneous grains seeds medicinal plants']),
  c('13', 'Gomas, resinas y extractos vegetales',
    ['goma arabiga', 'gum arabic', 'resina natural', 'natural resin', 'extracto vegetal', 'plant extract',
      'pectina', 'pectin', 'savia', 'agar agar'],
    ['lac gums resins vegetable saps extracts']),
  c('14', 'Fibras vegetales para trenzar',
    ['palma de iraca', 'fibra de iraca', 'paja toquilla', 'toquilla straw', 'rattan crudo', 'mimbre en bruto',
      'fique en rama', 'cana flecha'],
    ['vegetable plaiting materials']),

  // III. Grasas
  c('15', 'Grasas y aceites',
    ['aceite de oliva', 'olive oil', 'aceite de coco', 'coconut oil', 'aceite vegetal', 'vegetable oil',
      'aceite de girasol', 'sunflower oil', 'aceite de palma', 'palm oil', 'aceite de aguacate', 'avocado oil',
      'manteca', 'lard', 'margarina', 'margarine', 'ghee'],
    ['animal vegetable fats oils']),

  // IV. Alimentos preparados, bebidas, tabaco
  c('16', 'Embutidos y conservas de carne o pescado',
    ['salchicha', 'salchichas', 'sausage', 'sausages', 'jamon', 'ham', 'chorizo', 'embutido', 'embutidos',
      'atun en lata', 'canned tuna', 'sardinas', 'sardines', 'salami'],
    ['preparations of meat fish']),
  c('17', 'Azúcar y dulces',
    ['azucar', 'sugar', 'panela', 'dulce', 'dulces', 'candy', 'caramelo', 'caramelos', 'bombones', 'chicle',
      'goma de mascar', 'chewing gum', 'arequipe', 'dulce de leche', 'bocadillo'],
    ['sugars sugar confectionery']),
  c('18', 'Cacao y chocolate',
    ['cacao', 'cocoa', 'chocolate', 'chocolates', 'nibs de cacao', 'cacao en polvo', 'cocoa powder'],
    ['cocoa preparations chocolate']),
  c('19', 'Panadería, pastas y cereales preparados',
    ['galletas', 'cookies', 'crackers', 'pan de molde', 'pan tajado', 'sliced bread', 'bread', 'pasta seca', 'dried pasta', 'macarrones', 'macaroni', 'espagueti', 'spaghetti', 'arepa', 'arepas',
      'cereal para desayuno', 'breakfast cereal', 'granola', 'pasteles', 'tortillas', 'ponque'],
    ['preparations of cereals flour pastrycooks products']),
  c('20', 'Conservas de frutas y hortalizas',
    ['mermelada', 'mermeladas', 'jam', 'jalea', 'encurtidos', 'pickles', 'pulpa de fruta', 'fruit pulp',
      'salsa de tomate', 'ketchup', 'papas fritas', 'french fries', 'aceitunas', 'olives', 'frutas en almibar'],
    ['preparations of vegetables fruit nuts']),
  c('21', 'Preparaciones alimenticias diversas',
    ['salsa', 'salsas', 'sauce', 'mayonesa', 'mayonnaise', 'mostaza', 'mustard', 'sopa', 'sopas', 'soup',
      'caldo', 'consome', 'helado', 'helados', 'ice cream', 'suplemento dietario', 'suplemento alimenticio',
      'dietary supplement', 'supplement facts', 'proteina en polvo', 'protein powder', 'cafe instantaneo',
      'instant coffee', 'levadura', 'yeast'],
    ['miscellaneous edible preparations']),
  c('22', 'Bebidas',
    ['vinagre', 'vinegar', 'aguardiente', 'kombucha', 'bebida energetica', 'energy drink'],
    ['beverages spirits vinegar']),
  c('23', 'Alimento para animales',
    ['alimento para perros', 'alimento para gatos', 'dog food', 'cat food', 'pet food', 'comida para mascotas',
      'alimento para mascotas', 'concentrado para perros', 'concentrado para gatos', 'dog treats', 'cat treats', 'perros adultos', 'adult dog', 'cachorros', 'puppy', 'gatitos', 'kitten',
      'snacks para perros', 'analisis garantizado', 'guaranteed analysis', 'proteina cruda', 'crude protein',
      'fibra cruda', 'crude fiber', 'grasa cruda', 'crude fat', 'animal feed', 'forraje', 'fodder', 'pienso'],
    ['preparations used in animal feeding dog cat food']),
  c('24', 'Tabaco',
    ['tabaco', 'tobacco', 'cigarrillo', 'cigarrillos', 'cigarette', 'cigarettes', 'cigarro', 'cigar', 'cigars',
      'vapeador', 'e-liquid', 'nicotina', 'nicotine', 'hookah', 'shisha'],
    ['tobacco manufactured tobacco substitutes nicotine']),

  // V. Minerales
  c('25', 'Sal, piedra, cemento y yeso',
    ['sal marina', 'sea salt', 'sal rosada', 'himalayan salt', 'cemento', 'cement', 'yeso', 'gypsum', 'arena',
      'sand', 'piedra pomez', 'pumice', 'marmol en bruto'],
    ['salt sulfur earths stone plastering lime cement']),
  c('26', 'Minerales metalíferos',
    ['mineral de hierro', 'iron ore', 'mineral de cobre', 'copper ore', 'mineral de oro', 'gold ore',
      'concentrado de zinc', 'ores', 'escorias', 'slag'],
    ['ores slag ash']),
  c('27', 'Combustibles y aceites minerales',
    ['carbon mineral', 'coal', 'petroleo', 'petroleum', 'gasolina', 'gasoline', 'aceite de motor',
      'motor oil', 'aceite lubricante', 'lubricating oil', 'parafina', 'paraffin', 'vaselina', 'petroleum jelly',
      'queroseno', 'kerosene', 'propano', 'propane', 'asfalto', 'asphalt'],
    ['mineral fuels mineral oils']),

  // VI. Químicos
  c('28', 'Químicos inorgánicos',
    ['acido sulfurico', 'sulfuric acid', 'acido clorhidrico', 'hydrochloric acid', 'soda caustica',
      'caustic soda', 'hidroxido de sodio', 'sodium hydroxide', 'bicarbonato de sodio', 'sodium bicarbonate',
      'baking soda', 'peroxido de hidrogeno', 'hydrogen peroxide', 'agua oxigenada', 'sulfato de magnesio',
      'magnesium sulfate', 'sal de epsom', 'epsom salt', 'hipoclorito de calcio'],
    ['inorganic chemicals']),
  c('29', 'Químicos orgánicos',
    ['alcohol isopropilico', 'isopropyl alcohol', 'acetona', 'acetone', 'metanol', 'methanol', 'etilenglicol',
      'ethylene glycol', 'tolueno', 'toluene', 'xileno', 'xylene', 'formaldehido', 'formaldehyde'],
    ['organic chemicals']),
  c('30', 'Productos farmacéuticos',
    ['medicamento', 'medicamentos', 'medicine', 'medicina', 'drug facts', 'principio activo', 'active ingredient',
      'active ingredients', 'posologia', 'dosage', 'contraindicaciones', 'contraindications', 'venda', 'vendas', 'bandage', 'bandages', 'curitas', 'gasa', 'gauze',
      'botiquin', 'first aid kit', 'analgesico', 'antibiotico', 'ibuprofeno', 'ibuprofen', 'acetaminofen',
      'paracetamol'],
    ['pharmaceutical products medicaments']),
  c('31', 'Abonos',
    ['fertilizante', 'fertilizantes', 'fertilizer', 'abono', 'abonos', 'compost', 'humus', 'npk'],
    ['fertilizers']),
  c('32', 'Pinturas y tintas',
    ['pintura', 'pinturas', 'paint', 'paints', 'barniz', 'varnish', 'laca', 'lacquer', 'tinta', 'tintas', 'ink',
      'pigmento', 'pigmentos', 'pigment', 'masilla', 'putty'],
    ['tanning dyeing extracts paints varnishes inks']),
  c('33', 'Cosméticos y perfumes',
    ['aceite esencial', 'aceites esenciales', 'essential oil', 'colonia', 'cologne', 'esmalte de unas',
      'nail polish', 'pasta dental', 'crema dental', 'toothpaste', 'enjuague bucal', 'mouthwash', 'delineador',
      'eyeliner', 'tinte para cabello', 'hair dye', 'gel para el cabello', 'hair gel', 'bloqueador', 'sunscreen'],
    ['essential oils perfumery cosmetic toilet preparations']),
  c('34', 'Jabones, velas y limpieza',
    ['vela', 'velas', 'candle', 'candles', 'vela aromatica', 'betun', 'shoe polish', 'cera para autos',
      'car wax', 'cera para pisos', 'floor wax', 'lavavajillas'],
    ['soap washing preparations waxes candles']),
  c('35', 'Pegantes, gelatinas y enzimas',
    ['pegante', 'pegamento', 'glue', 'cola blanca', 'colbon', 'super glue', 'gelatina sin sabor',
      'unflavored gelatin'],
    ['albuminoidal substances glues enzymes']),
  c('36', 'Fósforos y pirotecnia',
    ['fosforos', 'safety matches', 'cerillas', 'polvora', 'gunpowder', 'pirotecnia', 'fireworks', 'bengalas', 'sparklers',
      'explosivo', 'explosivos', 'explosives'],
    ['explosives pyrotechnic products matches']),
  c('37', 'Productos fotográficos',
    ['pelicula fotografica', 'photographic film', 'papel fotografico', 'photo paper', 'rollo fotografico',
      'instant film', 'revelador fotografico'],
    ['photographic cinematographic goods']),
  c('38', 'Químicos diversos (insecticidas, anticongelantes…)',
    ['insecticida', 'insecticide', 'repelente', 'repellent', 'raticida', 'rodenticide', 'herbicida', 'herbicide',
      'fungicida', 'fungicide', 'plaguicida', 'pesticide', 'anticongelante', 'antifreeze', 'liquido de frenos',
      'brake fluid', 'carbon activado', 'activated charcoal'],
    ['miscellaneous chemical products insecticides']),

  // VII. Plástico y caucho
  c('39', 'Plástico y sus manufacturas',
    ['bolsa plastica', 'bolsas plasticas', 'plastic bag', 'plastic bags', 'film plastico', 'cling film',
      'funda para celular', 'phone case', 'cinta adhesiva', 'adhesive tape'],
    ['plastics articles thereof']),
  c('40', 'Caucho y sus manufacturas',
    ['llanta', 'llantas', 'tire', 'tires', 'neumatico', 'neumaticos', 'tyre', 'tyres', 'guantes de latex',
      'latex gloves', 'guantes de nitrilo', 'nitrile gloves', 'banda elastica', 'bandas elasticas', 'rubber band',
      'rubber bands', 'preservativo', 'preservativos', 'condon', 'condones', 'condom', 'condoms', 'caucho natural',
      'natural rubber'],
    ['rubber articles thereof']),

  // VIII. Cuero
  c('41', 'Cueros y pieles en bruto o curtidos',
    ['cuero curtido', 'tanned leather', 'piel en bruto', 'raw hides', 'cuero crudo', 'hides and skins'],
    ['raw hides skins leather']),
  c('42', 'Marroquinería (bolsos, billeteras, estuches)',
    ['neceser', 'cosmetiquera', 'lonchera', 'lunch bag', 'rinonera', 'fanny pack', 'correa para perro',
      'dog leash', 'arnes para perro', 'dog harness', 'estuche'],
    ['articles of leather handbags travel goods']),
  c('43', 'Peletería',
    ['peleteria', 'furskin', 'furskins', 'fur coat', 'faux fur', 'piel sintetica', 'mink', 'vison'],
    ['furskins artificial fur']),

  // IX. Madera, corcho, cestería
  c('44', 'Madera y sus manufacturas',
    ['tabla de picar', 'cutting board', 'carbon vegetal', 'charcoal', 'marco de madera', 'picture frame',
      'estiba', 'pallet', 'triplex', 'plywood'],
    ['wood articles of wood charcoal']),
  c('45', 'Corcho',
    ['corcho', 'cork', 'tapon de corcho', 'cork stopper', 'corcho aglomerado'],
    ['cork articles of cork']),
  c('46', 'Cestería',
    ['cesta', 'cestas', 'canasta', 'canastas', 'basket', 'baskets', 'cesteria', 'basketwork', 'mimbre', 'wicker',
      'rattan', 'ratan', 'estera', 'esteras', 'straw mat', 'petate'],
    ['manufactures of straw plaiting materials basketware wickerwork']),

  // X. Papel
  c('47', 'Pasta de papel',
    ['pulpa de papel', 'wood pulp', 'pulpa de madera', 'waste paper', 'desperdicio de papel'],
    ['pulp of wood recovered paper']),
  c('48', 'Papel y cartón',
    ['sobres', 'envelopes', 'caja de carton', 'bolsa de papel', 'paper bag', 'papel higienico', 'toilet paper',
      'papel de regalo', 'wrapping paper'],
    ['paper paperboard articles']),
  c('49', 'Libros e impresos',
    ['calendario', 'calendar', 'poster', 'afiche', 'tarjeta de felicitacion', 'greeting card', 'revista',
      'magazine', 'folleto', 'brochure', 'mapa', 'libros', 'books'],
    ['printed books newspapers pictures']),

  // XI. Textiles. Del 50 al 60 son fibras, hilos y telas por metro; la
  // ropa hecha es 61 y 62. Por eso acá sólo hay palabras de hilo o de
  // tela suelta: "100% algodón" está en la etiqueta de cualquier
  // camiseta y no puede mandarla al capítulo de la fibra.
  c('50', 'Seda (fibra, hilo y tela)',
    ['seda cruda', 'raw silk', 'capullos de seda', 'silk cocoons', 'hilo de seda', 'silk yarn', 'tela de seda',
      'silk fabric'],
    ['silk yarn woven fabrics']),
  c('51', 'Lana (fibra, hilo y tela)',
    ['lana cruda', 'raw wool', 'hilo de lana', 'wool yarn', 'ovillo de lana', 'tela de lana', 'wool fabric',
      'alpaca yarn', 'lana para tejer', 'knitting yarn'],
    ['wool fine coarse animal hair yarn woven fabric']),
  c('52', 'Algodón (fibra, hilo y tela)',
    ['algodon en rama', 'raw cotton', 'hilo de algodon', 'cotton yarn', 'cotton thread', 'tela de algodon',
      'cotton fabric', 'lona de algodon', 'cotton canvas'],
    ['cotton yarn woven fabrics']),
  c('53', 'Lino, yute y otras fibras vegetales',
    ['lino en rama', 'raw flax', 'hilo de lino', 'linen yarn', 'tela de lino', 'linen fabric', 'yute', 'jute',
      'fique', 'sisal', 'hemp fabric', 'fibra de coco', 'coir'],
    ['vegetable textile fibers paper yarn']),
  c('54', 'Hilos y telas de filamento sintético',
    ['hilo de nylon', 'nylon yarn', 'hilo de poliester', 'polyester thread', 'polyester yarn', 'tela de poliester',
      'polyester fabric', 'tela de nylon', 'nylon fabric', 'hilo de coser', 'sewing thread', 'monofilamento',
      'monofilament'],
    ['man-made filaments yarn woven fabrics']),
  c('55', 'Fibras sintéticas cortas',
    ['fibra corta', 'staple fiber', 'staple fibre', 'polyester staple', 'hilado de fibras', 'spun yarn'],
    ['man-made staple fibers']),
  c('56', 'Fieltro, cuerdas y telas no tejidas',
    ['fieltro', 'felt', 'guata', 'wadding', 'soga', 'sogas', 'cuerda de nylon', 'cuerda de polipropileno', 'rope', 'cordel', 'twine', 'red de pesca',
      'fishing net', 'tela no tejida', 'non-woven', 'nonwoven'],
    ['wadding felt nonwovens twine cordage rope']),
  c('57', 'Alfombras',
    ['alfombra', 'alfombras', 'carpet', 'carpets', 'rug', 'rugs', 'tapete', 'tapetes', 'doormat', 'felpudo'],
    ['carpets textile floor coverings']),
  c('58', 'Encajes, cintas y bordados',
    ['parche bordado', 'embroidered patch', 'encaje por metro', 'lace trim', 'cinta de encaje', 'cinta de raso',
      'satin ribbon', 'cinta decorativa', 'ribbon', 'marquillas tejidas', 'woven labels'],
    ['special woven fabrics lace embroidery trimmings']),
  c('59', 'Telas técnicas o recubiertas',
    ['tela recubierta', 'coated fabric', 'lona encauchada', 'tela de filtro', 'filter cloth', 'tejido tecnico',
      'technical textile'],
    ['impregnated coated laminated textile fabrics']),
  c('60', 'Telas de punto (por metro)',
    ['tela de punto', 'knit fabric', 'knitted fabric', 'tela jersey', 'jersey fabric'],
    ['knitted crocheted fabrics']),
  c('61', 'Ropa de punto',
    ['medias', 'calcetines', 'socks', 'ropa interior', 'underwear', 'brasier', 'bra', 'pijama', 'pajamas',
      'leggings', 'sudadera', 'hoodie', 'traje de bano', 'vestido de bano', 'swimsuit', 'bikini'],
    ['apparel knitted crocheted']),
  c('62', 'Ropa plana (no de punto)',
    ['falda', 'skirt', 'shorts', 'bufanda', 'scarf', 'corbata', 'necktie', 'abrigo', 'coat', 'gabardina'],
    ['apparel not knitted']),
  c('63', 'Textiles para el hogar (toallas, sábanas, cortinas)',
    ['toalla', 'toallas', 'towel', 'towels', 'sabana', 'sabanas', 'bed sheets', 'cortina', 'cortinas', 'curtain',
      'curtains', 'mantel', 'manteles', 'tablecloth', 'cobija', 'cobijas', 'manta', 'blanket', 'funda de almohada',
      'pillowcase'],
    ['made up textile articles']),

  // XII. Calzado, sombreros, paraguas, pelucas
  c('64', 'Calzado',
    ['chanclas', 'flip flops', 'pantuflas', 'slippers', 'botines', 'mocasines', 'loafers', 'tacones', 'heels'],
    ['footwear']),
  c('65', 'Sombreros y gorras',
    ['sombrero', 'sombreros', 'hat', 'hats', 'gorra', 'gorras', 'baseball cap', 'trucker cap', 'snapback',
      'visera', 'viseras', 'visor', 'gorro', 'gorros', 'beanie', 'boina', 'beret', 'casco', 'cascos', 'helmet',
      'helmets', 'sombrero vueltiao', 'panama hat', 'bucket hat'],
    ['headgear hats']),
  c('66', 'Paraguas y bastones',
    ['paraguas', 'umbrella', 'umbrellas', 'sombrilla', 'sombrillas', 'parasol', 'baston', 'bastones',
      'walking stick'],
    ['umbrellas walking sticks']),
  c('67', 'Flores artificiales y pelucas',
    ['flores artificiales', 'artificial flowers', 'flor artificial', 'peluca', 'pelucas', 'wig', 'wigs',
      'extensiones de cabello', 'hair extensions', 'pestanas postizas', 'false eyelashes', 'cabello humano',
      'human hair', 'plumas decorativas'],
    ['prepared feathers artificial flowers human hair wigs']),

  // XIII. Piedra, cerámica, vidrio
  c('68', 'Manufacturas de piedra y cemento',
    ['marmol', 'marble', 'granito', 'granite', 'piedra tallada', 'carved stone', 'lija', 'papel de lija',
      'sandpaper', 'piedra de afilar', 'whetstone', 'lana de roca', 'rock wool', 'bloque de concreto',
      'concrete block'],
    ['articles of stone plaster cement mica']),
  c('69', 'Cerámica',
    ['maceta', 'macetas', 'matera', 'materas', 'flower pot', 'baldosa', 'baldosas', 'azulejo', 'azulejos', 'tiles',
      'ceramic tile', 'lavamanos', 'sink'],
    ['ceramic products']),
  c('70', 'Vidrio',
    ['botella de vidrio', 'glass bottle', 'frasco de vidrio', 'glass jar', 'espejo', 'espejos', 'mirror',
      'mirrors', 'vidrio templado', 'tempered glass', 'fibra de vidrio', 'fiberglass'],
    ['glass glassware']),

  // XIV. Joyería
  c('71', 'Joyería, bisutería y metales preciosos',
    ['perla', 'perlas', 'pearl', 'pearls', 'esmeralda', 'esmeraldas', 'emerald', 'emeralds', 'diamante',
      'diamantes', 'diamond', 'piedra preciosa', 'gemstone', 'dije', 'dijes', 'charm'],
    ['pearls precious stones precious metals imitation jewelry']),

  // XV. Metales
  c('72', 'Hierro y acero (en bruto)',
    ['lamina de acero', 'steel sheet', 'acero laminado', 'rolled steel', 'barra de acero', 'steel bar',
      'varilla corrugada', 'rebar', 'alambron', 'wire rod', 'lingote', 'ingot', 'chatarra', 'scrap'],
    ['iron steel']),
  c('73', 'Manufacturas de hierro o acero',
    ['tornillo', 'tornillos', 'screw', 'screws', 'tuerca', 'tuercas', 'perno', 'pernos', 'bolt', 'bolts',
      'parrilla', 'grill', 'cadena de acero', 'steel chain'],
    ['articles of iron steel']),
  c('74', 'Cobre',
    ['alambre de cobre', 'copper wire', 'lamina de cobre', 'copper sheet', 'tubo de cobre', 'copper tube',
      'copper pipe', 'cobre en bruto', 'refined copper', 'olla de cobre', 'copper pot'],
    ['copper articles thereof']),
  c('75', 'Níquel',
    ['niquel en bruto', 'nickel unwrought', 'anodo de niquel', 'nickel anode'],
    ['nickel articles thereof']),
  c('76', 'Aluminio',
    ['papel aluminio', 'aluminum foil', 'aluminium foil', 'perfil de aluminio', 'aluminum profile'],
    ['aluminum articles thereof']),
  c('78', 'Plomo',
    ['plomo en bruto', 'lingote de plomo', 'lead ingot', 'lamina de plomo', 'lead sheet'],
    ['lead articles thereof']),
  c('79', 'Cinc',
    ['zinc en bruto', 'lingote de zinc', 'zinc ingot', 'lamina de zinc', 'zinc sheet'],
    ['zinc articles thereof']),
  c('80', 'Estaño',
    ['estano en bruto', 'lingote de estano', 'tin ingot', 'soldadura de estano', 'solder'],
    ['tin articles thereof']),
  c('81', 'Otros metales comunes',
    ['tungsteno en bruto', 'molibdeno', 'molybdenum', 'cobalto', 'cobalt', 'bismuto', 'bismuth',
      'titanio en bruto', 'titanium sponge', 'manganeso metalico'],
    ['other base metals cermets']),
  c('82', 'Herramientas y cubiertos',
    ['herramienta', 'tool set', 'tool kit', 'hand tools', 'herramientas', 'destornillador', 'screwdriver', 'martillo', 'hammer',
      'alicate', 'alicates', 'pliers', 'llave inglesa', 'wrench', 'tijeras', 'scissors', 'cortaunas',
      'nail clipper', 'cuchilla de afeitar', 'razor'],
    ['tools implements cutlery base metal']),
  c('83', 'Cerraduras, llaveros y otras piezas de metal',
    ['candado', 'candados', 'padlock', 'padlocks', 'cerradura', 'cerraduras', 'bisagra', 'bisagras', 'hinge',
      'hinges', 'caja fuerte', 'lockbox', 'llavero', 'llaveros', 'keychain', 'keyring', 'letrero metalico',
      'metal sign'],
    ['miscellaneous articles of base metal locks']),

  // XVI. Máquinas
  c('84', 'Máquinas y aparatos mecánicos',
    ['impresora', 'printer', 'aire acondicionado', 'air conditioner', 'bomba de agua', 'water pump',
      'maquina de coser', 'sewing machine', 'aspiradora', 'vacuum cleaner', 'molino', 'grinder'],
    ['machinery mechanical appliances']),
  c('85', 'Aparatos eléctricos y electrónicos',
    ['bombillo', 'bombilla', 'light bulb', 'cable usb', 'usb', 'camara', 'camera', 'microfono', 'microphone',
      'secador de pelo', 'hair dryer', 'plancha para el cabello', 'hair straightener', 'bluetooth', 'wifi',
      'smartwatch', 'smart watch', 'reloj inteligente', 'cable electrico', 'electric cable'],
    ['electrical machinery equipment']),

  // XVII. Transporte
  c('86', 'Trenes y ferrocarril',
    ['locomotora', 'locomotive', 'vagon', 'railway', 'ferrocarril', 'rieles', 'rail track'],
    ['railway locomotives rolling stock track']),
  c('87', 'Vehículos, bicicletas y repuestos',
    ['automovil', 'vehiculo', 'vehicle', 'motocicleta', 'moto', 'motorcycle', 'bicicleta', 'bicycle', 'bike',
      // "Repuesto" solo no alcanza: el repuesto de una licuadora va con la
      // licuadora, no con los carros.
      'repuesto automotriz', 'repuestos para moto', 'auto parts', 'autoparte', 'autopartes', 'pastillas de freno',
      'brake pads', 'parachoques', 'bumper', 'coche de bebe', 'cochecito', 'stroller', 'carriola', 'remolque',
      'trailer', 'scooter'],
    ['vehicles parts accessories']),
  c('88', 'Aviones y drones',
    ['dron', 'drones', 'drone', 'cuadricoptero', 'quadcopter', 'avion', 'aircraft', 'helicoptero', 'helicopter',
      'paracaidas', 'parachute', 'planeador', 'glider'],
    ['aircraft spacecraft unmanned aircraft']),
  c('89', 'Barcos',
    ['barco', 'boat', 'boats', 'kayak', 'canoa', 'canoe', 'lancha', 'yate', 'yacht', 'velero', 'sailboat',
      'bote inflable', 'inflatable boat'],
    ['ships boats floating structures']),

  // XVIII. Óptica, relojes, música
  c('90', 'Óptica, instrumentos médicos y de medida',
    ['gafas', 'gafas de sol', 'sunglasses', 'anteojos', 'lentes', 'eyeglasses', 'lentes de contacto',
      'contact lenses', 'monturas', 'polarizado', 'polarizadas', 'polarized', 'termometro', 'thermometer',
      'tensiometro', 'blood pressure monitor', 'oximetro', 'pulse oximeter', 'glucometro', 'glucometer',
      'estetoscopio', 'stethoscope', 'jeringa', 'jeringas', 'syringe', 'syringes', 'cateter', 'catheter',
      'dispositivo medico', 'medical device', 'ortopedico', 'orthopedic', 'microscopio', 'microscope',
      'binoculares', 'binoculars', 'telescopio', 'telescope', 'lupa', 'magnifier', 'nivel laser', 'laser level',
      'multimetro', 'multimeter', 'brujula', 'compass', 'hearing aid'],
    ['optical photographic measuring medical instruments'],
    [/\buv\s?400\b/i]),
  c('91', 'Relojes',
    ['reloj', 'relojes', 'watch', 'watches', 'wristwatch', 'reloj de pulsera', 'reloj de pared', 'wall clock',
      'clock', 'clocks', 'despertador', 'alarm clock', 'cronografo', 'chronograph', 'quartz movement',
      'movimiento de cuarzo', 'japan movt', 'correa de reloj', 'watch band', 'watch strap'],
    ['clocks watches'],
    [/\b\d{1,2}\s?atm\b/i, /\bwr\s?\d{2,3}\s?m\b/i]),
  c('92', 'Instrumentos musicales',
    ['guitarra', 'guitarras', 'guitarra acustica', 'guitarra electrica', 'acoustic guitar', 'electric guitar',
      'guitar', 'guitars', 'piano', 'violin', 'violines', 'ukelele', 'ukulele',
      'bateria acustica', 'drum', 'drums', 'tambor', 'tambores', 'flauta', 'flute', 'armonica', 'harmonica',
      'maracas', 'charango', 'tiple', 'acordeon', 'accordion', 'trompeta', 'trumpet', 'saxofon', 'saxophone',
      'clarinete', 'clarinet', 'instrumento musical', 'musical instrument', 'cuerdas para guitarra',
      'guitar strings', 'baquetas', 'drumsticks', 'metronomo', 'metronome'],
    ['musical instruments']),

  // XIX. Armas
  c('93', 'Armas y municiones',
    ['arma de fuego', 'firearm', 'firearms', 'municion', 'municiones', 'ammunition', 'escopeta', 'shotgun',
      'rifle', 'revolver'],
    ['arms ammunition']),

  // XX. Varios
  c('94', 'Muebles, colchones y lámparas',
    ['almohada', 'almohadas', 'pillow', 'pillows', 'cojin', 'cojines', 'cushion', 'edredon', 'comforter', 'duvet',
      'sofa', 'couch', 'luminaria', 'lamp', 'sleeping bag', 'saco de dormir', 'silla para carro', 'car seat'],
    ['furniture bedding mattresses lamps']),
  c('95', 'Juguetes, juegos y deportes',
    ['videojuego', 'video game', 'consola', 'balon', 'pelota', 'soccer ball', 'raqueta', 'racket', 'mancuerna',
      'mancuernas', 'dumbbell', 'dumbbells', 'pesas', 'yoga', 'yoga mat', 'tapete de yoga', 'bicicleta estatica',
      'cana de pescar', 'fishing rod', 'disfraz', 'disfraces', 'costume', 'adornos navidenos',
      'christmas ornament', 'arbol de navidad', 'christmas tree', 'naipes', 'playing cards'],
    ['toys games sports requisites']),
  c('96', 'Artículos diversos (bolígrafos, cepillos, pañales…)',
    ['boligrafo', 'boligrafos', 'ballpoint', 'esfero', 'esferos', 'lapicero', 'lapiceros', 'marcador',
      'marcadores', 'marker', 'markers', 'resaltador', 'highlighter', 'crayones', 'crayons', 'lapices de colores',
      'colored pencils', 'cepillo de dientes', 'toothbrush', 'cepillo para el cabello', 'hairbrush', 'peine',
      'peinilla', 'comb', 'encendedor', 'encendedores', 'lighters', 'cigarette lighter', 'cremallera', 'cremalleras',
      'zipper', 'zippers', 'panales', 'panal desechable', 'diaper', 'diapers', 'toalla higienica', 'toallas higienicas',
      'sanitary pad', 'sanitary pads', 'tampon', 'tampones', 'tampons', 'protector diario', 'panty liner',
      'flujo abundante', 'flujo moderado', 'heavy flow', 'tripode', 'tripod', 'selfie stick', 'palo de selfie',
      'brocha de maquillaje', 'makeup brush', 'pincel', 'pinceles', 'paintbrush', 'tablero borrable',
      'whiteboard', 'tiza', 'chalk'],
    ['miscellaneous manufactured articles']),

  // XXI. Arte
  c('97', 'Arte y antigüedades',
    ['obra de arte', 'artwork', 'work of art', 'pintura original', 'original painting', 'oleo sobre lienzo',
      'oil on canvas', 'acrilico sobre lienzo', 'acrylic on canvas', 'escultura', 'esculturas', 'sculpture',
      'sculptures', 'grabado original', 'original print', 'antiguedad', 'antiguedades', 'antiques',
      'litografia', 'lithograph', 'firmado por el artista', 'signed by the artist', 'sellos postales',
      'postage stamps'],
    ['works of art collectors pieces antiques']),
];

const porCodigo = new Map(CAPITULOS.map((cap) => [cap.codigo, cap]));

export function capitulo(codigo: string): Capitulo | null {
  return porCodigo.get(codigo) ?? null;
}

export function seccion(id: string): Seccion | null {
  return SECCIONES.find((s) => s.id === id) ?? null;
}
