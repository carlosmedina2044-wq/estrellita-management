"""
Render layered 2D home portraits from the Kenney suburban kit.

Renders with Cycles on the GPU (Metal/OPTIX/CUDA/HIP), falling back to CPU.

Usage:
  /Applications/Blender.app/Contents/MacOS/Blender -b -noaudio -P tools/blender/portraits/render.py -- \\
    --type a|all --palette classic|terracotta|slate|all --layer day|night|lit|shadow|foliage|snow|all \\
    --season spring|summer|autumn|winter --only-missing 1 --samples 192 --scale 1.2 --device GPU

Full set (273 frames, ~15 min on an M2 Pro; the first frame pays a one-off
Metal kernel compile of ~40s):
  ... -- --type all --palette all --layer all --season all --samples 160 --scale 1.2

Then `node scripts/prepare-portraits.mjs` to convert to webp, rebuild the
manifest and write the contact sheets. Changing --scale requires re-rendering
every layer of a type together, since the manifest's pixel anchors are per frame.
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

BASE_W = 780
BASE_H = 560  # ~house.webp aspect-ish with ground room
# --scale multiplies these. 1.0 is 780x560, which is under the 800 device px a
# 6.9" screen needs for the 62%-width stack on Today at 3x; 1.2 clears every
# current iPhone with headroom. The manifest stores frame w/h and the app works
# in fractions of it, so changing this does not move anything in the layout.
FRAME_W = BASE_W
FRAME_H = BASE_H
DEVICE = "GPU"
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


def enable_gpu():
    """Turn on the first available Cycles GPU backend; fall back to CPU."""
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
    except (KeyError, AttributeError):
        return "CPU"
    for backend in ("METAL", "OPTIX", "CUDA", "HIP", "ONEAPI"):
        try:
            prefs.compute_device_type = backend
        except TypeError:
            continue
        try:
            prefs.get_devices()
        except Exception:
            continue
        if any(d.type == backend for d in prefs.devices):
            for d in prefs.devices:
                d.use = d.type == backend
            print(f"cycles: {backend} GPU")
            return "GPU"
    print("cycles: CPU")
    return "CPU"


def set_input(node, names, value):
    """Set the first input that exists. Principled input names moved in 4.x
    (Specular -> Specular IOR Level), and this script has to run on either."""
    for name in names:
        if name in node.inputs:
            node.inputs[name].default_value = value
            return True
    return False


def configure_cycles(samples: int, device: str = "GPU"):
    """Cycles, not EEVEE.

    The earlier EEVEE fallback (Cycles hung under a stale GPU process) is most of
    why the portraits read flat: EEVEE has no Bevel node, no real GI bounce, and
    on EEVEE Next `use_gtao` no longer exists -- so the ambient occlusion this
    function used to set was silently skipped. Cycles buys rounded edge
    highlights, warm bounce into the shaded wall, and a sun shadow with a
    penumbra.
    """
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.render.resolution_x = FRAME_W
    scene.render.resolution_percentage = 100
    scene.render.resolution_y = FRAME_H
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    cy = scene.cycles
    cy.device = enable_gpu() if device.upper() == "GPU" else "CPU"
    cy.samples = samples
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.01
    cy.use_denoising = True
    try:
        cy.denoiser = "OPENIMAGEDENOISE"
    except (AttributeError, TypeError):
        pass
    # Clay and foliage need diffuse bounce; caustics only buy fireflies here.
    cy.max_bounces = 8
    cy.diffuse_bounces = 4
    cy.glossy_bounces = 4
    cy.transmission_bounces = 8
    cy.transparent_max_bounces = 8
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    cy.blur_glossy = 1.0

    # AgX keeps sunlit roofs from clipping to white (Standard did). Palette colour
    # comes from the colormap cells (scripts/portrait-palettes.mjs), never from
    # saturation boosts or painted materials; the contrast look only puts back
    # the bite AgX takes out of terracotta.
    scene.view_settings.view_transform = "AgX"
    for look in ("AgX - Medium High Contrast", "Medium High Contrast", "None"):
        try:
            scene.view_settings.look = look
            break
        except TypeError:
            continue
    if hasattr(scene.view_settings, "exposure"):
        scene.view_settings.exposure = 0.0
    if hasattr(scene.view_settings, "gamma"):
        scene.view_settings.gamma = 1.0


def aim_at(obj, target):
    """Point a light or camera down -Z at a world-space target."""
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def setup_world(phase: str, strength=0.6):
    """Vertical sky gradient used purely as an ambient source.

    film_transparent hides the sky itself, so none of this is ever seen -- it is
    light only. Cool overhead and warm near the ground is what puts a blue cast
    in the shade and a warm edge on the lit side, instead of the single uniform
    grey the flat Background colour gave.
    """
    world = bpy.data.worlds.new("PortraitWorld")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    # Name stays "Background": the lit layer mutes the world by node name.
    bg = nt.nodes.new("ShaderNodeBackground")
    top, mid, horizon = [hex_rgb(c) for c in SKY[phase]]
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "EASE"
    ramp.color_ramp.elements[0].position = 0.42
    ramp.color_ramp.elements[0].color = (*horizon, 1.0)
    ramp.color_ramp.elements[1].position = 0.80
    ramp.color_ramp.elements[1].color = (*top, 1.0)
    midstop = ramp.color_ramp.elements.new(0.58)
    midstop.color = (*mid, 1.0)
    bg.inputs["Strength"].default_value = strength
    nt.links.new(coord.outputs["Generated"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def setup_lights(phase: str):
    """Warm key, warm ground bounce, cool rim.

    Energies are Cycles watts / irradiance, not the EEVEE numbers they replace,
    so they look wildly larger for the same result.
    """
    aim = Vector((0.0, 0.0, 0.55))

    # Key sun from camera-left. ~5 degree disc: a penumbra soft enough to read as
    # illustration, tight enough that the shadow layer keeps the silhouette.
    sun_data = bpy.data.lights.new("KeySun", "SUN")
    sun_data.color = hex_rgb("#fff0d6")
    sun_data.angle = math.radians(5)
    sun_data.energy = 0.0 if phase == "night" else 4.4
    sun = bpy.data.objects.new("KeySun", sun_data)
    bpy.context.collection.objects.link(sun)
    # Elevation 37 degrees. Higher than this and the cast shadow tucks under the
    # footprint, which reads as a house floating on the page; lower and the roof
    # plane loses the light it needs to separate from the walls.
    sun.rotation_euler = (math.radians(90 - 37), 0, math.radians(38))

    if phase == "night":
        moon = bpy.data.lights.new("Moon", "SUN")
        moon.color = hex_rgb("#9fb4ff")
        moon.energy = 0.45
        moon.angle = math.radians(4)
        mo = bpy.data.objects.new("Moon", moon)
        bpy.context.collection.objects.link(mo)
        mo.rotation_euler = (math.radians(90 - 55), 0, math.radians(-25))

    # Warm bounce from low and in front, standing in for sunlit ground. This is
    # the light that keeps the shaded wall from going to mud.
    bounce_data = bpy.data.lights.new("Bounce", "AREA")
    bounce_data.shape = "RECTANGLE"
    bounce_data.size = 9.0
    bounce_data.size_y = 4.5
    bounce_data.color = hex_rgb("#ffd9ae" if phase == "day" else "#8fa6d8")
    bounce_data.energy = 26.0 if phase == "day" else 5.0
    bounce = bpy.data.objects.new("Bounce", bounce_data)
    bpy.context.collection.objects.link(bounce)
    bounce.location = (1.7, -3.6, 0.5)
    aim_at(bounce, aim)

    # Cool rim from behind camera-right: separates roof and gable from a light
    # page, which a transparent film otherwise leaves to chance.
    rim_data = bpy.data.lights.new("Rim", "AREA")
    rim_data.size = 5.5
    rim_data.color = hex_rgb("#cfe0ff")
    rim_data.energy = 30.0 if phase == "day" else 16.0
    rim = bpy.data.objects.new("Rim", rim_data)
    bpy.context.collection.objects.link(rim)
    rim.location = (-2.9, 2.7, 2.9)
    aim_at(rim, aim)


def setup_camera(house_objects, frame_objects=None):
    minc, maxc = world_bounds(house_objects)
    center = (minc + maxc) / 2
    size = maxc - minc
    # Three-quarter front: azimuth ~22° left of frontal (-Y), elevation ~16°.
    # Distance follows the widest thing in frame (fence and path included) so
    # wide types never touch the border; the aim stays on the house.
    fmin, fmax = world_bounds(frame_objects or house_objects)
    fsize = fmax - fmin
    house_span = max(size.x, size.y, size.z)
    frame_span = max(fsize.x, fsize.y, size.z)
    # House alone → 3.15× (fills ~78% of the frame); only back off when the
    # fence or path would otherwise touch the border.
    span = house_span
    dist = max(house_span * 3.15, frame_span * 2.45)
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


BEVEL_RADIUS = 0.014  # ~1% of a house span


def bevel_normal(nt):
    """Shader-only rounded edges (Cycles). Safer than a bevel modifier on kit
    topology, and it is most of what separates a moulded-toy read from flat
    facets meeting at a hard CG line."""
    bev = nt.nodes.new("ShaderNodeBevel")
    bev.inputs["Radius"].default_value = BEVEL_RADIUS
    bev.samples = 8
    return bev.outputs["Normal"]


def make_glass_material(phase: str):
    """Dark, glossy panes.

    The colormap paints windows as one flat pale-blue cell, which at portrait
    size reads as a sticker. Real roughness plus the sky gradient gives each pane
    a highlight and a dark interior instead."""
    mat = bpy.data.materials.new("WindowGlass")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    dark = (0.030, 0.038, 0.060, 1.0) if phase == "night" else (0.055, 0.075, 0.105, 1.0)
    bsdf.inputs["Base Color"].default_value = dark
    bsdf.inputs["Roughness"].default_value = 0.13
    set_input(bsdf, ("Specular IOR Level", "Specular"), 0.7)
    set_input(bsdf, ("Coat Weight",), 0.3)
    nt.links.new(bevel_normal(nt), bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


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
            principled = None
            tex = None
            for n in nt.nodes:
                if n.type == "TEX_IMAGE":
                    n.image = img
                    n.interpolation = "Closest"
                    tex = n
                if n.type == "BSDF_PRINCIPLED":
                    principled = n
            if principled:
                # Painted-plaster clay: matte, with just enough sheen that the key
                # reads as light falling on a surface rather than as a flat fill.
                principled.inputs["Roughness"].default_value = 0.52
                set_input(principled, ("Specular IOR Level", "Specular"), 0.35)
                set_input(principled, ("Sheen Weight",), 0.05)
                nt.links.new(bevel_normal(nt), principled.inputs["Normal"])
            # Base Color stays tex -> Principled: the colormap cells carry the palette.


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


# Kenney colormap cells (512×512: three 128 px bands below a 128 px unused strip,
# eight 64 px columns). Verified by probing face UVs of building-type-a/e/p:
#   panes  = band 0, col 5     door   = band 1, col 1     bushes = band 2, col 1
#   roof   = band 0, col 0     trim   = band 1, col 0     walls  = band 1, col 3
# Classification by cell is palette-independent; colour heuristics matched the
# grey trim cell and missed the light-blue panes.
CELL_PANES = (0, 5)
CELL_DOOR = (1, 1)
CELL_FOLIAGE = (2, 1)
CELL_ROOF = (0, 0)


def face_cell(obj, poly):
    """(band, col) of the colormap cell a face samples, or None without UVs."""
    uvs = obj.data.uv_layers.active
    if not uvs:
        return None
    su = sv = 0.0
    for li in poly.loop_indices:
        uv = uvs.data[li].uv
        su += uv.x
        sv += uv.y
    n = len(poly.loop_indices)
    u, v = su / n, sv / n
    y_from_top = (1.0 - v) * 512.0
    if y_from_top < 128.0:
        return None
    band = int((y_from_top - 128.0) // 128)
    col = int((u * 512.0) // 64)
    return (min(2, band), min(7, col))


def classify_faces(house_objects, palette: str):
    img = bpy.data.images.load(str(COLORMAPS / f"{palette}.png"), check_existing=True)
    pixels = list(img.pixels)  # kept for callers that sample colours
    glass = []  # (obj, poly_index)
    foliage = []
    door = []
    for o in house_objects:
        for poly in o.data.polygons:
            cell = face_cell(o, poly)
            if cell == CELL_PANES:
                glass.append((o, poly.index))
            elif cell == CELL_FOLIAGE:
                foliage.append((o, poly.index))
            elif cell == CELL_DOOR:
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
    cam_loc = cam.matrix_world.translation
    for o, polys, _ in clusters:
        # Skip panes on faces that point away from the camera: windows on the
        # back and far side project into the frame but are hidden by the house.
        mesh = o.data
        rot = o.matrix_world.to_3x3()
        normal = Vector((0.0, 0.0, 0.0))
        centre = Vector((0.0, 0.0, 0.0))
        for pi in polys:
            normal += rot @ mesh.polygons[pi].normal
            centre += o.matrix_world @ mesh.polygons[pi].center
        if normal.length == 0:
            continue
        normal.normalize()
        centre /= len(polys)
        if normal.dot((cam_loc - centre).normalized()) < 0.2:
            continue
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





def holdout_material():
    """EEVEE ignores Object.is_holdout; a Holdout shader node works in both engines.
    Looked up by name each time: clear_scene() purges materials between frames,
    so a cached Python reference would dangle."""
    mat = bpy.data.materials.get("PortraitHoldout")
    if mat is None:
        mat = bpy.data.materials.new("PortraitHoldout")
        mat.use_nodes = True
        nt = mat.node_tree
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        hold = nt.nodes.new("ShaderNodeHoldout")
        nt.links.new(hold.outputs["Holdout"], out.inputs["Surface"])
    return mat


def set_holdout(objects, enabled=True):
    """Replace every material on the objects with the holdout material.
    Faces that must stay visible are re-assigned afterwards with assign_poly_material."""
    if not enabled:
        return
    mat = holdout_material()
    for o in objects:
        mesh = o.data
        mesh.materials.clear()
        mesh.materials.append(mat)
        for poly in mesh.polygons:
            poly.material_index = 0


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
    bsdf.inputs["Roughness"].default_value = 0.72
    set_input(bsdf, ("Sheen Weight",), 0.18)
    nt.links.new(bevel_normal(nt), bsdf.inputs["Normal"])
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


def build_and_render(
    kit_type: str, palette: str, layer: str, season: str, samples: int, only_missing: bool, phase: str = "day"
):
    kit = load_kit()
    entry = kit[kit_type]

    if layer == "foliage":
        # Foliage is rendered once per phase. Sharing one day-lit tree across both
        # left the trees reading as daylight cutouts pasted on the night sky.
        out_name = f"{kit_type}-{season}-{phase}.png"
    elif layer in ("lit", "shadow", "snow"):
        out_name = f"{kit_type}-{layer}.png"
    else:
        out_name = f"{kit_type}-{palette}-{layer}.png"
    out_path = PNG_OUT / out_name
    if only_missing and out_path.exists() and out_path.stat().st_size > 1000:
        print("skip", out_name)
        return None

    clear_scene()
    configure_cycles(samples, DEVICE)
    if layer == "night":
        sky_phase = "night"
    elif layer == "foliage":
        sky_phase = phase
    else:
        sky_phase = "day"
    setup_world(sky_phase, strength=0.26 if sky_phase == "night" else 0.38)
    setup_lights(sky_phase)

    house_col, house_objs = import_glb(KIT_ROOT / f"building-type-{kit_type}.glb", "House")
    house_meshes = mesh_objects(house_col)
    apply_clay_colormap(house_meshes, palette)

    props_col, prop_objs = place_props(entry)
    prop_meshes = [o for o in prop_objs if o.type == "MESH"]
    apply_clay_colormap(prop_meshes, palette)

    tree_objs = [o for o in prop_meshes if "tree" in o.name.lower()]
    non_tree_props = [o for o in prop_meshes if o not in tree_objs]

    cam = setup_camera(house_meshes, house_meshes + non_tree_props)
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
    if layer in ("day", "night"):
        for o in tree_objs:
            o.hide_render = True
        glass_mat = make_glass_material(layer)
        by_obj = defaultdict(list)
        for o, pi in glass:
            by_obj[o].append(pi)
        for o, polys in by_obj.items():
            assign_poly_material(o, polys, glass_mat)
    elif layer == "lit":
        # Emission on glass only; everything else holdout; no lights so nothing
        # but the emission reaches the film.
        for o in prop_meshes:
            o.hide_render = True
        set_holdout(house_meshes, True)
        em = make_emission_material("WindowLit", strength=6.0)
        by_obj = defaultdict(list)
        for o, pi in glass:
            by_obj[o].append(pi)
        for o, polys in by_obj.items():
            assign_poly_material(o, polys, em)
        for light in bpy.data.lights:
            light.energy = 0.0
        bpy.context.scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.0
    elif layer == "shadow":
        # Render a white ground plane with the house and props held out, then
        # scripts/prepare-portraits.mjs turns the plane's darkening into a shadow
        # alpha (black, alpha = 1 - L/L_ref). Cycles does have a real shadow
        # catcher now, but this keeps the contract prepare-portraits.mjs reads.
        for o in tree_objs:
            o.hide_render = True
        set_holdout(house_meshes + [o for o in prop_meshes if o not in tree_objs], True)
        bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, -0.002))
        plane = bpy.context.active_object
        ground = bpy.data.materials.new("ShadowGround")
        ground.use_nodes = True
        gnt = ground.node_tree
        gb = next(n for n in gnt.nodes if n.type == "BSDF_PRINCIPLED")
        gb.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
        gb.inputs["Roughness"].default_value = 1.0
        plane.data.materials.append(ground)
        for light in bpy.data.lights:
            if light.type == "SUN":
                light.energy = max(light.energy, 3.0)
            else:
                # prepare-portraits.mjs measures the plane's darkening against an
                # unshadowed reference along the bottom edge. Fill and rim would
                # lift the shadowed pixels and wash the result out.
                light.energy = 0.0
        # Same reason: sky ambient is the floor on how dark the shadow can get.
        bpy.context.scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.18
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
        # White caps on upward faces; every other face held out.
        for o in prop_meshes:
            o.hide_render = True
        set_holdout(house_meshes, True)
        add_snow_caps(house_meshes)

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
    parser.add_argument("--scale", type=float, default=1.2)
    parser.add_argument("--device", default="GPU", choices=["GPU", "CPU", "gpu", "cpu"])
    args = parser.parse_args(argv_after_double_dash())

    global FRAME_W, FRAME_H, DEVICE
    # Even dimensions keep the webp encoder off half-pixel chroma edges.
    FRAME_W = int(round(BASE_W * args.scale / 2) * 2)
    FRAME_H = int(round(BASE_H * args.scale / 2) * 2)
    DEVICE = args.device.upper()

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
                    for ph in ("day", "night"):
                        m = build_and_render(kt, "terracotta", layer, season, args.samples, only_missing, ph)
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
