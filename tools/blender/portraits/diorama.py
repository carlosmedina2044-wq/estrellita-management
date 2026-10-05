"""
Procedural diorama pieces for the portrait renders: a rounded lawn slab, clay
trees and bushes. Replaces the Kenney fence walls (which read as floating brick
slabs) and the Kenney cone trees (which read as ghosts at night) with shapes in
the same soft, warm language as public/illustrations/house.webp.

Everything is built from primitives so there is nothing to download and the
look is fully deterministic. Imported by render.py inside Blender.
"""
from __future__ import annotations

import math
import random

import bmesh
import bpy
from mathutils import Vector

# Two tones per season: (shade, light). Mixed by noise so no surface is flat.
GRASS = {
    "spring": ("#6fa04a", "#9bc965"),
    "summer": ("#4c8a3a", "#74b04e"),
    "autumn": ("#6f8a3a", "#a0a745"),
    "winter": ("#cfdeec", "#fcfeff"),
}
CANOPY = {
    "spring": ("#7db24a", "#b0dc6a"),
    "summer": ("#3f7a33", "#6aa648"),
    "autumn": ("#c0601f", "#ec9a3c"),
    "winter": ("#5f7f7a", "#eef5f5"),
}
BUSH = {
    "spring": ("#5f9a40", "#8fc45a"),
    "summer": ("#3b7230", "#5f9a40"),
    "autumn": ("#7c6a24", "#c08a2c"),
    "winter": ("#587872", "#eaf2f1"),
}
SOIL = ("#4a3324", "#7a5236")
TRUNK = ("#4a3426", "#6e4e36")


def _rgb(h):
    h = h.lstrip("#")
    c = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    # Authored in sRGB, shaders want linear.
    lin = [(x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, 1.0)


def _principled(nt):
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return bsdf


def _set(node, names, value):
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = value
            return


def noise_mix_material(name, shade, light, scale=9.0, rough=0.85, bump=0.25, vertical_shade=0.0, ramp_lo=0.38, ramp_hi=0.64):
    """Two-tone material mixed by fractal noise, optionally darker toward the
    bottom of the object so blobs read as lit from above."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    bsdf = _principled(nt)
    coord = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 6.0
    noise.inputs["Roughness"].default_value = 0.6
    nt.links.new(coord.outputs["Object"], noise.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = ramp_lo
    ramp.color_ramp.elements[0].color = _rgb(shade)
    ramp.color_ramp.elements[1].position = ramp_hi
    ramp.color_ramp.elements[1].color = _rgb(light)
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    color_out = ramp.outputs["Color"]
    if vertical_shade:
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(coord.outputs["Object"], sep.inputs["Vector"])
        grad = nt.nodes.new("ShaderNodeMapRange")
        grad.inputs["From Min"].default_value = -0.9
        grad.inputs["From Max"].default_value = 0.9
        grad.inputs["To Min"].default_value = 1.0 - vertical_shade
        grad.inputs["To Max"].default_value = 1.0
        nt.links.new(sep.outputs["Z"], grad.inputs["Value"])
        mul = nt.nodes.new("ShaderNodeMix")
        mul.data_type = "RGBA"
        mul.blend_type = "MULTIPLY"
        mul.inputs["Factor"].default_value = 1.0
        nt.links.new(color_out, mul.inputs[6])
        nt.links.new(grad.outputs["Result"], mul.inputs[7])
        color_out = mul.outputs[2]
    nt.links.new(color_out, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    _set(bsdf, ("Specular IOR Level", "Specular"), 0.15)
    _set(bsdf, ("Sheen Weight",), 0.25)
    if bump:
        b = nt.nodes.new("ShaderNodeBump")
        b.inputs["Strength"].default_value = bump
        b.inputs["Distance"].default_value = 0.02
        nt.links.new(noise.outputs["Fac"], b.inputs["Height"])
        nt.links.new(b.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def slab_material(season: str):
    """Grass on top, soil on the sides, split by face normal."""
    g_shade, g_light = GRASS[season]
    grass = noise_mix_material(f"Grass_{season}", g_shade, g_light, scale=4.0 if season == "winter" else 5.0, bump=0.9 if season == "winter" else 0.35, rough=0.92, ramp_lo=0.3 if season == "winter" else 0.25, ramp_hi=0.8 if season == "winter" else 0.85)
    soil = noise_mix_material("Soil", *SOIL, scale=14.0, bump=0.4, rough=0.95)
    return grass, soil


def _rounded_rect(x0, x1, y0, y1, r, seg=7):
    pts = []
    corners = [
        (x1 - r, y1 - r, 0),
        (x0 + r, y1 - r, 90),
        (x0 + r, y0 + r, 180),
        (x1 - r, y0 + r, 270),
    ]
    for cx, cy, a0 in corners:
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def build_slab(x0, x1, y0, y1, season: str, thickness=0.16, radius=0.34, hidden=False):
    """A thick rounded lawn tile whose top face sits at z = 0."""
    mesh = bpy.data.meshes.new("LawnSlab")
    bm = bmesh.new()
    top = [bm.verts.new((x, y, 0.0)) for x, y in _rounded_rect(x0, x1, y0, y1, radius)]
    face = bm.faces.new(top)
    res = bmesh.ops.extrude_face_region(bm, geom=[face])
    verts = [v for v in res["geom"] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, -thickness), verts=verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("LawnSlab", mesh)
    bpy.context.collection.objects.link(obj)

    grass, soil = slab_material(season)
    mesh.materials.append(grass)
    mesh.materials.append(soil)
    for poly in mesh.polygons:
        poly.material_index = 0 if poly.normal.z > 0.5 else 1
        poly.use_smooth = poly.normal.z <= 0.5

    # Soft rim: a small bevel on the top edge reads as turf rolling over the
    # edge instead of a cut tile.
    bev = obj.modifiers.new("Rim", "BEVEL")
    bev.width = 0.035
    bev.segments = 4
    bev.limit_method = "ANGLE"
    obj.hide_render = hidden
    return obj


def _jitter_blob(obj, strength, seed, scale=2.2):
    rnd = random.Random(seed)
    tex = bpy.data.textures.new(f"Blob{seed}", "CLOUDS")
    tex.noise_scale = scale
    tex.noise_depth = 2
    sub = obj.modifiers.new("Sub", "SUBSURF")
    sub.levels = 2
    sub.render_levels = 3
    disp = obj.modifiers.new("Disp", "DISPLACE")
    disp.texture = tex
    disp.strength = strength
    disp.mid_level = 0.5
    tex.noise_basis = "BLENDER_ORIGINAL"
    obj.rotation_euler = (rnd.random() * 3, rnd.random() * 3, rnd.random() * 3)
    return obj


def _sphere(loc, scale, mat, seed, jitter):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0, location=loc)
    o = bpy.context.active_object
    o.scale = scale
    bpy.ops.object.shade_smooth()
    _jitter_blob(o, jitter, seed)
    o.data.materials.append(mat)
    return o


def build_tree(x, y, height, season: str, seed: int, hidden_from_render=False):
    """A trunk and a cluster of lumpy canopy blobs, about `height` tall."""
    rnd = random.Random(seed)
    objs = []
    trunk_h = height * 0.42
    bpy.ops.mesh.primitive_cone_add(
        vertices=14, radius1=height * 0.05, radius2=height * 0.028, depth=trunk_h, location=(x, y, trunk_h / 2)
    )
    trunk = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    tm = noise_mix_material("Trunk", *TRUNK, scale=30.0, bump=0.3, rough=0.9)
    trunk.data.materials.append(tm)
    objs.append(trunk)

    shade, light = CANOPY[season]
    cm = noise_mix_material(f"Canopy_{season}", shade, light, scale=4.0, bump=0.25, rough=0.8, vertical_shade=0.5, ramp_lo=0.25, ramp_hi=0.85)
    r = height * 0.30
    frost = 0.82 if season == "winter" else 1.0
    centers = [
        (0.0, 0.0, trunk_h + r * 0.95, 1.0),
        (-r * 0.72, r * 0.18, trunk_h + r * 0.55, 0.78),
        (r * 0.74, -r * 0.1, trunk_h + r * 0.62, 0.8),
        (r * 0.08, r * 0.5, trunk_h + r * 1.5, 0.66),
    ]
    for i, (dx, dy, dz, s) in enumerate(centers):
        sc = r * s * frost
        objs.append(
            _sphere((x + dx, y + dy, dz), (sc, sc, sc * 0.92), cm, seed * 10 + i, jitter=0.35 * sc / r * 0.5)
        )
    if season == "winter":
        snow = noise_mix_material("TreeCap", *SNOW, scale=4.0, bump=0.4, ramp_lo=0.3, ramp_hi=0.8)
        objs.append(_sphere((x, y, trunk_h + r * 1.62), (r * 0.78, r * 0.74, r * 0.34), snow, seed * 11, 0.06))
        objs.append(_sphere((x - r * 0.72, y + r * 0.18, trunk_h + r * 1.05), (r * 0.5, r * 0.48, r * 0.22), snow, seed * 12, 0.05))
    for o in objs:
        o.hide_render = hidden_from_render
    return objs


def build_bush(x, y, size, season: str, seed: int):
    shade, light = BUSH[season]
    m = noise_mix_material(f"Bush_{season}", shade, light, scale=5.0, bump=0.3, rough=0.82, vertical_shade=0.5, ramp_lo=0.25, ramp_hi=0.85)
    rnd = random.Random(seed)
    objs = []
    for i, (dx, dy, s) in enumerate([(0, 0, 1.0), (size * 0.8, size * 0.1, 0.72), (-size * 0.65, size * 0.15, 0.66)]):
        sc = size * s
        objs.append(_sphere((x + dx, y + dy, sc * 0.78), (sc, sc * 0.95, sc * 0.82), m, seed * 7 + i, 0.12))
    if season == "winter":
        snow = noise_mix_material("Cap", *SNOW, scale=4.0, bump=0.4, ramp_lo=0.3, ramp_hi=0.8)
        objs.append(_sphere((x, y, size * 1.18), (size * 0.8, size * 0.72, size * 0.34), snow, seed * 3, 0.05))
    return objs


def build_stone_path(x, y_start, y_end, seed=1):
    """Flat stepping stones running from the door toward the camera."""
    rnd = random.Random(seed)
    m = noise_mix_material("Stone", "#b9b0a2", "#d8d0c2", scale=8.0, bump=0.2, rough=0.9, ramp_lo=0.3, ramp_hi=0.8)
    y = y_start
    objs = []
    i = 0
    while y > y_end:
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=1.0, depth=1.0, location=(x + rnd.uniform(-0.03, 0.03), y, 0.008))
        o = bpy.context.active_object
        o.scale = (rnd.uniform(0.075, 0.09), rnd.uniform(0.055, 0.065), 0.012)
        o.rotation_euler[2] = rnd.uniform(-0.25, 0.25)
        bpy.ops.object.shade_smooth()
        bev = o.modifiers.new("B", "BEVEL")
        bev.width = 0.18
        bev.segments = 3
        o.data.materials.append(m)
        objs.append(o)
        y -= 0.15
        i += 1
    return objs


SNOW = ("#e6eef7", "#ffffff")


def build_snow_mound(x, y, size, seed):
    """A soft drift: a low, wide white lump."""
    m = noise_mix_material("Drift", *SNOW, scale=4.0, bump=0.5, rough=0.9, ramp_lo=0.3, ramp_hi=0.8)
    return _sphere((x, y, size * 0.12), (size * 1.5, size * 1.05, size * 0.3), m, seed, 0.04)
