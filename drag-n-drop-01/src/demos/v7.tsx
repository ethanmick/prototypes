import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import React, { useState } from 'react'

// Define types
interface BaseElement {
  id: string
  type: 'item' | 'group'
}

interface Item extends BaseElement {
  type: 'item'
  content: string
}

interface Group extends BaseElement {
  type: 'group'
  title: string
}

type DragElement = Item | Group

// SortableElement component
const SortableElement: React.FC<{
  element: DragElement
  isOverGroup?: boolean
}> = ({ element, isOverGroup }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 0 : 1,
  }

  if (element.type === 'group') {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`p-4 mb-2 border-2 rounded shadow-sm cursor-grab min-h-[4rem] flex flex-col justify-center ${
          isOverGroup
            ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-500'
            : 'bg-blue-50 border-blue-300'
        }`}
      >
        <h3 className="font-semibold text-blue-700">{element.title}</h3>
        <p className="text-sm text-blue-500">Group</p>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-4 mb-2 bg-white border border-gray-200 rounded shadow-sm cursor-grab flex items-center"
    >
      {element.content}
    </div>
  )
}

// Item renderer for the overlay
const ItemRenderer: React.FC<{ element: DragElement }> = ({ element }) => {
  if (element.type === 'group') {
    return (
      <div className="p-4 mb-2 bg-blue-50 border-2 border-blue-300 rounded shadow-sm cursor-grabbing min-h-[4rem] flex flex-col justify-center">
        <h3 className="font-semibold text-blue-700">{element.title}</h3>
        <p className="text-sm text-blue-500">Group</p>
      </div>
    )
  }

  return (
    <div className="p-4 mb-2 bg-white border border-gray-200 rounded shadow-sm cursor-grabbing flex items-center">
      {element.content}
    </div>
  )
}

// Main component
const DragAndDropDemo = () => {
  // Initial elements (items and groups)
  const [elements, setElements] = useState<DragElement[]>([
    { id: '1', type: 'item', content: 'Item 1' },
    { id: '2', type: 'group', title: 'Group A' },
    { id: '3', type: 'item', content: 'Item 2' },
    {
      id: '4',
      type: 'item',
      content: 'Item 3 with longer content to demonstrate flexible height',
    },
    { id: '5', type: 'group', title: 'Group B' },
    { id: '6', type: 'item', content: 'Item 4' },
  ])

  const [activeElement, setActiveElement] = useState<DragElement | null>(null)
  const [overGroupId, setOverGroupId] = useState<string | null>(null)

  // Configure sensors for mouse/touch and keyboard
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag start event
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const activeItem = elements.find((el) => el.id === active.id)
    if (activeItem) {
      setActiveElement(activeItem)
    }
  }

  // Handle drag over event
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event

    // Only track when an item is over a group
    const activeElement = elements.find((el) => el.id === active.id)

    if (over && activeElement?.type === 'item') {
      const overElement = elements.find((el) => el.id === over.id)

      if (overElement?.type === 'group') {
        setOverGroupId(over.id as string)
      } else {
        setOverGroupId(null)
      }
    } else {
      setOverGroupId(null)
    }
  }

  // Handle drag end event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    setActiveElement(null)
    setOverGroupId(null)

    if (over && active.id !== over.id) {
      setElements((elements) => {
        const oldIndex = elements.findIndex((el) => el.id === active.id)
        const newIndex = elements.findIndex((el) => el.id === over.id)

        return arrayMove(elements, oldIndex, newIndex)
      })
    }
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Sortable Items and Groups</h1>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={elements.map((el) => el.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {elements.map((element) => (
              <SortableElement
                key={element.id}
                element={element}
                isOverGroup={
                  element.type === 'group' && element.id === overGroupId
                }
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeElement ? <ItemRenderer element={activeElement} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

export default DragAndDropDemo
