from app.providers.base import AIProvider


class MockAIProvider(AIProvider):

    def generate(self, message: str) -> str:

        if "안녕" in message:
            return "안녕! 오늘은 어떤 이야기를 나눠볼까?"

        if "행복" in message or "기뻐" in message:
            return "정말 좋은 일이 있었나 보네! 나도 기분이 좋아!"

        if "슬퍼" in message or "힘들어" in message:
            return "많이 힘들었겠다. 내가 이야기를 들어줄게."

        if "놀랐" in message:
            return "정말? 무슨 일이 있었던 거야?"

        return "흥미로운 이야기네! 조금 더 자세히 말해줄래?"