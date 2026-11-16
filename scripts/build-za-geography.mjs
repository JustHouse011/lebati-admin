import { readFileSync, writeFileSync } from 'node:fs'
import { geoArea, geoBounds, geoCentroid, geoContains, geoMercator, geoPath } from 'd3-geo'

// Usage: node scripts/build-za-geography.mjs ADM1.geojson ADM2.geojson ADM3.geojson ZA.txt
const [adm1, adm2, adm3, gazetteer] = process.argv.slice(2)
if (!gazetteer) throw new Error('Provide the three geoBoundaries files and the GeoNames ZA.txt extract')

const names = {
  'Nothern Cape': 'Northern Cape', Cacadu: 'Sarah Baartman', Eden: 'Garden Route',
  Sisonke: 'Harry Gwala', Uthungulu: 'King Cetshwayo',
}
const levels = [adm1, adm2, adm3].map((file) => JSON.parse(readFileSync(file, 'utf8')).features.map((feature) => {
  // D3 uses the opposite polygon winding to RFC 7946.
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates
  for (const coordinates of polygons) {
    if (geoArea({ type: 'Polygon', coordinates }) > 2 * Math.PI) coordinates.forEach((ring) => ring.reverse())
  }
  return feature
}))
const projection = geoMercator().fitExtent([[12, 12], [768, 578]], { type: 'FeatureCollection', features: levels[0] })
const path = geoPath(projection).digits(1)
const round = (number) => Number(number.toFixed(1))
const frame = (feature) => {
  const [[left, top], [right, bottom]] = path.bounds(feature)
  const pad = Math.max(right - left, bottom - top) * 0.07
  return [left - pad, top - pad, right - left + pad * 2, bottom - top + pad * 2].map(round)
}
const shapes = levels.map((features, index) => features.map((feature) => ({
  feature,
  bbox: geoBounds(feature),
  area: {
    id: feature.properties.shapeID,
    name: names[feature.properties.shapeName] ?? feature.properties.shapeName,
    level: index + 1,
    path: path(feature),
    frame: frame(feature),
  },
})))

function contains(candidate, [lng, lat]) {
  const [[west, south], [east, north]] = candidate.bbox
  return lng >= west && lng <= east && lat >= south && lat <= north && geoContains(candidate.feature, [lng, lat])
}

for (const [index, children] of shapes.entries()) {
  if (index === 0) continue
  for (const shape of children) {
    const centroid = geoCentroid(shape.feature)
    const polygons = shape.feature.geometry.type === 'Polygon' ? [shape.feature.geometry.coordinates] : shape.feature.geometry.coordinates
    const mainRing = polygons.map(([ring]) => ring).sort((a, b) => b.length - a.length)[0]
    const points = mainRing.filter((_, i) => i % Math.max(1, Math.floor(mainRing.length / 32)) === 0)
    const candidates = shapes[index - 1].map((parent) => ({
      parent, score: points.filter((point) => contains(parent, point)).length + (contains(parent, centroid) ? 12 : 0),
    })).sort((a, b) => b.score - a.score)
    if (!candidates[0].score) throw new Error('Could not locate parent for ' + shape.area.name)
    shape.area.parent = candidates[0].parent.area.id
  }
}

const placeNames = new Map(Object.entries({
  'Cape Town': 'Cape Town', Stellenbosch: 'Stellenbosch', George: 'George',
  'Port Elizabeth': 'Gqeberha', 'East London': 'East London', Mthatha: 'Mthatha',
  Durban: 'Durban', Pietermaritzburg: 'Pietermaritzburg', Newcastle: 'Newcastle',
  Johannesburg: 'Johannesburg', Pretoria: 'Pretoria', Vereeniging: 'Vereeniging',
  Bloemfontein: 'Bloemfontein', Welkom: 'Welkom', Bethlehem: 'Bethlehem',
  Polokwane: 'Polokwane', Tzaneen: 'Tzaneen', Thohoyandou: 'Thohoyandou',
  Nelspruit: 'Mbombela', 'Witbank': 'Emalahleni', Ermelo: 'Ermelo',
  Kimberley: 'Kimberley', Upington: 'Upington', Springbok: 'Springbok',
  Rustenburg: 'Rustenburg', Klerksdorp: 'Klerksdorp', Mahikeng: 'Mahikeng',
}))
const towns = new Map()
for (const row of readFileSync(gazetteer, 'utf8').split('\n')) {
  const [id, name, ascii, , latitude, longitude, featureClass, featureCode, , , , , , , population] = row.split('\t')
  const key = [name, ascii, ...[row.split('\t')[3] ?? ''].flatMap((value) => value.split(','))].find((value) => placeNames.has(value))
  if (!key || featureClass !== 'P' || !['PPL', 'PPLA', 'PPLA2', 'PPLA3', 'PPLC'].includes(featureCode)) continue
  const point = [Number(longitude), Number(latitude)]
  if ((towns.get(key)?.population ?? -1) >= Number(population)) continue
  const parent = shapes[2].find((shape) => contains(shape, point))
  if (parent) towns.set(key, {
    population: Number(population),
    area: { id: 'place-' + id, name: placeNames.get(key), level: 4, parent: parent.area.id, point: projection(point).map(round) },
  })
}
if (towns.size !== placeNames.size) throw new Error('Missing towns: ' + [...placeNames.keys()].filter((key) => !towns.has(key)).join(', '))
const areas = [...shapes.flat().map(({ area }) => area), ...Array.from(towns.values(), ({ area }) => area).sort((a, b) => a.name.localeCompare(b.name))]
writeFileSync('public/za-geography.json', JSON.stringify({ areas }))
console.log(shapes.map((level) => level.length).join('/'), 'boundaries and', towns.size, 'towns')
