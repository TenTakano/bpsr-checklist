import { describe, expect, it } from 'vitest'
import { emptyStore } from '../test/fixtures'
import {
  addCharacter,
  duplicateCharacter,
  removeCharacter,
  renameCharacter,
  setProgress,
} from './actions'
import { reducer } from './reducer'

describe('reducer / addCharacter', () => {
  it('appends a character with a trimmed name', () => {
    const result = reducer(emptyStore(), addCharacter('  Alice  '))
    expect(result.characters).toHaveLength(1)
    expect(result.characters[0].name).toBe('Alice')
    expect(result.characters[0].id).toBeTruthy()
    expect(result.characters[0].createdAt).toBeTruthy()
  })

  it('rejects an empty (or whitespace-only) name', () => {
    const store = emptyStore()
    expect(reducer(store, addCharacter('   '))).toBe(store)
  })

  it('rejects a name longer than 50 characters', () => {
    const store = emptyStore()
    expect(reducer(store, addCharacter('a'.repeat(51)))).toBe(store)
  })

  it('accepts a name exactly at the 50 character limit', () => {
    const result = reducer(emptyStore(), addCharacter('a'.repeat(50)))
    expect(result.characters[0].name).toHaveLength(50)
  })
})

describe('reducer / renameCharacter', () => {
  it('renames an existing character', () => {
    const withCharacter = reducer(emptyStore(), addCharacter('Alice'))
    const id = withCharacter.characters[0].id
    const result = reducer(withCharacter, renameCharacter(id, 'Bob'))
    expect(result.characters[0].name).toBe('Bob')
  })

  it('is a no-op when the character does not exist', () => {
    const store = emptyStore()
    expect(reducer(store, renameCharacter('missing', 'Bob'))).toBe(store)
  })

  it('is a no-op when the new name is empty after trim', () => {
    const withCharacter = reducer(emptyStore(), addCharacter('Alice'))
    const id = withCharacter.characters[0].id
    const result = reducer(withCharacter, renameCharacter(id, '   '))
    expect(result).toBe(withCharacter)
  })
})

describe('reducer / duplicateCharacter', () => {
  it('duplicates a character together with its progress', () => {
    const withCharacter = reducer(emptyStore(), addCharacter('Alice'))
    const id = withCharacter.characters[0].id
    const withProgress = reducer(withCharacter, setProgress(id, 'daily_a', 3))
    const result = reducer(withProgress, duplicateCharacter(id))

    expect(result.characters).toHaveLength(2)
    const copy = result.characters[1]
    expect(copy.name).toBe('Alice のコピー')
    expect(copy.id).not.toBe(id)
    expect(result.progress[copy.id]).toEqual({ daily_a: 3 })
    expect(result.progress[id]).toEqual({ daily_a: 3 })
  })

  it('is a no-op when the source character does not exist', () => {
    const store = emptyStore()
    expect(reducer(store, duplicateCharacter('missing'))).toBe(store)
  })

  it('truncates the duplicated name so it never exceeds the 50 character limit', () => {
    const withCharacter = reducer(emptyStore(), addCharacter('a'.repeat(50)))
    const id = withCharacter.characters[0].id
    const result = reducer(withCharacter, duplicateCharacter(id))
    const copy = result.characters[1]
    expect(copy.name.length).toBeLessThanOrEqual(50)
    expect(copy.name).toBe(`${'a'.repeat(45)} のコピー`)
  })
})

describe('reducer / removeCharacter', () => {
  it('removes the character and its progress entry', () => {
    const withCharacter = reducer(emptyStore(), addCharacter('Alice'))
    const id = withCharacter.characters[0].id
    const withProgress = reducer(withCharacter, setProgress(id, 'daily_a', 1))
    const result = reducer(withProgress, removeCharacter(id))

    expect(result.characters).toHaveLength(0)
    expect(result.progress[id]).toBeUndefined()
  })

  it('is a no-op when the character does not exist', () => {
    const store = emptyStore()
    expect(reducer(store, removeCharacter('missing'))).toBe(store)
  })
})

describe('reducer / setProgress', () => {
  it('sets a non-negative integer progress value', () => {
    const withCharacter = reducer(emptyStore(), addCharacter('Alice'))
    const id = withCharacter.characters[0].id
    const result = reducer(withCharacter, setProgress(id, 'daily_a', 2))
    expect(result.progress[id]).toEqual({ daily_a: 2 })
  })

  it('preserves other task progress entries for the same character', () => {
    const withCharacter = reducer(emptyStore(), addCharacter('Alice'))
    const id = withCharacter.characters[0].id
    const first = reducer(withCharacter, setProgress(id, 'daily_a', 1))
    const second = reducer(first, setProgress(id, 'daily_b', 2))
    expect(second.progress[id]).toEqual({ daily_a: 1, daily_b: 2 })
  })

  it('rejects negative values', () => {
    const withCharacter = reducer(emptyStore(), addCharacter('Alice'))
    const id = withCharacter.characters[0].id
    const result = reducer(withCharacter, setProgress(id, 'daily_a', -1))
    expect(result).toBe(withCharacter)
  })

  it('rejects non-integer values', () => {
    const withCharacter = reducer(emptyStore(), addCharacter('Alice'))
    const id = withCharacter.characters[0].id
    const result = reducer(withCharacter, setProgress(id, 'daily_a', 1.5))
    expect(result).toBe(withCharacter)
  })

  it('is a no-op when the character does not exist', () => {
    const store = emptyStore()
    expect(reducer(store, setProgress('missing', 'daily_a', 1))).toBe(store)
  })
})
