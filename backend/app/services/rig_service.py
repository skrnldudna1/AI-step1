import cv2
import numpy as np
import json

from PIL import Image, ImageOps
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from app.services.character_service import character_service
from app.schemas.rig import RigRegion


class RigService:

    def __init__(self):

        self.output_dir = (
            Path(__file__).resolve().parents[2]
            / "generated"
        )

        self.output_dir.mkdir(
            parents=True,
            exist_ok=True
        )

    def create_mouth_variants(
        self,
        mouth_image: np.ndarray,
        save_dir: Path
    ) -> None:
        """
        원본 입 이미지에서 닫힌 입, 반쯤 열린 입,
        크게 열린 입 이미지를 생성한다.
        """

        image = Image.fromarray(mouth_image)
        image.save(save_dir / "mouth_closed.png")

        height, width = mouth_image.shape[:2]

        # 입 모양을 그릴 공간이 너무 작으면
        # 기존 입 이미지를 유지한다.
        if width < 4 or height < 4:
            image.save(save_dir / "mouth_half.png")
            image.save(save_dir / "mouth_open.png")
            return

        from PIL import ImageDraw

        for variant, openness in [
            ("half", 0.35),
            ("open", 0.7),
        ]:
            canvas = Image.new(
                "RGBA",
                (width, height),
                (0, 0, 0, 0)
            )

            draw = ImageDraw.Draw(canvas)

            center_x = width / 2
            center_y = height / 2

            mouth_width = width * 0.65
            mouth_height = max(
                2,
                height * openness
            )

            x1 = center_x - mouth_width / 2
            x2 = center_x + mouth_width / 2
            y1 = center_y - mouth_height / 2
            y2 = center_y + mouth_height / 2

            # 입 안쪽
            draw.ellipse(
                (x1, y1, x2, y2),
                fill=(65, 35, 45, 255)
            )

            # 크게 열린 입에는 혀 추가
            if variant == "open":
                draw.ellipse(
                    (
                        center_x - mouth_width * 0.22,
                        center_y + mouth_height * 0.12,
                        center_x + mouth_width * 0.22,
                        center_y + mouth_height * 0.38,
                    ),
                    fill=(225, 125, 145, 255)
                )

            canvas.save(
                save_dir / f"mouth_{variant}.png"
            )


    def generate(self, contents: bytes, regions: list[RigRegion] | None = None, preserve_face: bool = False) -> dict:

        if regions is not None or preserve_face:
            return self.generate_regions(contents, regions or [], preserve_face)

        # 캐릭터 이미지 분석
        geometry = character_service.analyze(contents)

        # 원본 이미지 읽기
        with Image.open(BytesIO(contents)) as image:
            rgba = np.array(ImageOps.exif_transpose(image).convert("RGBA"))

        height, width = rgba.shape[:2]

        rgb = rgba[:, :, :3].copy()
        alpha = rgba[:, :, 3].copy()

        # 분리 가능한 얼굴 파츠
        supported_types = {
            "left_eye",
            "right_eye",
            "left_eyebrow",
            "right_eyebrow",
            "nose",
            "mouth",
        }

        features = [
            feature
            for feature in geometry["features"]
            if feature["type"] in supported_types
        ]

        if not features:
            raise ValueError(
                "분리할 수 있는 얼굴 파츠가 없습니다."
            )

        # 캐릭터별 고유 ID 및 저장 폴더 생성
        rig_id = uuid4().hex

        save_dir = self.output_dir / rig_id

        save_dir.mkdir(
            parents=True,
            exist_ok=True
        )

        # 전체 파츠 제거 영역
        removal_mask = np.zeros(
            (height, width),
            dtype=np.uint8
        )

        parts = []

        # ========================================
        # 얼굴 파츠 추출
        # ========================================

        for feature in features:

            part_type = feature["type"]
            bounds = feature["bounds"]

            # 안티앨리어싱 픽셀을 고려한 여백
            padding = 2

            x1 = max(0, bounds["x"] - padding)
            y1 = max(0, bounds["y"] - padding)

            x2 = min(
                width,
                bounds["x"] + bounds["width"] + padding
            )

            y2 = min(
                height,
                bounds["y"] + bounds["height"] + padding
            )

            # 파츠 영역 잘라내기
            crop = rgba[y1:y2, x1:x2].copy()

            gray = cv2.cvtColor(
                crop,
                cv2.COLOR_RGBA2GRAY
            )

            # 어두운 특징 영역 추출
            part_mask = cv2.inRange(gray, 0, 140)

            # 기존 투명 영역 제외
            part_mask[crop[:, :, 3] == 0] = 0

            if not np.any(part_mask):
                continue

            # 파츠 외부 픽셀 투명 처리
            crop[:, :, 3] = np.minimum(
                crop[:, :, 3],
                part_mask
            )

            filename = f"{part_type}.png"

            # 투명 PNG 저장
            Image.fromarray(crop).save(
                save_dir / filename
            )

            # 입 파츠라면 말하기용 이미지 생성
            if part_type == "mouth":
                self.create_mouth_variants(
                crop,
                save_dir
            )

            # 원본에서 제거할 영역 등록
            kernel = np.ones(
                (3, 3),
                dtype=np.uint8
            )

            expanded_mask = cv2.dilate(
                part_mask,
                kernel,
                iterations=1
            )

            removal_mask[y1:y2, x1:x2] = (
                cv2.bitwise_or(
                    removal_mask[y1:y2, x1:x2],
                    expanded_mask
                )
            )

            # 파츠 위치 기록
            parts.append({
                "id": part_type,
                "type": (
                    "eyes"
                    if part_type.endswith("_eye")
                    else "eyebrow"
                    if part_type.endswith("_eyebrow")
                    else "nose"
                    if part_type == "nose"
                    else "mouth"
                ),
                "src": filename,
                "x": x1,
                "y": y1,
                "width": x2 - x1,
                "height": y2 - y1,
                "pivotX": 0.5,
                "pivotY": 0.5,
                "zIndex": 1
            })

        # ========================================
        # 원본 이미지 복원 (Inpainting)
        # ========================================

        restored_rgb = cv2.inpaint(
            rgb,
            removal_mask,
            3,
            cv2.INPAINT_TELEA
        )

        # 기존 투명도 복구
        restored_rgba = np.dstack(
            (restored_rgb, alpha)
        )

        # 얼굴 파츠가 제거된 이미지 저장
        Image.fromarray(restored_rgba).save(
            save_dir / "base.png"
        )

        # 기본 이미지 레이어
        parts.insert(0, {
            "id": "base",
            "type": "body",
            "src": "base.png",
            "x": 0,
            "y": 0,
            "width": width,
            "height": height,
            "pivotX": 0.5,
            "pivotY": 0.5,
            "zIndex": 0
        })

        # ========================================
        # 리깅 데이터 생성
        # ========================================

        rig = {
            "id": rig_id,
            "name": "Custom Character",
            "canvas": {
                "width": width,
                "height": height
            },
            "parts": parts,
            "expressions": {},
            "mouthVariants": (
                {
                    "closed": "mouth_closed.png",
                    "half": "mouth_half.png",
                    "open": "mouth_open.png"
                }
                if any(part["id"] == "mouth" for part in parts)
                else None
            )
        }

        # JSON 파일 저장
        with open(
            save_dir / "rig.json",
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                rig,
                file,
                ensure_ascii=False,
                indent=2
            )

        return rig

    def generate_regions(self, contents: bytes, regions: list[RigRegion], preserve_face: bool = False) -> dict:
        """Extract user-confirmed polygons. Facial details are removed from the
        underlying image first; structural layers then partition its silhouette."""
        if (not regions and not preserve_face) or len(regions) > 15 or len({r.id for r in regions}) != len(regions):
            raise ValueError("한 개 이상의 고유한 파츠 영역을 지정해 주세요.")
        with Image.open(BytesIO(contents)) as image:
            rgba = np.array(ImageOps.exif_transpose(image).convert("RGBA"))
        height, width = rgba.shape[:2]
        alpha = rgba[:, :, 3]
        gray = cv2.cvtColor(rgba, cv2.COLOR_RGBA2GRAY)
        face_ids = {"left_eye", "right_eye", "left_eyebrow", "right_eyebrow", "nose", "mouth"}
        types = {
            "left_eye": "eyes", "right_eye": "eyes",
            "left_eyebrow": "eyebrow", "right_eyebrow": "eyebrow",
            "left_arm": "arm", "right_arm": "arm", "left_leg": "leg", "right_leg": "leg",
            "torso": "body",
        }
        # Visible small details and overlapping limbs have priority over the
        # underlying torso. Unassigned pixels remain in the residual body layer.
        structural_priority = ["hair", "accessory", "left_arm", "right_arm", "left_leg", "right_leg", "tail", "head", "torso"]
        structural_z = {"tail": 1, "torso": 2, "left_leg": 3, "right_leg": 3, "left_arm": 4, "right_arm": 4, "head": 10, "hair": 20, "accessory": 22}
        by_id = {r.id: r for r in regions}
        facial_claimed = np.zeros((height, width), dtype=np.uint8)
        facial_removal = np.zeros_like(facial_claimed)
        structural_claimed = np.zeros_like(facial_claimed)
        structural_masks = {}
        assets = []

        def polygon_mask(region):
            mask = np.zeros((height, width), dtype=np.uint8)
            points = np.array([
                [round(point.x * (width - 1)), round(point.y * (height - 1))]
                for point in region.points
            ], dtype=np.int32)
            cv2.fillPoly(mask, [points], 255)
            mask[alpha == 0] = 0
            if region.id in face_ids and region.mode == "detail":
                mask[gray > 140] = 0
            return mask

        def extract(region, source, mask, z):
            pixels = cv2.findNonZero(mask)
            if pixels is None:
                raise ValueError(f"{region.id} 영역에 분리할 픽셀이 없어요. 윤곽을 다시 지정해 주세요.")
            x, y, w, h = cv2.boundingRect(pixels)
            crop = source[y:y+h, x:x+w].copy()
            crop[:, :, 3] = np.minimum(crop[:, :, 3], mask[y:y+h, x:x+w])
            part = {
                "id": region.id, "type": types.get(region.id, region.id),
                "src": f"{region.id}.png", "x": x, "y": y, "width": w, "height": h,
                "pivotX": float(np.clip((region.pivot.x * (width - 1) - x) / max(1, w), 0, 1)),
                "pivotY": float(np.clip((region.pivot.y * (height - 1) - y) / max(1, h), 0, 1)),
                "zIndex": z,
            }
            assets.append((part, crop))

        for region in regions:
            if region.id not in face_ids or preserve_face:
                continue
            mask = polygon_mask(region)
            mask[facial_claimed > 0] = 0
            extract(region, rgba, mask, 30)
            facial_claimed = cv2.bitwise_or(facial_claimed, mask)
            # Exact, hand-confirmed outlines shouldn't erase neighboring
            # line art. Expand only heuristic dark-feature masks.
            removal = cv2.dilate(mask, np.ones((3, 3), dtype=np.uint8)) if region.mode == "detail" else mask
            facial_removal = cv2.bitwise_or(facial_removal, removal)

        restored_rgb = cv2.inpaint(rgba[:, :, :3].copy(), facial_removal, 3, cv2.INPAINT_TELEA) if np.any(facial_removal) else rgba[:, :, :3].copy()
        restored = np.dstack((restored_rgb, alpha))
        for part_id in structural_priority:
            region = by_id.get(part_id)
            if not region:
                continue
            mask = polygon_mask(region)
            mask[structural_claimed > 0] = 0
            extract(region, restored, mask, structural_z[part_id])
            structural_masks[part_id] = mask
            structural_claimed = cv2.bitwise_or(structural_claimed, mask)

        base = restored.copy()
        base[:, :, 3][structural_claimed > 0] = 0
        # Keep a hidden overlap under mobile joints. A strict cut along the
        # neckline/shoulder previously exposed a transparent slit when a layer
        # rotated. Limit it to the original silhouette and the joint area,
        # rather than leaving a second, ghosted copy of the entire moving part.
        static_mask = np.where(base[:, :, 3] > 0, 255, 0).astype(np.uint8)
        if "torso" in structural_masks:
            static_mask = cv2.bitwise_or(static_mask, structural_masks["torso"])
        if np.any(static_mask):
            padding = max(2, min(20, round(min(width, height) * .018)))
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2*padding + 1, 2*padding + 1))
            neighbors = cv2.dilate(static_mask, kernel)
            support = np.zeros_like(structural_claimed)
            for part_id in ("head", "left_arm", "right_arm", "left_leg", "right_leg", "tail"):
                mask = structural_masks.get(part_id)
                if mask is None:
                    continue
                region = by_id[part_id]
                _, _, part_w, part_h = cv2.boundingRect(mask)
                radius = max(padding * 3, round(min(part_w, part_h) * .32) + padding)
                joint = np.zeros_like(support)
                center = (round(region.pivot.x * (width - 1)), round(region.pivot.y * (height - 1)))
                cv2.circle(joint, center, radius, 255, -1)
                bridge = cv2.bitwise_and(cv2.bitwise_and(mask, neighbors), joint)
                support = cv2.bitwise_or(support, bridge)
            if np.any(support):
                # Fill support from neighboring colors to reduce exposed seams
                # without retaining the moving part's hard contour underneath.
                filled = cv2.inpaint(restored_rgb, support, 3, cv2.INPAINT_TELEA)
                base[:, :, :3][support > 0] = filled[support > 0]
                base[:, :, 3][support > 0] = alpha[support > 0]
        base_part = {"id": "base", "type": "body", "src": "base.png", "x": 0, "y": 0,
                     "width": width, "height": height, "pivotX": .5, "pivotY": .5, "zIndex": 0}
        rig_id = uuid4().hex
        save_dir = self.output_dir / rig_id
        save_dir.mkdir(parents=True, exist_ok=True)
        Image.fromarray(base).save(save_dir / "base.png")
        for part, crop in assets:
            Image.fromarray(crop).save(save_dir / part["src"])
            if part["id"] == "mouth":
                self.create_mouth_variants(crop, save_dir)
        rig = {
            "id": rig_id, "name": "Custom Character", "canvas": {"width": width, "height": height},
            "partLayoutVersion": 2,
            "preserveFace": preserve_face,
            "parts": [base_part] + sorted([part for part, _ in assets], key=lambda p: p["zIndex"]),
            "expressions": {}, "mouthVariants": {"closed": "mouth_closed.png", "half": "mouth_half.png", "open": "mouth_open.png"} if any(part["id"] == "mouth" for part, _ in assets) else None,
        }
        if preserve_face:
            # Keep every original pixel and the confirmed control regions. The
            # mesh renderer deforms one continuous texture; no facial cutouts
            # or inpainted skin are needed. Existing parts remain a fallback.
            Image.fromarray(rgba).save(save_dir / "mesh.png")
            rig["mesh"] = {
                "src": "mesh.png",
                "regions": [region.model_dump(mode="json") for region in regions],
            }
        (save_dir / "rig.json").write_text(json.dumps(rig, ensure_ascii=False, indent=2), encoding="utf-8")
        return rig

    def generate_with_expressions(self, contents, regions, preserve_face, expressions):
        rig = self.generate(contents, regions, preserve_face)
        if expressions:
            rig["expressionRigs"] = {}
            for emotion, image, layout in expressions:
                variant = self.generate_regions(image, layout, preserve_face=True)
                variant["assetBase"] = f"/generated/{variant['id']}/"
                rig["expressionRigs"][emotion] = variant
            (self.output_dir / rig["id"] / "rig.json").write_text(json.dumps(rig, ensure_ascii=False, indent=2), encoding="utf-8")
        return rig


rig_service = RigService()
