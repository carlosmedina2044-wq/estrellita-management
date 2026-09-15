"""
Render layered 2D home portraits from the Kenney suburban kit.

Usage:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/blender/portraits/render.py -- \\
    --type a|all --palette classic|terracotta|slate|all --layer day|night|lit|shadow|foliage|snow|all \\
    --season spring|summer|autumn|winter --only-missing 1 --samples 192
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from collections import defaultdict, deque
from pathlib import Path

import bpy
from mathutils import Vector

REPO = Path(__file__).resolve().parents[3]
KIT_ROOT = REPO / "tools/blender/vendor/kenney-city-kit-suburban/Models/GLB format"
COLORMAPS = REPO / "tools/blender/portraits/colormaps"
KIT_JSON = REPO / "tools/blender/portraits/kit.json"
PNG_OUT = REPO / "tools/blender/out/portraits"
MANIFEST_PATH = REPO / "src/lib/scene/portrait-manifest.json"
CONTACT_OUT = REPO / "tools/blender/portraits"

FRAME_W = 780
FRAME_H = 560  # ~house.webp aspect-ish with ground room
SEASONS = {
    "spring": (0x7f / 255, 0xae / 255, 0x4f / 255, 1.0),
    "summer": (0x4f / 255, 0x8a / 255, 0x3b / 255, 1.0),
    "autumn": (0xc8 / 255, 0x74 / 255, 0x2e / 255, 1.0),
    "winter": None,  # hide leaf faces
}
SKY = {
    "day": ("#8fb8e8", "#c9dcf0", "#eef2f0"),
    "night": ("#0f1626", "#1a2238", "#2a2f45"),
}


def argv_after_double_dash():
    if "--" in sys.argv:
        return sys.argv[sys.argv.index("--") + 1 :]
    return []


def hex_rgb(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))


def clear_scene():
    # Avoid read_factory_settings mid-batch — it re-inits Metal and can segfault.
    scene = bpy.context.scene
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for col in list(bpy.data.collections):
        if col != scene.collection:
            bpy.data.collections.remove(col)
    for block in (
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.lights,
        bpy.data.cameras,
        bpy.data.worlds,
        bpy.data.images,
    ):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def import_glb(path: Path, collection_name: str):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [o for o in bpy.data.objects if o not in before]
    col = bpy.data.collections.new(collection_name)
    bpy.context.scene.collection.children.link(col)
    for o in imported:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        col.objects.link(o)
    return col, imported


def mesh_objects(collection):
    return [o for o in collection.objects if o.type == "MESH"]


def world_bounds(objects):
    minc = Vector((1e9, 1e9, 1e9))
    maxc = Vector((-1e9, -1e9, -1e9))
    for o in objects:
        for corner in o.bound_box:
            w = o.matrix_world @ Vector(corner)
            minc = Vector((min(minc.x, w.x), min(minc.y, w.y), min(minc.z, w.z)))
            maxc = Vector((max(maxc.x, w.x), max(maxc.y, w.y), max(maxc.z, w.z)))
    return minc, maxc


def configure_cycles(samples: int):
    # Judgment call: EEVEE for the 273-frame batch (Cycles hung under a stale GPU process).
    # Clay look still reads; samples arg kept for CLI compatibility.
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = FRAME_W
    scene.render.resolution_percentage = 100
    scene.render.resolution_y = FRAME_H
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "None"
    # Soft shadows / AO if available on EEVEE Next.
    eevee = getattr(scene, "eevee", None)
    if eevee is not None:
        if hasattr(eevee, "taa_render_samples"):
            eevee.taa_render_samples = max(16, min(64, samples // 2))
        if hasattr(eevee, "use_gtao"):
            eevee.use_gtao = True
        if hasattr(eevee, "gtao_distance"):
            eevee.gtao_distance = 1.0


def setup_world(phase: str, strength=0.6):
    world = bpy.data.worlds.new("PortraitWorld")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    top, mid, horizon = [hex_rgb(c) for c in SKY[phase]]
    # Single mid colour is enough for transparent-film stills; keeps noise down.
    bg.inputs["Color"].default_value = (*mid, 1.0)
    bg.inputs["Strength"].default_value = strength
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def setup_lights(phase: str):
    # Key sun from camera-left.
    sun_data = bpy.data.lights.new("KeySun", "SUN")
    sun_data.color = hex_rgb("#fff1dc")
    sun_data.angle = math.radians(3)
    if phase == "night":
        sun_data.energy = 0.0
    else:
        sun_data.energy = 3.0
    sun = bpy.data.objects.new("KeySun", sun_data)
    bpy.context.collection.objects.link(sun)
    # elevation 35°, azimuth ~ camera-left of three-quarter.
    sun.rotation_euler = (math.radians(55), 0, math.radians(40))

    if phase == "night":
        moon = bpy.data.lights.new("Moon", "SUN")
        moon.color = hex_rgb("#8fa3ff")
        moon.energy = 0.3
        moon.angle = math.radians(2)
        mo = bpy.data.objects.new("Moon", moon)
        bpy.context.collection.objects.link(mo)
        mo.rotation_euler = (math.radians(70), 0, math.radians(-20))

    # Soft fill from camera-right.
    area = bpy.data.lights.new("Fill", "AREA")
    area.energy = 0.4 if phase == "day" else 0.15
    area.size = 6.0
    area.color = hex_rgb("#fff8ee")
    ao = bpy.data.objects.new("Fill", area)
    bpy.context.collection.objects.link(ao)
    ao.location = (2.5, -2.0, 2.2)
    ao.rotation_euler = (math.radians(60), 0, math.radians(-35))

    # AO via world — Cycles uses scene.eevee AO not applicable; rely on soft fill.


def setup_camera(house_objects):
    minc, maxc = world_bounds(house_objects)
    center = (minc + maxc) / 2
    size = maxc - minc
    # Three-quarter front: azimuth ~22° left of frontal (-Y), elevation ~16°.
    span = max(size.x, size.y, size.z)
    dist = span * 3.15
    elev = math.radians(16)
    azim = math.radians(22)  # left of frontal when viewing toward +Y from -Y
    loc = Vector(
        (
            center.x - dist * math.cos(elev) * math.sin(azim),
            center.y - dist * math.cos(elev) * math.cos(azim),
            center.z + dist * math.sin(elev) + span * 0.08,
        )
    )

    cam_data = bpy.data.cameras.new("PortraitCam")
    cam_data.lens = 50
    cam_data.sensor_width = 36
    cam = bpy.data.objects.new("PortraitCam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = loc
    # Aim slightly below geometric center so ~6% of frame is ground under the footprint.
    target = Vector((center.x, center.y, minc.z + size.z * 0.42))
    cam.rotation_euler = (target - loc).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    bpy.context.view_layer.update()
    return cam


def apply_clay_colormap(objects, palette: str):
    cmap_path = COLORMAPS / f"{palette}.png"
    img = bpy.data.images.load(str(cmap_path), check_existing=True)
    for o in objects:
        if o.type != "MESH":
            continue
        for slot in o.material_slots:
            mat = slot.material
            if not mat or not mat.use_nodes:
                continue
            nt = mat.node_tree
            # Find image texture nodes; replace image with palette.
            principled = None
            for n in nt.nodes:
                if n.type == "TEX_IMAGE":
                    n.image = img
                    n.interpolation = "Closest"
                if n.type == "BSDF_PRINCIPLED":
                    principled = n
            if principled:
                principled.inputs["Roughness"].default_value = 0.7
                # Light noise bump via existing Normal if free; skip if complex.


# Kenney variation glass cells (linear 0..1), plus near neighbours.
GLASS_SWATCHES = [
    (103 / 255, 148 / 255, 217 / 255),  # #6794d9
    (208 / 255, 232 / 255, 255 / 255),  # #d0e8ff
    (142 / 255, 149 / 255, 179 / 255),  # #8e95b3 cool trim sometimes used on glass edge
]


def color_dist(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def is_glass_color(rgb):
    if any(color_dist(rgb, sw) < 0.18 for sw in GLASS_SWATCHES):
        return True
    r, g, b = rgb
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    # Kenney suburban often uses cool mid greys for panes.
    cool = b >= r - 0.02 and b >= g - 0.02
    return cool and 0.22 < lum < 0.55 and (max(r, g, b) - min(r, g, b)) < 0.22


def is_foliage_color(rgb):
    r, g, b = rgb
    return g > r + 0.05 and g > b + 0.05 and 0.2 < g < 0.9


def is_door_color(rgb):
    r, g, b = rgb
    # Dark neutrals / warm darks.
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return lum < 0.22 and max(r, g, b) - min(r, g, b) < 0.15


def sample_face_color(obj, poly, img_pixels, img_w, img_h):
    mesh = obj.data
    uvs = mesh.uv_layers.active
    if not uvs:
        return (0, 0, 0)
    # Average UV of face loops.
    sx = sy = 0.0
    n = 0
    for li in poly.loop_indices:
        uv = uvs.data[li].uv
        sx += uv.x
        sy += uv.y
        n += 1
    if not n:
        return (0, 0, 0)
    u, v = sx / n, sy / n
    x = int(min(img_w - 1, max(0, u * img_w)))
    y = int(min(img_h - 1, max(0, (1 - v) * img_h)))
    i = (y * img_w + x) * 4
    return (img_pixels[i], img_pixels[i + 1], img_pixels[i + 2])


def classify_faces(house_objects, palette: str):
    img = bpy.data.images.load(str(COLORMAPS / f"{palette}.png"), check_existing=True)
    pixels = list(img.pixels)  # 0..1 floats
    w, h = img.size
    glass = []  # (obj, poly_index)
    foliage = []
    door = []
    for o in house_objects:
        mesh = o.data
        for poly in mesh.polygons:
            rgb = sample_face_color(o, poly, pixels, w, h)
            if is_glass_color(rgb):
                glass.append((o, poly.index))
            elif is_foliage_color(rgb):
                foliage.append((o, poly.index))
            elif is_door_color(rgb):
                door.append((o, poly.index))
    return glass, foliage, door, pixels


def cluster_windows(glass_faces):
    # Group by object, then connected polys sharing edges.
    by_obj = defaultdict(list)
    for o, pi in glass_faces:
        by_obj[o].append(pi)
    clusters = []
    for o, indices in by_obj.items():
        mesh = o.data
        # Keep only roughly vertical faces (window panes, not roof trim).
        vertical = []
        for pi in indices:
            n = o.matrix_world.to_3x3() @ mesh.polygons[pi].normal
            if abs(n.z) < 0.45:
                vertical.append(pi)
        if not vertical:
            continue
        edge_to_polys = defaultdict(list)
        for pi in vertical:
            poly = mesh.polygons[pi]
            for ei in poly.edge_keys:
                edge_to_polys[ei].append(pi)
        remaining = set(vertical)
        while remaining:
            start = remaining.pop()
            q = deque([start])
            comp = {start}
            while q:
                cur = q.popleft()
                for ei in mesh.polygons[cur].edge_keys:
                    for nb in edge_to_polys[ei]:
                        if nb in remaining:
                            remaining.remove(nb)
                            comp.add(nb)
                            q.append(nb)
            clusters.append((o, sorted(comp)))
    keyed = []
    for o, polys in clusters:
        c = Vector((0, 0, 0))
        for pi in polys:
            c += o.matrix_world @ o.data.polygons[pi].center
        c /= max(1, len(polys))
        keyed.append(((round(c.x, 3), -round(c.z, 3)), o, polys, c))
    keyed.sort(key=lambda t: t[0])
    return [(o, polys, c) for _, o, polys, c in keyed]


def refine_window_rects(cam, clusters):
    """Project clusters, drop tiny/huge, merge overlaps."""
    rects = []
    for o, polys, _ in clusters:
        rect = project_rect(cam, window_world_points(o, polys))
        if not rect:
            continue
        area = rect["w"] * rect["h"]
        if area < 120 or area > 12000:
            continue
        if rect["w"] < 8 or rect["h"] < 8:
            continue
        # Prefer portrait-ish or square window shapes; drop very wide trim strips.
        if rect["w"] > rect["h"] * 2.8 or rect["h"] > rect["w"] * 3.5:
            continue
        rects.append(rect)

    # Greedy merge overlapping / near rects.
    merged = []
    for r in sorted(rects, key=lambda r: (r["x"], r["y"])):
        hit = None
        for m in merged:
            if (
                r["x"] < m["x"] + m["w"] + 4
                and r["x"] + r["w"] + 4 > m["x"]
                and r["y"] < m["y"] + m["h"] + 4
                and r["y"] + r["h"] + 4 > m["y"]
            ):
                x0 = min(m["x"], r["x"])
                y0 = min(m["y"], r["y"])
                x1 = max(m["x"] + m["w"], r["x"] + r["w"])
                y1 = max(m["y"] + m["h"], r["y"] + r["h"])
                # Refuse merges that balloon into a wall-sized blob.
                if (x1 - x0) * (y1 - y0) > 14000:
                    continue
                hit = m
                break
        if hit is None:
            merged.append(dict(r))
        else:
            x0 = min(hit["x"], r["x"])
            y0 = min(hit["y"], r["y"])
            x1 = max(hit["x"] + hit["w"], r["x"] + r["w"])
            y1 = max(hit["y"] + hit["h"], r["y"] + r["h"])
            hit.update({"x": round(x0, 1), "y": round(y0, 1), "w": round(x1 - x0, 1), "h": round(y1 - y0, 1)})
    merged.sort(key=lambda r: (r["x"], r["y"]))
    return [{"id": f"w{i}", **r} for i, r in enumerate(merged)]


def project_rect(cam, world_points):
    from bpy_extras.object_utils import world_to_camera_view

    scene = bpy.context.scene
    xs, ys = [], []
    for p in world_points:
        co = world_to_camera_view(scene, cam, p)
        xs.append(co.x * FRAME_W)
        ys.append((1 - co.y) * FRAME_H)  # top-left origin for app
    if not xs:
        return None
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)
    return {
        "x": round(x0, 1),
        "y": round(y0, 1),
        "w": round(max(1.0, x1 - x0), 1),
        "h": round(max(1.0, y1 - y0), 1),
    }


def window_world_points(o, polys):
    pts = []
    mesh = o.data
    for pi in polys:
        poly = mesh.polygons[pi]
        for vi in poly.vertices:
            pts.append(o.matrix_world @ mesh.vertices[vi].co)
    return pts


def make_emission_material(name, strength=8.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (1.0, 0.92, 0.7, 1.0)
    em.inputs["Strength"].default_value = strength
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    return mat


def assign_poly_material(obj, poly_indices, mat):
    mesh = obj.data
    if mat.name not in mesh.materials:
        mesh.materials.append(mat)
    idx = list(mesh.materials).index(mat)
    for pi in poly_indices:
        mesh.polygons[pi].material_index = idx


def set_holdout(objects, enabled=True):
    for o in objects:
        o.is_holdout = enabled


def hide_collection(col, hide=True):
    col.hide_render = hide
    for o in col.objects:
        o.hide_render = hide


def retint_foliage(foliage_faces, season: str):
    color = SEASONS[season]
    if color is None:
        # Winter: hide leaf faces via transparent material.
        mat = bpy.data.materials.new("WinterHide")
        mat.use_nodes = True
        nt = mat.node_tree
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        nt.links.new(tr.outputs["BSDF"], out.inputs["Surface"])
        mat.blend_method = "HASHED"
        by_obj = defaultdict(list)
        for o, pi in foliage_faces:
            by_obj[o].append(pi)
        for o, polys in by_obj.items():
            assign_poly_material(o, polys, mat)
        return
    mat = bpy.data.materials.new(f"Foliage_{season}")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = 0.85
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    by_obj = defaultdict(list)
    for o, pi in foliage_faces:
        by_obj[o].append(pi)
    for o, polys in by_obj.items():
        assign_poly_material(o, polys, mat)


def add_snow_caps(house_objects):
    # Duplicate house, keep only upward-facing faces with a white material; hide the rest.
    # Simpler: assign white emission/diffuse to faces with world normal z > 0.7.
    mat = bpy.data.materials.new("SnowCap")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (0.95, 0.97, 1.0, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.9
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    for o in house_objects:
        mesh = o.data
        snow = []
        for poly in mesh.polygons:
            n = o.matrix_world.to_3x3() @ poly.normal
            if n.z > 0.7:
                snow.append(poly.index)
        if snow:
            assign_poly_material(o, snow, mat)
    return mat


def render_to(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def load_kit():
    return json.loads(KIT_JSON.read_text())


def place_props(kit_entry, props_col_name="Props"):
    props = kit_entry.get("props") or {}
    col = bpy.data.collections.new(props_col_name)
    bpy.context.scene.collection.children.link(col)
    placed = []

    def place(model, x, y, rot_deg):
        path = KIT_ROOT / f"{model}.glb"
        if not path.exists():
            print("missing prop", path)
            return
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(path))
        imported = [o for o in bpy.data.objects if o not in before]
        for o in imported:
            for c in list(o.users_collection):
                c.objects.unlink(o)
            col.objects.link(o)
            o.location = (x, y, 0)
            o.rotation_euler[2] = math.radians(rot_deg)
            placed.append(o)

    for key in ("fence", "path", "driveway", "planter"):
        spec = props.get(key)
        if not spec:
            continue
        place(spec["model"], spec["x"], spec["y"], spec.get("rot", 0))
    for tree in props.get("trees") or []:
        place(tree["model"], tree["x"], tree["y"], tree.get("rot", 0))
    return col, placed


def find_chimney_top(house_objects):
    # Highest local peak that is thin — approximate: max Z vertex, if isolated.
    best = None
    best_z = -1e9
    for o in house_objects:
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            if w.z > best_z:
                best_z = w.z
                best = w.copy()
    minc, maxc = world_bounds(house_objects)
    if best is None:
        return None
    # Chimney if peak is notably above roof average.
    if best_z < minc.z + (maxc.z - minc.z) * 0.92:
        return None
    return best


def build_and_render(kit_type: str, palette: str, layer: str, season: str, samples: int, only_missing: bool):
    kit = load_kit()
    entry = kit[kit_type]

    if layer == "foliage":
        out_name = f"{kit_type}-{season}.png"
    elif layer in ("lit", "shadow", "snow"):
        out_name = f"{kit_type}-{layer}.png"
    else:
        out_name = f"{kit_type}-{palette}-{layer}.png"
    out_path = PNG_OUT / out_name
    if only_missing and out_path.exists() and out_path.stat().st_size > 1000:
        print("skip", out_name)
        return None

    clear_scene()
    configure_cycles(samples)
    phase = "night" if layer == "night" else "day"
    setup_world(phase, strength=0.35 if phase == "night" else 0.6)
    setup_lights("night" if layer == "night" else "day")

    house_col, house_objs = import_glb(KIT_ROOT / f"building-type-{kit_type}.glb", "House")
    house_meshes = mesh_objects(house_col)
    apply_clay_colormap(house_meshes, palette)

    props_col, prop_objs = place_props(entry)
    prop_meshes = [o for o in prop_objs if o.type == "MESH"]
    apply_clay_colormap(prop_meshes, palette)

    tree_objs = [o for o in prop_meshes if "tree" in o.name.lower()]
    non_tree_props = [o for o in prop_meshes if o not in tree_objs]

    cam = setup_camera(house_meshes)
    glass, foliage, door, _ = classify_faces(house_meshes, palette)
    clusters = cluster_windows(glass)
    windows = refine_window_rects(cam, clusters)

    door_anchor = None
    if door:
        pts = []
        for o, pi in door:
            pts.extend(window_world_points(o, [pi]))
        if pts:
            c = sum(pts, Vector((0, 0, 0))) / len(pts)
            from bpy_extras.object_utils import world_to_camera_view

            co = world_to_camera_view(bpy.context.scene, cam, c)
            door_anchor = {"x": round(co.x * FRAME_W, 1), "y": round((1 - co.y) * FRAME_H, 1)}

    chimney = find_chimney_top(house_meshes)
    chimney_anchor = None
    if chimney is not None:
        from bpy_extras.object_utils import world_to_camera_view

        co = world_to_camera_view(bpy.context.scene, cam, chimney)
        chimney_anchor = {"x": round(co.x * FRAME_W, 1), "y": round((1 - co.y) * FRAME_H, 1)}

    # Layer-specific visibility / materials.
    if layer == "day":
        for o in tree_objs:
            o.hide_render = True
    elif layer == "night":
        for o in tree_objs:
            o.hide_render = True
    elif layer == "lit":
        # Emission only on glass; everything else holdout.
        set_holdout(house_meshes + prop_meshes, True)
        em = make_emission_material("WindowLit", strength=12.0)
        by_obj = defaultdict(list)
        for o, pi in glass:
            by_obj[o].append(pi)
        for o, polys in by_obj.items():
            o.is_holdout = False
            assign_poly_material(o, polys, em)
        for o in prop_meshes:
            o.hide_render = True
    elif layer == "shadow":
        # Shadow catcher plane; house holdout.
        set_holdout(house_meshes + prop_meshes, True)
        for o in tree_objs:
            o.hide_render = True
        bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0.001))
        plane = bpy.context.active_object
        plane.is_shadow_catcher = True
        # Ensure sun casts shadows.
        for light in bpy.data.lights:
            if light.type == "SUN":
                light.energy = max(light.energy, 3.0)
    elif layer == "foliage":
        for o in house_meshes + non_tree_props:
            o.hide_render = True
        # Trees only; retint leaves on house bushes too if any foliage faces on house.
        retint_foliage(foliage, season)
        # Also retint tree materials roughly by replacing principled base.
        if SEASONS[season] is None:
            for o in tree_objs:
                o.hide_render = True
        else:
            color = SEASONS[season]
            for o in tree_objs:
                for slot in o.material_slots:
                    mat = slot.material
                    if not mat or not mat.use_nodes:
                        continue
                    for n in mat.node_tree.nodes:
                        if n.type == "BSDF_PRINCIPLED":
                            # Only shift greener materials.
                            bc = n.inputs["Base Color"].default_value
                            if bc[1] > bc[0] and bc[1] > bc[2]:
                                n.inputs["Base Color"].default_value = color
    elif layer == "snow":
        set_holdout(house_meshes, True)
        # Un-holdout and paint snow faces — actually snow layer is white caps with house holdout.
        # Spec: white cap on faces with normal z>0.7, house holdout.
        # So we need a duplicate: holdout original, show only snow faces.
        for o in prop_meshes:
            o.hide_render = True
        # Duplicate meshes for snow caps without holdout.
        snow_objs = []
        for o in house_meshes:
            dup = o.copy()
            dup.data = o.data.copy()
            bpy.context.collection.objects.link(dup)
            dup.is_holdout = False
            snow_objs.append(dup)
        add_snow_caps(snow_objs)
        # Hide non-snow by making default material transparent on dups — heavy-handed:
        # add_snow_caps only assigns snow faces; other faces keep holdout parent look.
        # Simpler path: don't holdout dups; transparent non-snow faces.
        tr = bpy.data.materials.new("Clear")
        tr.use_nodes = True
        nt = tr.node_tree
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        tnode = nt.nodes.new("ShaderNodeBsdfTransparent")
        nt.links.new(tnode.outputs["BSDF"], out.inputs["Surface"])
        tr.blend_method = "HASHED"
        for o in snow_objs:
            mesh = o.data
            if tr.name not in mesh.materials:
                mesh.materials.append(tr)
            clear_idx = list(mesh.materials).index(tr)
            snow_mat_idx = None
            for i, m in enumerate(mesh.materials):
                if m and m.name.startswith("SnowCap"):
                    snow_mat_idx = i
            for poly in mesh.polygons:
                if snow_mat_idx is not None and poly.material_index == snow_mat_idx:
                    continue
                poly.material_index = clear_idx

    render_to(out_path)
    print("wrote", out_path)

    minc, maxc = world_bounds(house_meshes)
    # Project house bbox to frame.
    corners = []
    for x in (minc.x, maxc.x):
        for y in (minc.y, maxc.y):
            for z in (minc.z, maxc.z):
                corners.append(Vector((x, y, z)))
    bbox = project_rect(cam, corners)

    return {
        "kitType": kit_type,
        "features": entry["features"],
        "frame": {"w": FRAME_W, "h": FRAME_H},
        "houseBounds": bbox,
        "windows": windows,
        "door": door_anchor,
        "chimney": chimney_anchor,
        "glassCount": len(glass),
        "windowCount": len(windows),
    }


def merge_manifest(meta_list):
    manifest = {}
    if MANIFEST_PATH.exists():
        try:
            manifest = json.loads(MANIFEST_PATH.read_text())
        except json.JSONDecodeError:
            manifest = {}
    for meta in meta_list:
        if not meta:
            continue
        kt = meta["kitType"]
        prev = manifest.get(kt, {})
        files = prev.get("files", {})
        # files filled by prepare-portraits; keep features/windows from latest
        manifest[kt] = {
            "features": meta["features"],
            "frame": meta["frame"],
            "houseBounds": meta["houseBounds"],
            "windows": meta["windows"],
            "door": meta["door"],
            "chimney": meta["chimney"],
            "windowCount": meta["windowCount"],
            "files": files,
        }
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")
    print("wrote", MANIFEST_PATH)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    parser = argparse.ArgumentParser()
    parser.add_argument("--type", default="all")
    parser.add_argument("--palette", default="all")
    parser.add_argument("--layer", default="all")
    parser.add_argument("--season", default="summer")
    parser.add_argument("--only-missing", default="0")
    parser.add_argument("--samples", type=int, default=192)
    args = parser.parse_args(argv_after_double_dash())

    types = list("abcdefghijklmnopqrstu") if args.type == "all" else [args.type]
    palettes = ["classic", "terracotta", "slate"] if args.palette == "all" else [args.palette]
    layers = ["day", "night", "lit", "shadow", "foliage", "snow"] if args.layer == "all" else [args.layer]
    seasons = ["spring", "summer", "autumn", "winter"] if args.season == "all" else [args.season]
    only_missing = args.only_missing in ("1", "true", "yes")

    metas = []
    for kt in types:
        # Meta from a day render (windows etc.)
        meta = None
        for layer in layers:
            if layer in ("day", "night"):
                for pal in palettes:
                    m = build_and_render(kt, pal, layer, "summer", args.samples, only_missing)
                    if m:
                        meta = m
            elif layer == "foliage":
                for season in seasons:
                    m = build_and_render(kt, "terracotta", layer, season, args.samples, only_missing)
                    if m:
                        meta = m or meta
            else:
                m = build_and_render(kt, "terracotta", layer, "summer", args.samples, only_missing)
                if m:
                    meta = m or meta
        if meta:
            metas.append(meta)
    merge_manifest(metas)


if __name__ == "__main__":
    main()
