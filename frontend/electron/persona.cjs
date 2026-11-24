const config = require('./personaConfig.json');
const characterTypes = Object.keys(config.defaults);

function validateProfile(value) {
  if (!value || typeof value !== 'object' || typeof value.name !== 'string') return null;
  const name = value.name.trim();
  if (!name || name.length > 24 || /[\x00-\x1f\x7f]/.test(name)) return null;
  if (typeof value.personality !== 'string' || typeof value.tone !== 'string' ||
      !Object.hasOwn(config.personalities, value.personality) || !Object.hasOwn(config.tones, value.tone)) return null;
  return { name, personality: value.personality, tone: value.tone };
}

function normalizeProfiles(value) {
  return Object.fromEntries(characterTypes.map(type => [
    type, validateProfile(value?.[type]) ?? { ...config.defaults[type] },
  ]));
}

function greeting(profile) {
  return config.personalities[profile.personality].greetings[profile.tone];
}

module.exports = { characterTypes, validateProfile, normalizeProfiles, greeting };
