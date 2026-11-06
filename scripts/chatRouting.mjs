const ENTITY_ALIASES = Object.freeze({
  ARICC: ['ARICC', 'Advanced Robotics and Intelligent Control Center', 'ARIC Center'],
  RIO: ['RIO', 'Research and Innovation Office'],
  CAESAR: ['CAESAR', 'Center for Advanced Environmental Science and Agriculture Research'],
  CBS: ['CBS', 'Center for Bulacan Studies', 'Bahay Saliksikan ng Bulacan'],
  FABLAB: ['FABLAB', 'Center for Fabrication and Manufacture', 'BulSU Fablab'],
  'BARAS TBI': ['BARAS TBI', 'DOST-BulSU BARAS Technology Business Incubator'],
  FIC: ['FIC', 'Food Innovation Center', 'Regional Food Innovation Center'],
  RECON: ['RECON', 'Resiliency Energy Continuity Center', 'RECON Center'],
});

function normalizeText(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeChatEntity(value = '') {
  const text = normalizeText(value).toLowerCase();
  if (!text) return '';
  const words = text.split(/\s+/);
  return Object.entries(ENTITY_ALIASES)
    .sort(([, left], [, right]) => right[0].length - left[0].length)
    .find(([, aliases]) => aliases.some((alias) => {
      const aliasWords = alias.toLowerCase().split(/\s+/);
      return aliasWords.every((word, index) => words[index] === word) || words.some((_, index) => aliasWords.every((word, offset) => words[index + offset] === word));
    }))?.[0] || '';
}

export function isFollowUpQuestion(message = '') {
  return /\b(it|its|they|them|their|this|that|these|those|the center|the office|the facility|the program|the services)\b/i.test(normalizeText(message));
}

export function isCurrentInformationQuestion(message = '') {
  return /\b(latest|recent|current|today|this week|this month|now|breaking|news|announcement|updates?)\b/i.test(normalizeText(message));
}

export function classifyChatQuestion(message = '', activeEntity = '') {
  const text = normalizeText(message);
  const explicitEntity = normalizeChatEntity(text);
  const contextualEntity = !explicitEntity && isFollowUpQuestion(text) ? normalizeChatEntity(activeEntity) : '';
  const entity = explicitEntity || contextualEntity;
  const institutional = Boolean(entity || /\b(bulsu|bulacan state university|university|campus|student services|enrollment|scholarships?)\b/i.test(text));
  const topic = isCurrentInformationQuestion(text) ? 'current' : institutional ? 'institutional' : 'general';
  return { topic, entity, useBulsuContext: topic === 'institutional', useWebSearch: topic === 'current' };
}

export function getWebSearchOptions(classification) {
  return classification?.useWebSearch && process.env.OPENROUTER_ENABLE_WEB_SEARCH === 'true'
    ? { plugins: [{ id: 'web', max_results: Number(process.env.OPENROUTER_WEB_MAX_RESULTS || 5) }] }
    : {};
}