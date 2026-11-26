from abc import ABC, abstractmethod

from app.schemas.ai import AIResponse, CharacterProfile, ChatTurn, ConversationSituation


class AIProvider(ABC):

    @abstractmethod
    def generate(self, message: str, profile: CharacterProfile | None = None, history: list[ChatTurn] | None = None, previous_situation: ConversationSituation | None = None) -> AIResponse:
        pass
