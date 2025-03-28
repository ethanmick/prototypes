import {
  closestCenter,
  DndContext,
  DragEndEvent,
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
const SortableElement: React.FC<{ element: DragElement }> = ({ element }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: element.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  if (element.type === 'group') {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="p-4 mb-2 bg-blue-50 border-2 border-blue-300 rounded shadow-sm cursor-grab min-h-[4rem] flex flex-col justify-center"
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

  // Configure sensors for mouse/touch and keyboard
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag end event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

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
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={elements.map((el) => el.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {elements.map((element) => (
              <SortableElement key={element.id} element={element} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

export default DragAndDropDemo
