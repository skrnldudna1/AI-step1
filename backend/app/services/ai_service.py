from app.providers.base import AIProvider
from app.providers.mock import MockAIProvider
from app.schemas.ai import AIResponse, CharacterProfile


class AIService:

    def __init__(self, provider: AIProvider):
        self.provider = provider

    def chat(self, message: str, profile: CharacterProfile | None = None) -> AIResponse:
        return self.provider.generate(message, profile)


# 현재는 무료 Mock AI 사용
ai_service = AIService(
    provider=MockAIProvider()
)
