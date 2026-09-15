"""Sky worlds for reference renders. Camera rays see CSS stops; lighting uses Nishita."""

from __future__ import annotations

import math

import bpy

STOPS = {
    "night": ("#0f1626", "#1a2238", "#2a2f45"),
    "dawn": ("#4a5a86", "#c98a6b", "#f2c9a0"),
    "day": ("#8fb8e8", "#c9dcf0", "#eef2f0"),
    "golden": ("#6f8fc2", "#e6a56a", "#f6d3a2"),
    "dusk": ("#2b3358", "#7a5a7a", "#e08a6a"),
}

SUN = {
    "dawn": (8, 95, 1.0, 1.0),
    "day": (55, 180, 1.0, 1.0),
    "golden": (12, 265, 1.0, 2.5),
    "dusk": (-4, 275, 1.0, 2.5),
}

# Spec defaults; may be lowered by 0.2 if day walls clip (recorded in report).
EXPOSURE = {"day": 0.0, "golden": 0.3, "dawn": 0.5, "dusk": 0.8, "night": 1.5}


def hex_rgb(hex_color: str):
    h = hex_color.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))


def apply_world(phase: str, fog=False):
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputWorld")
    top, mid, horizon = [hex_rgb(c) for c in STOPS[phase]]

    tex_coord = nodes.new("ShaderNodeTexCoord")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(tex_coord.outputs["Window"], sep.inputs[0])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (*horizon, 1)
    mid_el = ramp.color_ramp.elements.new(0.45)
    mid_el.color = (*mid, 1)
    ramp.color_ramp.elements[-1].position = 1.0
    ramp.color_ramp.elements[-1].color = (*top, 1)
    links.new(sep.outputs["Y"], ramp.inputs["Fac"])
    cam_bg = nodes.new("ShaderNodeBackground")
    links.new(ramp.outputs["Color"], cam_bg.inputs["Color"])
    cam_bg.inputs["Strength"].default_value = 1.0 if phase != "night" else 0.35

    light_bg = nodes.new("ShaderNodeBackground")
    if phase == "night":
        light_bg.inputs["Color"].default_value = (*hex_rgb("#0f1626"), 1)
        light_bg.inputs["Strength"].default_value = 0.35
        lamp = bpy.data.lights.new("Moon", "SUN")
        lamp.color = hex_rgb("#8fa3ff")
        lamp.energy = 0.1
        lamp.angle = math.radians(1)
        moon = bpy.data.objects.new("Moon", lamp)
        moon.rotation_euler = (math.radians(60), 0, math.radians(120))
        bpy.context.collection.objects.link(moon)
    else:
        sky = nodes.new("ShaderNodeTexSky")
        # Blender 5.2 renamed Nishita to MULTIPLE_SCATTERING.
        sky.sky_type = "MULTIPLE_SCATTERING"
        elev, rot, air, dust = SUN[phase]
        if hasattr(sky, "sun_disc"):
            sky.sun_disc = True
        if hasattr(sky, "sun_size"):
            sky.sun_size = math.radians(0.545)
        if hasattr(sky, "sun_elevation"):
            sky.sun_elevation = math.radians(elev)
        if hasattr(sky, "sun_rotation"):
            sky.sun_rotation = math.radians(rot)
        if hasattr(sky, "air_density"):
            sky.air_density = air
        if hasattr(sky, "dust_density"):
            sky.dust_density = dust
        if hasattr(sky, "ozone_density"):
            sky.ozone_density = 1.0
        if hasattr(sky, "sun_intensity"):
            sky.sun_intensity = 1.0
        links.new(sky.outputs[0], light_bg.inputs["Color"])
        light_bg.inputs["Strength"].default_value = 1.0

    path = nodes.new("ShaderNodeLightPath")
    mix = nodes.new("ShaderNodeMixShader")
    links.new(path.outputs["Is Camera Ray"], mix.inputs["Fac"])
    links.new(light_bg.outputs[0], mix.inputs[1])
    links.new(cam_bg.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], out.inputs[0])

    if fog:
        # World-volume density blanks the frame when the camera sits inside it.
        # Put Principled Volume in a horizon domain behind the house instead
        # (density 0.02 inside the domain; camera stays in clear air).
        import mathutils

        mesh = bpy.data.meshes.new("FogDomain")
        # Large box behind / around the far side of the house
        size = (80, 50, 30)
        # Blender: centered at y=+20 (into the scene), covering the horizon
        import bmesh

        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bm.to_mesh(mesh)
        bm.free()
        fog_obj = bpy.data.objects.new("FogDomain", mesh)
        fog_obj.scale = size
        fog_obj.location = (0, 25, 8)
        bpy.context.collection.objects.link(fog_obj)
        # Volume material
        mat = bpy.data.materials.new("FogVolume")
        mat.use_nodes = True
        mnodes = mat.node_tree.nodes
        mlinks = mat.node_tree.links
        mnodes.clear()
        out_m = mnodes.new("ShaderNodeOutputMaterial")
        vol = mnodes.new("ShaderNodeVolumePrincipled")
        vol.inputs["Density"].default_value = 0.02
        vol.inputs["Color"].default_value = (0.85, 0.84, 0.82, 1)
        mlinks.new(vol.outputs[0], out_m.inputs["Volume"])
        fog_obj.data.materials.append(mat)
        scene = bpy.context.scene
        if hasattr(scene.cycles, "volume_max_steps"):
            scene.cycles.volume_max_steps = 64


def apply_look(phase: str):
    view = bpy.context.scene.view_settings
    view.view_transform = "AgX"
    looks = [item.identifier for item in view.look_items] if hasattr(view, "look_items") else []
    chosen = next((name for name in looks if "Base Contrast" in name), "None")
    try:
        view.look = chosen
    except TypeError:
        view.look = "None"
        chosen = "None"
    view.exposure = EXPOSURE[phase]
    return chosen, view.exposure
