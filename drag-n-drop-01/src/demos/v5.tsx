// created with o3-mini-high

import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  UniqueIdentifier,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import React, { useState } from 'react'

// Helper: move an element inside an array.
function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArray = array.slice()
  const [moved] = newArray.splice(from, 1)
  newArray.splice(to, 0, moved)
  return newArray
}

// Helper: parse a draggable id into its parts.
// We encode top-level items as "top-item-<id>"
// Group header: "group-<groupId>"
// Items in groups: "group-item-<groupId>-<itemId>"
function parseDraggableId(id: string) {
  if (id.startsWith('top-item-')) {
    return { type: 'top-item', itemId: id.slice('top-item-'.length) }
  } else if (id.startsWith('group-item-')) {
    const rest = id.slice('group-item-'.length)
    const dashIndex = rest.indexOf('-')
    const groupId = rest.slice(0, dashIndex)
    const itemId = rest.slice(dashIndex + 1)
    return { type: 'group-item', groupId, itemId }
  } else if (id.startsWith('group-')) {
    return { type: 'group', groupId: id.slice('group-'.length) }
  }
  return { type: 'unknown' }
}

// Types for our state.
type TopLevelEntry =
  | { type: 'item'; id: UniqueIdentifier; content: string }
  | { type: 'group'; id: UniqueIdentifier }

type GroupItem = { id: string; content: string }

//
// Main demo component
//
const Demo = () => {
  // Top-level list: items and groups interweaved.
  const [topLevel, setTopLevel] = useState<TopLevelEntry[]>([
    { type: 'item', id: '1', content: 'Item 1' },
    { type: 'group', id: 'g1' },
    { type: 'item', id: '2', content: 'Item 2' },
    { type: 'group', id: 'g2' },
    { type: 'item', id: '3', content: 'Item 3' },
  ])

  // For each group id, we store its items.
  const [groupItems, setGroupItems] = useState<Record<string, GroupItem[]>>({
    g1: [
      { id: '1', content: 'Group 1 - Item A' },
      { id: '2', content: 'Group 1 - Item B' },
    ],
    g2: [{ id: '1', content: 'Group 2 - Item A' }],
  })

  // State to show a drag overlay preview.
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [activeContent, setActiveContent] = useState<string>('')

  const sensors = useSensors(useSensor(PointerSensor))

  // For top-level SortableContext we use an array of string ids.
  const topLevelIds: UniqueIdentifier[] = topLevel.map((entry) =>
    entry.type === 'item' ? `top-item-${entry.id}` : `group-${entry.id}`
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id)
    const data = event.active.data.current
    setActiveContent(data?.content || '')
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) {
      setActiveId(null)
      return
    }
    const activeIdStr = active.id
    const overIdStr = over.id
    const activeData = active.data.current as {
      container: string
      content: string
    } | null
    const overData = over.data.current as {
      container: string
      content: string
    } | null
    if (!activeData || !overData) {
      setActiveId(null)
      return
    }
    // If dropped in the same container, reorder within that container.
    if (activeData.container === overData.container) {
      if (activeData.container === 'top') {
        const oldIndex = topLevelIds.indexOf(activeIdStr)
        const newIndex = topLevelIds.indexOf(overIdStr)
        if (oldIndex !== newIndex) {
          setTopLevel((prev) => arrayMove(prev, oldIndex, newIndex))
        }
      } else {
        // Reorder within a group.
        const groupId = activeData.container
        const items = (groupItems[groupId] || []).map(
          (item) => `group-item-${groupId}-${item.id}`
        ) as UniqueIdentifier[]
        const oldIndex = items.indexOf(activeIdStr)
        const newIndex = items.indexOf(overIdStr)
        if (oldIndex !== newIndex) {
          setGroupItems((prev) => ({
            ...prev,
            [groupId]: arrayMove(prev[groupId], oldIndex, newIndex),
          }))
        }
      }
    } else {
      // Cross-container move – only items (not groups) can be moved.
      const parsed = parseDraggableId(activeIdStr as string)
      if (parsed.type === 'unknown' || parsed.type === 'group') {
        setActiveId(null)
        return
      }
      // Get the moving item (its content is carried in the draggable’s data).
      const movingItem: GroupItem = {
        id: parsed.itemId as string,
        content: activeData.content,
      }

      // Remove from source container.
      if (activeData.container === 'top') {
        setTopLevel((prev) =>
          prev.filter(
            (entry) => !(entry.type === 'item' && entry.id === parsed.itemId)
          )
        )
      } else {
        setGroupItems((prev) => ({
          ...prev,
          [activeData.container]: prev[activeData.container].filter(
            (item) => item.id !== parsed.itemId
          ),
        }))
      }
      // Insert into destination container.
      if (overData.container === 'top') {
        // Determine insertion index in the topLevel array.
        const destIndex = topLevelIds.indexOf(overIdStr)
        setTopLevel((prev) => {
          const newEntry: TopLevelEntry = {
            type: 'item',
            id: movingItem.id,
            content: movingItem.content,
          }
          const newArr = [...prev]
          newArr.splice(destIndex, 0, newEntry)
          return newArr
        })
      } else {
        const destGroup = overData.container
        let destIndex = 0
        // If dropping on a placeholder (empty group), use index 0.
        if (overIdStr.toString().startsWith(`group-placeholder-${destGroup}`)) {
          destIndex = 0
        } else {
          const groupIds = (groupItems[destGroup] || []).map(
            (item) => `group-item-${destGroup}-${item.id}`
          )
          destIndex = groupIds.indexOf(overIdStr as string)
          if (destIndex === -1) {
            destIndex = (groupItems[destGroup] || []).length
          }
        }
        setGroupItems((prev) => {
          const destArr = prev[destGroup] || []
          const newArr = [...destArr]
          newArr.splice(destIndex, 0, movingItem)
          return { ...prev, [destGroup]: newArr }
        })
      }
    }
    setActiveId(null)
  }

  // Create a new group and add it to the top-level list.
  const createNewGroup = () => {
    const newGroupId = 'g' + (Object.keys(groupItems).length + 1)
    setTopLevel((prev) => [...prev, { type: 'group', id: newGroupId }])
    setGroupItems((prev) => ({ ...prev, [newGroupId]: [] }))
  }

  // Callback to update items inside a group.
  const updateGroupItems = (groupId: string, newItems: GroupItem[]) => {
    setGroupItems((prev) => ({ ...prev, [groupId]: newItems }))
  }

  // Remove a group (its items are removed as well).
  const removeGroup = (groupId: string) => {
    setTopLevel((prev) =>
      prev.filter((entry) => !(entry.type === 'group' && entry.id === groupId))
    )
    setGroupItems((prev) => {
      const newState = { ...prev }
      delete newState[groupId]
      return newState
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="p-4">
        {/* Top-level sortable context for ungrouped items and group headers */}
        <SortableContext
          items={topLevelIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {topLevel.map((entry) => {
              if (entry.type === 'item') {
                return <SortableTopItem key={entry.id} item={entry} />
              } else {
                return (
                  <SortableGroup
                    key={entry.id}
                    groupId={entry.id as string}
                    items={groupItems[entry.id] || []}
                    updateItems={updateGroupItems}
                    removeGroup={removeGroup}
                  />
                )
              }
            })}
          </div>
        </SortableContext>
        <button className="mt-4 text-sm text-blue-600" onClick={createNewGroup}>
          + Create New Group
        </button>
      </div>
      <DragOverlay>
        {activeId ? (
          <div className="p-2 bg-blue-200 border border-blue-400 rounded shadow">
            {activeContent}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

//
// Component for a top-level (ungrouped) item
//
type SortableTopItemProps = { item: { id: UniqueIdentifier; content: string } }

const SortableTopItem: React.FC<SortableTopItemProps> = ({ item }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: `top-item-${item.id}`,
      data: { container: 'top', content: item.content },
    })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-2 border rounded bg-white shadow"
    >
      {item.content}
    </div>
  )
}

//
// Component for a group (sortable header plus a droppable list of items)
//
type SortableGroupProps = {
  groupId: string
  items: GroupItem[]
  updateItems: (groupId: string, items: GroupItem[]) => void
  removeGroup: (groupId: string) => void
}

const SortableGroup: React.FC<SortableGroupProps> = ({
  groupId,
  items,
  removeGroup,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: `group-${groupId}`,
      data: { container: 'top', content: `Group ${groupId}` },
    })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const groupItemIds = items.map((item) => `group-item-${groupId}-${item.id}`)
  return (
    <div className="border p-2 rounded bg-gray-50">
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="flex justify-between items-center bg-gray-200 p-1 rounded"
      >
        <span>Group {groupId}</span>
        <button
          onClick={() => removeGroup(groupId)}
          className="text-red-500 text-xs"
        >
          Remove
        </button>
      </div>
      {/* Nested sortable context for the group's items */}
      <SortableContext
        items={groupItemIds}
        strategy={verticalListSortingStrategy}
      >
        <div className="mt-2 space-y-1">
          {items.length > 0 ? (
            items.map((item) => (
              <SortableGroupItem key={item.id} groupId={groupId} item={item} />
            ))
          ) : (
            <EmptyGroupPlaceholder groupId={groupId} />
          )}
        </div>
      </SortableContext>
    </div>
  )
}

//
// Component for an item inside a group
//
type SortableGroupItemProps = {
  groupId: string
  item: GroupItem
}

const SortableGroupItem: React.FC<SortableGroupItemProps> = ({
  groupId,
  item,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: `group-item-${groupId}-${item.id}`,
      data: { container: groupId, content: item.content },
    })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-2 border rounded bg-white shadow"
    >
      {item.content}
    </div>
  )
}

//
// When a group is empty, show a placeholder droppable area.
// (Its id is used in the onDragEnd handler to determine a drop at index 0.)
//
type EmptyGroupPlaceholderProps = { groupId: string }

const EmptyGroupPlaceholder: React.FC<EmptyGroupPlaceholderProps> = ({
  groupId,
}) => {
  return (
    <div
      id={`group-placeholder-${groupId}`}
      data-container={groupId}
      className="p-2 border-dashed border-2 border-gray-300 rounded text-center text-sm text-gray-500"
    >
      Drop items here
    </div>
  )
}

export default Demo
