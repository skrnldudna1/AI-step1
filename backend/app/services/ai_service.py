from app.providers.base import AIProvider
from app.providers.mock import MockAIProvider


class AIService:

    def __init__(self, provider: AIProvider):
        self.provider = provider

    def chat(self, message: str) -> str:
        return self.provider.generate(message)


# 현재 사용할 AI Provider 설정
ai_service = AIService(
    provider=MockAIProvider()
)