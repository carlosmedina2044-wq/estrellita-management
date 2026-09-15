"""Cycles GPU Metal settings and WebP output."""

from __future__ import annotations

from pathlib import Path

import bpy


def configure_cycles(samples=1024, size=(1290, 860)):
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for device in prefs.devices:
        device.use = True
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU"
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.01
    scene.cycles.samples = samples
    scene.cycles.adaptive_min_samples = min(128, samples)
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.cycles.max_bounces = 8
    scene.cycles.diffuse_bounces = 3
    scene.cycles.glossy_bounces = 4
    scene.cycles.transmission_bounces = 6
    scene.cycles.transparent_max_bounces = 8
    scene.cycles.sample_clamp_indirect = 10
    scene.cycles.blur_glossy = 0.5
    scene.render.use_persistent_data = True
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = 92
    if size[0] >= 2500:
        # Showcase frames must stay ≥ 150 KB; flat pastel scenes need near-lossless WebP.
        scene.render.image_settings.quality = 100
        try:
            scene.render.image_settings.webp_quality = 100
        except Exception:
            pass


def inspect_glare():
    """Enumerate CompositorNodeGlare properties/inputs for this Blender build."""
    info = {"properties": [], "inputs": [], "bloom_via": None}
    try:
        tmp = bpy.data.node_groups.new("GlareProbe", "CompositorNodeTree")
        node = tmp.nodes.new("CompositorNodeGlare")
        rna = node.bl_rna
        for prop in rna.properties:
            if prop.identifier in {"rna_type", "type", "location", "width", "height", "name", "label"}:
                continue
            info["properties"].append(prop.identifier)
        info["inputs"] = [inp.name for inp in node.inputs]
        if "Type" in node.inputs:
            try:
                node.inputs["Type"].default_value = "Bloom"
                info["bloom_via"] = "inputs.Type=Bloom"
            except Exception as exc:
                info["bloom_via"] = f"Type_failed:{exc}"
        bpy.data.node_groups.remove(tmp)
    except Exception as exc:
        info["error"] = str(exc)
    return info


def configure_compositor(horizon="#eef2f0"):
    try:
        _configure_compositor(horizon)
    except Exception as exc:
        print(f"compositor skipped: {exc}")


def _configure_compositor(horizon="#eef2f0"):
    scene = bpy.context.scene
    scene.render.use_compositing = True
    scene.use_nodes = True
    try:
        scene.view_layers[0].use_pass_mist = True
    except Exception:
        pass
    world = scene.world
    if world and hasattr(world, "mist_settings"):
        world.mist_settings.use_mist = True
        world.mist_settings.start = 18
        world.mist_settings.depth = 22

    tree = getattr(scene, "node_tree", None)
    if tree is None and hasattr(bpy.data, "node_groups"):
        tree = bpy.data.node_groups.new("CuidalaComp", "CompositorNodeTree")
        if hasattr(scene, "compositing_node_group"):
            scene.compositing_node_group = tree
    if tree is None:
        return
    nodes = tree.nodes
    links = tree.links
    nodes.clear()
    src = nodes.new("CompositorNodeRLayers")
    glare = nodes.new("CompositorNodeGlare")
    bloom_set = False
    if "Type" in glare.inputs:
        try:
            glare.inputs["Type"].default_value = "Bloom"
            bloom_set = True
            print("glare via inputs.Type=Bloom")
        except Exception as exc:
            print(f"glare Type failed: {exc}")
    if "Threshold" in glare.inputs:
        glare.inputs["Threshold"].default_value = 1.0
    if "Size" in glare.inputs:
        try:
            glare.inputs["Size"].default_value = 6
        except Exception:
            pass
    if "Strength" in glare.inputs:
        try:
            glare.inputs["Strength"].default_value = 0.15
        except Exception:
            pass

    # Blender 5.x removed MixRGB; mist toward horizon via AlphaOver
    mist_mix = nodes.new("CompositorNodeAlphaOver")
    h = horizon.lstrip("#")
    horizon_rgba = (
        int(h[0:2], 16) / 255,
        int(h[2:4], 16) / 255,
        int(h[4:6], 16) / 255,
        1,
    )
    # Background = horizon, Foreground = glare image, Factor from mist when available
    if "Background" in mist_mix.inputs:
        mist_mix.inputs["Background"].default_value = horizon_rgba
    if "Factor" in mist_mix.inputs:
        mist_mix.inputs["Factor"].default_value = 0.35

    vignette = nodes.new("CompositorNodeLensdist")
    try:
        vignette.inputs["Distortion"].default_value = 0.0
    except Exception:
        pass
    # Blender 5.x: CompositorNodeComposite is gone; node-group trees use Group Output.
    out_node = None
    for out_type in ("NodeGroupOutput", "CompositorNodeViewer", "CompositorNodeOutputFile"):
        try:
            out_node = nodes.new(out_type)
            break
        except Exception:
            continue
    if out_node is None:
        raise RuntimeError("no compositor output node available")

    links.new(src.outputs["Image"], glare.inputs["Image"] if "Image" in glare.inputs else glare.inputs[0])
    glare_out = glare.outputs[0]
    if "Foreground" in mist_mix.inputs:
        links.new(glare_out, mist_mix.inputs["Foreground"])
    else:
        links.new(glare_out, mist_mix.inputs[1])
    if "Mist" in src.outputs and "Factor" in mist_mix.inputs:
        try:
            links.new(src.outputs["Mist"], mist_mix.inputs["Factor"])
        except Exception:
            pass
    links.new(mist_mix.outputs[0], vignette.inputs[0])
    # Wire vignette into first available input on the output node
    if out_node.inputs:
        links.new(vignette.outputs[0], out_node.inputs[0])
    if not bloom_set:
        print("WARNING: bloom not configured on CompositorNodeGlare")
    print(f"compositor output via {out_node.bl_idname}")


def render_to(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.image_settings.file_format = "WEBP"
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    png_dir = path.parent / "png"
    png_dir.mkdir(parents=True, exist_ok=True)
    result = bpy.data.images.get("Render Result")
    if result:
        prev = scene.render.image_settings.file_format
        scene.render.image_settings.file_format = "PNG"
        result.save_render(str(png_dir / path.with_suffix(".png").name))
        scene.render.image_settings.file_format = prev
