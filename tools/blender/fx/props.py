"""
The four care decorations as small 3D renders: planter, window box, bench,
wreath. Same camera direction, sun and clay look as the diorama, one transparent
WebP each, so they stand on the lawn as part of the same set instead of as flat
vector stickers.

  Blender -b -noaudio -P tools/blender/fx/props.py -- --out DIR [--size 192] [--samples 96]
"""
import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "portraits"))
import diorama  # noqa: E402


def parse():
    a = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--size", type=int, default=192)
    p.add_argument("--samples", type=int, default=96)
    p.add_argument("--only", default="")
    return p.parse_args(a)


def mat(name, shade, light=None, **kw):
    return diorama.noise_mix_material(name, shade, light or shade, **kw)


def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)


def box(loc, size, m, bevel=0.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.scale = size
    b = o.modifiers.new("B", "BEVEL")
    b.width = bevel
    b.segments = 3
    o.data.materials.append(m)
    return o


def blob(loc, scale, m, seed, jitter=0.1):
    return diorama._sphere(loc, scale, m, seed, jitter)


def planter():
    pot = mat("Pot", "#b5714a", "#d08a5d", scale=14, bump=0.2, rough=0.8, ramp_lo=0.3, ramp_hi=0.8)
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.085, radius2=0.12, depth=0.16, location=(0, 0, 0.08))
    p = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    p.data.materials.append(pot)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.12, minor_radius=0.016, location=(0, 0, 0.165))
    r = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    r.data.materials.append(pot)
    leaf = mat("Leaf", "#3f7a33", "#6aa648", scale=5, bump=0.3, ramp_lo=0.25, ramp_hi=0.85, vertical_shade=0.4)
    blob((0, 0, 0.27), (0.13, 0.13, 0.11), leaf, 1)
    blob((-0.07, 0.02, 0.22), (0.08, 0.08, 0.07), leaf, 2)
    blob((0.075, -0.01, 0.23), (0.08, 0.08, 0.07), leaf, 3)
    for i, (x, y, z, c) in enumerate([(-0.05, -0.08, 0.31, "#e86a7a"), (0.06, -0.07, 0.3, "#f2c14e"), (0.0, -0.1, 0.25, "#f4f0e6")]):
        blob((x, y, z), (0.028, 0.028, 0.028), mat(f"Fl{i}", c, rough=0.6, bump=0), 10 + i, 0.02)


def window_box():
    wood = mat("Wood", "#7a5336", "#9c7550", scale=26, bump=0.25, rough=0.8, ramp_lo=0.3, ramp_hi=0.8)
    box((0, 0, 0.05), (0.42, 0.11, 0.1), wood, 0.012)
    leaf = mat("Leaf", "#3f7a33", "#6aa648", scale=5, bump=0.3, ramp_lo=0.25, ramp_hi=0.85, vertical_shade=0.4)
    for i, x in enumerate([-0.15, -0.05, 0.05, 0.15]):
        blob((x, 0, 0.13), (0.075, 0.07, 0.06), leaf, 20 + i, 0.08)
    for i, (x, z, c) in enumerate([(-0.16, 0.19, "#e86a7a"), (-0.08, 0.2, "#f2c14e"), (0.01, 0.2, "#e86a7a"), (0.09, 0.2, "#f2c14e"), (0.17, 0.19, "#e86a7a")]):
        blob((x, -0.03, z), (0.026, 0.026, 0.026), mat(f"Fl{i}", c, rough=0.6, bump=0), 30 + i, 0.02)


def bench():
    wood = mat("Wood", "#8a6340", "#b08658", scale=30, bump=0.3, rough=0.75, ramp_lo=0.3, ramp_hi=0.8)
    dark = mat("Iron", "#3a342e", "#4a433b", scale=10, bump=0.05, rough=0.6)
    for z in (0.19, 0.205):
        pass
    # seat slats
    for i, y in enumerate([-0.07, -0.02, 0.03]):
        box((0, y, 0.19), (0.5, 0.045, 0.02), wood, 0.006)
    # backrest slats, leaning back
    for i, z in enumerate([0.27, 0.32, 0.37]):
        o = box((0, 0.08, z), (0.5, 0.02, 0.04), wood, 0.006)
        o.rotation_euler[0] = math.radians(-12)
    for x in (-0.22, 0.22):
        box((x, 0, 0.09), (0.03, 0.2, 0.03), dark, 0.004)
        for y in (-0.07, 0.07):
            box((x, y, 0.09), (0.03, 0.03, 0.18), dark, 0.004)
        o = box((x, 0.085, 0.3), (0.03, 0.025, 0.2), dark, 0.004)
        o.rotation_euler[0] = math.radians(-12)


def wreath():
    leaf = mat("Leaf", "#355f2c", "#5f9a40", scale=14, bump=0.4, ramp_lo=0.25, ramp_hi=0.85)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.1, minor_radius=0.032, location=(0, 0, 0.12), rotation=(math.radians(90), 0, 0))
    t = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    t.data.materials.append(leaf)
    mod = t.modifiers.new("Sub", "SUBSURF")
    mod.levels = 1
    for i in range(9):
        a = math.radians(i * 40)
        blob((0.1 * math.cos(a), -0.02, 0.12 + 0.1 * math.sin(a)), (0.03, 0.03, 0.03), leaf, 40 + i, 0.2)
    red = mat("Berry", "#b8403a", rough=0.5, bump=0)
    for i, a in enumerate([30, 52, 75, 200, 225]):
        r = math.radians(a)
        blob((0.1 * math.cos(r), -0.045, 0.12 + 0.1 * math.sin(r)), (0.014, 0.014, 0.014), red, 60 + i, 0.01)
    bow = mat("Bow", "#c4574f", rough=0.6, bump=0)
    for s in (-1, 1):
        o = blob((s * 0.028, -0.05, 0.035), (0.032, 0.012, 0.018), bow, 70 + s, 0.01)
    blob((0, -0.055, 0.035), (0.014, 0.012, 0.014), bow, 73, 0.01)


def cblob(loc, scale, m, seed, jitter=0.0):
    """Like blob() but unrotated, so a flattened ellipsoid stays flat."""
    o = blob(loc, scale, m, seed, jitter)
    o.rotation_euler = (0, 0, 0)
    return o


def cat_asleep():
    fur = mat("Fur", "#3b3430", "#5a4d44", scale=30, bump=0.25, rough=0.95, ramp_lo=0.3, ramp_hi=0.8)
    pale = mat("Pale", "#d9cfc2", "#f0e8dc", scale=20, bump=0.2, rough=0.95)
    cblob((0.02, 0.01, 0.045), (0.15, 0.09, 0.048), fur, 100, 0.02)  # curled body, low
    cblob((-0.115, -0.045, 0.045), (0.052, 0.05, 0.045), fur, 101, 0.01)  # head resting
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.02, radius2=0.002, depth=0.035, location=(-0.115 + sx * 0.026, -0.045, 0.095))
        bpy.context.active_object.data.materials.append(fur)
    cblob((0.1, -0.07, 0.03), (0.075, 0.03, 0.026), fur, 102, 0.01)  # tail curled in front
    cblob((-0.13, -0.09, 0.022), (0.028, 0.018, 0.016), pale, 103, 0.01)  # paw


def cat_awake():
    fur = mat("Fur", "#3b3430", "#5a4d44", scale=30, bump=0.25, rough=0.95, ramp_lo=0.3, ramp_hi=0.8)
    pale = mat("Pale", "#d9cfc2", "#f0e8dc", scale=20, bump=0.2, rough=0.95)
    eye = mat("Eye", "#e8c75a", rough=0.3, bump=0)
    cblob((0, 0.02, 0.07), (0.07, 0.085, 0.085), fur, 110, 0.02)  # body
    cblob((0, -0.03, 0.17), (0.058, 0.056, 0.055), fur, 111, 0.01)  # head
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.026, radius2=0.002, depth=0.05, location=(sx * 0.036, -0.03, 0.225))
        e = bpy.context.active_object
        e.data.materials.append(fur)
        cblob((sx * 0.02, -0.075, 0.18), (0.009, 0.006, 0.011), eye, 112 + sx, 0.0)
        cblob((sx * 0.025, -0.06, 0.02), (0.02, 0.03, 0.018), pale, 114 + sx, 0.01)
    cblob((0.075, 0.08, 0.04), (0.02, 0.07, 0.02), fur, 116, 0.01)  # tail on the ground


BUILD = {
    "planter": planter,
    "window-box": window_box,
    "bench": bench,
    "wreath": wreath,
    "cat-asleep": cat_asleep,
    "cat-awake": cat_awake,
}


def render_one(name, out, size, samples):
    clear()
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.device = "CPU"
    scene.view_settings.view_transform = "AgX"
    world = bpy.data.worlds.new("W")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.74, 0.82, 0.95, 1)
    bg.inputs["Strength"].default_value = 0.55
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = 4.4
    sun.angle = math.radians(5)
    sun.color = (1.0, 0.94, 0.84)
    so = bpy.data.objects.new("Sun", sun)
    scene.collection.objects.link(so)
    so.rotation_euler = (math.radians(53), 0, math.radians(38))
    BUILD[name]()
    # Ground shadow catcher so the prop sits on something.
    bpy.ops.mesh.primitive_plane_add(size=3, location=(0, 0, -0.001))
    plane = bpy.context.active_object
    plane.is_shadow_catcher = True
    elev, azim = math.radians(22), math.radians(22)
    d = Vector((-math.cos(elev) * math.sin(azim), -math.cos(elev) * math.cos(azim), math.sin(elev)))
    target = Vector((0, 0, {"wreath": 0.12, "cat-asleep": 0.06, "cat-awake": 0.11}.get(name, 0.17)))
    cam_data = bpy.data.cameras.new("C")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = {"planter": 0.56, "window-box": 0.62, "bench": 0.78, "wreath": 0.34, "cat-asleep": 0.34, "cat-awake": 0.42}[name]
    cam = bpy.data.objects.new("C", cam_data)
    scene.collection.objects.link(cam)
    cam.location = target + d * 4
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    scene.render.filepath = str(Path(out) / f"{name}.png")
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    bpy.ops.wm.read_factory_settings(use_empty=True)
    a = parse()
    Path(a.out).mkdir(parents=True, exist_ok=True)
    for n in (sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else BUILD):
        render_one(n, a.out, a.size, a.samples)
        print("rendered", n)
