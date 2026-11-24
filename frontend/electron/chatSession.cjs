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

function createChatSession({ request, publishChat, publishReaction }) {
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

  function updateReaction(patch) {
    const valid = validReactionPatch(patch);
    if (!valid || disposed) return;
    changeReaction({
      reaction: { ...reaction.reaction, ...valid },
      reactionId: (valid.action && valid.action !== 'idle') || (valid.emotion && valid.emotion !== reaction.reaction.emotion)
        ? reaction.reactionId + 1 : reaction.reactionId,
    });
    if (valid.action !== undefined) scheduleIdle();
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
      const response = await request(content, profile);
      if (disposed) return;
      const valid = validReactionPatch(response?.reaction);
      if (typeof response?.reply !== 'string' || !valid ||
          !valid.emotion || !valid.action || valid.intensity === undefined) {
        throw new Error('Invalid chat response');
      }
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
      }, Math.min(5000, Math.max(1000, response.reply.length * 80)));
    } catch (error) {
      if (disposed) return;
      console.error('채팅 API 오류:', error.message);
      changeChat({ messages: [...chat.messages, message('assistant', ERROR, profile.name)], isLoading: false, pendingSenderName: null });
      changeReaction({ isThinking: false, isTalking: false });
    }
  }

  function submit(input) {
    if (disposed || chat.isLoading || typeof input !== 'string') return false;
    const content = input.trim();
    if (!content || content.length > 4000) return false;
    clearTimeout(talkingTimer);
    const profile = { ...activeProfile };
    changeChat({ messages: [...chat.messages, message('user', content)], isLoading: true, pendingSenderName: profile.name });
    changeReaction({ isThinking: true, isTalking: false });
    void completeMessage(content, profile);
    return true;
  }

  return {
    getChat: () => chat,
    getReaction: () => reaction,
    submit,
    setProfile,
    updateReaction,
    dispose() {
      disposed = true;
      clearTimeout(talkingTimer);
      clearTimeout(actionTimer);
    },
  };
}

module.exports = { createChatSession };
