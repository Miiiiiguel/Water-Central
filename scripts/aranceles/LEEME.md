# Aranceles de otros países

Los archivos `server/aranceles/arancel-<ID>.ndjson.gz` salen de los aranceles
oficiales de cada aduana. Para actualizarlos (cuando un país publica cambios):

1. Descargar los archivos oficiales en una carpeta (`datos/`):

   | ID | País | Archivo oficial | Dónde |
   |---|---|---|---|
   | CL | Chile | `cl/arancel_cl_2022.xlsx` | aduana.cl → Arancel Aduanero 2022 (Excel completo) |
   | PE | Perú | `pe/arancel_pe_2022.pdf` → `pe/pe.txt` (`pdftotext -layout`) | sunat.gob.pe → Arancel de Aduanas 2022 |
   | CO | Colombia | `co/decreto_1881_2021.htm` → `.htm.txt` | normograma.dian.gov.co → Decreto 1881 de 2021 |
   | BR / MERCOSUR | Brasil y Mercosur | `br/tec_br.xlsx` | gov.br/mdic → Camex → Tarifas vigentes (Anexos I a X, Resolución Gecex 272/21) |
   | MX | México | `mx/ligie_2022.pdf` → `mx/mx.txt` (`pdftotext -layout`) | diputados.gob.mx → LIGIE, texto vigente |
   | UE | Unión Europea | `ue.ndjson.gz` | `python3 descargar_ue.py datos/ue.ndjson.gz` (API XI del UK Trade Tariff) |

2. `python3 leer_aranceles.py datos/ salida/ [IDs…]`
3. Copiar `salida/<ID>.ndjson.gz` y `<ID>.meta.json` a `server/aranceles/arancel-<ID>.*`
   y correr `npx vitest run server/aranceles`.

Canadá: la CBSA corta las descargas desde servidores en la nube. El archivo del
arancel (Customs Tariff 01-99) hay que bajarlo desde un computador y subirlo.
