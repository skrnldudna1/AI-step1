from app.providers.base import AIProvider
from app.schemas.ai import AIResponse, CharacterProfile, CharacterReaction


# Each set preserves the same five intents, with distinct personalities and speech styles.
# This is deterministic offline behavior until a real AI provider is integrated.
REPLIES = {
    ("warm", "casual"): (
        "안녕! 오늘도 네 이야기를 들어줄게.",
        "정말 잘됐다! 나도 덩달아 행복해. 무슨 일이 있었어?",
        "많이 힘들었겠다. 괜찮아, 내가 곁에서 이야기를 들어줄게.",
        "정말 놀랐겠구나! 어떤 일이 있었는지 들려줄래?",
        "그랬구나. 조금 더 이야기해 줘. 네 생각이 궁금해.",
    ),
    ("warm", "polite"): (
        "안녕하세요! 편하게 이야기해 주세요.",
        "정말 기쁜 일이 있었군요! 저도 함께 기뻐하고 싶어요.",
        "많이 힘드셨겠어요. 곁에서 이야기를 들어 드릴게요.",
        "정말 놀라셨겠어요. 무슨 일이 있었나요?",
        "그랬군요. 조금 더 들려주실래요? 천천히 들어 드릴게요.",
    ),
    ("warm", "brief"): (
        "안녕! 언제든 이야기해.",
        "정말 잘됐다! 축하해.",
        "힘들었지. 내가 곁에 있어.",
        "놀랐겠다! 무슨 일이야?",
        "응, 더 이야기해 줘.",
    ),
    ("playful", "casual"): (
        "안녕! 오늘도 신나게 뭐 해볼까?",
        "와아! 축하 파티다! 좋은 소식 더 들려줘!",
        "으앗, 오늘은 힘든 날이었구나. 내가 기운을 보태 줄게!",
        "헉, 진짜?! 완전 궁금해졌어!",
        "오호, 흥미진진한데? 다음 이야기도 들려줘!",
    ),
    ("playful", "polite"): (
        "안녕하세요! 오늘은 어떤 재미있는 일이 펼쳐질까요?",
        "와, 정말 신나는 소식이네요! 함께 축하해요!",
        "오늘은 조금 힘드셨군요. 제가 응원을 보태 드릴게요!",
        "어머, 정말요?! 너무 궁금해요!",
        "오, 재미있는 이야기네요! 다음 이야기도 듣고 싶어요.",
    ),
    ("playful", "brief"): (
        "안녕! 놀아 볼까?",
        "와아! 축하해!",
        "힘내! 내가 응원할게!",
        "헉, 진짜?!",
        "오! 더 들려줘!",
    ),
    ("calm", "casual"): (
        "안녕. 천천히 이야기해도 괜찮아.",
        "좋은 일이 있었구나. 그 기쁨을 천천히 즐겨 봐.",
        "지금은 잠깐 쉬어도 괜찮아. 서두르지 말자.",
        "뜻밖의 일이었구나. 차분히 이야기해 볼까?",
        "그렇구나. 천천히 네 생각을 정리해도 괜찮아.",
    ),
    ("calm", "polite"): (
        "안녕하세요. 편안하게 이야기 나눠요.",
        "좋은 일이 있었군요. 그 기쁨을 여유롭게 즐겨 보세요.",
        "힘든 시간이셨군요. 잠시 쉬어 가도 괜찮아요.",
        "뜻밖의 일이었겠어요. 차분히 이야기해 봐요.",
        "그렇군요. 천천히 생각을 나눠 주세요.",
    ),
    ("calm", "brief"): (
        "안녕. 편하게 쉬어.",
        "좋은 순간이네. 즐겨 봐.",
        "잠시 쉬어도 괜찮아.",
        "그랬구나. 천천히 말해.",
        "응. 천천히 생각해 봐.",
    ),
    ("focused", "casual"): (
        "안녕! 오늘 함께할 목표가 있을까?",
        "잘했어! 이번에 잘 된 점을 기억해 두자.",
        "힘들었겠다. 지금 필요한 것부터 하나씩 정리해 볼까?",
        "예상 못 한 일이었구나. 상황부터 차근차근 살펴보자.",
        "좋아, 핵심을 함께 정리해 보자. 어떤 부분이 가장 중요해?",
    ),
    ("focused", "polite"): (
        "안녕하세요. 오늘의 목표를 함께 정해 볼까요?",
        "정말 잘하셨어요! 잘 된 점을 다음에도 활용해 봐요.",
        "힘드셨겠어요. 지금 필요한 것부터 정리해 볼까요?",
        "예상치 못한 일이었군요. 상황을 차근차근 살펴봐요.",
        "좋습니다. 핵심은 무엇인지 함께 정리해 볼까요?",
    ),
    ("focused", "brief"): (
        "안녕! 오늘 목표는?",
        "잘했어. 성공한 점을 기록해 둬.",
        "힘들었지. 하나씩 정리하자.",
        "놀랐겠다. 상황부터 확인하자.",
        "좋아. 핵심부터 정리하자.",
    ),
}

# The extra emotional intents use the same speech styles as the original
# profile-aware mock, ready for an eventual structured AI response.
EXTRA_EMOTIONS = {
    "excited": (("신나", "신났", "신남", "대박", "설레", "설렌", "최고"), 0.95, "bounce"),
    "shy": (("부끄", "쑥쓰", "쑥스", "창피", "민망"), 0.65, "idle"),
    "angry": (("화나", "화났", "화남", "화가", "짜증", "열받", "억울"), 0.8, "shake"),
    "confused": (("당황", "헷갈", "혼란", "모르겠", "갸웃"), 0.65, "idle"),
    "sleepy": (("졸려", "졸립", "졸림", "졸음", "피곤", "잘래", "잠 와", "잠와"), 0.45, "idle"),
    "playful": (("장난", "농담", "윙크", "놀리"), 0.75, "idle"),
    "affectionate": (("사랑", "좋아해", "보고 싶", "보고싶", "고마워", "소중", "애정", "귀여워", "안아"), 0.8, "idle"),
}

EXTRA_REPLIES = {
    "excited": ("와! 나까지 신나네. 좋은 순간을 제대로 즐겨 보자!", "와, 저도 덩달아 신나요! 이 기분을 마음껏 즐겨 보세요.", "와! 정말 신나!"),
    "shy": ("조금 쑥스러웠구나. 괜찮아, 편하게 있어도 돼.", "조금 쑥스러우셨군요. 편안하게 이야기해 주세요.", "쑥스럽지? 괜찮아."),
    "angry": ("화가 난 이유가 있었겠지. 어떤 일이 있었는지 들어볼게.", "화가 나실 만한 일이 있었군요. 차근차근 이야기해 주세요.", "화났겠다. 말해 줘."),
    "confused": ("어라, 조금 헷갈리는 상황이구나. 하나씩 살펴보자.", "조금 헷갈리시는군요. 하나씩 함께 살펴볼까요?", "어라? 하나씩 봐 보자."),
    "sleepy": ("하암, 많이 피곤했구나. 오늘은 조금 쉬어도 괜찮아.", "많이 피곤하셨겠어요. 잠시 쉬어 가셔도 괜찮아요.", "하암... 푹 쉬어."),
    "playful": ("히히, 오늘은 장난기가 좀 생겼는데? 재미있는 이야기 더 해 줘!", "후후, 재미있네요! 가볍게 농담을 나눠 볼까요?", "히히, 재밌네!"),
    "affectionate": ("따뜻한 말 고마워! 나도 너와 함께하는 시간이 소중해.", "따뜻한 말씀 고마워요. 함께하는 시간이 참 소중해요.", "고마워! 함께해서 좋아."),
}

TONE_INDEX = {"casual": 0, "polite": 1, "brief": 2}
PERSONALITY_TAILS = {
    "playful": (" 우리답게 기분 좋은 순간을 찾아보자!", " 우리답게 기분 좋은 순간을 찾아봐요!", " 같이 해 보자!"),
    "calm": (" 서두르지 않아도 괜찮아.", " 마음이 가는 속도로 해도 괜찮아요.", " 천천히 하자."),
    "focused": (" 지금 할 수 있는 것부터 하나씩 생각해 보자.", " 지금 할 수 있는 것부터 하나씩 생각해 볼까요?", " 하나씩 정리하자."),
}


class MockAIProvider(AIProvider):
    def generate(self, message: str, profile: CharacterProfile | None = None) -> AIResponse:
        profile = profile or CharacterProfile()
        templates = REPLIES[(profile.personality, profile.tone)]
        if "이름" in message and any(word in message for word in ("너", "뭐", "누구", "알려", "네", "니")):
            reply = (
                f"제 이름은 {profile.name}입니다."
                if profile.tone == "polite"
                else f"내 이름은 {profile.name}!"
            )
            return AIResponse(reply=reply, reaction=CharacterReaction(emotion="happy", intensity=0.6, action="nod"))

        for emotion, (keywords, intensity, action) in EXTRA_EMOTIONS.items():
            if any(keyword in message for keyword in keywords):
                index = TONE_INDEX[profile.tone]
                reply = EXTRA_REPLIES[emotion][index]
                if profile.personality in PERSONALITY_TAILS and profile.tone != "brief":
                    reply += PERSONALITY_TAILS[profile.personality][index]
                if profile.personality == "calm":
                    intensity = max(0.3, intensity - 0.25)
                    action = "nod" if action == "bounce" else action
                elif profile.personality == "playful" and emotion in ("excited", "playful", "affectionate"):
                    intensity = min(1.0, intensity + 0.1)
                return AIResponse(reply=reply, reaction=CharacterReaction(emotion=emotion, intensity=intensity, action=action))

        if "슬퍼" in message or "힘들어" in message:
            index, emotion, intensity, action = 2, "sad", 0.7, "nod"
        elif "행복" in message or "기뻐" in message:
            index, emotion, intensity, action = 1, "happy", 0.9, "bounce"
        elif "놀랐" in message:
            index, emotion, intensity, action = 3, "surprised", 0.9, "bounce"
        elif "안녕" in message:
            index, emotion, intensity, action = 0, "happy", 0.6, "nod"
        else:
            index, emotion, intensity, action = 4, "neutral", 0.5, "idle"

        if profile.personality == "playful" and emotion in ("happy", "surprised"):
            intensity, action = min(1.0, intensity + 0.1), "bounce"
        elif profile.personality == "calm":
            intensity = max(0.3, intensity - 0.25)
            if action == "bounce":
                action = "nod"

        return AIResponse(
            reply=templates[index],
            reaction=CharacterReaction(emotion=emotion, intensity=intensity, action=action),
        )
