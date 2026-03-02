'use client'

import { createClient } from '@/lib/supabase-auth'
import { useUserContext } from '@/lib/useUserContext'
import { useEffect, useState, useRef } from 'react'

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

  const mapRef         = useRef<any>(null)
  const leafletRef     = useRef<any>(null)
  const geoLayerRef    = useRef<any>(null)
  const drawnLayerRef  = useRef<any>(null)
  const boundaryMapRef = useRef<Record<string, object>>({})

  // ── UI state ──────────────────────────────────────────────────────────────
  const [mapReady,        setMapReady]        = useState(false)
  const [mode,            setMode]            = useState<'view' | 'add' | 'edit'>('view')
  const [selectedOrchard, setSelectedOrchard] = useState<Orchard | null>(null)
  const [editTarget,      setEditTarget]      = useState<Orchard | null>(null)
  const [drawnBoundary,   setDrawnBoundary]   = useState<object | null>(null)
  const [boundaryDrawn,   setBoundaryDrawn]   = useState(false)

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
        const map = L.map(mapRef.current, { center: [-32.785, 18.715], zoom: 13 })
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { attribution: '© Esri', maxZoom: 19 }
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
        .app { display: flex; min-height: 100vh; }
        .sidebar {
          width: 220px; height: 100vh; position: sticky; top: 0; overflow-y: auto;
          background: #1c3a2a; padding: 32px 20px;
          display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;
        }
        .logo { font-family: 'DM Serif Display', serif; font-size: 22px; color: #a8d5a2; margin-bottom: 32px; }
        .logo span { color: #fff; }
        .nav-item {
          display: flex; align-items: center; gap: 10px; padding: 10px 12px;
          border-radius: 8px; color: #8aab96; font-size: 13.5px; font-weight: 500;
          cursor: pointer; transition: all 0.15s; text-decoration: none;
        }
        .nav-item:hover { background: #2a4f38; color: #fff; }
        .nav-item.active { background: #2a4f38; color: #a8d5a2; }
        .sidebar-footer { margin-top: auto; padding-top: 24px; border-top: 1px solid #2a4f38; font-size: 12px; color: #4a7a5a; }
        .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .top-bar {
          padding: 12px 24px; background: #fff; border-bottom: 1px solid #e8e4dc;
          display: flex; align-items: center; gap: 16px; flex-shrink: 0;
        }
        .page-title { font-family: 'DM Serif Display', serif; font-size: 20px; color: #1c3a2a; }
        .btn-primary {
          margin-left: auto; padding: 8px 18px; background: #1c3a2a; color: #a8d5a2;
          border: none; border-radius: 8px; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
        }
        .btn-primary:hover { background: #2a4f38; }
        .btn-cancel {
          padding: 8px 18px; background: none; color: #6a7a70;
          border: 1.5px solid #e0ddd6; border-radius: 8px; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
        }
        .btn-cancel:hover { background: #f4f1eb; }
        .btn-save {
          padding: 8px 20px; background: #2a6e45; color: #fff;
          border: none; border-radius: 8px; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
        }
        .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-edit {
          width: 100%; margin-top: 16px; padding: 9px; background: #f0f7f2; color: #2a6e45;
          border: 1.5px solid #c8e6c9; border-radius: 8px; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: 'DM Sans', sans-serif;
        }
        .btn-edit:hover { background: #e0f0e4; }
        .farm-select {
          padding: 6px 10px; border-radius: 8px; border: 1.5px solid #e0ddd6;
          font-family: 'DM Sans', sans-serif; font-size: 13px; color: #1c3a2a;
          background: #fff; cursor: pointer; outline: none;
        }
        .content { flex: 1; display: flex; overflow: hidden; }
        .form-panel {
          width: 340px; flex-shrink: 0; background: #fff; border-right: 1px solid #e8e4dc;
          overflow-y: auto; padding: 24px 20px; display: flex; flex-direction: column; gap: 14px;
        }
        .field-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.7px; color: #9aaa9f; margin-bottom: 4px; }
        .field-input {
          width: 100%; padding: 8px 10px; border: 1.5px solid #e0ddd6; border-radius: 8px;
          font-family: 'DM Sans', sans-serif; font-size: 13px; color: #1c3a2a; background: #fff; outline: none;
        }
        .field-input:focus { border-color: #2a6e45; }
        .field-row { display: flex; gap: 10px; }
        .field-row .field-wrap { flex: 1; }
        .field-wrap { display: flex; flex-direction: column; }
        .required { color: #e85a4a; }
        .save-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
        .save-err { font-size: 12px; color: #e85a4a; }
        .save-ok  { font-size: 12px; color: #2a6e45; font-weight: 600; }
        .map-wrap { flex: 1; position: relative; min-height: 600px; }
        #orchards-map { width: 100%; height: 100%; min-height: 600px; }
        .info-panel {
          position: absolute; top: 16px; right: 16px; width: 260px;
          background: #fff; border-radius: 12px; border: 1px solid #e8e4dc;
          padding: 20px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); z-index: 1000;
        }
        .info-title { font-family: 'DM Serif Display', serif; font-size: 18px; color: #1c3a2a; margin-bottom: 2px; }
        .info-sub { font-size: 12px; color: #9aaa9f; margin-bottom: 14px; }
        .info-divider { height: 1px; background: #f0ede6; margin: 12px 0; }
        .info-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 13px; }
        .info-label { color: #9aaa9f; }
        .info-value { font-weight: 500; color: #1c3a2a; }
        .placeholder-panel { color: #9aaa9f; font-size: 13px; font-style: italic; text-align: center; padding-top: 8px; }
        .boundary-badge {
          position: absolute; top: 16px; left: 16px; z-index: 1100;
          background: #1c3a2a; color: #a8d5a2; padding: 6px 14px;
          border-radius: 20px; font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif;
        }
        .orchard-tooltip {
          background: #1c3a2a !important; color: #fff !important; border: none !important;
          border-radius: 6px !important; font-family: 'DM Sans', sans-serif !important;
          font-size: 12px !important; font-weight: 500 !important; padding: 4px 10px !important;
        }
        .orchard-tooltip::before { display: none !important; }
      `}</style>

      <div className="app">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="logo"><span>Farm</span>Scout</div>
          <a href="/" className="nav-item"><span>📊</span> Dashboard</a>
          <a href="/orchards" className="nav-item active"><span>🏡</span> Orchards</a>
          <a href="/pests" className="nav-item"><span>🐛</span> Pests</a>
          <a href="/trap-inspections" className="nav-item"><span>🪤</span> Trap Inspections</a>
          <a href="/inspections" className="nav-item"><span>🔍</span> Inspections</a>
          <a href="/scouts" className="nav-item"><span>👷</span> Scouts</a>
          <a href="/scouts/sections" className="nav-item"><span>🗂️</span> Sections</a>
          <div className="sidebar-footer">
            Mouton's Valley Group<br />
            <span style={{ color: '#2a6e45' }}>●</span> Connected<br />
            <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
              style={{ marginTop: 10, background: 'none', border: '1px solid #2a4f38', color: '#6aaa80',
                borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              Sign out
            </button>
          </div>
        </aside>

        <div className="main">
          {/* Top bar */}
          <div className="top-bar">
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
          <div className="content">
            {/* Form panel (add / edit mode) */}
            {mode !== 'view' && (
              <div className="form-panel">
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
            <div className="map-wrap">
              <div id="orchards-map" ref={mapRef} />

              {mode !== 'view' && boundaryDrawn && (
                <div className="boundary-badge">✓ Boundary drawn</div>
              )}

              {mode === 'view' && (
                <div className="info-panel">
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
    </>
  )
}
