const { randomUUID } = require('node:crypto');
const { greeting } = require('./persona.cjs');
const emotionConfig = require('./emotionConfig.json');

const ERROR = '서버 연결에 문제가 발생했어. 잠시 후 다시 시도해 줘.';
const emotions = Object.keys(emotionConfig);
const actions = ['idle', 'nod', 'shake', 'bounce'];

function message(role, content, senderName) {
  return { id: randomUUID(), role, content, ...(senderName ? { senderName } : {}) };
}

function validReactionPatch(patch) {
  if (!patch || typeof patch !== 'object') return null;
  const result = {};
  if (emotions.includes(patch.emotion)) result.emotion = patch.emotion;
  if (actions.includes(patch.action)) result.action = patch.action;
  if (typeof patch.intensity === 'number' && Number.isFinite(patch.intensity)) {
    result.intensity = Math.max(0, Math.min(1, patch.intensity));
  }
  return Object.keys(result).length ? result : null;
}

function createChatSession({ request, publishChat, publishReaction, emotionResetMs = 3500, contextKey = () => '', describeError = () => ERROR }) {
  let activeProfile = { name: 'Companion', personality: 'warm', tone: 'casual' };
  let chat = { messages: [message('assistant', greeting(activeProfile), activeProfile.name)], isLoading: false, pendingSenderName: null };
  let reaction = {
    reaction: { emotion: 'neutral', intensity: 0.5, action: 'idle' },
    isThinking: false,
    isTalking: false,
    reactionId: 0,
  };
  let talkingTimer;
  let actionTimer;
  let emotionTimer;
  const historyByProfile = new Map();
  const situationByProfile = new Map();
  let disposed = false;

  function changeChat(patch) {
    chat = { ...chat, ...patch };
    publishChat(chat);
  }

  function changeReaction(patch) {
    reaction = { ...reaction, ...patch };
    publishReaction(reaction);
  }

  function scheduleIdle() {
    clearTimeout(actionTimer);
    if (reaction.reaction.action !== 'idle') {
      actionTimer = setTimeout(() => {
        changeReaction({ reaction: { ...reaction.reaction, action: 'idle' } });
      }, 1000);
    }
  }

  function scheduleEmotionReset() {
    clearTimeout(emotionTimer);
    if (reaction.isThinking || reaction.isTalking ||
        (reaction.reaction.emotion === 'neutral' && reaction.reaction.intensity === 0.5)) return;
    emotionTimer = setTimeout(() => {
      changeReaction({ reaction: { ...reaction.reaction, emotion: 'neutral', intensity: 0.5 } });
    }, emotionResetMs);
  }

  function updateReaction(patch) {
    const valid = validReactionPatch(patch);
    if (!valid || disposed) return;
    changeReaction({
      reaction: { ...reaction.reaction, ...valid },
      reactionId: (valid.action && valid.action !== 'idle') || (valid.emotion && (valid.emotion !== 'neutral' || valid.emotion !== reaction.reaction.emotion))
        ? reaction.reactionId + 1 : reaction.reactionId,
    });
    if (valid.action !== undefined) scheduleIdle();
    if (valid.emotion !== undefined || valid.intensity !== undefined) scheduleEmotionReset();
  }

  function setProfile(profile) {
    if (disposed) return;
    activeProfile = { ...profile };
    // Preserve conversations already started and the names of their speakers.
    if (chat.messages.length === 1 && !chat.isLoading) {
      const first = chat.messages[0];
      changeChat({ messages: [{ ...first, content: greeting(activeProfile), senderName: activeProfile.name }] });
    }
  }

  async function completeMessage(content, profile) {
    try {
      const key = JSON.stringify([contextKey(), profile]);
      const history = historyByProfile.get(key) || [];
      const response = await request(content, profile, history, situationByProfile.get(key));
      if (disposed) return;
      const valid = validReactionPatch(response?.reaction);
      if (typeof response?.reply !== 'string' || !valid ||
          !valid.emotion || !valid.action || valid.intensity === undefined) {
        throw new Error('Invalid chat response');
      }
      historyByProfile.set(key, [...history, { role: 'user', content }, { role: 'assistant', content: response.reply.slice(0, 4000) }].slice(-12));
      if (typeof response.situation === 'string') situationByProfile.set(key, response.situation);
      changeChat({ messages: [...chat.messages, message('assistant', response.reply, profile.name)], isLoading: false, pendingSenderName: null });
      changeReaction({
        reaction: valid,
        isThinking: false,
        isTalking: true,
        reactionId: reaction.reactionId + 1,
      });
      scheduleIdle();
      talkingTimer = setTimeout(() => {
        changeReaction({ isTalking: false });
        scheduleEmotionReset();
      }, Math.min(5000, Math.max(1000, response.reply.length * 80)));
    } catch (error) {
      if (disposed) return;
      console.error('채팅 API 오류:', error?.constructor?.name || 'Error');
      changeChat({ messages: [...chat.messages, message('assistant', describeError(error), profile.name)], isLoading: false, pendingSenderName: null });
      changeReaction({ isThinking: false, isTalking: false });
      scheduleEmotionReset();
    }
  }

  function submit(input) {
    if (disposed || chat.isLoading || typeof input !== 'string') return false;
    const content = input.trim();
    if (!content || content.length > 4000) return false;
    clearTimeout(talkingTimer);
    clearTimeout(emotionTimer);
    const profile = { ...activeProfile };
    changeChat({ messages: [...chat.messages, message('user', content)], isLoading: true, pendingSenderName: profile.name });
    changeReaction({ isThinking: true, isTalking: false });
    void completeMessage(content, profile);
    return true;
  }

  function clear() {
    if (disposed || chat.isLoading) return false;
    clearTimeout(talkingTimer);
    clearTimeout(actionTimer);
    clearTimeout(emotionTimer);
    historyByProfile.clear();
    situationByProfile.clear();
    changeChat({ messages: [message('assistant', greeting(activeProfile), activeProfile.name)], isLoading: false, pendingSenderName: null });
    changeReaction({
      reaction: { emotion: 'neutral', intensity: 0.5, action: 'idle' },
      isThinking: false,
      isTalking: false,
      reactionId: reaction.reactionId + 1,
    });
    return true;
  }

  return {
    getChat: () => chat,
    getReaction: () => reaction,
    submit,
    clear,
    setProfile,
    updateReaction,
    dispose() {
      disposed = true;
      clearTimeout(talkingTimer);
      clearTimeout(actionTimer);
      clearTimeout(emotionTimer);
    },
  };
}

module.exports = { createChatSession };
