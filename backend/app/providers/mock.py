from app.providers.base import AIProvider
from app.schemas.ai import AIResponse, CharacterReaction


class MockAIProvider(AIProvider):

    def generate(self, message: str) -> AIResponse:

        if "안녕" in message:
            return AIResponse(
                reply="안녕! 오늘은 어떤 이야기를 나눠볼까?",
                reaction=CharacterReaction(
                    emotion="happy",
                    intensity=0.6,
                    action="nod",
                ),
            )

        if "행복" in message or "기뻐" in message:
            return AIResponse(
                reply="정말 좋은 일이 있었나 보네! 나도 기분이 좋아!",
                reaction=CharacterReaction(
                    emotion="happy",
                    intensity=0.9,
                    action="bounce",
                ),
            )

        if "슬퍼" in message or "힘들어" in message:
            return AIResponse(
                reply="많이 힘들었겠다. 내가 이야기를 들어줄게.",
                reaction=CharacterReaction(
                    emotion="sad",
                    intensity=0.7,
                    action="nod",
                ),
            )

        if "놀랐" in message:
            return AIResponse(
                reply="정말? 무슨 일이 있었던 거야?",
                reaction=CharacterReaction(
                    emotion="surprised",
                    intensity=0.9,
                    action="bounce",
                ),
            )

        return AIResponse(
            reply="흥미로운 이야기네! 조금 더 자세히 말해줄래?",
            reaction=CharacterReaction(
                emotion="neutral",
                intensity=0.5,
                action="idle",
            ),
        )