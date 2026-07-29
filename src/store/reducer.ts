import type { Action } from './actions'
import { MAX_CHARACTER_NAME_LENGTH, type Character } from './schema'
import type { Store } from './types'

const normalizeName = (name: string): string | null => {
  const trimmed = name.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_CHARACTER_NAME_LENGTH) {
    return null
  }
  return trimmed
}

const DUPLICATE_NAME_SUFFIX = ' のコピー'

const buildDuplicateName = (sourceName: string): string => {
  const maxSourceLength =
    MAX_CHARACTER_NAME_LENGTH - DUPLICATE_NAME_SUFFIX.length
  const truncatedSource = sourceName.slice(0, maxSourceLength)
  return `${truncatedSource}${DUPLICATE_NAME_SUFFIX}`
}

const removeProgressEntry = (
  progress: Store['progress'],
  characterId: string,
): Store['progress'] => {
  const next = { ...progress }
  delete next[characterId]
  return next
}

const hasCharacter = (store: Store, id: string): boolean =>
  store.characters.some((character) => character.id === id)

export const reducer = (store: Store, action: Action): Store => {
  switch (action.type) {
    case 'addCharacter': {
      const name = normalizeName(action.name)
      if (name === null) {
        return store
      }
      const character: Character = {
        id: crypto.randomUUID(),
        name,
        createdAt: new Date().toISOString(),
      }
      return {
        ...store,
        characters: [...store.characters, character],
      }
    }

    case 'renameCharacter': {
      const name = normalizeName(action.name)
      if (name === null) {
        return store
      }
      if (!hasCharacter(store, action.id)) {
        return store
      }
      return {
        ...store,
        characters: store.characters.map((character) =>
          character.id === action.id ? { ...character, name } : character,
        ),
      }
    }

    case 'duplicateCharacter': {
      const source = store.characters.find(
        (character) => character.id === action.id,
      )
      if (source === undefined) {
        return store
      }
      const character: Character = {
        id: crypto.randomUUID(),
        name: buildDuplicateName(source.name),
        createdAt: new Date().toISOString(),
      }
      const sourceProgress = store.progress[source.id] ?? {}
      return {
        ...store,
        characters: [...store.characters, character],
        progress: {
          ...store.progress,
          [character.id]: { ...sourceProgress },
        },
      }
    }

    case 'removeCharacter': {
      if (!hasCharacter(store, action.id)) {
        return store
      }
      return {
        ...store,
        characters: store.characters.filter(
          (character) => character.id !== action.id,
        ),
        progress: removeProgressEntry(store.progress, action.id),
      }
    }

    case 'setProgress': {
      if (!Number.isInteger(action.value) || action.value < 0) {
        return store
      }
      if (!hasCharacter(store, action.characterId)) {
        return store
      }
      const characterProgress = store.progress[action.characterId] ?? {}
      return {
        ...store,
        progress: {
          ...store.progress,
          [action.characterId]: {
            ...characterProgress,
            [action.taskId]: action.value,
          },
        },
      }
    }
  }
}
