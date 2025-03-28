/* eslint-disable @typescript-eslint/no-explicit-any */
// created with chatgpt-4o

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
import { useState } from 'react'

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c == 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export default function DragDropDemo() {
  const [items, setItems] = useState<ItemOrGroup[]>([
    { id: uuidv4(), type: 'item', label: 'Item A' },
    {
      id: uuidv4(),
      type: 'group',
      label: 'Group 1',
      children: [
        { id: uuidv4(), type: 'item', label: 'Nested Item 1' },
        { id: uuidv4(), type: 'item', label: 'Nested Item 2' },
      ],
    },
    { id: uuidv4(), type: 'item', label: 'Item B' },
  ])
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)

  const sensors = useSensors(useSensor(PointerSensor))

  const findItemById = (id: UniqueIdentifier): ItemType | null => {
    for (const entry of items) {
      if (entry.type === 'item' && entry.id === id) return entry
      if (entry.type === 'group') {
        const child = entry.children.find((c) => c.id === id)
        if (child) return child
      }
    }
    return null
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return setActiveId(null)
    if (active.id === over.id) return setActiveId(null)

    let newItems = [...items]
    let draggedItem: ItemType | null = null

    // Remove the item from its previous position
    newItems = newItems.flatMap((entry: any) => {
      if (entry.type === 'item' && entry.id === active.id) {
        draggedItem = entry
        return []
      }
      if (entry.type === 'group') {
        const idx = entry.children.findIndex((c: any) => c.id === active.id)
        if (idx !== -1) {
          draggedItem = entry.children[idx]
          entry.children.splice(idx, 1)
        }
        return [entry]
      }
      return [entry]
    })

    if (!draggedItem) return setActiveId(null)

    // Drop inside a group
    newItems = newItems.map((entry) => {
      if (entry.type === 'group' && entry.id === over.id) {
        entry.children.push(draggedItem!)
      }
      return entry
    })

    // Drop between items
    if (!newItems.some((entry) => entry.id === over.id)) {
      const overIndex = items.findIndex((entry) => entry.id === over.id)
      newItems.splice(overIndex, 0, draggedItem)
    }

    setItems(newItems)
    setActiveId(null)
  }

  const createNewGroup = () => {
    setItems((prev) => [
      ...prev,
      {
        id: uuidv4(),
        type: 'group',
        label: `Group ${prev.filter((x) => x.type === 'group').length + 1}`,
        children: [],
      },
    ])
  }

  const removeGroup = (id: string) => {
    setItems((prev) =>
      prev.filter((entry) => entry.id !== id || entry.type !== 'group')
    )
  }

  return (
    <div className="p-4 max-w-xl mx-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((entry) => {
            if (entry.type === 'item') {
              return <SortableItem key={entry.id} item={entry} />
            }
            if (entry.type === 'group') {
              return (
                <SortableGroup
                  key={entry.id}
                  group={entry}
                  onRemove={() => removeGroup(entry.id)}
                />
              )
            }
            return null
          })}
        </SortableContext>

        <DragOverlay>
          {activeId ? (
            <div className="p-2 bg-gray-100 shadow">
              {findItemById(activeId)?.label}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <button
        onClick={createNewGroup}
        className="mt-4 text-sm text-blue-500 hover:underline"
      >
        + Create new group
      </button>
    </div>
  )
}

function SortableItem({ item }: { item: ItemType }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-2 border rounded mb-2 bg-white"
    >
      {item.label}
    </div>
  )
}

function SortableGroup({
  group,
  onRemove,
}: {
  group: GroupType
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: group.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-2 border border-blue-300 rounded mb-2 bg-blue-50"
    >
      <div className="flex justify-between items-center mb-2">
        <span>{group.label}</span>
        <button onClick={onRemove} className="text-xs text-red-500">
          Remove
        </button>
      </div>
      {group.children.map((item) => (
        <SortableItem key={item.id} item={item} />
      ))}
    </div>
  )
}

// ---- types.ts ----

export type ItemType = {
  id: string
  type: 'item'
  label: string
}

export type GroupType = {
  id: string
  type: 'group'
  label: string
  children: ItemType[]
}

export type ItemOrGroup = ItemType | GroupType
