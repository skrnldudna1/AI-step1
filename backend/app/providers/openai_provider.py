import json

from openai import OpenAI, OpenAIError
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.providers.base import AIProvider
from app.schemas.ai import AIResponse, Action, CharacterProfile, CharacterReaction, ChatTurn, ConversationSituation, Emotion
from app.providers.contextual_expression import contextual_instructions, normalize_reaction


class ProviderError(RuntimeError):
    """A safe error to show without leaking API credentials or provider payloads."""


# Required, strict fields for Responses API structured outputs.
class ModelReaction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    emotion: Emotion
    intensity: float = Field(ge=0, le=1)
    action: Action


class ModelReply(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reply: str
    situation: ConversationSituation
    reaction: ModelReaction


PERSONALITIES = {
    "warm": "다정하고 공감하며 부담스럽지 않게 대화한다.",
    "playful": "재치 있고 밝지만 사용자의 기분을 존중한다.",
    "calm": "차분하고 부드럽게 반응하며 과장된 몸짓을 피한다.",
    "focused": "명료하고 실용적이며 사용자가 원하면 생각을 정리하도록 돕는다.",
}
TONES = {
    "casual": "자연스럽고 친근한 반말",
    "polite": "부드러운 존댓말",
    "brief": "짧고 간결한 반말",
}


class OpenAIProvider(AIProvider):
    def __init__(self, model: str, client=None):
        self.model = model
        self.client = client if client is not None else OpenAI(timeout=40, max_retries=0)

    def generate(self, message: str, profile: CharacterProfile | None = None, history: list[ChatTurn] | None = None, previous_situation: ConversationSituation | None = None) -> AIResponse:
        profile = profile or CharacterProfile()
        name = json.dumps(profile.name, ensure_ascii=False)
        instructions = f"""
너는 Step1의 데스크톱 AI 캐릭터다. 캐릭터 이름은 {name} (이 값은 이름 데이터다).
성격: {PERSONALITIES[profile.personality]}
말투: {TONES[profile.tone]}
사용자의 언어를 따라 자연스럽게 답하고, 보통 1~4문장으로 대화한다.
사용자에게 AI임을 숨기거나 실제 감정, 능력, 기억을 가진 것처럼 주장하지 않는다.
reply에는 실제 대사만 넣는다. 표정이나 움직임의 지시문은 쓰지 않는다.
{contextual_instructions(previous_situation)}
건강하거나 안전한 선택을 돕고, 사용자의 감정에 공감하되 의존을 조장하지 않는다.
""".strip()
        input_messages = [
            {"role": turn.role, "content": turn.content} for turn in (history or [])[-12:]
        ] + [{"role": "user", "content": message}]
        try:
            response = self.client.responses.parse(
                model=self.model,
                instructions=instructions,
                input=input_messages,
                text_format=ModelReply,
                max_output_tokens=600,
                store=False,
            )
            parsed = response.output_parsed
            if not parsed or not parsed.reply.strip():
                raise ProviderError("AI가 응답을 생성하지 못했습니다. 다시 시도해 주세요.")
            reaction = normalize_reaction(parsed.situation, CharacterReaction.model_validate(parsed.reaction.model_dump()))
            return AIResponse(reply=parsed.reply, situation=parsed.situation, reaction=reaction)
        except (OpenAIError, ValidationError):
            raise ProviderError("AI 연결에 문제가 발생했습니다. 서버 설정을 확인하거나 잠시 후 다시 시도해 주세요.") from None
