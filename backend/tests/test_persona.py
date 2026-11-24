import unittest

from fastapi.testclient import TestClient

from main import app


class PersonaTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def chat(self, message, profile=None):
        payload = {"message": message}
        if profile is not None:
            payload["profile"] = profile
        return self.client.post("/api/chat", json=payload)

    def test_all_twelve_combinations_have_distinct_greetings(self):
        replies = set()
        for personality in ("warm", "playful", "calm", "focused"):
            for tone in ("casual", "polite", "brief"):
                profile = {"name": "별이", "personality": personality, "tone": tone}
                response = self.chat("안녕", profile)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["reaction"]["emotion"], "happy")
                replies.add(response.json()["reply"])
        self.assertEqual(len(replies), 12)

    def test_name_and_tone_in_response(self):
        for tone, expected in (("casual", "내 이름은 별이!"), ("polite", "제 이름은 별이입니다."), ("brief", "내 이름은 별이!")):
            response = self.chat("네 이름이 뭐야?", {"name": " 별이 ", "personality": "warm", "tone": tone})
            self.assertEqual(response.json()["reply"], expected)
        self.assertEqual(self.chat("안녕").status_code, 200)

    def test_personality_affects_reply_and_reaction(self):
        playful = self.chat("행복해", {"name": "포미", "personality": "playful", "tone": "casual"}).json()
        calm = self.chat("행복해", {"name": "루나", "personality": "calm", "tone": "casual"}).json()
        self.assertNotEqual(playful["reply"], calm["reply"])
        self.assertGreater(playful["reaction"]["intensity"], calm["reaction"]["intensity"])
        self.assertEqual(playful["reaction"]["action"], "bounce")
        self.assertEqual(calm["reaction"]["action"], "nod")

    def test_invalid_profile_is_rejected(self):
        base = {"name": "별이", "personality": "warm", "tone": "casual"}
        for invalid in ({"name": " "}, {"name": "a" * 25}, {"name": "a\nb"}, {"tone": "unknown"}, {"personality": "unknown"}):
            self.assertEqual(self.chat("안녕", {**base, **invalid}).status_code, 422)


if __name__ == "__main__":
    unittest.main()
