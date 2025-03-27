import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import React, { useState } from 'react'
import { createPortal } from 'react-dom'

// Types
interface Item {
  id: string
  content: string
}

interface Group {
  id: string
  title: string
  items: Item[]
}

type DraggableItem = Item | Group

// Components
const ItemCard: React.FC<{
  item: Item
  isDragging?: boolean
}> = ({ item, isDragging }) => {
  return (
    <div
      className={`p-4 bg-white rounded shadow mb-2 cursor-move ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      {item.content}
    </div>
  )
}

const GroupCard: React.FC<{
  group: Group
  isDragging?: boolean
  onRemove: () => void
}> = ({ group, isDragging, onRemove }) => {
  return (
    <div
      className={`p-4 bg-gray-100 rounded shadow mb-4 ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold">{group.title}</h3>
        <button
          onClick={onRemove}
          className="text-red-500 hover:text-red-700 text-sm"
        >
          Remove
        </button>
      </div>
      <SortableContext
        items={group.items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {group.items.map((item) => (
            <SortableItem key={item.id} item={item} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

const SortableItem: React.FC<{ item: Item }> = ({ item }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ItemCard item={item} isDragging={isDragging} />
    </div>
  )
}

const SortableGroup: React.FC<{
  group: Group
  onRemove: () => void
}> = ({ group, onRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <GroupCard group={group} isDragging={isDragging} onRemove={onRemove} />
    </div>
  )
}

const DragOverlayWrapper: React.FC<{
  activeId: string | null
  items: DraggableItem[]
}> = ({ activeId, items }) => {
  if (!activeId) return null

  const activeItem = items.find((item) => item.id === activeId)
  if (!activeItem) return null

  return createPortal(
    <div className="opacity-80">
      {'items' in activeItem ? (
        <GroupCard group={activeItem as Group} isDragging onRemove={() => {}} />
      ) : (
        <ItemCard item={activeItem as Item} isDragging />
      )}
    </div>,
    document.body
  )
}

// Main Component
export const DragNDropDemo: React.FC = () => {
  const [items, setItems] = useState<DraggableItem[]>([
    { id: 'item-1', content: 'Item 1' },
    { id: 'item-2', content: 'Item 2' },
    { id: 'item-3', content: 'Item 3' },
    {
      id: 'group-1',
      title: 'Group 1',
      items: [
        { id: 'group-1-item-1', content: 'Group 1 Item 1' },
        { id: 'group-1-item-2', content: 'Group 1 Item 2' },
      ],
    },
  ])

  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    if (active.id === over.id) return

    const oldIndex = items.findIndex((item) => item.id === active.id)
    const newIndex = items.findIndex((item) => item.id === over.id)

    setItems(arrayMove(items, oldIndex, newIndex))
  }

  const handleRemoveGroup = (groupId: string) => {
    setItems((prevItems) => {
      const group = prevItems.find((item) => item.id === groupId) as Group
      return [
        ...prevItems.filter((item) => item.id !== groupId),
        ...group.items,
      ]
    })
  }

  const handleAddGroup = () => {
    const newGroup: Group = {
      id: `group-${Date.now()}`,
      title: `New Group ${items.filter((item) => 'items' in item).length + 1}`,
      items: [],
    }
    setItems((prevItems) => [...prevItems, newGroup])
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {items.map((item) =>
              'items' in item ? (
                <SortableGroup
                  key={item.id}
                  group={item}
                  onRemove={() => handleRemoveGroup(item.id)}
                />
              ) : (
                <SortableItem key={item.id} item={item} />
              )
            )}
          </div>
        </SortableContext>

        <DragOverlay>
          <DragOverlayWrapper activeId={activeId} items={items} />
        </DragOverlay>
      </DndContext>

      <button
        onClick={handleAddGroup}
        className="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm"
      >
        Add New Group
      </button>
    </div>
  )
}
