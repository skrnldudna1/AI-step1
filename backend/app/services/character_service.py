import cv2
import numpy as np

from PIL import Image
from io import BytesIO
from itertools import combinations


class CharacterService:

    def analyze(self, contents: bytes) -> dict:

        with Image.open(BytesIO(contents)) as image:
            rgba = np.array(image.convert("RGBA"))

        height, width = rgba.shape[:2]

        # 캐릭터 영역 마스크 생성
        alpha = rgba[:, :, 3]

        mask = np.where(
            alpha > 30, 255, 0
        ).astype(np.uint8)

        # 캐릭터 외곽선 검출
        contours, _ = cv2.findContours(
            mask,
            cv2.RETR_EXTERNAL,
            cv2.CHAIN_APPROX_SIMPLE
        )

        if not contours:
            raise ValueError("캐릭터 영역을 찾을 수 없습니다.")

        main_contour = max(
            contours,
            key=cv2.contourArea
        )

        x, y, w, h = cv2.boundingRect(main_contour)

        # 특징 후보 검출
        features = self.detect_features(
            rgba, mask, x, y, w, h
        )

        # 얼굴 특징 자동 분류
        features = self.classify_features(
            features, w, h
        )

        return {
            "canvas": {
                "width": width,
                "height": height
            },
            "bounds": {
                "x": int(x),
                "y": int(y),
                "width": int(w),
                "height": int(h)
            },
            "center": {
                "x": float(x + w / 2),
                "y": float(y + h / 2)
            },
            "has_transparent_background": bool(
                np.any(alpha == 0)
            ),
            "contour_count": len(contours),
            "features": features
        }

    # ========================================
    # 특징 후보 검출
    # ========================================

    def detect_features(
        self, rgba, mask, x, y, w, h
    ) -> list:

        gray = cv2.cvtColor(
            rgba,
            cv2.COLOR_RGBA2GRAY
        )

        dark_mask = cv2.inRange(gray, 0, 100)

        dark_mask = cv2.bitwise_and(
            dark_mask, mask
        )

        face_mask = np.zeros_like(mask)
        face_mask[y:y + int(h * 0.65), x:x + w] = 255

        dark_mask = cv2.bitwise_and(
            dark_mask, face_mask
        )

        count, labels, stats, centroids = (
            cv2.connectedComponentsWithStats(
                dark_mask,
                connectivity=8
            )
        )

        features = []

        for i in range(1, count):

            fx, fy, fw, fh, area = stats[i]

            if area < 3 or area > w * h * 0.03:
                continue

            if fw > w * 0.35 or fh > h * 0.25:
                continue

            cx, cy = centroids[i]

            features.append({
                "id": f"feature_{len(features) + 1}",
                "type": "unknown",
                "bounds": {
                    "x": int(fx),
                    "y": int(fy),
                    "width": int(fw),
                    "height": int(fh)
                },
                "center": {
                    "x": round(float(cx), 2),
                    "y": round(float(cy), 2)
                },
                "area": int(area)
            })

        return features

    # ========================================
    # 얼굴 특징 자동 분류
    # ========================================

    def classify_features(
        self, features, w, h
    ) -> list:

        if len(features) < 3:
            return features

        best_pair = None
        best_score = -1

        # 눈 후보 조합 탐색
        for a, b in combinations(features, 2):

            dx = abs(
                a["center"]["x"] - b["center"]["x"]
            )

            dy = abs(
                a["center"]["y"] - b["center"]["y"]
            )

            # 좌우 간격 검사
            if not w * 0.12 <= dx <= w * 0.55:
                continue

            # 높이 차이 검사
            if dy > dx * 0.45:
                continue

            # 크기 유사도 계산
            similarity = min(
                a["area"], b["area"]
            ) / max(
                a["area"], b["area"]
            )

            if similarity < 0.5:
                continue

            # 눈의 가로세로 비율
            ratio_a = (
                a["bounds"]["width"]
                / a["bounds"]["height"]
            )

            ratio_b = (
                b["bounds"]["width"]
                / b["bounds"]["height"]
            )

            if not 0.5 <= ratio_a <= 1.8:
                continue

            if not 0.5 <= ratio_b <= 1.8:
                continue

            # 각 눈 위에 눈썹 후보가 있는지 검사
            brow_count = 0

            for eye in [a, b]:

                for feature in features:

                    if feature in [a, b]:
                        continue

                    diff_x = abs(
                        feature["center"]["x"]
                        - eye["center"]["x"]
                    )

                    diff_y = (
                        eye["center"]["y"]
                        - feature["center"]["y"]
                    )

                    if (
                        diff_x < w * 0.08
                        and 0 < diff_y < h * 0.15
                    ):
                        brow_count += 1
                        break

            score = (
                similarity
                + brow_count * 0.7
                - dy / dx
            )

            if score > best_score:
                best_score = score
                best_pair = [a, b]

        if best_pair is None:
            return features

        # 화면 기준 왼쪽, 오른쪽 눈
        left_eye, right_eye = sorted(
            best_pair,
            key=lambda f: f["center"]["x"]
        )

        left_eye["type"] = "left_eye"
        right_eye["type"] = "right_eye"

        # 눈썹 분류
        for eye, brow_type in [
            (left_eye, "left_eyebrow"),
            (right_eye, "right_eyebrow")
        ]:

            candidates = []

            for feature in features:

                if feature["type"] != "unknown":
                    continue

                dx = abs(
                    feature["center"]["x"]
                    - eye["center"]["x"]
                )

                dy = (
                    eye["center"]["y"]
                    - feature["center"]["y"]
                )

                if (
                    dx < w * 0.08
                    and 0 < dy < h * 0.15
                ):
                    candidates.append(
                        (dx + dy, feature)
                    )

            if candidates:
                closest = min(
                    candidates,
                    key=lambda item: item[0]
                )[1]

                closest["type"] = brow_type

        # 두 눈 사이의 중심 좌표
        eye_center_x = (
            left_eye["center"]["x"]
            + right_eye["center"]["x"]
        ) / 2

        eye_center_y = (
            left_eye["center"]["y"]
            + right_eye["center"]["y"]
        ) / 2

        eye_distance = (
            right_eye["center"]["x"]
            - left_eye["center"]["x"]
        )

        # 입 후보 탐색
        mouth_candidates = []

        for feature in features:

            if feature["type"] != "unknown":
                continue

            dx = abs(
                feature["center"]["x"]
                - eye_center_x
            )

            dy = (
                feature["center"]["y"]
                - eye_center_y
            )

            if (
                dx < eye_distance * 0.45
                and 0 < dy < h * 0.25
            ):
                mouth_candidates.append(
                    (dx + dy * 0.5, feature)
                )

        if mouth_candidates:
            mouth = min(
                mouth_candidates,
                key=lambda item: item[0]
            )[1]

            mouth["type"] = "mouth"

        return features


character_service = CharacterService()