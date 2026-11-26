from typing import Literal

from pydantic import BaseModel, Field, field_validator


Emotion = Literal[
    "neutral",
    "happy",
    "excited",
    "sad",
    "shy",
    "angry",
    "confused",
    "sleepy",
    "surprised",
    "playful",
    "affectionate",
]

Action = Literal[
    "idle",
    "nod",
    "shake",
    "bounce",
]

ConversationSituation = Literal[
    "casual", "explaining", "empathizing", "reassuring", "celebrating",
    "playing", "affection", "surprised", "clarifying", "apologizing",
    "serious", "winding_down",
]


class CharacterReaction(BaseModel):
    emotion: Emotion = "neutral"
    intensity: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
    )
    action: Action = "idle"


class AIResponse(BaseModel):
    reply: str
    reaction: CharacterReaction
    situation: ConversationSituation | None = None


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class CharacterProfile(BaseModel):
    name: str = Field(default="Companion", min_length=1, max_length=24)
    personality: Literal["warm", "playful", "calm", "focused"] = "warm"
    tone: Literal["casual", "polite", "brief"] = "casual"

    @field_validator("name", mode="before")
    @classmethod
    def clean_name(cls, value):
        if isinstance(value, str):
            value = value.strip()
            if any(ord(char) < 32 or ord(char) == 127 for char in value):
                raise ValueError("캐릭터 이름에 줄바꿈이나 제어 문자를 사용할 수 없습니다.")
        return value
