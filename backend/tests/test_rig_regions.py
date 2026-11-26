import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from app.schemas.rig import RigRegion
from app.services.rig_service import rig_service
from main import app


def sample_image():
    canvas = Image.new("RGBA", (100, 140), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((30, 55, 70, 105), fill=(230, 190, 125, 255))
    draw.rectangle((14, 62, 29, 85), fill=(220, 180, 120, 255))
    draw.rectangle((71, 62, 85, 85), fill=(220, 180, 120, 255))
    draw.rectangle((32, 106, 48, 128), fill=(215, 175, 115, 255))
    draw.rectangle((52, 106, 68, 128), fill=(215, 175, 115, 255))
    draw.ellipse((19, 7, 81, 64), fill=(250, 220, 160, 255))
    draw.ellipse((33, 29, 41, 36), fill=(40, 150, 220, 255))
    draw.ellipse((60, 29, 68, 36), fill=(40, 150, 220, 255))
    draw.ellipse((48, 38, 53, 42), fill=(175, 100, 85, 255))
    draw.rectangle((45, 49, 56, 52), fill=(170, 70, 85, 255))
    out = io.BytesIO()
    canvas.save(out, format="PNG")
    return out.getvalue()


def region(part, x1, y1, x2, y2, pivot=None):
    points = [{"x": x/99, "y": y/139} for x, y in [(x1,y1),(x2,y1),(x2,y2),(x1,y2)]]
    px, py = pivot or ((x1+x2)/2, (y1+y2)/2)
    return {"id": part, "points": points, "pivot": {"x": px/99, "y": py/139}, "mode": "region"}


class RigRegionTests(unittest.TestCase):
    def test_preserved_face_retains_original_pixels_and_expression_images_have_independent_rigs(self):
        original = sample_image()
        reference = Image.open(io.BytesIO(original)).convert("RGBA")
        ImageDraw.Draw(reference).rectangle((45, 49, 56, 52), fill=(10, 120, 80, 255))
        reference_bytes = io.BytesIO()
        reference.save(reference_bytes, format="PNG")
        selection = [
            region("head", 19, 7, 81, 64, (50, 61)),
            region("left_eye", 33, 29, 41, 36),
            region("left_arm", 14, 62, 29, 85, (28, 65)),
            region("left_leg", 32, 106, 48, 128, (40, 107)),
            region("mouth", 45, 49, 56, 52),
        ]
        with tempfile.TemporaryDirectory() as tmp, patch.object(rig_service, "output_dir", Path(tmp)):
            response = TestClient(app).post("/api/character/generate", files=[
                ("file", ("primary.png", original, "image/png")),
                ("expression_files", ("happy.png", reference_bytes.getvalue(), "image/png")),
                ("expression_files", ("sad.png", original, "image/png")),
            ], data={
                "regions": json.dumps(selection), "preserve_face": "true",
                "expression_layouts": json.dumps([
                    {"emotion": "happy", "regions": selection},
                    {"emotion": "sad", "regions": []},
                ])
            })
            self.assertEqual(response.status_code, 200, response.text)
            rig = response.json()["rig"]
            self.assertTrue(rig["preserveFace"])
            self.assertIsNone(rig["mouthVariants"])
            parts = {part["id"]: part for part in rig["parts"]}
            self.assertNotIn("left_eye", parts)
            self.assertNotIn("mouth", parts)
            self.assertIn("left_arm", parts)
            self.assertIn("left_leg", parts)
            main_dir = Path(tmp) / rig["id"]
            head = np.array(Image.open(main_dir / "head.png"))
            source = np.array(Image.open(io.BytesIO(original)))
            self.assertEqual(rig["mesh"]["regions"], selection)
            self.assertTrue(np.array_equal(np.array(Image.open(main_dir / rig["mesh"]["src"])), source))
            part = parts["head"]
            # The actual eye/skin artwork is kept, not inpainted or replaced.
            self.assertTrue(np.array_equal(head[33-part["y"], 37-part["x"]], source[33, 37]))
            self.assertTrue(np.array_equal(head[50-part["y"], 50-part["x"]], source[50, 50]))
            happy = rig["expressionRigs"]["happy"]
            self.assertEqual(happy["mesh"]["regions"], selection)
            self.assertTrue(np.array_equal(np.array(Image.open(Path(tmp) / happy["id"] / happy["mesh"]["src"])), np.array(reference)))
            self.assertIn("left_arm", {p["id"] for p in happy["parts"]})
            self.assertEqual(happy["assetBase"], f"/generated/{happy['id']}/")
            happy_head = np.array(Image.open(Path(tmp) / happy["id"] / "head.png"))
            self.assertEqual(tuple(happy_head[50-part["y"], 50-part["x"]]), (10, 120, 80, 255))
            sad = rig["expressionRigs"]["sad"]
            self.assertEqual(len(sad["parts"]), 1)
            self.assertTrue(np.array_equal(np.array(Image.open(Path(tmp) / sad["id"] / "base.png")), source))

    def test_polygons_extract_colored_face_and_independent_body_layers(self):
        selection = [
            region("head", 19, 7, 81, 64, (50, 61)),
            region("torso", 30, 55, 70, 105),
            region("left_arm", 14, 62, 29, 85, (28, 65)),
            region("right_arm", 71, 62, 85, 85, (73, 65)),
            region("left_leg", 32, 106, 48, 128, (40, 107)),
            region("right_leg", 52, 106, 68, 128, (60, 107)),
            region("left_eye", 33, 29, 41, 36),
            region("right_eye", 60, 29, 68, 36),
            region("nose", 48, 38, 53, 42), region("mouth", 45, 49, 56, 52),
        ]
        with tempfile.TemporaryDirectory() as tmp, patch.object(rig_service, "output_dir", Path(tmp)):
            response = TestClient(app).post("/api/character/generate",
                files={"file": ("character.png", sample_image(), "image/png")},
                data={"regions": json.dumps(selection)})
            self.assertEqual(response.status_code, 200, response.text)
            rig = response.json()["rig"]
            self.assertEqual(rig["partLayoutVersion"], 2)
            parts = {p["id"]: p for p in rig["parts"]}
            self.assertEqual(parts["nose"]["type"], "nose")
            self.assertEqual(parts["left_arm"]["type"], "arm")
            self.assertEqual(parts["left_leg"]["type"], "leg")
            self.assertGreater(parts["head"]["pivotY"], .8)
            out = Path(tmp) / rig["id"]
            eye = np.array(Image.open(out / "left_eye.png"))
            self.assertTrue(np.any((eye[:, :, 2] == 220) & (eye[:, :, 3] > 0)))
            self.assertEqual(np.array(Image.open(out / "base.png"))[35, 50, 3], 0)
            # Only the hidden neck/shoulder joint gets a small overlap,
            # never the entire face or transparent background.
            base = np.array(Image.open(out / "base.png"))
            self.assertGreater(base[64, 50, 3], 0)
            self.assertEqual(base[0, 0, 3], 0)
            self.assertTrue((out / "mouth_open.png").exists())

    def test_invalid_or_duplicate_regions_are_rejected_and_empty_polygons_do_not_generate(self):
        client = TestClient(app)
        valid = region("nose", 48, 38, 53, 42)
        bad = {**valid, "points": [{"x": 0, "y": 0}] * 3}
        with tempfile.TemporaryDirectory() as tmp, patch.object(rig_service, "output_dir", Path(tmp)):
            for selection in [[bad], [valid, valid], [region("head", 0, 0, 6, 6)]]:
                response = client.post("/api/character/generate",
                    files={"file": ("test.png", sample_image(), "image/png")},
                    data={"regions": json.dumps(selection)})
                self.assertIn(response.status_code, (400, 422))
            self.assertEqual(list(Path(tmp).iterdir()), [])
