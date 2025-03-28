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
import { useState } from 'react'

// Types
type ItemType = {
  id: string
  type: 'item'
  content: string
}

type GroupType = {
  id: string
  type: 'group'
  title: string
  items: ItemType[]
}

type ElementType = ItemType | GroupType

// Helper function to create a new item
const createItem = (): ItemType => ({
  id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  type: 'item',
  content: `Item ${Math.floor(Math.random() * 100)}`,
})

// Helper function to create a new group
const createGroup = (): GroupType => ({
  id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  type: 'group',
  title: `Group ${Math.floor(Math.random() * 100)}`,
  items: [],
})

// Individual Item Component
const Item = ({
  id,
  content,
  isDraggable = true,
}: {
  id: string
  content: string
  isDraggable?: boolean
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: !isDraggable,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-md p-2 bg-white shadow-sm mb-2"
      {...attributes}
      {...listeners}
    >
      {content}
    </div>
  )
}

// Group Component
const Group = ({
  id,
  title,
  items,
  onRemoveGroup,
  onRemoveItem,
}: {
  id: string
  title: string
  items: ItemType[]
  onRemoveGroup: (id: string) => void
  onRemoveItem: (groupId: string, itemId: string) => void
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-lg p-3 bg-gray-50 mb-4"
    >
      <div
        className="flex items-center justify-between mb-2 p-2 bg-gray-100 rounded-md cursor-move"
        {...attributes}
        {...listeners}
      >
        <h3 className="font-medium">{title}</h3>
        <button
          className="text-red-500 hover:text-red-700 text-sm px-2 py-1"
          onClick={() => onRemoveGroup(id)}
        >
          ✕
        </button>
      </div>
      <div className="pl-2">
        {items.map((item) => (
          <div key={item.id} className="relative group">
            <Item id={item.id} content={item.content} />
            <button
              className="absolute right-2 top-2 text-red-400 opacity-0 group-hover:opacity-100 text-xs"
              onClick={() => onRemoveItem(id, item.id)}
            >
              ✕
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-gray-400 text-sm p-2 border border-dashed rounded-md">
            Drop items here
          </div>
        )}
      </div>
    </div>
  )
}

// Drag overlay components
const DragOverlayItem = ({ content }: { content: string }) => (
  <div className="border rounded-md p-2 bg-white shadow-md">{content}</div>
)

const DragOverlayGroup = ({ title }: { title: string }) => (
  <div className="border rounded-lg p-3 bg-gray-50 shadow-md">
    <div className="mb-2 p-2 bg-gray-100 rounded-md">
      <h3 className="font-medium">{title}</h3>
    </div>
  </div>
)

// Main Component
export default function DragAndDropDemo() {
  const [elements, setElements] = useState<ElementType[]>([
    createItem(),
    createItem(),
    createGroup(),
    createItem(),
    createItem(),
  ])
  const [activeElement, setActiveElement] = useState<ElementType | null>(null)
  const [activeItemFromGroup, setActiveItemFromGroup] = useState<{
    itemId: string
    groupId: string
  } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Get all sortable IDs (top-level elements)
  const elementIds = elements.map((element) => element.id)

  // Function to add a new group
  const addGroup = () => {
    setElements([...elements, createGroup()])
  }

  // Function to remove a group
  const removeGroup = (groupId: string) => {
    // Find the group to extract its items
    const group = elements.find(
      (el): el is GroupType => el.id === groupId && el.type === 'group'
    )

    if (!group) return

    // All items from the group will be placed after the group's position
    const groupIndex = elements.findIndex((el) => el.id === groupId)
    const newElements = [...elements]

    // Remove the group
    newElements.splice(groupIndex, 1)

    // Insert its items at the same position
    newElements.splice(groupIndex, 0, ...group.items)

    setElements(newElements)
  }

  // Function to remove an item from a group
  const removeItemFromGroup = (groupId: string, itemId: string) => {
    setElements(
      elements.map((element) => {
        if (element.id === groupId && element.type === 'group') {
          return {
            ...element,
            items: element.items.filter((item) => item.id !== itemId),
          }
        }
        return element
      })
    )
  }

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const activeId = active.id as string

    // Check if it's a top-level element
    const draggedElement = elements.find((el) => el.id === activeId)

    if (draggedElement) {
      setActiveElement(draggedElement)
      return
    }

    // Check if it's an item inside a group
    for (const element of elements) {
      if (element.type === 'group') {
        const foundItem = element.items.find((item) => item.id === activeId)
        if (foundItem) {
          setActiveElement(foundItem)
          setActiveItemFromGroup({
            itemId: activeId,
            groupId: element.id,
          })
          return
        }
      }
    }
  }

  // Handle drag over
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Skip if hovering over self
    if (activeId === overId) return

    // If we're dragging an item from a group
    if (activeItemFromGroup) {
      const { groupId, itemId } = activeItemFromGroup

      // Find the source group
      const sourceGroupIndex = elements.findIndex((el) => el.id === groupId)
      if (sourceGroupIndex === -1) return

      const sourceGroup = elements[sourceGroupIndex] as GroupType
      const draggedItem = sourceGroup.items.find((item) => item.id === itemId)
      if (!draggedItem) return

      // Check if we're hovering over another group
      const overGroupIndex = elements.findIndex(
        (el) => el.id === overId && el.type === 'group'
      )

      if (overGroupIndex !== -1 && overId !== groupId) {
        // Move item from one group to another
        const newElements = [...elements]

        // Remove from source group
        newElements[sourceGroupIndex] = {
          ...sourceGroup,
          items: sourceGroup.items.filter((item) => item.id !== itemId),
        }

        // Add to target group
        const targetGroup = newElements[overGroupIndex] as GroupType
        newElements[overGroupIndex] = {
          ...targetGroup,
          items: [...targetGroup.items, draggedItem],
        }

        setElements(newElements)
        setActiveItemFromGroup({
          itemId,
          groupId: overId,
        })
      }
    } else if (!activeItemFromGroup && activeElement?.type === 'item') {
      // Handle dragging a standalone item over a group
      const isOverGroup = elements.some(
        (el) => el.id === overId && el.type === 'group'
      )

      if (isOverGroup) {
        // We're handling this in drag end to avoid flickering
        return
      }
    }
  }

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) {
      setActiveElement(null)
      setActiveItemFromGroup(null)
      return
    }

    const activeId = active.id as string
    const overId = over.id as string

    // If we're dragging an item from a group to a non-group target
    if (activeItemFromGroup && elements.some((el) => el.id === overId)) {
      const { groupId, itemId } = activeItemFromGroup

      // Find the source group
      const sourceGroupIndex = elements.findIndex((el) => el.id === groupId)
      if (sourceGroupIndex === -1) {
        setActiveElement(null)
        setActiveItemFromGroup(null)
        return
      }

      const sourceGroup = elements[sourceGroupIndex] as GroupType
      const draggedItem = sourceGroup.items.find((item) => item.id === itemId)
      if (!draggedItem) {
        setActiveElement(null)
        setActiveItemFromGroup(null)
        return
      }

      // Item is being moved out of group to main list
      const overIndex = elements.findIndex((el) => el.id === overId)
      if (overIndex === -1) {
        setActiveElement(null)
        setActiveItemFromGroup(null)
        return
      }

      const newElements = [...elements]

      // Remove from source group
      newElements[sourceGroupIndex] = {
        ...sourceGroup,
        items: sourceGroup.items.filter((item) => item.id !== itemId),
      }

      // Insert into main list - we need to determine if we're inserting before or after
      // the over element based on whether it's a group and the position
      if (elements[overIndex].type === 'group') {
        // If dropping onto a group, place it after the group
        newElements.splice(overIndex + 1, 0, draggedItem)
      } else {
        // If dropping onto an item, place it at that position
        newElements.splice(overIndex, 0, draggedItem)
      }

      setElements(newElements)
      setActiveElement(null)
      setActiveItemFromGroup(null)
      return
    }

    // If dragging an item to a group
    if (!activeItemFromGroup && activeElement?.type === 'item') {
      const targetGroupIndex = elements.findIndex(
        (el) => el.id === overId && el.type === 'group'
      )

      if (targetGroupIndex !== -1) {
        const itemIndex = elements.findIndex((el) => el.id === activeId)
        if (itemIndex === -1) {
          setActiveElement(null)
          return
        }

        // Create a completely new array to avoid reference issues
        const newElements = JSON.parse(
          JSON.stringify(elements)
        ) as ElementType[]
        const item = newElements[itemIndex] as ItemType

        // Remove item from main list
        newElements.splice(itemIndex, 1)

        // Get the group after the removal
        const targetGroup = newElements.find(
          (el): el is GroupType => el.id === overId && el.type === 'group'
        )

        if (targetGroup) {
          // Find the new index of the group after removing the item
          const newTargetGroupIndex = newElements.findIndex(
            (el) => el.id === overId
          )

          // Update the group with the new item
          newElements[newTargetGroupIndex] = {
            ...targetGroup,
            items: [...targetGroup.items, item],
          }

          setElements(newElements)
        } else {
          // If somehow the target group doesn't exist, restore the original state
          setElements([...elements])
        }

        setActiveElement(null)
        return
      }
    }

    // Handle reordering of top-level elements
    if (activeId !== overId && !activeItemFromGroup) {
      const oldIndex = elementIds.indexOf(activeId)
      const newIndex = elementIds.indexOf(overId)

      if (oldIndex !== -1 && newIndex !== -1) {
        setElements(arrayMove(elements, oldIndex, newIndex))
      }
    }

    setActiveElement(null)
    setActiveItemFromGroup(null)
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Drag and Drop Demo</h1>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={elementIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {elements.map((element) => {
              if (element.type === 'item') {
                return (
                  <Item
                    key={element.id}
                    id={element.id}
                    content={element.content}
                  />
                )
              } else if (element.type === 'group') {
                return (
                  <Group
                    key={element.id}
                    id={element.id}
                    title={element.title}
                    items={element.items}
                    onRemoveGroup={removeGroup}
                    onRemoveItem={removeItemFromGroup}
                  />
                )
              }
              return null
            })}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeElement?.type === 'item' && (
            <DragOverlayItem content={(activeElement as ItemType).content} />
          )}
          {activeElement?.type === 'group' && (
            <DragOverlayGroup title={(activeElement as GroupType).title} />
          )}
        </DragOverlay>
      </DndContext>

      <button
        onClick={addGroup}
        className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm transition-colors"
      >
        + Add Group
      </button>
    </div>
  )
}
