from abc import ABC, abstractmethod

from app.schemas.ai import AIResponse, CharacterProfile


class AIProvider(ABC):

    @abstractmethod
    def generate(self, message: str, profile: CharacterProfile | None = None) -> AIResponse:
        pass
