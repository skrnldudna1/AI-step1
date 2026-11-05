from app.providers.base import AIProvider
from app.providers.mock import MockAIProvider
from app.schemas.ai import AIResponse


class AIService:

    def __init__(self, provider: AIProvider):
        self.provider = provider

    def chat(self, message: str) -> AIResponse:
        return self.provider.generate(message)


# 현재는 무료 Mock AI 사용
ai_service = AIService(
    provider=MockAIProvider()
)