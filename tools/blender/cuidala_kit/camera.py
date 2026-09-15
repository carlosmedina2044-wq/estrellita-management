"""Reference camera — (9, 6.5, 11) runtime looking at (0, 1.6, 0)."""

from __future__ import annotations

from mathutils import Vector

import bpy


def runtime_to_blender(pos):
    """Map runtime (x, y-up, z) to Blender (x, −z, y)."""
    x, y, z = pos
    return (x, -z, y)


def setup_camera(lens=35):
    loc = Vector(runtime_to_blender((9, 6.5, 11)))
    target = Vector(runtime_to_blender((0, 1.6, 0)))
    cam_data = bpy.data.cameras.new("Portrait")
    cam_data.lens = lens
    cam_data.sensor_width = 36
    cam_data.dof.use_dof = True
    cam_data.dof.aperture_fstop = 5.6
    cam_data.dof.aperture_blades = 6
    cam_data.dof.focus_distance = (loc - target).length
    cam = bpy.data.objects.new("Portrait", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = loc
    cam.rotation_euler = (target - loc).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    bpy.context.view_layer.update()
    return cam
