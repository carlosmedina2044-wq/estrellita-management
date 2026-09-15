"""Measure Kenney building AABBs. Run: Blender -b -P tools/blender/portraits/inspect_bounds.py"""
from __future__ import annotations

import json
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1] / "vendor/kenney-city-kit-suburban/Models/GLB format"
OUT = Path(__file__).resolve().parents[3] / ".tmp/kit-bounds.json"


def measure(path: Path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    minc = Vector((1e9, 1e9, 1e9))
    maxc = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for corner in o.bound_box:
            w = o.matrix_world @ Vector(corner)
            minc = Vector((min(minc.x, w.x), min(minc.y, w.y), min(minc.z, w.z)))
            maxc = Vector((max(maxc.x, w.x), max(maxc.y, w.y), max(maxc.z, w.z)))
    size = maxc - minc
    return {
        "size": [round(size.x, 3), round(size.y, 3), round(size.z, 3)],
        "min": [round(minc.x, 3), round(minc.y, 3), round(minc.z, 3)],
        "max": [round(maxc.x, 3), round(maxc.y, 3), round(maxc.z, 3)],
        "meshes": len(objs),
    }


def main():
    out = {}
    for t in "abcdefghijklmnopqrstu":
        path = ROOT / f"building-type-{t}.glb"
        out[t] = measure(path)
        print(t, out[t]["size"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
