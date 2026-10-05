"""
Exactly periodic loops (no cross-fade needed): falling leaves and a sprinkler.

Every moving thing is a function of phase = frame / N that returns to its start
at phase 1, so frame N would equal frame 0.

  Blender -b -noaudio -P tools/blender/fx/loops.py -- --kind leaves|sprinkler --out DIR
      [--frames 36] [--size 96] [--samples 32]
"""
import argparse
import math
import random
import sys
from pathlib import Path

import bpy


def parse():
    a = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--kind", required=True, choices=["leaves", "sprinkler"])
    p.add_argument("--out", required=True)
    p.add_argument("--frames", type=int, default=36)
    p.add_argument("--size", type=int, default=96)
    p.add_argument("--samples", type=int, default=32)
    return p.parse_args(a)


def lin(h):
    h = h.lstrip("#")
    c = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c) + (1.0,)


def mat(name, color, rough=0.7, emit=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = lin(color)
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = lin(color)
        b.inputs["Emission Strength"].default_value = emit
    b.inputs["Alpha"].default_value = alpha
    return m


def setup(size_w, size_h, samples, ortho_w):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.render.resolution_x = size_w
    scene.render.resolution_y = size_h
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False
    scene.cycles.device = "CPU"
    scene.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("W")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.82, 0.88, 1.0, 1)
    bg.inputs["Strength"].default_value = 0.9
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = 3.2
    sun.color = (1.0, 0.93, 0.82)
    so = bpy.data.objects.new("Sun", sun)
    scene.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), 0, math.radians(30))
    cam_data = bpy.data.cameras.new("C")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ortho_w if size_w >= size_h else ortho_w * size_h / size_w
    cam = bpy.data.objects.new("C", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (0, -8, 0)
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.camera = cam
    return scene


def leaves(a):
    # Frame is 1.0 wide x 4/3 tall in world units, centred on the origin.
    w, h = a.size, int(a.size * 4 / 3)
    scene = setup(w, h, a.samples, 1.0)
    rnd = random.Random(11)
    colors = ["#c8742e", "#d99a3a", "#a9541f", "#e0b04a", "#b8632a"]
    objs = []
    for i in range(5):
        bpy.ops.mesh.primitive_circle_add(vertices=14, radius=1.0, fill_type="NGON")
        o = bpy.context.active_object
        o.scale = (0.06, 0.036, 1)
        o.data.materials.append(mat(f"Leaf{i}", colors[i], rough=0.8))
        o.modifiers.new("Solid", "SOLIDIFY").thickness = 0.01
        objs.append(
            {
                "o": o,
                "x0": rnd.uniform(-0.3, 0.3),
                "amp": rnd.uniform(0.05, 0.12),
                "off": i / 5 + rnd.uniform(-0.04, 0.04),
                "spin": rnd.choice([1, 2]),
                "tilt": rnd.uniform(0.4, 1.0),
            }
        )
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    top, bottom = 0.62, -0.62
    for k in range(a.frames):
        t = k / a.frames
        for L in objs:
            ph = (t + L["off"]) % 1.0
            # Fade by shrinking at both ends so a leaf is never seen popping in.
            fade = min(1.0, ph / 0.08, (1 - ph) / 0.12)
            L["o"].location = (
                L["x0"] + L["amp"] * math.sin(2 * math.pi * (ph * 1.5)),
                0,
                top + (bottom - top) * ph,
            )
            L["o"].rotation_euler = (
                L["tilt"] * math.sin(2 * math.pi * ph * L["spin"]),
                0.9 * math.sin(2 * math.pi * ph * 2 + 1),
                2 * math.pi * ph * L["spin"] * 0.5,
            )
            s = max(0.001, fade)
            L["o"].scale = (0.06 * s, 0.036 * s, s)
        scene.render.filepath = str(out / f"f{k:03d}.png")
        bpy.ops.render.render(write_still=True)
        print("frame", k)


def sprinkler(a):
    # Wide frame: 1.0 x 0.6 world units, nozzle at bottom centre.
    w, h = a.size * 2, int(a.size * 1.2)
    scene = setup(w, h, a.samples, 1.0)
    water = mat("Water", "#bfe0ff", rough=0.15, emit=1.2, alpha=1.0)
    nozzle = None
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.012, depth=0.05, location=(0, 0, -0.275))
    nozzle = bpy.context.active_object
    nozzle.data.materials.append(mat("Brass", "#6b5a48"))
    jets = [(-1, 1.0), (0, 1.0), (1, 1.0)]
    drops = []
    n_per = 22
    for ji in range(3):
        for di in range(n_per):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=1.0)
            o = bpy.context.active_object
            o.data.materials.append(water)
            drops.append((o, ji, di))
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    g = 1.9
    v = 0.95
    base_alpha = [math.radians(58), math.radians(70), math.radians(58)]
    for k in range(a.frames):
        t = k / a.frames
        sweep = math.sin(2 * math.pi * t)  # the head swings left and right
        for o, ji, di in drops:
            s = (t + di / n_per) % 1.0  # droplet age 0..1
            tt = s * 0.62
            az = math.radians(24 * sweep) + math.radians((ji - 1) * 34)
            alpha = base_alpha[ji]
            dist = v * math.cos(alpha) * tt
            x = dist * math.sin(az) * 1.0
            z = -0.275 + 0.03 + v * math.sin(alpha) * tt - 0.5 * g * tt * tt
            o.location = (x, 0, z)
            size = 0.0095 * min(1.0, s / 0.06, (1 - s) / 0.1)
            o.scale = (max(0.0005, size),) * 3
            o.hide_render = z < -0.285
        scene.render.filepath = str(out / f"f{k:03d}.png")
        bpy.ops.render.render(write_still=True)
        print("frame", k)


if __name__ == "__main__":
    bpy.ops.wm.read_factory_settings(use_empty=True)
    a = parse()
    {"leaves": leaves, "sprinkler": sprinkler}[a.kind](a)
