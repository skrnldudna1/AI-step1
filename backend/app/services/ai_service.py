import os
from pathlib import Path

from dotenv import load_dotenv

from app.providers.base import AIProvider
from app.providers.mock import MockAIProvider
from app.providers.openai_provider import OpenAIProvider, ProviderError
from app.schemas.ai import AIResponse, CharacterProfile, ChatTurn, ConversationSituation


class AIService:

    def __init__(self, provider: AIProvider):
        self.provider = provider

    def chat(self, message: str, profile: CharacterProfile | None = None, history: list[ChatTurn] | None = None, previous_situation: ConversationSituation | None = None) -> AIResponse:
        return self.provider.generate(message, profile, history, previous_situation)


class UnavailableProvider(AIProvider):
    def generate(self, message, profile=None, history=None, previous_situation=None):
        raise ProviderError("OpenAI API 키 또는 AI 모드 설정을 확인해 주세요.")


def create_ai_service():
    mode = os.getenv("STEP1_AI_PROVIDER", "mock").strip().lower()
    if mode == "mock":
        return AIService(MockAIProvider()), "mock", True
    if mode == "openai" and os.getenv("OPENAI_API_KEY", "").strip():
        model = os.getenv("STEP1_OPENAI_MODEL", "gpt-4.1-mini").strip() or "gpt-4.1-mini"
        return AIService(OpenAIProvider(model)), "openai", True
    return AIService(UnavailableProvider()), mode if mode == "openai" else "invalid", False


load_dotenv(Path(__file__).resolve().parents[2] / ".env")
ai_service, ai_mode, ai_configured = create_ai_service()
