import os
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from openai import OpenAIError
from app.providers.openai_provider import ModelReply, OpenAIProvider, ProviderError
from app.schemas.ai import CharacterProfile, ChatTurn
from app.services.ai_service import create_ai_service


class OpenAIProviderTests(unittest.TestCase):
    def setUp(self):
        self.client = Mock()
        self.provider = OpenAIProvider("test-model", client=self.client)

    def test_structured_response_preserves_reaction_and_profile(self):
        self.client.responses.parse.return_value = SimpleNamespace(output_parsed=ModelReply(
            reply="모찌가 응원할게!", situation="reassuring", reaction={"emotion": "affectionate", "intensity": .6, "action": "nod"}
        ))
        answer = self.provider.generate("오늘 힘들었어", CharacterProfile(name="모찌", personality="calm", tone="polite"),
                                        [ChatTurn(role="user", content="안녕"), ChatTurn(role="assistant", content="반가워요")], "empathizing")
        self.assertEqual(answer.reaction.emotion, "affectionate")
        self.assertEqual(answer.reaction.intensity, .6)
        self.assertEqual(answer.situation, "reassuring")
        kwargs = self.client.responses.parse.call_args.kwargs
        self.assertEqual(kwargs["model"], "test-model")
        self.assertFalse(kwargs["store"])
        self.assertIn("모찌", kwargs["instructions"])
        self.assertIn("차분하고", kwargs["instructions"])
        self.assertIn("존댓말", kwargs["instructions"])
        self.assertIn("직전 답변의 상황은 empathizing", kwargs["instructions"])
        self.assertEqual(kwargs["input"][-1], {"role": "user", "content": "오늘 힘들었어"})
        self.assertEqual(len(kwargs["input"]), 3)
        self.assertIs(kwargs["text_format"], ModelReply)

    def test_conversation_situation_limits_inappropriate_expressions(self):
        self.client.responses.parse.return_value = SimpleNamespace(output_parsed=ModelReply(
            reply="괜찮아. 천천히 해 보자.", situation="empathizing",
            reaction={"emotion": "excited", "intensity": 1, "action": "bounce"}
        ))
        answer = self.provider.generate("응", history=[ChatTurn(role="user", content="오늘 너무 속상해")])
        self.assertEqual(answer.reaction.emotion, "sad")
        self.assertEqual(answer.reaction.action, "idle")
        self.assertEqual(answer.reaction.intensity, .55)

    def test_refusal_and_provider_errors_are_safe(self):
        self.client.responses.parse.return_value = SimpleNamespace(output_parsed=None)
        with self.assertRaises(ProviderError):
            self.provider.generate("test")
        self.client.responses.parse.side_effect = OpenAIError("private provider payload")
        with self.assertRaises(ProviderError) as ctx:
            self.provider.generate("test")
        self.assertNotIn("private provider payload", str(ctx.exception))

    def test_mode_is_explicit_and_missing_key_is_not_silently_mocked(self):
        with patch.dict(os.environ, {"STEP1_AI_PROVIDER": "mock"}, clear=True):
            _, mode, ready = create_ai_service()
            self.assertEqual((mode, ready), ("mock", True))
        with patch.dict(os.environ, {"STEP1_AI_PROVIDER": "openai"}, clear=True):
            service, mode, ready = create_ai_service()
            self.assertEqual((mode, ready), ("openai", False))
            with self.assertRaises(ProviderError):
                service.chat("안녕")
        with patch.dict(os.environ, {"STEP1_AI_PROVIDER": "openai", "OPENAI_API_KEY": "test-key"}, clear=True), patch("app.services.ai_service.OpenAIProvider"):
            _, mode, ready = create_ai_service()
            self.assertEqual((mode, ready), ("openai", True))
