import cv2
import numpy as np
import json

from PIL import Image
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from app.services.character_service import character_service


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


    def generate(self, contents: bytes) -> dict:

        # 캐릭터 이미지 분석
        geometry = character_service.analyze(contents)

        # 원본 이미지 읽기
        with Image.open(BytesIO(contents)) as image:
            rgba = np.array(image.convert("RGBA"))

        height, width = rgba.shape[:2]

        rgb = rgba[:, :, :3].copy()
        alpha = rgba[:, :, 3].copy()

        # 분리 가능한 얼굴 파츠
        supported_types = {
            "left_eye",
            "right_eye",
            "left_eyebrow",
            "right_eyebrow",
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


rig_service = RigService()