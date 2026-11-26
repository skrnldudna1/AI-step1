from app.schemas.ai import CharacterReaction, ConversationSituation

# Each entry is: natural emotions, default emotion, default strength, maximum,
# natural actions. Keep behavior consistent with Electron's ChatGPT provider.
RULES = {
    "casual": ("neutral happy affectionate", "neutral", .5, .65, "idle nod"),
    "explaining": ("neutral happy confused", "neutral", .5, .55, "idle nod"),
    "empathizing": ("sad", "sad", .55, .7, "idle nod"),
    "reassuring": ("affectionate happy neutral", "affectionate", .5, .7, "idle nod"),
    "celebrating": ("happy excited surprised affectionate", "happy", .65, .9, "idle nod bounce"),
    "playing": ("playful", "playful", .65, .8, "idle nod shake bounce"),
    "affection": ("affectionate happy shy neutral", "affectionate", .55, .7, "idle nod"),
    "surprised": ("surprised confused happy neutral", "surprised", .6, .75, "idle nod"),
    "clarifying": ("neutral confused", "neutral", .5, .55, "idle nod"),
    "apologizing": ("neutral sad shy", "sad", .4, .55, "idle nod"),
    "serious": ("neutral sad angry affectionate", "neutral", .5, .65, "idle nod shake"),
    "winding_down": ("sleepy neutral affectionate", "neutral", .5, .55, "idle nod"),
}


def contextual_instructions(previous: ConversationSituation | None = None) -> str:
    rules = "; ".join(f"{name}: {emotions}, actions {actions}" for name, (emotions, _, _, _, actions) in RULES.items())
    instructions = f"""
표정은 사용자의 마지막 문장만 보고 결정하지 않는다. 최근 사용자와 어시스턴트의 대화 흐름, 해결되지 않은 상황, 그리고 방금 작성하는 reply의 뜻을 해석한다.
먼저 실제로 일어난 사건과 상대가 느낄 만한 분위기를 파악한다. 대화의 의미와 작성할 답변의 의도를 함께 판단해 situation을 선택하고 표정과 행동을 정한다.
상실, 이별, 실패, 속상한 일이 중심이면 슬픔의 단어가 없어도 empathizing/sad로 공감한다. 위로하는 문장이 다정하다는 이유만으로 중립이나 행복으로 바꾸지 않는다. 불안이나 과제를 격려하는 때는 reassuring, 진지한 위험이나 문제는 serious다.
실제 웃긴 에피소드, 유쾌한 농담과 장난은 playing/playful로 표현한다. 단순 칭찬이나 축하와 구별한다. 웃음 표시가 없더라도 상황이 웃기면 장난스러운 표정을 선택한다.
짧은 "응", "그렇구나"에도 이전 상황을 고려한다. 새로운 소식으로 맥락이 바뀌면 새로운 상황을 선택한다.
인용, 가정, 부정문, 과거 이야기, 이모지와 단어 자체를 실제 감정으로 착각하지 않는다. 힘든 상황의 습관적인 ㅋㅋ/ㅎㅎ나 반어법은 농담이 아니다.
슬픔이나 분노의 강도를 과장하지 않는다. 설명이나 불확실한 상황에서는 중립이나 작은 움직임을 선호한다.
예: 실패했다는 이야기 뒤의 "응"은 empathizing 또는 reassuring; "그래도 합격했어!"는 celebrating; "행복이라는 단어 뜻이 뭐야?"는 explaining.
예: "오늘 반려견이 무지개다리를 건넜어"는 empathizing/sad; "고양이가 화상회의에서 팀장 대신 야옹하더라"는 playing/playful; "진짜 신난다… 면접 또 떨어졌네"는 empathizing/sad. 단어보다 상황의 의미를 우선한다.
상황별 허용 감정과 움직임: {rules}
neutral은 0.5, 감정 강도는 대개 0.3~0.65. bounce는 진짜 축하나 장난스러운 대화에서만 선택한다.
""".strip()
    if previous in RULES:
        instructions += f"\n직전 답변의 상황은 {previous}였지만 새로운 맥락에 따라 바꿀 수 있다."
    return instructions


def normalize_reaction(situation: ConversationSituation, reaction: CharacterReaction) -> CharacterReaction:
    emotions, fallback, default, maximum, actions = RULES[situation]
    compatible = reaction.emotion in emotions.split()
    emotion = reaction.emotion if compatible else fallback
    intensity = .5 if emotion == "neutral" else min(maximum, reaction.intensity if compatible else default)
    action = reaction.action if compatible and reaction.action in actions.split() else "idle"
    return CharacterReaction(emotion=emotion, intensity=intensity, action=action)
