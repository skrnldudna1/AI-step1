from abc import ABC, abstractmethod

from app.schemas.ai import AIResponse


class AIProvider(ABC):

    @abstractmethod
    def generate(self, message: str) -> AIResponse:
        pass