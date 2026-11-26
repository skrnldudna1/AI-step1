import json
import unittest
from pathlib import Path
from typing import get_args
from fastapi.testclient import TestClient
from unittest.mock import patch
from app.providers.mock import MockAIProvider
from app.services.ai_service import AIService
from app.schemas.ai import Emotion, ChatTurn
from main import app


class EmotionTests(unittest.TestCase):
    def test_schema_matches_electron_emotion_catalog(self):
        catalog_path = Path(__file__).resolve().parents[2] / "frontend/electron/emotionConfig.json"
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        self.assertEqual(set(get_args(Emotion)), set(catalog))
        self.assertEqual(len(catalog), 11)

    @patch("main.ai_service", AIService(MockAIProvider()))
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

    def test_mock_context_prioritizes_events_and_continuations(self):
        provider = MockAIProvider()
        self.assertEqual(provider.generate("오늘 반려견이 무지개다리를 건넜어").reaction.emotion, "sad")
        self.assertEqual(provider.generate("응", previous_situation="empathizing").reaction.emotion, "sad")
        self.assertEqual(provider.generate("응", history=[ChatTurn(role="user",content="면접에서 탈락했어")]).reaction.emotion, "sad")
        self.assertEqual(provider.generate("그래도 합격했어!", previous_situation="empathizing").reaction.emotion, "happy")
        self.assertEqual(provider.generate("완전 신난다... 면접 또 떨어졌네ㅋㅋ").reaction.emotion, "sad")
        self.assertEqual(provider.generate("고양이가 화상회의에서 야옹하더라").reaction.emotion, "playful")
        self.assertEqual(provider.generate("행복이라는 단어 뜻이 뭐야?").reaction.emotion, "neutral")


if __name__ == "__main__":
    unittest.main()
