import { useState, type FormEvent } from 'react'
import {
  addCharacter,
  duplicateCharacter,
  removeCharacter,
  renameCharacter,
} from '../store/actions'
import { useStore } from '../store/context'
import { MAX_CHARACTER_NAME_LENGTH } from '../store/schema'
import { NO_CHARACTERS_MESSAGE } from './messages'

export function CharacterManager() {
  const { store, status, message, dispatch } = useStore()
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const isReadOnly = status === 'readonly'

  const handleAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (newName.trim() === '') {
      return
    }
    dispatch(addCharacter(newName))
    setNewName('')
  }

  const startEditing = (id: string, currentName: string) => {
    setEditingId(id)
    setEditingName(currentName)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingName('')
  }

  const handleRenameSubmit = (
    event: FormEvent<HTMLFormElement>,
    id: string,
  ) => {
    event.preventDefault()
    if (editingName.trim() === '') {
      return
    }
    dispatch(renameCharacter(id, editingName))
    cancelEditing()
  }

  const handleDuplicate = (id: string) => {
    dispatch(duplicateCharacter(id))
  }

  const handleRemove = (id: string, name: string) => {
    const confirmed = window.confirm(
      `「${name}」を削除しますか？この操作は取り消せません。`,
    )
    if (!confirmed) {
      return
    }
    dispatch(removeCharacter(id))
  }

  return (
    <section aria-label="キャラクター管理">
      {message !== null && <p role="status">{message}</p>}

      <form onSubmit={handleAdd}>
        <label htmlFor="new-character-name">キャラクター名</label>
        <input
          id="new-character-name"
          value={newName}
          maxLength={MAX_CHARACTER_NAME_LENGTH}
          disabled={isReadOnly}
          onChange={(event) => setNewName(event.target.value)}
        />
        <button type="submit" disabled={isReadOnly}>
          追加
        </button>
      </form>

      {store.characters.length === 0 ? (
        <p>{NO_CHARACTERS_MESSAGE}</p>
      ) : (
        <ul>
          {store.characters.map((character) => (
            <li key={character.id}>
              {editingId === character.id ? (
                <form
                  onSubmit={(event) => handleRenameSubmit(event, character.id)}
                >
                  <label htmlFor={`rename-${character.id}`}>
                    {character.name} の新しい名前
                  </label>
                  <input
                    id={`rename-${character.id}`}
                    value={editingName}
                    maxLength={MAX_CHARACTER_NAME_LENGTH}
                    onChange={(event) => setEditingName(event.target.value)}
                  />
                  <button type="submit">保存</button>
                  <button type="button" onClick={cancelEditing}>
                    キャンセル
                  </button>
                </form>
              ) : (
                <>
                  <span>{character.name}</span>
                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => startEditing(character.id, character.name)}
                  >
                    リネーム
                  </button>
                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => handleDuplicate(character.id)}
                  >
                    複製
                  </button>
                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => handleRemove(character.id, character.name)}
                  >
                    削除
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
