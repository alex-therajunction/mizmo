export type RankingPayload = {
  version: 1
  updatedAt: number
  inbox: string[]
  outbox: Record<string, string[]>
  archived: string[]
  deleted: string[]
}

export function emptyRankings(): RankingPayload {
  return {
    version: 1,
    updatedAt: 0,
    inbox: [],
    outbox: {},
    archived: [],
    deleted: [],
  }
}

function validIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value.filter(
        (item): item is string => typeof item === 'string' && item.length > 0,
      ),
    ),
  )
}

export function parseRankingPayload(value: unknown): RankingPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const payload = value as Record<string, unknown>

  if (
    payload.version !== 1 ||
    typeof payload.updatedAt !== 'number' ||
    !Number.isFinite(payload.updatedAt) ||
    !payload.outbox ||
    typeof payload.outbox !== 'object' ||
    Array.isArray(payload.outbox)
  ) {
    return null
  }

  const outbox: Record<string, string[]> = {}

  for (const [pubkey, ids] of Object.entries(
    payload.outbox as Record<string, unknown>,
  )) {
    outbox[pubkey] = validIds(ids)
  }

  return {
    version: 1,
    updatedAt: payload.updatedAt,
    inbox: validIds(payload.inbox),
    outbox,
    archived: validIds(payload.archived),
    deleted: validIds(payload.deleted),
  }
}

export function orderRecords<T>(
  records: readonly T[],
  rankedIds: readonly string[],
  getId: (record: T) => string,
  getCreatedAt: (record: T) => number,
): T[] {
  const positions = new Map(rankedIds.map((id, index) => [id, index]))

  return [...records].sort((a, b) => {
    const aPosition = positions.get(getId(a))
    const bPosition = positions.get(getId(b))

    if (aPosition !== undefined && bPosition !== undefined) {
      return aPosition - bPosition
    }

    if (aPosition !== undefined) return 1
    if (bPosition !== undefined) return -1

    return (
      getCreatedAt(b) - getCreatedAt(a) ||
      getId(a).localeCompare(getId(b))
    )
  })
}

export function adjacentVisibleId(
  visibleIds: readonly string[],
  id: string,
  offset: -1 | 1,
): string | null {
  const index = visibleIds.indexOf(id)

  if (index === -1) return null

  return visibleIds[index + offset] ?? null
}

export function swapIds(
  ids: readonly string[],
  first: string,
  second: string,
): string[] {
  const next = [...ids]
  const firstIndex = next.indexOf(first)
  const secondIndex = next.indexOf(second)

  if (
    firstIndex === -1 ||
    secondIndex === -1 ||
    firstIndex === secondIndex
  ) {
    return next
  }

  ;[next[firstIndex], next[secondIndex]] = [
    next[secondIndex],
    next[firstIndex],
  ]

  return next
}

export function moveIdTo(
  ids: readonly string[],
  sourceId: string,
  targetId: string,
): string[] {
  const sourceIndex = ids.indexOf(sourceId)
  const targetIndex = ids.indexOf(targetId)

  if (
    sourceIndex === -1 ||
    targetIndex === -1 ||
    sourceIndex === targetIndex
  ) {
    return [...ids]
  }

  const next = [...ids]
  next.splice(sourceIndex, 1)
  const adjustedTarget = next.indexOf(targetId)
  next.splice(adjustedTarget + (sourceIndex < targetIndex ? 1 : 0), 0, sourceId)

  return next
}
