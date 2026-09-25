"""
Road Buffer Tool — backend
OSM se roads/buildings/water extract (Overpass API) -> buffer -> dissolve -> export.
Frontend: static/ (Leaflet + Turf.js)
"""
import io
import json
import math
import os
import re
import tempfile
import zipfile

import pyproj
import requests
from flask import Flask, Response, jsonify, request, send_from_directory
from shapely.geometry import LineString, mapping, shape
from shapely.geometry import box as shp_box
from shapely.ops import split as shapely_split, transform, unary_union

try:
    import shapefile as pyshp  # pyshp — shapefile export ke liye
except ImportError:
    pyshp = None

app = Flask(__name__, static_folder="static", static_url_path="")

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

# buffer distance units -> meters
UNIT_TO_METERS = {"m": 1.0, "mm": 0.001, "cm": 0.01, "km": 1000.0, "ft": 0.3048}
# shapely cap_style ints (1.x/2.x dono me kaam karta hai)
CAP_STYLES = {"round": 1, "flat": 2, "square": 3}

MAX_AREA_KM2 = 100.0
MIN_AREA_KM2 = 0.002


def bbox_km2(s, w, n, e):
    mid_lat = (s + n) / 2.0
    width_km = max(0.0, e - w) * 111.32 * math.cos(math.radians(mid_lat))
    height_km = max(0.0, n - s) * 110.574
    return width_km * height_km


# ---------------- extent clipping: data strictly bbox ke andar ----------------
def clip_geometry(geom, bbox_poly):
    """Geometry ko extent me clip karo. Bahar ka hissa hat jata hai.
    Return GeoJSON geometry ya None (poora bahar / invalid)."""
    try:
        g = shape(geom)
        if g.is_empty:
            return None
        clipped = g.intersection(bbox_poly)
    except Exception:
        return None
    if clipped.is_empty:
        return None

    parts = []
    if clipped.geom_type == "GeometryCollection":
        for p in clipped.geoms:
            if p.geom_type.startswith("Multi"):
                parts.extend(list(p.geoms))
            elif p.geom_type in ("Polygon", "LineString"):
                parts.append(p)
    elif clipped.geom_type.startswith("Multi"):
        parts.extend(list(clipped.geoms))
    elif clipped.geom_type in ("Polygon", "LineString"):
        parts.append(clipped)

    polys = [p for p in parts if p.geom_type == "Polygon"]
    lines = [p for p in parts if p.geom_type == "LineString"]
    if not polys and not lines:
        return None
    if polys and not lines:
        if len(polys) == 1:
            return mapping(polys[0])
        return {"type": "MultiPolygon", "coordinates": [mapping(p)["coordinates"] for p in polys]}
    if lines and not polys:
        if len(lines) == 1:
            return mapping(lines[0])
        return {"type": "MultiLineString", "coordinates": [mapping(p)["coordinates"] for p in lines]}
    # mixed — polygons ko prefer karo (touching lines usually boundary debris)
    return {"type": "MultiPolygon", "coordinates": [mapping(p)["coordinates"] for p in polys]}


def clip_fc(features, bbox_poly):
    """Feature list clip karo — bbox se bahar wale features drop."""
    out = []
    for f in features:
        g = clip_geometry(f.get("geometry"), bbox_poly)
        if g:
            out.append({**f, "geometry": g})
    return out


def utm_crs_for(lon, lat):
    zone = int((lon + 180.0) // 6.0) + 1
    return pyproj.CRS.from_dict({"proj": "utm", "zone": zone, "south": lat < 0, "ellps": "WGS84"})


def utm_meta(s, w, n, e):
    """Auto UTM zone detection — measurement CRS ka auto-detect."""
    lat = (s + n) / 2.0
    lon = (w + e) / 2.0
    zone = int((lon + 180.0) // 6.0) + 1
    hemi = "N" if lat >= 0 else "S"
    epsg = (32600 if hemi == "N" else 32700) + zone
    return {"zone": zone, "hemisphere": hemi, "epsg": epsg, "label": f"UTM Zone {zone}{hemi} (EPSG:{epsg})"}


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/api/health")
def health():
    return jsonify({"ok": True})


def validated_bbox(data):
    """Return (s, w, n, e, area) ya (None, (error_msg, status))."""
    try:
        s, w, n, e = (float(data[k]) for k in ("south", "west", "north", "east"))
    except (KeyError, TypeError, ValueError):
        return None, ("Invalid bounding box.", 400)
    if not (-90 <= s < n <= 90 and -180 <= w < e <= 180):
        return None, ("Bounding box out of range.", 400)
    area = bbox_km2(s, w, n, e)
    if area > MAX_AREA_KM2:
        return None, ((
            f"Selected area too large ({area:.0f} km²). "
            f"Please select a smaller area (max {MAX_AREA_KM2:.0f} km²)."
        ), 400)
    if area < MIN_AREA_KM2:
        return None, ("Selected area too small — drag a bigger rectangle.", 400)
    return (s, w, n, e, area), None


def fetch_overpass(query):
    """Overpass se query chalao (mirror fallback ke saath). Result ya (None, error)."""
    last_err = None
    for url in OVERPASS_ENDPOINTS:
        try:
            resp = requests.post(
                url, data={"data": query}, timeout=180,
                headers={"User-Agent": "RoadBufferTool/1.0 (local GIS tool)"},
            )
            if resp.status_code == 200:
                return resp.json(), None
            last_err = f"HTTP {resp.status_code}"
        except Exception as exc:
            last_err = str(exc)
    return None, f"Overpass API not reachable ({last_err}). Try again in a moment."


@app.route("/api/extract", methods=["POST"])
def extract():
    data = request.get_json(force=True, silent=True) or {}
    bbox, err = validated_bbox(data)
    if err:
        return jsonify({"error": err[0]}), err[1]
    s, w, n, e, area = bbox
    filt = '["highway"]'
    query = f'[out:json][timeout:120];way{filt}({s},{w},{n},{e});out geom;'

    payload, oerr = fetch_overpass(query)
    if oerr:
        return jsonify({"error": oerr}), 502

    bbox_poly = shp_box(w, s, e, n)  # strict extent clipping
    features = []
    for el in payload.get("elements", []):
        geom = el.get("geometry") or []
        if len(geom) < 2:
            continue
        tags = el.get("tags", {})
        line = {"type": "LineString", "coordinates": [[p["lon"], p["lat"]] for p in geom]}
        clipped = clip_geometry(line, bbox_poly)
        if not clipped:
            continue  # extent ke andar ka hissa nahi
        features.append({
            "type": "Feature",
            "geometry": clipped,
            "properties": {"osm_id": el.get("id"), "name": tags.get("name", ""), "highway": tags.get("highway", "")},
        })

    total_len_m = 0.0
    if features:
        fwd = pyproj.Transformer.from_crs(
            "EPSG:4326", utm_crs_for((w + e) / 2.0, (s + n) / 2.0), always_xy=True)
        for f in features:
            try:
                total_len_m += transform(fwd.transform, shape(f["geometry"])).length
            except Exception:
                pass

    return jsonify({
        "type": "FeatureCollection",
        "features": features,
        "meta": {"count": len(features), "length_km": total_len_m / 1000.0, "area_km2": area,
                 "utm": utm_meta(s, w, n, e)},
    })


def _close_ring(coords):
    if coords[0] != coords[-1]:
        coords.append(list(coords[0]))
    return coords


# polygon/line extract karne ke liye Overpass filters
WATER_LINE_TYPES = ("river", "stream", "canal", "ditch", "drain", "channel")
POLY_KINDS = {
    "building": {
        "query": '(way["building"]({b});relation["building"]({b});)',
        "tag": "building",
        "timeout": 180,
    },
    "water": {
        "query": '(way["natural"="water"]({b});relation["natural"="water"]({b});'
                 'way["waterway"]({b});)',
        "tag": "water",
        "timeout": 180,
    },
    "nature": {
        "query": '(way["natural"]({b});relation["natural"]({b});'
                 'way["landuse"]({b});relation["landuse"]({b});)',
        "tag": "natural",
        "timeout": 240,
    },
}


@app.route("/api/extract-poly", methods=["POST"])
def extract_poly():
    """Buildings / water broad extract — sub-category filtering client-side hoti hai."""
    data = request.get_json(force=True, silent=True) or {}
    kind = data.get("kind", "building")
    if kind not in POLY_KINDS:
        kind = "building"
    bbox, err = validated_bbox(data)
    if err:
        return jsonify({"error": err[0]}), err[1]
    s, w, n, e, area = bbox

    cfg = POLY_KINDS[kind]
    query = f'[out:json][timeout:{cfg["timeout"]}];{cfg["query"].format(b=f"{s},{w},{n},{e}")};out geom;'

    payload, oerr = fetch_overpass(query)
    if oerr:
        return jsonify({"error": oerr}), 502

    bbox_poly = shp_box(w, s, e, n)  # strict extent clipping
    tag = cfg["tag"]
    features = []
    for el in payload.get("elements", []):
        tags = el.get("tags", {})
        props = {"osm_id": el.get("id"), "name": tags.get("name", ""), tag: tags.get(tag, "yes")}
        if kind == "nature":
            props["natural"] = tags.get("natural", "")
            props["landuse"] = tags.get("landuse", "")
            if tags.get("natural") == "water" or tags.get("waterway"):
                continue  # water features Water category me aate hain — duplicate skip

        # water lines (river/stream/canal...) — LineString features (riverbank=area, wo poly me jayega)
        if kind == "water" and tags.get("waterway") and tags.get("waterway") != "riverbank" \
                and tags.get("natural") != "water":
            geom = el.get("geometry") or []
            if el.get("type") != "way" or len(geom) < 2:
                continue
            clipped = clip_geometry({"type": "LineString",
                                     "coordinates": [[p["lon"], p["lat"]] for p in geom]}, bbox_poly)
            if not clipped:
                continue
            features.append({"type": "Feature",
                             "geometry": clipped,
                             "properties": {**props, "water": tags.get("waterway")}})
            continue

        if el.get("type") == "way":
            geom = el.get("geometry") or []
            if len(geom) < 3:
                continue
            coords = _close_ring([[p["lon"], p["lat"]] for p in geom])
            clipped = clip_geometry({"type": "Polygon", "coordinates": [coords]}, bbox_poly)
            if not clipped:
                continue
            features.append({"type": "Feature",
                             "geometry": clipped,
                             "properties": props})

        elif el.get("type") == "relation":
            # relation ko outer ways ke simple polygons ke roop me flatten karo
            outer_idx = 0
            for m in el.get("members", []):
                if m.get("role") != "outer":
                    continue
                mg = m.get("geometry") or []
                if len(mg) < 3:
                    continue
                coords = _close_ring([[p["lon"], p["lat"]] for p in mg])
                clipped = clip_geometry({"type": "Polygon", "coordinates": [coords]}, bbox_poly)
                if not clipped:
                    continue
                outer_idx += 1
                features.append({"type": "Feature",
                                 "geometry": clipped,
                                 "properties": {**props, "osm_id": f"{el.get('id')}/{outer_idx}"}})

    total_area_m2 = 0.0
    total_len_m = 0.0
    if features:
        fwd = pyproj.Transformer.from_crs(
            "EPSG:4326", utm_crs_for((w + e) / 2.0, (s + n) / 2.0), always_xy=True)
        for f in features:
            try:
                g = transform(fwd.transform, shape(f["geometry"]))
                if g.geom_type in ("Polygon", "MultiPolygon"):
                    total_area_m2 += g.area
                elif g.geom_type in ("LineString", "MultiLineString"):
                    total_len_m += g.length
            except Exception:
                pass

    return jsonify({
        "type": "FeatureCollection",
        "features": features,
        "meta": {"count": len(features), "area_m2": total_area_m2, "length_km": total_len_m / 1000.0,
                 "area_km2": area, "utm": utm_meta(s, w, n, e)},
    })


# ---------------- local data mode: area ka data ek baar download, phir offline ----------------
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "local_cache")

LOCAL_QUERY = ('[out:json][timeout:300];('
               'way["highway"]({b});'
               'way["building"]({b});relation["building"]({b});'
               'way["natural"="water"]({b});relation["natural"="water"]({b});'
               'way["waterway"]({b});'
               'way["natural"]({b});relation["natural"]({b});'
               'way["landuse"]({b});relation["landuse"]({b});'
               ');out geom;')


def parse_osm_elements(elements):
    """Overpass elements ko 5 alag FeatureCollections me todo (roads/buildings/waterPoly/waterLine/nature)."""
    roads, buildings, water_poly, water_line, nature = [], [], [], [], []

    def way_line(geom, props):
        return {"type": "Feature",
                "geometry": {"type": "LineString", "coordinates": [[p["lon"], p["lat"]] for p in geom]},
                "properties": props}

    def way_poly(geom, props):
        if len(geom) < 3:
            return None
        coords = _close_ring([[p["lon"], p["lat"]] for p in geom])
        return {"type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [coords]},
                "properties": props}

    for el in elements:
        tags = el.get("tags", {})
        etype = el.get("type")
        geom = el.get("geometry") or []
        osm_id = el.get("id")

        if etype == "way" and tags.get("highway") and len(geom) >= 2:
            roads.append(way_line(geom, {"osm_id": osm_id, "name": tags.get("name", ""),
                                         "highway": tags.get("highway", "")}))

        if tags.get("building"):
            if etype == "way":
                f = way_poly(geom, {"osm_id": osm_id, "name": tags.get("name", ""),
                                    "building": tags.get("building", "yes")})
                if f:
                    buildings.append(f)
            elif etype == "relation":
                idx = 0
                for m in el.get("members", []):
                    if m.get("role") != "outer":
                        continue
                    mg = m.get("geometry") or []
                    f = way_poly(mg, {"osm_id": f"{osm_id}/{idx + 1}", "name": tags.get("name", ""),
                                      "building": tags.get("building", "yes")})
                    idx += 1
                    if f:
                        buildings.append(f)

        if tags.get("natural") == "water" or tags.get("waterway") == "riverbank":
            if etype == "way":
                f = way_poly(geom, {"osm_id": osm_id, "name": tags.get("name", ""),
                                    "water": tags.get("water", "yes")})
                if f:
                    water_poly.append(f)
            elif etype == "relation":
                idx = 0
                for m in el.get("members", []):
                    if m.get("role") != "outer":
                        continue
                    mg = m.get("geometry") or []
                    f = way_poly(mg, {"osm_id": f"{osm_id}/{idx + 1}", "name": tags.get("name", ""),
                                      "water": tags.get("water", "yes")})
                    idx += 1
                    if f:
                        water_poly.append(f)
        elif etype == "way" and tags.get("waterway") and len(geom) >= 2:
            water_line.append(way_line(geom, {"osm_id": osm_id, "name": tags.get("name", ""),
                                              "waterway": tags.get("waterway", "")}))

        # natural / landuse polygons (water features Water collection me hain — yahan skip)
        if etype == "way" and (tags.get("natural") or tags.get("landuse")) \
                and tags.get("natural") != "water" and not tags.get("waterway") and len(geom) >= 3:
            f = way_poly(geom, {"osm_id": osm_id, "name": tags.get("name", ""),
                                "natural": tags.get("natural", ""), "landuse": tags.get("landuse", "")})
            if f:
                nature.append(f)
        elif etype == "relation" and (tags.get("natural") or tags.get("landuse")) \
                and tags.get("natural") != "water" and not tags.get("waterway"):
            idx = 0
            for m in el.get("members", []):
                if m.get("role") != "outer":
                    continue
                mg = m.get("geometry", [])
                f = way_poly(mg, {"osm_id": f"{osm_id}/{idx + 1}", "name": tags.get("name", ""),
                                  "natural": tags.get("natural", ""), "landuse": tags.get("landuse", "")})
                idx += 1
                if f:
                    nature.append(f)

    return {
        "roads": {"type": "FeatureCollection", "features": roads},
        "buildings": {"type": "FeatureCollection", "features": buildings},
        "waterPoly": {"type": "FeatureCollection", "features": water_poly},
        "waterLine": {"type": "FeatureCollection", "features": water_line},
        "nature": {"type": "FeatureCollection", "features": nature},
    }


@app.route("/api/local/download", methods=["POST"])
def local_download():
    """Selected area ka poora OSM data ek baar me download karke local cache me save karo."""
    data = request.get_json(force=True, silent=True) or {}
    bbox, err = validated_bbox(data)
    if err:
        return jsonify({"error": err[0]}), err[1]
    s, w, n, e, area = bbox

    payload, oerr = fetch_overpass(LOCAL_QUERY.format(b=f"{s},{w},{n},{e}"))
    if oerr:
        return jsonify({"error": oerr}), 502

    parsed = parse_osm_elements(payload.get("elements", []))
    bbox_poly = shp_box(w, s, e, n)  # cache bhi strictly clipped store hota hai
    for key, fc in parsed.items():
        fc["features"] = clip_fc(fc["features"], bbox_poly)
    doc = {"bbox": {"south": s, "west": w, "north": n, "east": e}, "utm": utm_meta(s, w, n, e), **parsed}

    os.makedirs(CACHE_DIR, exist_ok=True)
    cid = f"{s:.4f}_{w:.4f}_{n:.4f}_{e:.4f}"
    out_path = os.path.join(CACHE_DIR, f"{cid}.json")
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh)

    counts = {k: len(v["features"]) for k, v in parsed.items()}
    return jsonify({"id": cid, "counts": counts, "utm": doc["utm"],
                    "bytes": os.path.getsize(out_path)})


@app.route("/api/local/get")
def local_get():
    import re
    cid = request.args.get("id", "")
    if not re.fullmatch(r"[0-9.\-_]+", cid or ""):
        return jsonify({"error": "Invalid cache id."}), 400
    path = os.path.join(CACHE_DIR, f"{cid}.json")
    if not os.path.isfile(path):
        return jsonify({"error": "Cached dataset not found — download the extent data first."}), 404
    with open(path, "r", encoding="utf-8") as fh:
        doc = json.load(fh)
    # purane (unclipped) caches bhi strict extent me serve ho — idempotent re-clip
    b = doc.get("bbox")
    if b:
        try:
            bbox_poly = shp_box(b["west"], b["south"], b["east"], b["north"])
            for key, val in doc.items():
                if isinstance(val, dict) and "features" in val:
                    val["features"] = clip_fc(val["features"], bbox_poly)
        except Exception:
            pass
    return Response(json.dumps(doc), mimetype="application/json")


@app.route("/api/local/list")
def local_list():
    import re
    out = []
    if os.path.isdir(CACHE_DIR):
        for fname in sorted(os.listdir(CACHE_DIR)):
            if not fname.endswith(".json"):
                continue
            try:
                with open(os.path.join(CACHE_DIR, fname), "r", encoding="utf-8") as fh:
                    doc = json.load(fh)
                out.append({"id": fname[:-5], "bbox": doc.get("bbox"),
                            "counts": {k: len(v["features"]) for k, v in doc.items()
                                       if isinstance(v, dict) and "features" in v}})
            except Exception:
                pass
    return jsonify(out)


@app.route("/api/local/cache-clear", methods=["POST"])
def local_cache_clear():
    """Server-side local_cache ke saare downloads delete karo (disk space)."""
    removed = 0
    if os.path.isdir(CACHE_DIR):
        for fname in os.listdir(CACHE_DIR):
            if fname.endswith(".json"):
                try:
                    os.remove(os.path.join(CACHE_DIR, fname))
                    removed += 1
                except OSError:
                    pass
    return jsonify({"ok": True, "removed": removed})


@app.route("/api/buffer", methods=["POST"])
def buffer():
    data = request.get_json(force=True, silent=True) or {}
    fc = data.get("geojson")
    if not fc or not fc.get("features"):
        return jsonify({"error": "No roads found. Extract roads first (Step 1)."}), 400

    try:
        width = float(data.get("width", 10))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid buffer width."}), 400
    unit = data.get("unit", "m")
    if unit not in UNIT_TO_METERS:
        unit = "m"
    width_m = width * UNIT_TO_METERS[unit]
    if width_m <= 0:
        return jsonify({"error": "Buffer width must be greater than 0."}), 400
    cap = CAP_STYLES.get(data.get("cap", "round"), 1)

    lines, lons, lats = [], [], []
    for f in fc["features"]:
        g = f.get("geometry") or {}
        props = f.get("properties") or {}
        gtype = g.get("type")
        if gtype not in ("LineString", "MultiLineString", "Polygon", "MultiPolygon"):
            continue
        try:
            geom_sh = shape(g)
            xmin, ymin, xmax, ymax = geom_sh.bounds
            lons.extend([xmin, xmax])
            lats.extend([ymin, ymax])
        except Exception:
            pass
        lines.append((g, props))
    if not lines:
        return jsonify({"error": "No bufferable geometry found (line/polygon)."}), 400

    # UTM zone — manual override (user-selectable) ya auto-detect
    zone_override = data.get("utm_zone")
    hemi_override = data.get("utm_south")
    if isinstance(zone_override, int) and 1 <= zone_override <= 60:
        crs = pyproj.CRS.from_dict({"proj": "utm", "zone": zone_override,
                                    "south": bool(hemi_override), "ellps": "WGS84"})
    else:
        crs = utm_crs_for(sum(lons) / len(lons), sum(lats) / len(lats))
    fwd = pyproj.Transformer.from_crs("EPSG:4326", crs, always_xy=True)
    inv = pyproj.Transformer.from_crs(crs, "EPSG:4326", always_xy=True)

    out_features = []
    for g, props in lines:
        geom_m = transform(fwd.transform, shape(g))
        poly_m = geom_m.buffer(width_m, quad_segs=8, cap_style=cap)
        poly_wgs = transform(inv.transform, poly_m)
        out_features.append({"type": "Feature", "geometry": mapping(poly_wgs), "properties": props})

    return jsonify({
        "type": "FeatureCollection",
        "features": out_features,
        "meta": {"count": len(out_features), "width_m": width_m, "unit": unit, "width": width},
    })


@app.route("/api/dissolve", methods=["POST"])
def dissolve():
    data = request.get_json(force=True, silent=True) or {}
    fc = data.get("geojson")
    polys = []
    if fc:
        for f in fc.get("features", []):
            g = f.get("geometry") or {}
            if g.get("type") in ("Polygon", "MultiPolygon"):
                try:
                    polys.append(shape(g))
                except Exception:
                    pass
    if not polys:
        return jsonify({"error": "No buffer polygons found. Create a buffer first (Step 2)."}), 400

    try:
        merged = unary_union(polys)
    except Exception:
        merged = unary_union([p.buffer(0) for p in polys])

    if merged.is_empty:
        return jsonify({"error": "Dissolve produced an empty result."}), 500

    parts_out = len(merged.geoms) if merged.geom_type in ("MultiPolygon", "GeometryCollection") else 1
    out = {
        "type": "FeatureCollection",
        "features": [{"type": "Feature", "geometry": mapping(merged),
                      "properties": {"dissolved": True, "input_parts": len(polys)}}],
        "meta": {"parts_in": len(polys), "parts_out": parts_out},
    }
    return jsonify(out)


# ---------------- export: SHP (shapefile zip) ----------------
WGS84_PRJ = (
    'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],'
    'PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]'
)


def _fc_geometry_classes(fc):
    """FC me kaun-kaun si geometry classes hain (polygon/line)."""
    has_poly = has_line = False
    for f in fc.get("features", []):
        t = (f.get("geometry") or {}).get("type")
        if t in ("Polygon", "MultiPolygon"):
            has_poly = True
        elif t in ("LineString", "MultiLineString"):
            has_line = True
    return has_poly, has_line


def _write_shapefile(out_dir, name, feats, shape_kind):
    """Ek geometry class ka shapefile set likho (.shp/.shx/.dbf/.prj)."""
    if shape_kind == "polygon":
        writer = pyshp.Writer(target=os.path.join(out_dir, name), shapeType=pyshp.POLYGON, encoding="utf-8")
    else:
        writer = pyshp.Writer(target=os.path.join(out_dir, name), shapeType=pyshp.POLYLINE, encoding="utf-8")
    writer.field("osm_id", "C", 12)
    writer.field("name", "C", 60)
    writer.field("ftype", "C", 16)

    for f in feats:
        g = f.get("geometry") or {}
        props = f.get("properties") or {}
        if shape_kind == "polygon":
            if g.get("type") == "Polygon":
                parts = [list(map(list, ring)) for ring in g["coordinates"]]
            elif g.get("type") == "MultiPolygon":
                parts = [list(map(list, ring)) for poly in g["coordinates"] for ring in poly]
            else:
                continue
            writer.poly(parts)
        else:
            if g.get("type") == "LineString":
                lines = [list(map(list, g["coordinates"]))]
            elif g.get("type") == "MultiLineString":
                lines = [list(map(list, line)) for line in g["coordinates"]]
            else:
                continue
            writer.line(lines)

        ftype = (props.get("highway") or props.get("building") or props.get("water")
                 or props.get("waterway") or props.get("natural") or "")
        writer.record(str(props.get("osm_id", ""))[:12], str(props.get("name", ""))[:60], str(ftype)[:16])

    writer.close()
    with open(os.path.join(out_dir, name + ".prj"), "w") as prj:
        prj.write(WGS84_PRJ)


@app.route("/api/export/shp", methods=["POST"])
def export_shp():
    if pyshp is None:
        return jsonify({"error": "pyshp installed nahi hai — server pe 'pip install pyshp' chalao."}), 500
    data = request.get_json(force=True, silent=True) or {}
    fc = data.get("geojson")
    if not fc or not fc.get("features"):
        return jsonify({"error": "Export karne ke liye kuch nahi hai — pehle extract karo."}), 400
    name = "".join(c for c in str(data.get("name", "export")) if c.isalnum() or c in "-_")[:40] or "export"

    has_poly, has_line = _fc_geometry_classes(fc)
    if not has_poly and not has_line:
        return jsonify({"error": "Shapefile support wali geometry (line/polygon) nahi mili."}), 400

    poly_feats = [f for f in fc["features"] if (f.get("geometry") or {}).get("type") in ("Polygon", "MultiPolygon")]
    line_feats = [f for f in fc["features"] if (f.get("geometry") or {}).get("type") in ("LineString", "MultiLineString")]

    with tempfile.TemporaryDirectory() as tmp:
        if has_poly:
            _write_shapefile(tmp, f"{name}_poly", poly_feats, "polygon")
        if has_line:
            _write_shapefile(tmp, f"{name}_line", line_feats, "line")
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for fname in sorted(os.listdir(tmp)):
                with open(os.path.join(tmp, fname), "rb") as fh:
                    zf.writestr(fname, fh.read())
    buf.seek(0)
    return Response(buf.read(), mimetype="application/zip",
                    headers={"Content-Disposition": f"attachment; filename={name}_shapefile.zip"})


# ---------------- export: SVG (true vector, geometry se) ----------------
def _svg_string(fc, stroke="#333333", fill="#cccccc", fill_opacity=0.45, stroke_width=1.2):
    """FeatureCollection ka standalone SVG string (bounds auto-fit)."""
    lons, lats = [], []
    for f in fc.get("features", []):
        for ring_or_line in _iter_coords((f.get("geometry") or {})):
            for lon, lat in ring_or_line:
                lons.append(lon)
                lats.append(lat)
    if not lons:
        raise ValueError("Geometry nahi mili.")

    w, e, s, n = min(lons), max(lons), min(lats), max(lats)
    cosf = max(0.2, math.cos(math.radians((s + n) / 2.0)))
    width_px = 1600
    height_px = int(min(5000, max(120, width_px * (n - s) / max(1e-9, (e - w) * cosf))))
    kx = width_px / max(1e-9, e - w)
    ky = height_px / max(1e-9, n - s)

    def path_d(gtype, coords_sets):
        d = []
        for ring in coords_sets:
            pts = [f"{(lon - w) * kx:.1f},{(n - lat) * ky:.1f}" for lon, lat in ring]
            d.append("M" + "L".join(pts) + ("Z" if gtype in ("Polygon", "MultiPolygon") else ""))
        return "".join(d)

    paths = []
    for f in fc.get("features", []):
        g = f.get("geometry") or {}
        gtype = g.get("type")
        if gtype in ("Polygon", "MultiPolygon"):
            rings = g["coordinates"] if gtype == "Polygon" else [r for poly in g["coordinates"] for r in poly]
            paths.append(f'<path d="{path_d("Polygon", rings)}" fill="{fill}" fill-opacity="{fill_opacity}" '
                         f'stroke="{stroke}" stroke-width="{stroke_width}"/>')
        elif gtype in ("LineString", "MultiLineString"):
            lines = [g["coordinates"]] if gtype == "LineString" else g["coordinates"]
            paths.append(f'<path d="{path_d("LineString", lines)}" fill="none" '
                         f'stroke="{stroke}" stroke-width="{stroke_width}"/>')

    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width_px}" height="{height_px}" '
            f'viewBox="0 0 {width_px} {height_px}">'
            f'<rect width="{width_px}" height="{height_px}" fill="#ffffff"/>' + "".join(paths) + "</svg>")


@app.route("/api/export/svg", methods=["POST"])
def export_svg():
    data = request.get_json(force=True, silent=True) or {}
    fc = data.get("geojson")
    if not fc or not fc.get("features"):
        return jsonify({"error": "Export karne ke liye kuch nahi hai — pehle extract karo."}), 400
    name = "".join(c for c in str(data.get("name", "export")) if c.isalnum() or c in "-_")[:40] or "export"
    stroke_width = float(data.get("stroke_width", 1.2))

    try:
        svg = _svg_string(
            fc,
            stroke=str(data.get("stroke", "#333333")),
            fill=str(data.get("fill", "#cccccc")),
            fill_opacity=float(data.get("fill_opacity", 0.45)),
            stroke_width=stroke_width,
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return Response(svg, mimetype="image/svg+xml",
                    headers={"Content-Disposition": f"attachment; filename={name}.svg"})


# ---------------- export: all-in-one ZIP (sab layers + stages ek saath) ----------------
@app.route("/api/export/all", methods=["POST"])
def export_all():
    """Sabhi available datasets ek hi zip me — har ek ka GeoJSON + Shapefile + SVG apne folder me."""
    if pyshp is None:
        return jsonify({"error": "pyshp installed nahi hai — server pe 'pip install pyshp' chalao."}), 500
    data = request.get_json(force=True, silent=True) or {}
    entries = data.get("exports") or []
    if not entries:
        return jsonify({"error": "Export karne ke liye kuch nahi hai — pehle extract karo."}), 400
    root = "".join(c for c in str(data.get("name", "export-all")) if c.isalnum() or c in "-_")[:40] or "export-all"

    with tempfile.TemporaryDirectory() as tmp:
        manifest = [
            f"{root} — OSM Extract & Buffer Tool (all-in-one export)",
            "CRS: WGS 84 (EPSG:4326) — QGIS me directly khulta hai",
            "Har folder me: .geojson + shapefile (.shp/.shx/.dbf/.prj) + .svg",
            "",
        ]
        written = 0
        for ent in entries:
            fc = ent.get("geojson")
            if not fc or not fc.get("features"):
                continue
            name = "".join(c for c in str(ent.get("name", "layer")) if c.isalnum() or c in "-_")[:40] or "layer"
            sub = os.path.join(tmp, name)
            os.makedirs(sub, exist_ok=True)

            with open(os.path.join(sub, name + ".geojson"), "w", encoding="utf-8") as fh:
                json.dump(fc, fh)

            poly_feats = [f for f in fc["features"] if (f.get("geometry") or {}).get("type") in ("Polygon", "MultiPolygon")]
            line_feats = [f for f in fc["features"] if (f.get("geometry") or {}).get("type") in ("LineString", "MultiLineString")]
            if poly_feats:
                _write_shapefile(sub, name + "_poly", poly_feats, "polygon")
            if line_feats:
                _write_shapefile(sub, name + "_line", line_feats, "line")

            style = ent.get("style") or {}
            try:
                svg = _svg_string(
                    fc,
                    stroke=str(style.get("stroke", "#333333")),
                    fill=str(style.get("fill", "#cccccc")),
                    fill_opacity=float(style.get("fill_opacity", 0.45)),
                )
                with open(os.path.join(sub, name + ".svg"), "w", encoding="utf-8") as fh:
                    fh.write(svg)
            except (ValueError, TypeError):
                pass

            manifest.append(f"{name}/  — {len(fc['features'])} features")
            written += 1

        if not written:
            return jsonify({"error": "Koi valid data nahi mila export ke liye."}), 400

        with open(os.path.join(tmp, "README.txt"), "w", encoding="utf-8") as fh:
            fh.write("\n".join(manifest) + "\n")

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for dirpath, _dirs, files in os.walk(tmp):
                for fname in sorted(files):
                    full = os.path.join(dirpath, fname)
                    with open(full, "rb") as fh:
                        zf.writestr(os.path.relpath(full, tmp), fh.read())

    buf.seek(0)
    return Response(buf.read(), mimetype="application/zip",
                    headers={"Content-Disposition": f"attachment; filename={root}.zip"})


# ---------------- GIS digitizing: split polygon by line (shapely — planar exact) ----------------
@app.route("/api/gis/clip", methods=["POST"])
def gis_clip():
    """Kisi bhi FeatureCollection set ko bbox me clip karo (browser saved copies ke liye)."""
    data = request.get_json(force=True, silent=True) or {}
    b = data.get("bbox") or {}
    try:
        bbox_poly = shp_box(float(b["west"]), float(b["south"]), float(b["east"]), float(b["north"]))
    except Exception:
        return jsonify({"error": "Invalid bbox."}), 400
    fc = data.get("geojson")
    if not isinstance(fc, dict):
        return jsonify({"error": "geojson required."}), 400
    out = {}
    for key, val in fc.items():
        if isinstance(val, dict) and "features" in val:
            out[key] = {**val, "features": clip_fc(val["features"], bbox_poly)}
    return jsonify(out)


@app.route("/api/gis/split", methods=["POST"])
def gis_split():
    data = request.get_json(force=True, silent=True) or {}
    try:
        poly = shape(data.get("polygon") or {})
        cutter = shape(data.get("line") or {})
    except Exception:
        return jsonify({"error": "Invalid geometry."}), 400
    if poly.geom_type not in ("Polygon", "MultiPolygon"):
        return jsonify({"error": "Split karne ke liye polygon chahiye."}), 400
    if cutter.geom_type not in ("LineString", "MultiLineString"):
        return jsonify({"error": "Cutting line chahiye (LineString)."}), 400

    try:
        pieces = shapely_split(poly, cutter)
    except Exception as exc:
        return jsonify({"error": f"Split fail: {exc}"}), 400

    polys = []
    def _collect(g):
        if g.geom_type == "Polygon":
            polys.append(g)
        elif g.geom_type == "MultiPolygon":
            polys.extend(list(g.geoms))
    if pieces.geom_type == "GeometryCollection":
        for g in pieces.geoms:
            _collect(g)
    else:
        _collect(pieces)

    if len(polys) < 2:
        return jsonify({"error": "Line polygon ko poora cross nahi kar rahi — "
                                 "line ko polygon ke dono taraf boundary se bahar tak kheencho."}), 400

    features = [{"type": "Feature", "geometry": mapping(p), "properties": {"split": True}}
                for p in polys]
    return jsonify({"type": "FeatureCollection", "features": features, "meta": {"parts": len(polys)}})


def _iter_coords(geometry):
    """Geometry ke saare rings/lines yield karo."""
    gtype = geometry.get("type")
    if gtype == "Polygon":
        yield from geometry["coordinates"]
    elif gtype == "MultiPolygon":
        for poly in geometry["coordinates"]:
            yield from poly
    elif gtype == "LineString":
        yield geometry["coordinates"]
    elif gtype == "MultiLineString":
        yield from geometry["coordinates"]


# ---------------- clean JSON errors (405/404 ko bhi JSON me jawab do) ----------------
@app.errorhandler(405)
def _err_405(_e):
    return jsonify({"error": "Wrong request method for this endpoint."}), 405


@app.errorhandler(404)
def _err_404(_e):
    return jsonify({"error": "Unknown endpoint."}), 404


if __name__ == "__main__":
    env_port = os.environ.get("PORT")
    if env_port:
        # live deployment (Render/Railway/VPS): PORT env set hota hai, sab network interfaces pe suno
        port = int(env_port)
        host = os.environ.get("HOST", "0.0.0.0")
    else:
        import socket

        host = "127.0.0.1"
        port = 5000
        for p in (5000, 5001, 8000, 8080):
            with socket.socket() as s:
                try:
                    s.bind((host, p))
                    port = p
                    break
                except OSError:
                    continue

    print(f"\nOSM Extract & Buffer Tool running ->  http://127.0.0.1:{port}\n")

    try:
        from waitress import serve
        serve(app, host=host, port=port, threads=8)
    except ImportError:
        app.run(host=host, port=port, debug=False)
