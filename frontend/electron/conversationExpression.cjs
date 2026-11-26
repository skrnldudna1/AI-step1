const SITUATIONS = {
  casual: { label: '일상 이야기', emotions: ['neutral', 'happy', 'affectionate'], fallback: 'neutral', intensity: .5, max: .65, actions: ['idle', 'nod'] },
  explaining: { label: '설명·정보 전달', emotions: ['neutral', 'happy', 'confused'], fallback: 'neutral', intensity: .5, max: .55, actions: ['idle', 'nod'] },
  empathizing: { label: '슬픔·상실·실패·서운함에 공감', emotions: ['sad'], fallback: 'sad', intensity: .55, max: .7, actions: ['idle', 'nod'] },
  reassuring: { label: '격려·안심', emotions: ['affectionate', 'happy', 'neutral'], fallback: 'affectionate', intensity: .5, max: .7, actions: ['idle', 'nod'] },
  celebrating: { label: '축하·함께 기뻐함', emotions: ['happy', 'excited', 'surprised', 'affectionate'], fallback: 'happy', intensity: .65, max: .9, actions: ['idle', 'nod', 'bounce'] },
  playing: { label: '실제로 웃긴 일·농담·가벼운 장난', emotions: ['playful'], fallback: 'playful', intensity: .65, max: .8, actions: ['idle', 'nod', 'shake', 'bounce'] },
  affection: { label: '친근함·다정함', emotions: ['affectionate', 'happy', 'shy', 'neutral'], fallback: 'affectionate', intensity: .55, max: .7, actions: ['idle', 'nod'] },
  surprised: { label: '예상 밖의 실제 소식', emotions: ['surprised', 'confused', 'happy', 'neutral'], fallback: 'surprised', intensity: .6, max: .75, actions: ['idle', 'nod'] },
  clarifying: { label: '질문·확인·함께 생각', emotions: ['neutral', 'confused'], fallback: 'neutral', intensity: .5, max: .55, actions: ['idle', 'nod'] },
  apologizing: { label: '미안함·실수를 바로잡음', emotions: ['neutral', 'sad', 'shy'], fallback: 'sad', intensity: .4, max: .55, actions: ['idle', 'nod'] },
  serious: { label: '걱정·진지한 상황·부당한 일', emotions: ['neutral', 'sad', 'angry', 'affectionate'], fallback: 'neutral', intensity: .5, max: .65, actions: ['idle', 'nod', 'shake'] },
  winding_down: { label: '휴식·작별·잠들기', emotions: ['sleepy', 'neutral', 'affectionate'], fallback: 'neutral', intensity: .5, max: .55, actions: ['idle', 'nod'] },
};

function expressionInstructions(previousSituation) {
  const lines = [
    '표정은 사용자 메시지의 감정 단어가 아니라, 지금까지의 user·assistant 대화 흐름 전체와 캐릭터가 방금 작성할 reply를 해석하여 결정한다.',
    '먼저 대화에서 실제로 일어난 사건과 상대가 느낄 만한 분위기를 파악한다. 상황의 의미와 작성할 답변의 의도를 함께 판단해 situation을 정하고 캐릭터 표정과 행동을 선택한다.',
    '상대가 슬퍼할 만한 상실, 이별, 실패, 속상한 일이 중심이면 슬픔의 단어가 없어도 empathizing/sad로 공감한다. 위로하는 문장이 다정하다는 이유만으로 행복 또는 중립으로 바꾸지 않는다. 불안이나 어려운 과제를 격려하는 상황은 reassuring, 진지한 위험·문제는 serious다.',
    '실제 웃긴 에피소드, 유쾌한 농담이나 장난이면 playing/playful을 우선한다. 단순 칭찬이나 축하는 affection/celebrating이다. 웃음 표시가 없더라도 맥락이 웃기면 장난스러운 표정을 선택한다.',
    '이전 대사와 해결되지 않은 상황을 고려한다. 짧은 "응", "그렇구나"도 이어지는 맥락을 따른다. 반대로 새로운 소식으로 분위기가 바뀌면 즉시 새 상황을 선택한다.',
    '부정문, 인용, 가정, 과거 이야기, 이모지와 단어 자체는 표정을 발동시키지 않는다. 힘든 상황에서 습관적으로 ㅋㅋ/ㅎㅎ를 쓰거나 반어법을 써도 장난으로 분류하지 않는다. 분노나 슬픔의 강도는 과장하지 않는다.',
    '수습·설명·집중 상황에서는 중립이나 작고 자연스러운 반응이 좋다. 불확실한 단서에는 성급한 놀람이나 신남을 피한다. 기본 표정도 좋은 선택이다.',
    '예: 시험에 실패했다는 이야기 뒤 "응"이라고 할 때는 empathizing 또는 reassuring; 이후 "그래도 합격했어!"라는 실제 좋은 소식이 나오면 celebrating. "행복이라는 단어 뜻이 뭐야?"는 explaining, 행복 표정을 강제하지 않는다.',
    '예: "오늘 반려견이 무지개다리를 건넜어" → empathizing/sad, "고양이가 화상회의에서 팀장 대신 계속 야옹하더라" → playing/playful, "진짜 신난다… 면접 또 떨어졌네" → empathizing/sad. 단어가 아니라 상황의 의미를 우선한다.',
    '상황별 자연스러운 반응 후보: ' + Object.entries(SITUATIONS).map(([id, rule]) => id + '(' + rule.label + '): ' + rule.emotions.join('/') + ', ' + rule.actions.join('/')).join('; '),
    '강도는 대개 0.3~0.65, neutral은 0.5. 통통 튀기는 진짜 축하하거나 분위기가 충분히 장난스러울 때만 사용한다.',
  ];
  if (Object.hasOwn(SITUATIONS, previousSituation)) lines.push('직전 실제 답변의 상황은 ' + previousSituation + '였지만, 새 맥락에 따라 바꿀 수 있다.');
  return lines.join('\n');
}

function normalizeContextualReaction(situation, reaction) {
  if (!Object.hasOwn(SITUATIONS, situation)) return null;
  const rule = SITUATIONS[situation];
  const compatible = rule.emotions.includes(reaction.emotion);
  const emotion = compatible ? reaction.emotion : rule.fallback;
  const intensity = emotion === 'neutral' ? .5 : Math.min(rule.max, compatible ? reaction.intensity : rule.intensity);
  const action = rule.actions.includes(reaction.action) && compatible ? reaction.action : 'idle';
  return { emotion, intensity, action };
}

module.exports = { SITUATIONS, expressionInstructions, normalizeContextualReaction };
