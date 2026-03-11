'use client'

import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'
import { useOrgModules } from '@/lib/useOrgModules'
import { useEffect, useState, useRef } from 'react'
import MobileNav from '@/app/components/MobileNav'

interface Orchard {
  id: string
  name: string
  orchard_nr: number | null
  farm_id: string
  organisation_id: string
  commodity_id: string
  section_id: string | null
  variety: string | null
  variety_group: string | null
  rootstock: string | null
  ha: number | null
  year_planted: number | null
  trees_per_ha: number | null
  nr_of_trees: number | null
  plant_distance: number | null
  row_width: number | null
  legacy_id: number | null
  is_active: boolean
  commodities: { code: string; name: string } | null
  sections: { name: string; section_nr: number } | null
}

interface Commodity { id: string; code: string; name: string }
interface Section   { id: string; name: string; section_nr: number }
interface Farm      { id: string; full_name: string; code: string; organisation_id: string }

const COMMODITY_COLORS: Record<string, string> = {
  POME:   '#6b9fd4',
  STONE:  '#f0a500',
  CITRUS: '#8bc34a',
}
function orchardColor(code: string | undefined) {
  return COMMODITY_COLORS[code ?? ''] ?? '#aaaaaa'
}

const ORCHARD_SELECT = 'id, name, orchard_nr, farm_id, organisation_id, commodity_id, section_id, variety, variety_group, rootstock, ha, year_planted, trees_per_ha, nr_of_trees, plant_distance, row_width, legacy_id, is_active, commodities(code,name), sections!section_id(name,section_nr)'

function emptyForm() {
  return {
    name: '', commodityId: '', orchardNr: '', sectionId: '', farmId: '',
    variety: '', varietyGroup: '', rootstock: '',
    ha: '', yearPlanted: '', treesPerHa: '', nrOfTrees: '',
    plantDistance: '', rowWidth: '', legacyId: '',
  }
}

export default function OrchardsPage() {
  const supabase = createClient()
  const { farmIds, isSuperAdmin, contextLoaded } = useUserContext()
  const modules = useOrgModules()

  const mapRef         = useRef<any>(null)
  const leafletRef     = useRef<any>(null)
  const geoLayerRef    = useRef<any>(null)
  const drawnLayerRef  = useRef<any>(null)
  const boundaryMapRef = useRef<Record<string, object>>({})

  // ── UI state ──────────────────────────────────────────────────────────────
  const [mapReady,         setMapReady]         = useState(false)
  const [boundaryMapReady, setBoundaryMapReady] = useState(false)
  const [mode,             setMode]             = useState<'view' | 'add' | 'edit'>('view')
  const [selectedOrchard,  setSelectedOrchard]  = useState<Orchard | null>(null)
  const [editTarget,       setEditTarget]       = useState<Orchard | null>(null)
  const [drawnBoundary,    setDrawnBoundary]    = useState<object | null>(null)
  const [boundaryDrawn,    setBoundaryDrawn]    = useState(false)

  // ── Zone state ────────────────────────────────────────────────────────────
  const [orchardZones,   setOrchardZones]   = useState<{id:string,name:string,zone_nr:number,zone_letter:string}[]>([])
  const [zonesLoading,   setZonesLoading]   = useState(false)
  const [editingZoneId,  setEditingZoneId]  = useState<string|null>(null)
  const [editingZoneName,setEditingZoneName]= useState('')

  // ── Data state ────────────────────────────────────────────────────────────
  const [farms,          setFarms]          = useState<Farm[]>([])
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null)
  const [orchards,       setOrchards]       = useState<Orchard[]>([])
  const [commodities,    setCommodities]    = useState<Commodity[]>([])
  const [sections,       setSections]       = useState<Section[]>([])
  const [refreshKey,     setRefreshKey]     = useState(0)

  // ── Form state ────────────────────────────────────────────────────────────
  const [form,    setForm]    = useState(emptyForm())
  const [saving,  setSaving]  = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [saveOk,  setSaveOk]  = useState(false)

  // ── 1. Load farms ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!contextLoaded) return
    let q = supabase.from('farms').select('id, full_name, code, organisation_id').eq('is_active', true).order('full_name')
    if (!isSuperAdmin && farmIds.length > 0) q = q.in('id', farmIds)
    q.then(({ data }) => {
      const list = (data as Farm[]) || []
      setFarms(list)
      if (list.length > 0) setSelectedFarmId(list[0].id)
    })
  }, [contextLoaded])

  // ── 2. Load orchards when farm changes (separate from draw) ───────────────
  useEffect(() => {
    if (!selectedFarmId) return
    console.log('[orchards] loading for farm:', selectedFarmId)
    supabase
      .from('orchards')
      .select(ORCHARD_SELECT)
      .eq('farm_id', selectedFarmId)
      .eq('is_active', true)
      .order('name')
      .then(({ data, error }) => {
        console.log('[orchards] loaded:', data?.length ?? 0, 'error:', error)
        setOrchards((data as any) || [])
      })
  }, [selectedFarmId, refreshKey])

  // ── 3. Load form dropdowns when farm changes ──────────────────────────────
  useEffect(() => {
    if (!selectedFarmId) return
    Promise.all([
      supabase.from('commodities').select('id, code, name').order('name'),
      supabase.from('sections').select('id, name, section_nr').eq('farm_id', selectedFarmId).order('section_nr'),
    ]).then(([{ data: comms }, { data: secs }]) => {
      setCommodities((comms as Commodity[]) || [])
      setSections((secs as Section[]) || [])
    })
  }, [selectedFarmId])

  // ── 3b. Reload sections when farm changes inside the edit form ────────────
  useEffect(() => {
    if (mode !== 'edit' || !form.farmId) return
    supabase.from('sections').select('id, name, section_nr')
      .eq('farm_id', form.farmId).order('section_nr')
      .then(({ data }) => setSections((data as Section[]) || []))
  }, [form.farmId])

  // ── 4. Map init — import Geoman BEFORE L.map() so addInitHook fires ────────
  useEffect(() => {
    if (mapReady) return
    async function initMap() {
      const L = (await import('leaflet')).default
      // Must import geoman before creating the map so map.pm is initialised
      await import('@geoman-io/leaflet-geoman-free')
      leafletRef.current = L
      if (mapRef.current && !mapRef.current._leaflet_id) {
        const map = L.map(mapRef.current, { center: [-32.785, 18.715], zoom: 13, maxZoom: 19 })
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { attribution: '© Esri', maxZoom: 19, maxNativeZoom: 18 }
        ).addTo(map)
        mapRef.current._map = map
        setMapReady(true)
      }
    }
    initMap()
  }, [])

  // ── 5. Draw polygons when orchards state or map is ready ──────────────────
  useEffect(() => {
    console.log('[draw] effect triggered — mapReady:', mapReady, 'orchards:', orchards.length, 'mode:', mode)
    if (!mapReady || orchards.length === 0 || mode !== 'view') return

    async function drawPolygons() {
      const L   = leafletRef.current
      const map = mapRef.current?._map
      console.log('[draw] L:', !!L, 'map:', !!map)
      if (!L || !map) return

      if (geoLayerRef.current) { geoLayerRef.current.remove(); geoLayerRef.current = null }

      const { data: boundaryData, error: rpcErr } = await supabase.rpc('get_orchard_boundaries')
      console.log('[draw] boundaryData:', boundaryData?.length ?? 0, 'rpcErr:', rpcErr)
      if (!boundaryData?.length) return

      // Store all boundaries for geoman use in edit mode
      const bmap: Record<string, object> = {}
      boundaryData.forEach((b: any) => { if (b.boundary) bmap[b.id] = b.boundary })
      boundaryMapRef.current = bmap
      setBoundaryMapReady(true)

      const lookup: Record<string, Orchard> = {}
      orchards.forEach(o => { lookup[o.id] = o })

      // Draw ALL boundaries (like pressure map) — style function hides non-farm ones
      const features = boundaryData
        .filter((b: any) => b.boundary)
        .map((b: any) => ({
          type: 'Feature' as const,
          properties: { id: b.id, name: b.name },
          geometry: b.boundary,
        }))

      const matchCount = features.filter((f: any) => lookup[f.properties.id]).length
      console.log('[draw] total features:', features.length, 'matching this farm:', matchCount)

      if (features.length === 0) return

      const layer = L.geoJSON(
        { type: 'FeatureCollection', features },
        {
          style: (feature: any) => {
            const o = lookup[feature.properties.id]
            // Hide orchards not belonging to selected farm
            if (!o) return { fillOpacity: 0, color: 'transparent', weight: 0, opacity: 0 }
            return {
              fillColor: orchardColor((o.commodities as any)?.code),
              fillOpacity: 0.6,
              color: '#fff',
              weight: 1.5,
            }
          },
          onEachFeature: (feature: any, lyr: any) => {
            const o = lookup[feature.properties.id]
            if (!o) return // skip non-farm orchards entirely
            lyr.on('mouseover', () => lyr.setStyle({ fillOpacity: 0.9, weight: 2.5 }))
            lyr.on('mouseout',  () => lyr.setStyle({ fillOpacity: 0.6, weight: 1.5 }))
            lyr.on('click', () => setSelectedOrchard(o))
            lyr.bindTooltip(o.name, { permanent: false, direction: 'center', className: 'orchard-tooltip' })
          },
        }
      ).addTo(map)

      geoLayerRef.current = layer
      const bounds = layer.getBounds()
      console.log('[draw] bounds valid:', bounds.isValid())
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] })
    }

    drawPolygons()
  }, [mapReady, orchards, mode, refreshKey])

  // ── 6. Geoman tools for add / edit ────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || mode === 'view') return

    async function setupGeoman() {
      const L   = leafletRef.current
      const map = mapRef.current._map
      if (!L || !map) return

      // Show other orchards faded
      if (geoLayerRef.current) { geoLayerRef.current.remove(); geoLayerRef.current = null }
      const bmap = boundaryMapRef.current
      const fadedFeatures = orchards
        .filter((o: Orchard) => bmap[o.id] && (mode !== 'edit' || o.id !== editTarget?.id))
        .map((o: Orchard) => ({
          type: 'Feature',
          properties: { id: o.id },
          geometry: bmap[o.id] as any,
        }))
      if (fadedFeatures.length > 0) {
        geoLayerRef.current = L.geoJSON(
          { type: 'FeatureCollection', features: fadedFeatures },
          { style: () => ({ fillColor: '#888', fillOpacity: 0.25, color: '#fff', weight: 1 }) }
        ).addTo(map)
      }

      if (drawnLayerRef.current) { drawnLayerRef.current.remove(); drawnLayerRef.current = null }

      if (mode === 'edit' && editTarget && bmap[editTarget.id]) {
        // addControls FIRST — this initialises map.pm.globalOptions which editLayer.pm.enable() needs
        map.pm.addControls({
          position: 'topleft',
          drawMarker: false, drawPolyline: false, drawCircle: false, drawCircleMarker: false,
          drawRectangle: false, drawPolygon: false,
          editMode: true, dragMode: true,
          cutPolygon: false, removalMode: false,
        })

        const editLayer = L.geoJSON(
          { type: 'Feature', properties: {}, geometry: bmap[editTarget.id] as any },
          { style: () => ({ fillColor: orchardColor((editTarget.commodities as any)?.code), fillOpacity: 0.5, color: '#f0a500', weight: 2 }) }
        ).addTo(map)
        drawnLayerRef.current = editLayer
        setDrawnBoundary(bmap[editTarget.id])
        setBoundaryDrawn(true)

        // Enable PM on each polygon sub-layer (GeoJSON returns a FeatureGroup)
        editLayer.eachLayer((sublayer: any) => {
          sublayer.pm.enable({ allowSelfIntersection: false })
          sublayer.on('pm:edit', () => {
            setDrawnBoundary(sublayer.toGeoJSON().geometry)
          })
        })
      } else {
        map.pm.addControls({
          position: 'topleft',
          drawMarker: false, drawPolyline: false, drawCircle: false, drawCircleMarker: false,
          drawRectangle: true, drawPolygon: true,
          editMode: false, dragMode: false,
          cutPolygon: false, removalMode: false,
        })
        map.on('pm:create', (e: any) => {
          if (drawnLayerRef.current) drawnLayerRef.current.remove()
          drawnLayerRef.current = e.layer
          setDrawnBoundary(e.layer.toGeoJSON().geometry)
          setBoundaryDrawn(true)
          map.pm.disableDraw()
        })
      }
    }

    setupGeoman()

    return () => {
      const map = mapRef.current?._map
      if (map?.pm) { map.pm.removeControls(); map.off('pm:create') }
      if (drawnLayerRef.current) { drawnLayerRef.current.remove(); drawnLayerRef.current = null }
    }
  }, [mapReady, mode, editTarget])

  // ── Helpers ───────────────────────────────────────────────────────────────
  function selectOrchardFromList(o: Orchard) {
    setSelectedOrchard(o)
    if (!geoLayerRef.current) return
    const map = mapRef.current?._map
    if (!map) return
    geoLayerRef.current.eachLayer((lyr: any) => {
      if (lyr.feature?.properties?.id === o.id) {
        map.fitBounds(lyr.getBounds(), { padding: [60, 60], maxZoom: 17 })
      }
    })
  }

  function enterAdd() {
    setForm(emptyForm())
    setDrawnBoundary(null); setBoundaryDrawn(false)
    setSaveErr(''); setSaveOk(false)
    setSelectedOrchard(null); setEditTarget(null)
    setMode('add')
  }

  function enterEdit(o: Orchard) {
    setForm({
      name: o.name, commodityId: o.commodity_id,
      orchardNr: o.orchard_nr?.toString() ?? '',
      sectionId: o.section_id ?? '',
      farmId: o.farm_id,
      variety: o.variety ?? '', varietyGroup: o.variety_group ?? '',
      rootstock: o.rootstock ?? '',
      ha: o.ha?.toString() ?? '', yearPlanted: o.year_planted?.toString() ?? '',
      treesPerHa: o.trees_per_ha?.toString() ?? '', nrOfTrees: o.nr_of_trees?.toString() ?? '',
      plantDistance: o.plant_distance?.toString() ?? '', rowWidth: o.row_width?.toString() ?? '',
      legacyId: o.legacy_id?.toString() ?? '',
    })
    setDrawnBoundary(null); setBoundaryDrawn(false)
    setSaveErr(''); setSaveOk(false)
    setEditTarget(o); setSelectedOrchard(null)
    setMode('edit')
  }

  function cancelEdit() {
    setMode('view')
    setEditTarget(null)
    setDrawnBoundary(null); setBoundaryDrawn(false)
    setSaveErr(''); setSaveOk(false)
  }

  // ── Load zones when orchard selected ──────────────────────────────────────
  useEffect(() => {
    if (!selectedOrchard) { setOrchardZones([]); return }
    setZonesLoading(true)
    fetch(`/api/orchards/zones?orchard_id=${selectedOrchard.id}`)
      .then(r => r.json())
      .then(data => { setOrchardZones(Array.isArray(data) ? data : []); setZonesLoading(false) })
      .catch(() => setZonesLoading(false))
    setEditingZoneId(null)
  }, [selectedOrchard?.id])

  async function handleGenerateZones() {
    if (!selectedOrchard?.ha) return
    if (orchardZones.length > 0) {
      if (!confirm(`Replace ${orchardZones.length} existing zone${orchardZones.length !== 1 ? 's' : ''}?`)) return
    }
    setZonesLoading(true)
    const res = await fetch('/api/orchards/zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'generate', orchardId: selectedOrchard.id, ha: selectedOrchard.ha }),
    })
    const data = await res.json()
    if (!res.ok || data.error) { alert(`Zone generation failed: ${data.error}`); setZonesLoading(false); return }
    setOrchardZones(Array.isArray(data) ? data : [])
    setZonesLoading(false)
  }

  async function handleAddZone() {
    if (!selectedOrchard) return
    const nextNr = orchardZones.length + 1
    const nextLetter = String.fromCharCode(64 + nextNr) // 1→A, 2→B …
    const name = `${selectedOrchard.name}${selectedOrchard.variety ? ` (${selectedOrchard.variety})` : ''} - Zone ${nextLetter}`
    setZonesLoading(true)
    const res = await fetch('/api/orchards/zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'create', orchardId: selectedOrchard.id, zoneLetter: nextLetter, zoneNr: nextNr, name }),
    })
    const data = await res.json()
    if (data.id) setOrchardZones(z => [...z, data])
    setZonesLoading(false)
  }

  async function handleRenameZone(id: string, name: string) {
    await fetch('/api/orchards/zones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name }),
    })
    setOrchardZones(z => z.map(zone => zone.id === id ? { ...zone, name } : zone))
    setEditingZoneId(null)
  }

  async function handleDeleteZone(id: string) {
    if (!confirm('Delete this zone?')) return
    await fetch('/api/orchards/zones', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setOrchardZones(z => z.filter(zone => zone.id !== id))
  }

  async function handleSave() {
    setSaving(true); setSaveErr(''); setSaveOk(false)
    const body: Record<string, any> = {
      type: mode === 'add' ? 'create' : 'update',
      farmId: mode === 'edit' ? form.farmId : selectedFarmId,
      name: form.name, commodityId: form.commodityId,
      sectionId:     form.sectionId     || null,
      orchardNr:     form.orchardNr     ? parseInt(form.orchardNr)       : null,
      variety:       form.variety       || null,
      varietyGroup:  form.varietyGroup  || null,
      rootstock:     form.rootstock     || null,
      ha:            form.ha            ? parseFloat(form.ha)            : null,
      yearPlanted:   form.yearPlanted   ? parseInt(form.yearPlanted)     : null,
      treesPerHa:    form.treesPerHa    ? parseInt(form.treesPerHa)      : null,
      nrOfTrees:     form.nrOfTrees     ? parseInt(form.nrOfTrees)       : null,
      plantDistance: form.plantDistance ? parseFloat(form.plantDistance) : null,
      rowWidth:      form.rowWidth      ? parseFloat(form.rowWidth)      : null,
      legacyId:      form.legacyId      ? parseInt(form.legacyId)        : null,
      boundary: drawnBoundary ?? null,
    }
    if (mode === 'edit') body.id = editTarget!.id

    const res  = await fetch('/api/orchards/manage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok || json.error) { setSaveErr(json.error || 'Save failed'); setSaving(false); return }

    setSaveOk(true); setSaving(false)
    setRefreshKey(k => k + 1)
    setTimeout(() => setMode('view'), 600)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const o = selectedOrchard

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #f4f1eb; }
        .app { display: flex; height: 100vh; overflow: hidden; }
        .sidebar {
          width: 220px; height: 100vh; position: sticky; top: 0; overflow-y: auto;
          background: #1a2a3a; padding: 32px 20px;
          display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;
        }
        .logo { font-family: 'DM Serif Display', serif; font-size: 22px; color: #a0c4f0; margin-bottom: 32px; }
        .logo span { color: #fff; }
        .nav-item {
          display: flex; align-items: center; gap: 10px; padding: 10px 12px;
          border-radius: 8px; color: #7a8fa0; font-size: 13.5px; font-weight: 500;
          cursor: pointer; transition: all 0.15s; text-decoration: none;
        }
        .nav-item:hover { background: #1a4a7a; color: #fff; }
        .nav-item.active { background: #1a4a7a; color: #a0c4f0; }
        .sidebar-footer { margin-top: auto; padding-top: 24px; border-top: 1px solid #1a4a7a; font-size: 12px; color: #5a7a8a; }
        .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .top-bar {
          padding: 12px 24px; background: #fff; border-bottom: 1px solid #e8e4dc;
          display: flex; align-items: center; gap: 16px; flex-shrink: 0;
        }
        .page-title { font-family: 'DM Serif Display', serif; font-size: 20px; color: #1a2a3a; }
        .btn-primary {
          margin-left: auto; padding: 8px 18px; background: #1a2a3a; color: #a0c4f0;
          border: none; border-radius: 8px; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
        }
        .btn-primary:hover { background: #1a4a7a; }
        .btn-cancel {
          padding: 8px 18px; background: none; color: #6a7a70;
          border: 1.5px solid #e0ddd6; border-radius: 8px; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
        }
        .btn-cancel:hover { background: #f4f1eb; }
        .btn-save {
          padding: 8px 20px; background: #2176d9; color: #fff;
          border: none; border-radius: 8px; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
        }
        .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-edit {
          width: 100%; margin-top: 16px; padding: 9px; background: #f0f4fa; color: #2176d9;
          border: 1.5px solid #c8d8f0; border-radius: 8px; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
        }
        .btn-edit:hover { background: #e0f0e4; }
        .farm-select {
          padding: 6px 10px; border-radius: 8px; border: 1.5px solid #e0ddd6;
          font-family: 'DM Sans', sans-serif; font-size: 13px; color: #1a2a3a;
          background: #fff; cursor: pointer; outline: none;
        }
        .content { flex: 1; display: flex; overflow: hidden; }
        .form-panel {
          width: 340px; flex-shrink: 0; background: #fff; border-right: 1px solid #e8e4dc;
          overflow-y: auto; padding: 24px 20px; display: flex; flex-direction: column; gap: 14px;
        }
        .field-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.7px; color: #8a95a0; margin-bottom: 4px; }
        .field-input {
          width: 100%; padding: 8px 10px; border: 1.5px solid #e0ddd6; border-radius: 8px;
          font-family: 'DM Sans', sans-serif; font-size: 13px; color: #1a2a3a; background: #fff; outline: none;
        }
        .field-input:focus { border-color: #2176d9; }
        .field-row { display: flex; gap: 10px; }
        .field-row .field-wrap { flex: 1; }
        .field-wrap { display: flex; flex-direction: column; }
        .required { color: #e85a4a; }
        .save-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
        .save-err { font-size: 12px; color: #e85a4a; }
        .save-ok  { font-size: 12px; color: #2176d9; font-weight: 600; }
        .map-wrap { flex: 1; position: relative; }
        #orchards-map { width: 100%; height: 100%; }
        .info-panel {
          position: absolute; top: 16px; right: 16px; width: 260px;
          background: #fff; border-radius: 12px; border: 1px solid #e8e4dc;
          padding: 20px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); z-index: 1000;
          max-height: calc(100vh - 80px); overflow-y: auto;
        }
        .info-title { font-family: 'DM Serif Display', serif; font-size: 18px; color: #1a2a3a; margin-bottom: 2px; }
        .info-sub { font-size: 12px; color: #8a95a0; margin-bottom: 14px; }
        .info-divider { height: 1px; background: #f0ede6; margin: 12px 0; }
        .info-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 13px; }
        .info-label { color: #8a95a0; }
        .info-value { font-weight: 500; color: #1a2a3a; }
        .placeholder-panel { color: #8a95a0; font-size: 13px; font-style: italic; text-align: center; padding-top: 8px; }
        .boundary-badge {
          position: absolute; top: 16px; left: 16px; z-index: 1100;
          background: #1a2a3a; color: #a0c4f0; padding: 6px 14px;
          border-radius: 20px; font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif;
        }
        .orchard-tooltip {
          background: #1a2a3a !important; color: #fff !important; border: none !important;
          border-radius: 6px !important; font-family: 'DM Sans', sans-serif !important;
          font-size: 12px !important; font-weight: 500 !important; padding: 4px 10px !important;
        }
        .orchard-tooltip::before { display: none !important; }
        .orchard-list-panel {
          width: 260px; flex-shrink: 0; background: #fff;
          border-right: 1px solid #e8e4dc; overflow-y: auto;
          display: flex; flex-direction: column;
        }
        .orchard-list-header {
          padding: 14px 16px 10px; font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.7px; color: #8a95a0;
          border-bottom: 1px solid #f0ede6; flex-shrink: 0;
        }
        .orchard-list-item {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 16px; border-bottom: 1px solid #f7f5f0;
          cursor: pointer; transition: background 0.1s;
        }
        .orchard-list-item:hover { background: #f7f5f0; }
        .orchard-list-item.selected { background: #f0f4fa; }
        .orchard-list-name { flex: 1; font-size: 13px; color: #1a2a3a; font-weight: 500; line-height: 1.3; }
        .orchard-list-no-boundary { font-size: 10px; color: #bbb; display: block; }
        .orchard-list-edit {
          flex-shrink: 0; padding: 3px 9px; font-size: 11px; font-weight: 600;
          background: none; border: 1.5px solid #e0ddd6; border-radius: 6px;
          color: #6a7a70; cursor: pointer; font-family: 'DM Sans', sans-serif;
        }
        .orchard-list-edit:hover { background: #f0f4fa; border-color: #c8d8f0; color: #2176d9; }

        /* ── Mobile responsive ─────────────────────────────────── */
        @media (max-width: 768px) {
          .orch-sidebar { display: none !important; }
          .orch-app {
            flex-direction: column !important;
            height: auto !important;
            min-height: 100dvh !important;
            overflow: visible !important;
            padding-top: env(safe-area-inset-top, 0px);
          }
          .orch-main {
            overflow: visible !important;
          }
          .orch-top-bar {
            flex-wrap: wrap !important;
            gap: 8px !important;
            padding: 10px 16px !important;
          }
          .orch-top-bar .btn-primary,
          .orch-top-bar .btn-cancel,
          .orch-top-bar .farm-select {
            min-height: 44px !important;
          }
          .orch-content {
            flex-direction: column !important;
          }
          .orch-map {
            width: 100% !important;
            height: 50dvh !important;
            min-height: 300px !important;
          }
          .orch-map #orchards-map {
            width: 100% !important;
            height: 100% !important;
          }
          .orch-list-panel {
            width: 100% !important;
            max-height: none !important;
            position: relative !important;
            border-right: none !important;
            border-top: 1px solid #e8e4dc !important;
            padding-bottom: 80px !important;
          }
          .orch-info-panel {
            position: fixed !important;
            top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
            width: 100% !important;
            max-width: none !important;
            z-index: 8000 !important;
            overflow-y: auto !important;
            padding-bottom: 80px !important;
            border-radius: 0 !important;
          }
          .orch-form-panel {
            width: 100% !important;
            max-width: none !important;
            padding-bottom: 80px !important;
          }
          .orchard-list-item {
            min-height: 44px !important;
            padding: 12px 16px !important;
          }
          .orchard-list-edit {
            min-height: 44px !important;
            padding: 6px 14px !important;
          }
          .btn-edit, .btn-save {
            min-height: 44px !important;
          }
        }
      `}</style>

      <div className="app orch-app">
        {/* Sidebar */}
        <aside className="sidebar orch-sidebar">
          <div className="logo"><span>Farm</span>Scout</div>
          <a href="/" className="nav-item"><span>📊</span> Dashboard</a>
          <a href="/orchards" className="nav-item active"><span>🏡</span> Orchards</a>
          <a href="/pests" className="nav-item"><span>🐛</span> Pests</a>
          <a href="/trap-inspections" className="nav-item"><span>🪤</span> Trap Inspections</a>
          <a href="/inspections" className="nav-item"><span>🔍</span> Inspections</a>
          <a href="/heatmap" className="nav-item"><span>🌡️</span> Heat Map</a>
          <a href="/scouts" className="nav-item"><span>👷</span> Scouts</a>
          <a href="/scouts/sections" className="nav-item"><span>🗂️</span> Sections</a>
          <div className="sidebar-footer">
            Mouton's Valley Group<br />
            <span style={{ color: '#2176d9' }}>●</span> Connected<br />
            <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
              style={{ marginTop: 10, background: 'none', border: '1px solid #1a4a7a', color: '#6a9fd4',
                borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              Sign out
            </button>
          </div>
        </aside>

        <div className="main orch-main">
          {/* Top bar */}
          <div className="top-bar orch-top-bar">
            {mode !== 'view' && <button className="btn-cancel" onClick={cancelEdit}>← Cancel</button>}
            <div className="page-title">
              {mode === 'add' ? 'Add New Orchard' : mode === 'edit' ? `Edit: ${editTarget?.name}` : 'Orchards'}
            </div>
            {mode === 'view' && farms.length > 1 && (
              <select className="farm-select" value={selectedFarmId ?? ''}
                onChange={e => { setSelectedFarmId(e.target.value); setSelectedOrchard(null) }}>
                {farms.map(f => <option key={f.id} value={f.id}>{f.full_name}</option>)}
              </select>
            )}
            {mode === 'view' && <button className="btn-primary" onClick={enterAdd}>+ Add Orchard</button>}
          </div>

          {/* Content */}
          <div className="content orch-content">
            {/* Orchard list panel (view mode only) */}
            {mode === 'view' && (
              <div className="orchard-list-panel orch-list-panel">
                <div className="orchard-list-header">{orchards.length} Orchards</div>
                {orchards.map(o => {
                  const hasBoundary = !!boundaryMapRef.current[o.id]
                  return (
                    <div
                      key={o.id}
                      className={`orchard-list-item${selectedOrchard?.id === o.id ? ' selected' : ''}`}
                      onClick={() => selectOrchardFromList(o)}
                    >
                      <div className="orchard-list-name">
                        {o.name}{o.variety ? ` (${o.variety})` : ''}
                        {!hasBoundary && <span className="orchard-list-no-boundary">no boundary</span>}
                      </div>
                      <button
                        className="orchard-list-edit"
                        onClick={e => { e.stopPropagation(); enterEdit(o) }}
                      >
                        Edit
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Form panel (add / edit mode) */}
            {mode !== 'view' && (
              <div className="form-panel orch-form-panel">
                <div className="field-wrap">
                  <div className="field-label">Name <span className="required">*</span></div>
                  <input className="field-input" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Block A" />
                </div>
                {mode === 'edit' && (
                  <div className="field-wrap">
                    <div className="field-label">Farm <span className="required">*</span></div>
                    <select className="field-input" value={form.farmId}
                      onChange={e => setForm(f => ({ ...f, farmId: e.target.value, sectionId: '' }))}>
                      <option value="">— select —</option>
                      {farms.map(f => <option key={f.id} value={f.id}>{f.full_name}</option>)}
                    </select>
                  </div>
                )}
                <div className="field-wrap">
                  <div className="field-label">Commodity <span className="required">*</span></div>
                  <select className="field-input" value={form.commodityId}
                    onChange={e => setForm(f => ({ ...f, commodityId: e.target.value }))}>
                    <option value="">— select —</option>
                    {commodities.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                  </select>
                </div>
                <div className="field-row">
                  <div className="field-wrap">
                    <div className="field-label">Orchard #</div>
                    <input className="field-input" type="number" value={form.orchardNr}
                      onChange={e => setForm(f => ({ ...f, orchardNr: e.target.value }))} />
                  </div>
                  <div className="field-wrap">
                    <div className="field-label">Section</div>
                    <select className="field-input" value={form.sectionId}
                      onChange={e => setForm(f => ({ ...f, sectionId: e.target.value }))}>
                      <option value="">—</option>
                      {sections.map(s => <option key={s.id} value={s.id}>{s.name || `Section ${s.section_nr}`}</option>)}
                    </select>
                  </div>
                </div>
                <div className="field-wrap">
                  <div className="field-label">Variety</div>
                  <input className="field-input" value={form.variety}
                    onChange={e => setForm(f => ({ ...f, variety: e.target.value }))} />
                </div>
                <div className="field-wrap">
                  <div className="field-label">Variety Group</div>
                  <input className="field-input" value={form.varietyGroup}
                    onChange={e => setForm(f => ({ ...f, varietyGroup: e.target.value }))} />
                </div>
                <div className="field-wrap">
                  <div className="field-label">Rootstock</div>
                  <input className="field-input" value={form.rootstock}
                    onChange={e => setForm(f => ({ ...f, rootstock: e.target.value }))} />
                </div>
                <div className="field-row">
                  <div className="field-wrap">
                    <div className="field-label">Hectares</div>
                    <input className="field-input" type="number" step="0.01" value={form.ha}
                      onChange={e => setForm(f => ({ ...f, ha: e.target.value }))} />
                  </div>
                  <div className="field-wrap">
                    <div className="field-label">Year Planted</div>
                    <input className="field-input" type="number" value={form.yearPlanted}
                      onChange={e => setForm(f => ({ ...f, yearPlanted: e.target.value }))} />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field-wrap">
                    <div className="field-label">Trees / ha</div>
                    <input className="field-input" type="number" value={form.treesPerHa}
                      onChange={e => setForm(f => ({ ...f, treesPerHa: e.target.value }))} />
                  </div>
                  <div className="field-wrap">
                    <div className="field-label">Nr of Trees</div>
                    <input className="field-input" type="number" value={form.nrOfTrees}
                      onChange={e => setForm(f => ({ ...f, nrOfTrees: e.target.value }))} />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field-wrap">
                    <div className="field-label">Plant Distance (m)</div>
                    <input className="field-input" type="number" step="0.1" value={form.plantDistance}
                      onChange={e => setForm(f => ({ ...f, plantDistance: e.target.value }))} />
                  </div>
                  <div className="field-wrap">
                    <div className="field-label">Row Width (m)</div>
                    <input className="field-input" type="number" step="0.1" value={form.rowWidth}
                      onChange={e => setForm(f => ({ ...f, rowWidth: e.target.value }))} />
                  </div>
                </div>
                <div className="field-wrap">
                  <div className="field-label">Legacy ID</div>
                  <input className="field-input" type="number" value={form.legacyId}
                    onChange={e => setForm(f => ({ ...f, legacyId: e.target.value }))} />
                </div>
                <div className="save-row">
                  <button className="btn-save" onClick={handleSave}
                    disabled={saving || !form.name || !form.commodityId || (mode === 'edit' && !form.farmId)}>
                    {saving ? 'Saving…' : 'Save Orchard'}
                  </button>
                  {saveErr && <span className="save-err">{saveErr}</span>}
                  {saveOk  && <span className="save-ok">Saved!</span>}
                </div>
              </div>
            )}

            {/* Map */}
            <div className="map-wrap orch-map">
              <div id="orchards-map" ref={mapRef} />

              {mode !== 'view' && boundaryDrawn && (
                <div className="boundary-badge">✓ Boundary drawn</div>
              )}

              {mode === 'view' && (
                <div className="info-panel orch-info-panel">
                  {o ? (
                    <>
                      <div className="info-title">{o.name}</div>
                      <div className="info-sub">
                        {(o.commodities as any)?.name || '—'}
                        {o.variety ? ` · ${o.variety}` : ''}
                        {(o.sections as any)?.name ? ` · ${(o.sections as any).name}` : ''}
                        {o.ha ? ` · ${o.ha} ha` : ''}
                      </div>
                      <div className="info-divider" />
                      <div className="info-row"><span className="info-label">Orchard #</span><span className="info-value">{o.orchard_nr ?? '—'}</span></div>
                      <div className="info-row"><span className="info-label">Rootstock</span><span className="info-value">{o.rootstock || '—'}</span></div>
                      <div className="info-row"><span className="info-label">Year</span><span className="info-value">{o.year_planted ?? '—'}</span></div>
                      <div className="info-row"><span className="info-label">Trees/ha</span><span className="info-value">{o.trees_per_ha ?? '—'}</span></div>
                      <div className="info-row"><span className="info-label">Nr trees</span><span className="info-value">{o.nr_of_trees?.toLocaleString() ?? '—'}</span></div>
                      <div className="info-row"><span className="info-label">Row width</span><span className="info-value">{o.row_width ? `${o.row_width} m` : '—'}</span></div>
                      <div className="info-row"><span className="info-label">Legacy ID</span><span className="info-value">{o.legacy_id ?? '—'}</span></div>
                      <div className="info-divider" />

                      {/* Zones section */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#8a95a0' }}>Zones</span>
                        <button
                          onClick={handleGenerateZones}
                          disabled={!o.ha || zonesLoading}
                          title={o.ha ? `Auto-generate ${Math.ceil(o.ha / 2)} zones from ${o.ha} ha` : 'Set hectares first'}
                          style={{
                            padding: '3px 9px', fontSize: 11, fontWeight: 600, cursor: o.ha ? 'pointer' : 'not-allowed',
                            background: o.ha ? '#1a2a3a' : '#e0e0e0', color: o.ha ? '#a0c4f0' : '#999',
                            border: 'none', borderRadius: 6, fontFamily: 'DM Sans, sans-serif', opacity: zonesLoading ? 0.6 : 1,
                          }}>
                          ⚡ Auto-generate
                        </button>
                      </div>

                      {zonesLoading && <div style={{ fontSize: 12, color: '#8a95a0', marginBottom: 6 }}>Loading…</div>}

                      {!zonesLoading && orchardZones.map(zone => (
                        <div key={zone.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid #f0ede6' }}>
                          {editingZoneId === zone.id ? (
                            <>
                              <input
                                autoFocus
                                value={editingZoneName}
                                onChange={e => setEditingZoneName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleRenameZone(zone.id, editingZoneName); if (e.key === 'Escape') setEditingZoneId(null) }}
                                style={{ flex: 1, padding: '3px 6px', fontSize: 12, border: '1.5px solid #2176d9', borderRadius: 5, fontFamily: 'DM Sans, sans-serif', color: '#1a2a3a' }}
                              />
                              <button onClick={() => handleRenameZone(zone.id, editingZoneName)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2176d9', fontSize: 14, padding: '0 2px' }} title="Save">✓</button>
                              <button onClick={() => setEditingZoneId(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 14, padding: '0 2px' }} title="Cancel">✗</button>
                            </>
                          ) : (
                            <>
                              <span style={{ flex: 1, fontSize: 13, color: '#1a2a3a' }}>{zone.name}</span>
                              <button onClick={() => { setEditingZoneId(zone.id); setEditingZoneName(zone.name) }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8a95a0', fontSize: 13, padding: '0 2px' }} title="Rename">✏️</button>
                              <button onClick={() => handleDeleteZone(zone.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e85a4a', fontSize: 13, padding: '0 2px' }} title="Delete">×</button>
                            </>
                          )}
                        </div>
                      ))}

                      {!zonesLoading && orchardZones.length === 0 && (
                        <div style={{ fontSize: 12, color: '#8a95a0', fontStyle: 'italic', marginBottom: 4 }}>No zones — use Auto-generate or add manually</div>
                      )}

                      <button onClick={handleAddZone} disabled={zonesLoading}
                        style={{
                          marginTop: 6, background: 'none', border: 'none', color: '#2176d9',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'DM Sans, sans-serif',
                        }}>
                        + Add zone
                      </button>

                      <div className="info-divider" />
                      {!boundaryMapRef.current[o.id] && (
                        <div style={{ fontSize: 12, color: '#8a95a0', fontStyle: 'italic', marginBottom: 8 }}>
                          No boundary drawn — click Edit to draw one
                        </div>
                      )}
                      <button className="btn-edit" onClick={() => enterEdit(o)}>Edit Orchard</button>
                    </>
                  ) : (
                    <div className="placeholder-panel">Click an orchard polygon to view details</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <MobileNav isSuperAdmin={isSuperAdmin} modules={modules} />
    </>
  )
}
