import json
import unittest
from pathlib import Path
from typing import get_args
from fastapi.testclient import TestClient
from app.schemas.ai import Emotion
from main import app


class EmotionTests(unittest.TestCase):
    def test_schema_matches_electron_emotion_catalog(self):
        catalog_path = Path(__file__).resolve().parents[2] / "frontend/electron/emotionConfig.json"
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        self.assertEqual(set(get_args(Emotion)), set(catalog))
        self.assertEqual(len(catalog), 11)

    def test_mock_api_can_return_every_emotion(self):
        cases = {
            "평범한 오늘": "neutral",
            "오늘 기뻐": "happy",
            "정말 신나": "excited",
            "너무 슬퍼": "sad",
            "부끄러워": "shy",
            "화가 나": "angry",
            "당황했어": "confused",
            "졸려": "sleepy",
            "정말 놀랐어": "surprised",
            "장난이야": "playful",
            "너를 좋아해": "affectionate",
        }
        client = TestClient(app)
        for text, expected in cases.items():
            for tone in ("casual", "polite", "brief"):
                response = client.post("/api/chat", json={"message": text, "profile": {
                    "name": "모찌", "personality": "warm", "tone": tone,
                }})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["reaction"]["emotion"], expected)
                self.assertTrue(response.json()["reply"])


if __name__ == "__main__":
    unittest.main()
