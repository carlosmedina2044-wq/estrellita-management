"""
Chimney smoke as a seamless sprite strip.

Cycles volume lit by a warm key and cool sky, orthographic from the front, noise
scrolled upward so the plume rises, widens and thins out. Renders 2N frames and
cross-fades them into a loop of N frames (see assemble_loop.py), because noise
does not repeat on its own.

  Blender -b -noaudio -P tools/blender/fx/smoke.py -- --out DIR [--frames 24] [--size 128] [--samples 64]
"""
import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def args():
    a = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--frames", type=int, default=24)
    p.add_argument("--size", type=int, default=128)
    p.add_argument("--samples", type=int, default=64)
    p.add_argument("--tint", default="warm")  # warm | cool (night)
    return p.parse_args(a)


def math_node(nt, op, a=None, b=None, clamp=False):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    n.use_clamp = clamp
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def smoothstep(nt, x, lo, hi):
    m = nt.nodes.new("ShaderNodeMapRange")
    m.interpolation_type = "SMOOTHSTEP"
    m.clamp = True
    m.inputs["From Min"].default_value = lo
    m.inputs["From Max"].default_value = hi
    m.inputs["To Min"].default_value = 0.0
    m.inputs["To Max"].default_value = 1.0
    nt.links.new(x, m.inputs["Value"])
    return m.outputs["Result"]


def build_material(night):
    mat = bpy.data.materials.new("Smoke")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (0.62, 0.64, 0.7, 1) if night else (0.93, 0.91, 0.89, 1)
    vol.inputs["Anisotropy"].default_value = 0.35
    nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])

    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(coord.outputs["Generated"], sep.inputs["Vector"])
    gx, gy, gz = sep.outputs["X"], sep.outputs["Y"], sep.outputs["Z"]

    dx = math_node(nt, "SUBTRACT", gx, 0.5)
    dy = math_node(nt, "SUBTRACT", gy, 0.5)
    r2 = math_node(nt, "ADD", math_node(nt, "MULTIPLY", dx, dx), math_node(nt, "MULTIPLY", dy, dy))
    r = math_node(nt, "SQRT", r2)
    # Plume radius grows with height; a slow sway keeps the axis from being a ruler line.
    sway = nt.nodes.new("ShaderNodeValue")
    sway.name = "Sway"
    sway.outputs[0].default_value = 0.0
    width = math_node(nt, "ADD", 0.06, math_node(nt, "MULTIPLY", math_node(nt, "POWER", gz, 0.85), 0.2))
    axis_off = math_node(nt, "MULTIPLY", sway.outputs[0], math_node(nt, "MULTIPLY", gz, gz))
    rr = math_node(nt, "ABSOLUTE", math_node(nt, "SUBTRACT", math_node(nt, "SQRT", math_node(nt, "ADD", math_node(nt, "MULTIPLY", math_node(nt, "SUBTRACT", dx, axis_off), math_node(nt, "SUBTRACT", dx, axis_off)), math_node(nt, "MULTIPLY", dy, dy))), 0.0))
    ratio = math_node(nt, "DIVIDE", rr, width)
    profile = math_node(nt, "SUBTRACT", 1.0, smoothstep(nt, ratio, 0.15, 1.1))

    # Noise advected upward over time.
    shift = nt.nodes.new("ShaderNodeValue")
    shift.name = "Shift"
    shift.outputs[0].default_value = 0.0
    wval = nt.nodes.new("ShaderNodeValue")
    wval.name = "WTime"
    wval.outputs[0].default_value = 0.0
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(math_node(nt, "MULTIPLY", gx, 3.2), comb.inputs["X"])
    nt.links.new(math_node(nt, "MULTIPLY", gy, 3.2), comb.inputs["Y"])
    nt.links.new(math_node(nt, "SUBTRACT", math_node(nt, "MULTIPLY", gz, 5.0), shift.outputs[0]), comb.inputs["Z"])
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.noise_dimensions = "4D"
    noise.inputs["Scale"].default_value = 1.0
    noise.inputs["Detail"].default_value = 5.0
    noise.inputs["Roughness"].default_value = 0.62
    nt.links.new(comb.outputs["Vector"], noise.inputs["Vector"])
    nt.links.new(wval.outputs[0], noise.inputs["W"])
    puffy = smoothstep(nt, noise.outputs["Fac"], 0.38, 0.72)

    bottom = smoothstep(nt, gz, 0.0, 0.07)
    top = math_node(nt, "SUBTRACT", 1.0, smoothstep(nt, gz, 0.45, 0.98))
    dens = math_node(nt, "MULTIPLY", math_node(nt, "MULTIPLY", profile, puffy), math_node(nt, "MULTIPLY", bottom, top))
    nt.links.new(math_node(nt, "MULTIPLY", dens, 9.0), vol.inputs["Density"])
    return mat


def main():
    a = args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    night = a.tint == "cool"

    scene.render.engine = "CYCLES"
    scene.render.resolution_x = a.size
    scene.render.resolution_y = a.size * 2
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.cycles.samples = a.samples
    scene.cycles.use_denoising = False
    scene.cycles.volume_bounces = 2
    scene.cycles.volume_step_rate = 0.5
    scene.cycles.device = "CPU"
    scene.view_settings.view_transform = "Standard"

    # World: soft sky ambient.
    world = bpy.data.worlds.new("W")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.55, 0.62, 0.78, 1) if night else (0.8, 0.88, 1.0, 1)
    bg.inputs["Strength"].default_value = 0.5 if night else 1.1

    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = 1.2 if night else 4.0
    sun.color = (0.7, 0.78, 1.0) if night else (1.0, 0.92, 0.8)
    so = bpy.data.objects.new("Sun", sun)
    scene.collection.objects.link(so)
    so.rotation_euler = (math.radians(55), 0, math.radians(35))

    bpy.ops.mesh.primitive_cube_add(size=1)
    dom = bpy.context.active_object
    dom.scale = (1.6, 1.6, 3.2)
    dom.location = (0, 0, 1.6)
    dom.data.materials.append(build_material(night))

    cam_data = bpy.data.cameras.new("C")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 3.2
    cam = bpy.data.objects.new("C", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (0, -6, 1.6)
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.camera = cam

    nt = dom.data.materials[0].node_tree
    shift = nt.nodes["Shift"].outputs[0]
    wtime = nt.nodes["WTime"].outputs[0]
    sway = nt.nodes["Sway"].outputs[0]

    n = a.frames
    for k in range(2 * n):
        t = k / n  # 0..2 periods
        shift.default_value = t * 2.2
        wtime.default_value = t * 0.9
        sway.default_value = 0.09 * math.sin(t * math.pi * 2 / 2)
        scene.render.filepath = str(out / f"f{k:03d}.png")
        bpy.ops.render.render(write_still=True)
        print("frame", k)


if __name__ == "__main__":
    main()
