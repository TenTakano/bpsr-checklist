export type Action =
  | { type: 'addCharacter'; name: string }
  | { type: 'renameCharacter'; id: string; name: string }
  | { type: 'duplicateCharacter'; id: string }
  | { type: 'removeCharacter'; id: string }
  | { type: 'setProgress'; characterId: string; taskId: string; value: number }
  | { type: 'evaluateReset'; now: Date }

export const addCharacter = (name: string): Action => ({
  type: 'addCharacter',
  name,
})

export const renameCharacter = (id: string, name: string): Action => ({
  type: 'renameCharacter',
  id,
  name,
})

export const duplicateCharacter = (id: string): Action => ({
  type: 'duplicateCharacter',
  id,
})

export const removeCharacter = (id: string): Action => ({
  type: 'removeCharacter',
  id,
})

export const setProgress = (
  characterId: string,
  taskId: string,
  value: number,
): Action => ({
  type: 'setProgress',
  characterId,
  taskId,
  value,
})

export const evaluateReset = (now: Date): Action => ({
  type: 'evaluateReset',
  now,
})
