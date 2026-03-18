/**
 * Orchard Planning — Auto-calculation utilities
 *
 * All geometry uses WGS84 (EPSG:4326) coordinates [lng, lat].
 * Distances in metres, areas in hectares unless noted.
 */

// ─── Geo helpers ──────────────────────────────────────────────────────────────

const DEG = Math.PI / 180
const EARTH_R = 6371000 // metres

/** Haversine distance between two [lng, lat] points → metres */
export function haversine(a: [number, number], b: [number, number]): number {
  const [lng1, lat1] = a
  const [lng2, lat2] = b
  const dLat = (lat2 - lat1) * DEG
  const dLng = (lng2 - lng1) * DEG
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_R * Math.asin(Math.sqrt(s))
}

/** Geodesic polygon area (Shoelace on sphere) → square metres */
export function polygonAreaM2(ring: [number, number][]): number {
  // Use spherical excess method
  let area = 0
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length
    area += (ring[j][0] - ring[i][0]) * DEG * (2 + Math.sin(ring[i][1] * DEG) + Math.sin(ring[j][1] * DEG))
  }
  return Math.abs((area * EARTH_R * EARTH_R) / 2)
}

/** Polygon area in hectares (outer ring only, subtract inner rings) */
export function polygonAreaHa(coords: [number, number][][]): number {
  if (!coords || coords.length === 0) return 0
  let area = polygonAreaM2(coords[0])
  for (let i = 1; i < coords.length; i++) {
    area -= polygonAreaM2(coords[i])
  }
  return area / 10000
}

/** Move a point [lng, lat] by distance (m) at bearing (degrees from north) */
export function offsetPoint(
  point: [number, number],
  distanceM: number,
  bearingDeg: number
): [number, number] {
  const lat1 = point[1] * DEG
  const lng1 = point[0] * DEG
  const brng = bearingDeg * DEG
  const d = distanceM / EARTH_R

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  )
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    )
  return [lng2 / DEG, lat2 / DEG]
}

// ─── Polygon manipulation ────────────────────────────────────────────────────

/** Inset a polygon ring by headlandWidth metres (rough buffer) */
export function insetPolygon(
  ring: [number, number][],
  headlandWidthM: number
): [number, number][] {
  if (headlandWidthM <= 0 || ring.length < 4) return ring

  // Compute centroid
  let cx = 0, cy = 0
  const n = ring.length - 1 // skip closing point
  for (let i = 0; i < n; i++) {
    cx += ring[i][0]
    cy += ring[i][1]
  }
  cx /= n
  cy /= n

  const result: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const [lng, lat] = ring[i]
    const dx = lng - cx
    const dy = lat - cy
    const dist = haversine([cx, cy], [lng, lat])
    if (dist === 0) { result.push([lng, lat]); continue }
    const ratio = Math.max(0, (dist - headlandWidthM) / dist)
    result.push([cx + dx * ratio, cy + dy * ratio])
  }
  result.push(result[0]) // close ring
  return result
}

// ─── Row geometry ────────────────────────────────────────────────────────────

export interface RowLine {
  start: [number, number]  // [lng, lat]
  end: [number, number]
  length: number           // metres (after headland deduction)
}

export interface RowGeometryResult {
  numberOfRows: number
  rowLengths: number[]     // metres per row
  rowLines: RowLine[]      // actual row coordinates (for KML/map)
  totalRowMetres: number
  avgRowLength: number
}

/**
 * Given a polygon boundary + row bearing + row width:
 * - Generate parallel lines at `rowWidth` spacing perpendicular to bearing
 * - Clip each line to the polygon
 * - Deduct headlands: row-end headland shortens each row, side headland skips edge rows
 *
 * @param headlandWidthM  Row-end headland (top/bottom of rows, turning space, default 6m)
 * @param sideHeadlandWidthM  Side headland (between adjacent orchards, default 0 — neighbour shares boundary)
 */
export function calculateRowGeometry(
  polygonCoords: [number, number][][],
  rowBearingDeg: number,
  rowWidthM: number,
  headlandWidthM: number = 6,
  sideHeadlandWidthM: number = 0
): RowGeometryResult {
  if (!polygonCoords?.[0] || rowWidthM <= 0) {
    return { numberOfRows: 0, rowLengths: [], rowLines: [], totalRowMetres: 0, avgRowLength: 0 }
  }

  // Use the RAW polygon for row clipping (headlands deducted per-row, not by insetting)
  const ring = polygonCoords[0]
  const n = ring.length - 1

  // Project all polygon points onto the axis perpendicular to row bearing
  // "perpendicular bearing" = rowBearing + 90
  const perpBearing = (rowBearingDeg + 90) % 360

  // Use centroid as origin
  let cx = 0, cy = 0
  for (let i = 0; i < n; i++) { cx += ring[i][0]; cy += ring[i][1] }
  cx /= n; cy /= n
  const origin: [number, number] = [cx, cy]

  // Project each point along perpendicular axis (signed distance from origin)
  function perpDistance(pt: [number, number]): number {
    const dist = haversine(origin, pt)
    if (dist === 0) return 0
    const lat1 = origin[1] * DEG, lng1 = origin[0] * DEG
    const lat2 = pt[1] * DEG, lng2 = pt[0] * DEG
    const y = Math.sin(lng2 - lng1) * Math.cos(lat2)
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1)
    const bearing = (Math.atan2(y, x) / DEG + 360) % 360
    const angleDiff = (bearing - perpBearing) * DEG
    return dist * Math.cos(angleDiff)
  }

  const perpDists = ring.slice(0, n).map(perpDistance)
  const minPerp = Math.min(...perpDists)
  const maxPerp = Math.max(...perpDists)

  // Side headland: skip rows within sideHeadlandWidthM of the polygon sides
  const sideInset = sideHeadlandWidthM > 0 ? sideHeadlandWidthM : rowWidthM / 2

  // Generate row offsets along the perpendicular
  const rowLengths: number[] = []
  const rowLines: RowLine[] = []
  for (let d = minPerp + sideInset; d <= maxPerp - sideInset; d += rowWidthM) {
    // Create a line at this perpendicular offset, along the row bearing
    // Find intersections of this line with the polygon edges
    const lineOrigin = offsetPoint(origin, d, perpBearing)
    // Cast a long line along the row bearing direction
    const lineA = offsetPoint(lineOrigin, -2000, rowBearingDeg)
    const lineB = offsetPoint(lineOrigin, 2000, rowBearingDeg)

    // Find polygon edge intersections
    const intersections: [number, number][] = []
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % ring.length
      const pt = lineSegmentIntersection(lineA, lineB, ring[i], ring[j])
      if (pt) intersections.push(pt)
    }

    if (intersections.length >= 2) {
      // Sort along row bearing direction and take pairs
      intersections.sort((a, b) => {
        const da = haversine(lineA, a)
        const db = haversine(lineA, b)
        return da - db
      })
      // Take first and last for simple convex polygons; sum pairs for concave
      let totalLength = 0
      for (let i = 0; i < intersections.length - 1; i += 2) {
        totalLength += haversine(intersections[i], intersections[i + 1])
      }
      // Deduct row-end headlands (turning space at both ends of each row)
      const usableLength = totalLength - 2 * headlandWidthM
      if (usableLength > 0) {
        rowLengths.push(usableLength)
        // Store row line coordinates — inset by headland from each intersection
        const rowStart = offsetPoint(intersections[0], headlandWidthM, rowBearingDeg)
        const rowEnd = offsetPoint(intersections[intersections.length - 1], headlandWidthM, (rowBearingDeg + 180) % 360)
        rowLines.push({ start: rowStart, end: rowEnd, length: usableLength })
      }
    }
  }

  const totalRowMetres = rowLengths.reduce((s, l) => s + l, 0)
  return {
    numberOfRows: rowLengths.length,
    rowLengths,
    rowLines,
    totalRowMetres,
    avgRowLength: rowLengths.length > 0 ? totalRowMetres / rowLengths.length : 0,
  }
}

/** Line segment intersection in 2D (lng/lat treated as planar for small areas) */
function lineSegmentIntersection(
  a1: [number, number], a2: [number, number],
  b1: [number, number], b2: [number, number]
): [number, number] | null {
  const dx1 = a2[0] - a1[0], dy1 = a2[1] - a1[1]
  const dx2 = b2[0] - b1[0], dy2 = b2[1] - b1[1]
  const denom = dx1 * dy2 - dy1 * dx2
  if (Math.abs(denom) < 1e-15) return null // parallel

  const dx3 = b1[0] - a1[0], dy3 = b1[1] - a1[1]
  const t = (dx3 * dy2 - dy3 * dx2) / denom
  const u = (dx3 * dy1 - dy3 * dx1) / denom

  // t can be anything (we're using a long line); u must be [0,1] (edge segment)
  if (u < 0 || u > 1) return null

  return [a1[0] + t * dx1, a1[1] + t * dy1]
}

// ─── Tree count ──────────────────────────────────────────────────────────────

export interface TreeCountResult {
  totalTrees: number
  mainVarietyTrees: number
  pollinatorAllocations: { variety: string; percentage: number; trees: number }[]
}

export function calculateTreeCount(
  netPlantableHa: number,
  plantDistanceM: number,
  rowWidthM: number,
  pollinators: { variety: string; percentage: number }[] = []
): TreeCountResult {
  if (netPlantableHa <= 0 || plantDistanceM <= 0 || rowWidthM <= 0) {
    return { totalTrees: 0, mainVarietyTrees: 0, pollinatorAllocations: [] }
  }

  const totalTrees = Math.round((netPlantableHa * 10000) / (plantDistanceM * rowWidthM))
  const pollinatorPct = pollinators.reduce((s, p) => s + p.percentage, 0)
  const mainPct = Math.max(0, 100 - pollinatorPct)

  const pollinatorAllocations = pollinators.map(p => ({
    variety: p.variety,
    percentage: p.percentage,
    trees: Math.round(totalTrees * (p.percentage / 100)),
  }))

  const mainVarietyTrees = totalTrees - pollinatorAllocations.reduce((s, p) => s + p.trees, 0)

  return { totalTrees, mainVarietyTrees, pollinatorAllocations }
}

// ─── Pole count ──────────────────────────────────────────────────────────────

export interface PoleCountResult {
  endPoles: number
  insidePoles: number
  angledPoles: number     // angled support poles (1 per row end, same qty as end poles)
  totalPoles: number
  endPoleCost: number
  insidePoleCost: number
  angledPoleCost: number
  totalPoleCost: number
}

export function calculatePoleCount(
  rowGeometry: RowGeometryResult,
  insidePoleFrequency: number,  // every Nth tree
  plantDistanceM: number,
  endPoleUnitCost: number = 0,
  insidePoleUnitCost: number = 0,
  angledPoleUnitCost: number = 0,
  hasAngledPoles: boolean = false
): PoleCountResult {
  const endPoles = rowGeometry.numberOfRows * 2
  const angledPoles = hasAngledPoles ? endPoles : 0

  let insidePoles = 0
  if (insidePoleFrequency > 0 && plantDistanceM > 0) {
    const spacing = insidePoleFrequency * plantDistanceM
    for (const rowLen of rowGeometry.rowLengths) {
      insidePoles += Math.max(0, Math.floor(rowLen / spacing) - 1)
    }
  }

  const endPoleCost = endPoles * endPoleUnitCost
  const insidePoleCost = insidePoles * insidePoleUnitCost
  const angledPoleCost = angledPoles * angledPoleUnitCost

  return {
    endPoles,
    insidePoles,
    angledPoles,
    totalPoles: endPoles + insidePoles + angledPoles,
    endPoleCost,
    insidePoleCost,
    angledPoleCost,
    totalPoleCost: endPoleCost + insidePoleCost + angledPoleCost,
  }
}

// ─── Wire length ─────────────────────────────────────────────────────────────

export interface WireResult {
  totalWireLength: number  // metres
  wireSpacing: number      // metres between wires
  totalWireCost: number
}

export function calculateWireLength(
  totalRowMetres: number,
  numberOfLines: number,
  bottomWireHeight: number = 0.6,   // metres from ground
  usablePoleHeight: number = 3.0,   // metres
  unitCostPerM: number = 0
): WireResult {
  const totalWireLength = totalRowMetres * numberOfLines
  const wireSpacing = numberOfLines > 1 ? (usablePoleHeight - bottomWireHeight) / (numberOfLines - 1) : 0

  return {
    totalWireLength,
    wireSpacing,
    totalWireCost: totalWireLength * unitCostPerM,
  }
}

// ─── Net plantable area ──────────────────────────────────────────────────────

/**
 * Net plantable area.
 * If rowGeometry is available (row bearing set), net area = sum(rowLengths × rowWidth) / 10000.
 * Otherwise, fallback to uniform polygon inset.
 */
export function calculateNetPlantableArea(
  polygonCoords: [number, number][][],
  headlandWidthM: number,
  rowGeometry?: RowGeometryResult,
  rowWidthM?: number
): { grossHa: number; netHa: number } {
  const grossHa = polygonAreaHa(polygonCoords)

  // Prefer row-geometry-based calculation (accounts for directional headlands)
  if (rowGeometry && rowGeometry.totalRowMetres > 0 && rowWidthM && rowWidthM > 0) {
    const netHa = (rowGeometry.totalRowMetres * rowWidthM) / 10000
    return { grossHa, netHa: Math.max(0, Math.min(netHa, grossHa)) }
  }

  // Fallback: uniform inset
  if (headlandWidthM <= 0) return { grossHa, netHa: grossHa }
  const insetRing = insetPolygon(polygonCoords[0], headlandWidthM)
  const netHa = polygonAreaM2(insetRing) / 10000
  return { grossHa, netHa: Math.max(0, netHa) }
}

// ─── Gantt template ──────────────────────────────────────────────────────────

export interface TemplateTask {
  name: string
  category: string
  leadMonths: number     // months before planting
  durationMonths: number // 0 = point-in-time
  sortOrder: number
}

export const GANTT_TEMPLATE: TemplateTask[] = [
  { name: 'Soil profile grid & marking',   category: 'soil_profile', leadMonths: 11, durationMonths: 1, sortOrder: 1 },
  { name: 'Soil scientist visit',          category: 'soil_profile', leadMonths: 10, durationMonths: 0, sortOrder: 2 },
  { name: 'Lab results received',          category: 'soil_profile', leadMonths: 9,  durationMonths: 0, sortOrder: 3 },
  { name: 'Soil prep plan finalised',      category: 'soil_prep',    leadMonths: 8,  durationMonths: 0, sortOrder: 4 },
  { name: 'Deep ripping / ridging',        category: 'soil_prep',    leadMonths: 8,  durationMonths: 1, sortOrder: 5 },
  { name: 'Lime application',              category: 'chemistry',    leadMonths: 7,  durationMonths: 0, sortOrder: 6 },
  { name: 'Gypsum / phosphate',            category: 'chemistry',    leadMonths: 6,  durationMonths: 0, sortOrder: 7 },
  { name: 'Fumigation',                    category: 'fumigation',   leadMonths: 6,  durationMonths: 0, sortOrder: 8 },
  { name: 'Irrigation design finalised',   category: 'irrigation',   leadMonths: 6,  durationMonths: 1, sortOrder: 9 },
  { name: 'Pole & wire materials ordered', category: 'structure',    leadMonths: 5,  durationMonths: 0, sortOrder: 10 },
  { name: 'Poles installed',               category: 'structure',    leadMonths: 4,  durationMonths: 1, sortOrder: 11 },
  { name: 'Irrigation lines laid',         category: 'irrigation',   leadMonths: 4,  durationMonths: 1, sortOrder: 12 },
  { name: 'Trellis wires strung',          category: 'structure',    leadMonths: 3,  durationMonths: 1, sortOrder: 13 },
  { name: 'Irrigation commissioned',       category: 'irrigation',   leadMonths: 2,  durationMonths: 0, sortOrder: 14 },
  { name: 'Cover crop seeded',             category: 'cover_crop',   leadMonths: 1,  durationMonths: 0, sortOrder: 15 },
  { name: 'Final land prep & row marking', category: 'soil_prep',    leadMonths: 1,  durationMonths: 0, sortOrder: 16 },
  { name: 'Planting',                      category: 'planting',     leadMonths: 0,  durationMonths: 0, sortOrder: 17 },
]

/** Generate task dates from a target planting date */
export function generateTaskDates(
  template: TemplateTask[],
  plantingDate: Date
): { name: string; category: string; startDate: string; endDate: string; sortOrder: number }[] {
  return template.map(t => {
    const end = new Date(plantingDate)
    end.setMonth(end.getMonth() - t.leadMonths)
    const start = new Date(end)
    if (t.durationMonths > 0) {
      start.setMonth(start.getMonth() - t.durationMonths)
    }
    return {
      name: t.name,
      category: t.category,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      sortOrder: t.sortOrder,
    }
  })
}

// ─── Cost summary ────────────────────────────────────────────────────────────

export interface CostLine {
  category: string
  label: string
  total: number
}

export function aggregateCosts(spec: Record<string, any>, poleResult?: PoleCountResult, wireResult?: WireResult): CostLine[] {
  const lines: CostLine[] = []

  if (spec.tree_deposit)      lines.push({ category: 'Trees', label: 'Tree order deposit', total: spec.tree_deposit })
  if (poleResult?.totalPoleCost) lines.push({ category: 'Poles', label: 'Poles (end + inside)', total: poleResult.totalPoleCost })
  if (wireResult?.totalWireCost) lines.push({ category: 'Wire', label: 'Trellis wire', total: wireResult.totalWireCost })
  if (spec.netting_cost)      lines.push({ category: 'Netting', label: 'Netting', total: spec.netting_cost })
  if (spec.irrigation_cost)   lines.push({ category: 'Irrigation', label: 'Irrigation', total: spec.irrigation_cost })
  if (spec.soil_prep_cost)    lines.push({ category: 'Soil prep', label: 'Soil prep & chemistry', total: spec.soil_prep_cost })
  if (spec.fumigation_cost)   lines.push({ category: 'Fumigation', label: 'Fumigation', total: spec.fumigation_cost })
  if (spec.drainage_cost)     lines.push({ category: 'Drainage', label: 'Drainage', total: spec.drainage_cost })
  if (spec.cover_crop_cost)   lines.push({ category: 'Cover crop', label: 'Cover crop', total: spec.cover_crop_cost })
  if (spec.windbreak_cost)    lines.push({ category: 'Windbreak', label: 'Windbreak', total: spec.windbreak_cost })

  return lines
}

// ─── Orchard layout KML export ───────────────────────────────────────────────

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function ringToKmlCoords(ring: [number, number][]): string {
  return ring.map(([lng, lat]) => `${lng},${lat},0`).join(' ')
}

/**
 * Generate a KML document showing:
 * 1. Orchard boundary polygon (blue outline)
 * 2. Headland area (orange shading between boundary and plantable area)
 * 3. Individual tree rows (green lines)
 */
export function generateOrchardLayoutKml(
  orchardName: string,
  polygonCoords: [number, number][][],
  rowGeometry: RowGeometryResult,
  headlandWidthM: number,
  insetRing?: [number, number][]
): string {
  const outerRing = polygonCoords[0]

  // Boundary polygon
  const boundaryPlacemark = `  <Placemark>
    <name>${escXml(orchardName)} — Boundary</name>
    <Style>
      <LineStyle><color>ffff8800</color><width>2</width></LineStyle>
      <PolyStyle><color>22ffaa00</color></PolyStyle>
    </Style>
    <Polygon>
      <outerBoundaryIs><LinearRing><coordinates>${ringToKmlCoords(outerRing)}</coordinates></LinearRing></outerBoundaryIs>
    </Polygon>
  </Placemark>`

  // Headland area (boundary minus plantable = headland strip)
  // Show as orange polygon with hole for the plantable area
  let headlandPlacemark = ''
  const netRing = insetRing || (headlandWidthM > 0 ? insetPolygon(outerRing, headlandWidthM) : null)
  if (netRing && headlandWidthM > 0) {
    headlandPlacemark = `  <Placemark>
    <name>Headland (${headlandWidthM}m)</name>
    <Style>
      <LineStyle><color>005599ff</color><width>1</width></LineStyle>
      <PolyStyle><color>440055ff</color></PolyStyle>
    </Style>
    <Polygon>
      <outerBoundaryIs><LinearRing><coordinates>${ringToKmlCoords(outerRing)}</coordinates></LinearRing></outerBoundaryIs>
      <innerBoundaryIs><LinearRing><coordinates>${ringToKmlCoords(netRing)}</coordinates></LinearRing></innerBoundaryIs>
    </Polygon>
  </Placemark>`
  }

  // Row lines
  const rowPlacemarks = rowGeometry.rowLines.map((row, i) =>
    `    <Placemark>
      <name>Row ${i + 1}</name>
      <description>${row.length.toFixed(1)}m</description>
      <Style>
        <LineStyle><color>ff00aa00</color><width>1.5</width></LineStyle>
      </Style>
      <LineString><coordinates>${row.start[0]},${row.start[1]},0 ${row.end[0]},${row.end[1]},0</coordinates></LineString>
    </Placemark>`
  ).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${escXml(orchardName)} — Orchard Layout</name>
  <description>${rowGeometry.numberOfRows} rows, ${rowGeometry.totalRowMetres.toFixed(0)}m total</description>
${boundaryPlacemark}
${headlandPlacemark}
  <Folder>
    <name>Tree Rows (${rowGeometry.numberOfRows})</name>
${rowPlacemarks}
  </Folder>
</Document>
</kml>`
}
