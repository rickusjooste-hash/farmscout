/**
 * Soil Profile Grid Generator — 50×50m grid within polygon
 *
 * Generates labelled points (A1, A2, B1, B2...) on a 50m grid
 * clipped to the polygon interior.
 */

import { offsetPoint, haversine } from './planning-calcs'

export interface GridPoint {
  id: string      // e.g. "A1", "B3"
  col: string     // column letter
  row: number     // row number
  lng: number
  lat: number
}

const GRID_SPACING = 50 // metres

/**
 * Generate a 50×50m grid within a polygon boundary
 * @param ring - outer ring of polygon [[lng,lat], ...]
 * @returns array of GridPoint inside the polygon
 */
export function generateSoilGrid(ring: [number, number][]): GridPoint[] {
  if (!ring || ring.length < 4) return []

  // Find bounding box
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }

  // Calculate grid origin (bottom-left corner) and extents
  const origin: [number, number] = [minLng, minLat]
  const width = haversine([minLng, minLat], [maxLng, minLat])
  const height = haversine([minLng, minLat], [minLng, maxLat])

  const cols = Math.ceil(width / GRID_SPACING)
  const rows = Math.ceil(height / GRID_SPACING)

  const points: GridPoint[] = []

  for (let c = 0; c <= cols; c++) {
    for (let r = 0; r <= rows; r++) {
      // Move east from origin by c * GRID_SPACING
      const eastPt = offsetPoint(origin, c * GRID_SPACING, 90)
      // Move north by r * GRID_SPACING
      const pt = offsetPoint([eastPt[0], origin[1]], r * GRID_SPACING, 0)

      if (pointInPolygon(pt, ring)) {
        const colLetter = columnLabel(c)
        points.push({
          id: `${colLetter}${r + 1}`,
          col: colLetter,
          row: r + 1,
          lng: pt[0],
          lat: pt[1],
        })
      }
    }
  }

  return points
}

/** Column label: 0→A, 1→B, ..., 25→Z, 26→AA */
function columnLabel(n: number): string {
  let label = ''
  let num = n
  do {
    label = String.fromCharCode(65 + (num % 26)) + label
    num = Math.floor(num / 26) - 1
  } while (num >= 0)
  return label
}

/** Ray-casting point-in-polygon test */
function pointInPolygon(pt: [number, number], ring: [number, number][]): boolean {
  const [x, y] = pt
  let inside = false
  const n = ring.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Export soil grid points as KML Placemarks
 * Returns the <Folder> XML string to be embedded in a KML document
 */
export function gridToKmlFolder(
  points: GridPoint[],
  orchardName: string
): string {
  const placemarks = points.map(p =>
    `    <Placemark>
      <name>${escXml(p.id)}</name>
      <description>Soil profile point ${escXml(p.id)} — ${escXml(orchardName)}</description>
      <Style>
        <IconStyle>
          <Icon><href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href></Icon>
          <scale>0.8</scale>
        </IconStyle>
        <LabelStyle><scale>0.8</scale></LabelStyle>
      </Style>
      <Point><coordinates>${p.lng},${p.lat},0</coordinates></Point>
    </Placemark>`
  ).join('\n')

  return `  <Folder>
    <name>${escXml(orchardName)} — Soil Profile Grid</name>
${placemarks}
  </Folder>`
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
