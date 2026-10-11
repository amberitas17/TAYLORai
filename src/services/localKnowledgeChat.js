import {
  getOfflineUnavailableMessage,
  searchLocalKnowledge,
} from './localKnowledgeService.js';

function isNetworkFailure(error) {
  return /Network|network|fetch|Failed to fetch|aborted|temporarily unavailable/i.test(error?.message || '');
}

export async function resolveLocalFirstChat({ query, activeEntity = '', index, requestBackend }) {
  const localResult = searchLocalKnowledge(query, { activeEntity, index });
  if (localResult.match) {
    return { kind: 'local', result: localResult };
  }

  try {
    const response = await requestBackend(localResult);
    return { kind: 'backend', response, localResult };
  } catch (error) {
    if (!isNetworkFailure(error)) throw error;
    return {
      kind: 'unavailable',
      message: getOfflineUnavailableMessage(localResult.entity),
      localResult,
    };
  }
}

export default resolveLocalFirstChat;
