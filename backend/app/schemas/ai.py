from typing import Literal

from pydantic import BaseModel, Field


Emotion = Literal[
    "neutral",
    "happy",
    "sad",
    "surprised",
]

Action = Literal[
    "idle",
    "nod",
    "shake",
    "bounce",
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