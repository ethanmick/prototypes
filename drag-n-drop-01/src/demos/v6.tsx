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
import { useRef, useState } from 'react'

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

// Drag target types
type DropTarget = {
  id: string
  type: 'inside-group' | 'before-element' | 'after-element'
}

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

// Individual Item Component with drop indicator
const Item = ({
  id,
  content,
  isDraggable = true,
  isActiveDropTarget = false,
  activeDropType = null,
}: {
  id: string
  content: string
  isDraggable?: boolean
  isActiveDropTarget?: boolean
  activeDropType?: 'before-element' | 'after-element' | null
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
    <div className="relative">
      {activeDropType === 'before-element' && (
        <div className="absolute left-0 right-0 top-0 h-1 bg-blue-500 -translate-y-1 z-10" />
      )}
      <div
        ref={setNodeRef}
        style={style}
        className={`border rounded-md p-2 bg-white shadow-sm mb-2 ${
          isActiveDropTarget ? 'border-blue-300' : ''
        }`}
        {...attributes}
        {...listeners}
      >
        {content}
      </div>
      {activeDropType === 'after-element' && (
        <div className="absolute left-0 right-0 bottom-0 h-1 bg-blue-500 translate-y-1 z-10" />
      )}
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
  isActiveDropTarget,
  activeDropType,
}: {
  id: string
  title: string
  items: ItemType[]
  onRemoveGroup: (id: string) => void
  onRemoveItem: (groupId: string, itemId: string) => void
  isActiveDropTarget: boolean
  activeDropType: 'inside-group' | 'before-element' | 'after-element' | null
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

  // Get all sortable IDs for items in this group
  const itemIds = items.map((item) => item.id)

  return (
    <div className="relative">
      {activeDropType === 'before-element' && (
        <div className="absolute left-0 right-0 top-0 h-1 bg-blue-500 -translate-y-1 z-10" />
      )}
      <div
        ref={setNodeRef}
        style={style}
        className={`border rounded-lg p-3 ${
          isActiveDropTarget && activeDropType === 'inside-group'
            ? 'bg-blue-50 border-blue-300'
            : 'bg-gray-50'
        } mb-4`}
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
          <SortableContext
            items={itemIds}
            strategy={verticalListSortingStrategy}
          >
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
          </SortableContext>
          {items.length === 0 && (
            <div
              className={`text-gray-400 text-sm p-2 border border-dashed rounded-md ${
                isActiveDropTarget && activeDropType === 'inside-group'
                  ? 'bg-blue-50 border-blue-300'
                  : ''
              }`}
            >
              Drop items here
            </div>
          )}
        </div>
      </div>
      {activeDropType === 'after-element' && (
        <div className="absolute left-0 right-0 bottom-0 h-1 bg-blue-500 -translate-y-3 z-10" />
      )}
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

  // Add state for drop indicator
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  const lastClientOffset = useRef<{ x: number; y: number } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Lower activation distance makes it easier to position precisely
      activationConstraint: {
        distance: 5,
      },
    }),
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

  // Determine dropping position (either inside, before, or after)
  const determineDropPositionForGroup = (
    event: DragOverEvent
  ): 'inside-group' | 'before-element' | 'after-element' => {
    const { over, active } = event

    if (!over) return 'inside-group'

    // Get the client rect of the over element
    const overRect = over.rect
    if (!overRect) return 'inside-group'

    // Get client offset of the active element
    const activeOffset =
      active.rect.current?.translated || active.rect.current?.initial
    if (!activeOffset) return 'inside-group'

    lastClientOffset.current = {
      x: activeOffset.left,
      y: activeOffset.top,
    }

    // Define a small region at the top and bottom of the group for "before" and "after"
    const topRegionSize = Math.min(overRect.height * 0.25, 20)
    const bottomRegionSize = Math.min(overRect.height * 0.25, 20)

    if (activeOffset.top < overRect.top + topRegionSize) {
      return 'before-element'
    } else if (activeOffset.top > overRect.bottom - bottomRegionSize) {
      return 'after-element'
    } else {
      return 'inside-group'
    }
  }

  // Handle drag over
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) {
      setDropTarget(null)
      return
    }

    const activeId = active.id as string
    const overId = over.id as string

    // Skip if hovering over self
    if (activeId === overId) {
      setDropTarget(null)
      return
    }

    // Find whether we're hovering over a group
    const overElementIndex = elements.findIndex((el) => el.id === overId)
    if (overElementIndex === -1) {
      // Check if it's an item within a group
      for (const element of elements) {
        if (element.type === 'group') {
          const itemIndex = element.items.findIndex(
            (item) => item.id === overId
          )
          if (itemIndex !== -1) {
            // It's an item in a group, set that as our drop target
            setDropTarget({
              id: overId,
              type: 'inside-group',
            })
            break
          }
        }
      }
      return
    }

    const overElement = elements[overElementIndex]

    // If hovering over a group, determine if we want to drop inside, before, or after
    if (overElement.type === 'group') {
      const dropPosition = determineDropPositionForGroup(event)
      setDropTarget({
        id: overId,
        type: dropPosition,
      })
    } else {
      // If hovering over an item, just set it as target
      // Determine if we should show before or after indicator
      const overRect = over.rect
      if (overRect && lastClientOffset.current) {
        const isBeforeMiddleY =
          lastClientOffset.current.y < overRect.top + overRect.height / 2
        setDropTarget({
          id: overId,
          type: isBeforeMiddleY ? 'before-element' : 'after-element',
        })
      } else {
        setDropTarget({
          id: overId,
          type: 'before-element',
        })
      }
    }

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

      if (
        overGroupIndex !== -1 &&
        overId !== groupId &&
        dropTarget?.type === 'inside-group'
      ) {
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
      // Visual feedback only, actual dropping is handled in drag end
    }
  }

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || !dropTarget) {
      setActiveElement(null)
      setActiveItemFromGroup(null)
      setDropTarget(null)
      return
    }

    const activeId = active.id as string
    const overId = over.id as string

    // If we're dragging an item from a group
    if (activeItemFromGroup) {
      const { groupId, itemId } = activeItemFromGroup

      // Check if we're dropping on the same group or an item in the same group
      const overIsInSameGroup = elements.some((el) => {
        if (el.id === groupId && el.type === 'group') {
          // Check if overId is the group itself
          if (el.id === overId) return true

          // Check if overId is an item in the group
          return el.items.some((item) => item.id === overId)
        }
        return false
      })

      if (overIsInSameGroup) {
        // Find the source group
        const sourceGroupIndex = elements.findIndex((el) => el.id === groupId)
        if (sourceGroupIndex === -1) {
          setActiveElement(null)
          setActiveItemFromGroup(null)
          setDropTarget(null)
          return
        }

        const sourceGroup = elements[sourceGroupIndex] as GroupType

        // If dropping on an item in the same group, reorder within group
        if (overId !== groupId) {
          const oldIndex = sourceGroup.items.findIndex(
            (item) => item.id === itemId
          )
          const newIndex = sourceGroup.items.findIndex(
            (item) => item.id === overId
          )

          if (oldIndex !== -1 && newIndex !== -1) {
            const newElements = [...elements]
            newElements[sourceGroupIndex] = {
              ...sourceGroup,
              items: arrayMove(sourceGroup.items, oldIndex, newIndex),
            }

            setElements(newElements)
          }
        }

        setActiveElement(null)
        setActiveItemFromGroup(null)
        setDropTarget(null)
        return
      }

      // Continue with existing logic for dropping on other targets
      const sourceGroupIndex = elements.findIndex((el) => el.id === groupId)
      if (sourceGroupIndex === -1) {
        setActiveElement(null)
        setActiveItemFromGroup(null)
        setDropTarget(null)
        return
      }

      const sourceGroup = elements[sourceGroupIndex] as GroupType
      const draggedItem = sourceGroup.items.find((item) => item.id === itemId)
      if (!draggedItem) {
        setActiveElement(null)
        setActiveItemFromGroup(null)
        setDropTarget(null)
        return
      }

      // Item is being moved out of group to main list
      const overIndex = elements.findIndex((el) => el.id === overId)
      if (overIndex === -1) {
        setActiveElement(null)
        setActiveItemFromGroup(null)
        setDropTarget(null)
        return
      }

      const newElements = [...elements]

      // Remove from source group
      newElements[sourceGroupIndex] = {
        ...sourceGroup,
        items: sourceGroup.items.filter((item) => item.id !== itemId),
      }

      const overElement = elements[overIndex]

      // Determine where to insert based on drop target type
      if (overElement.type === 'group' && dropTarget.type === 'inside-group') {
        // Add item to the group instead of placing it outside
        const targetGroup = newElements[overIndex] as GroupType
        newElements[overIndex] = {
          ...targetGroup,
          items: [...targetGroup.items, draggedItem],
        }
      } else if (dropTarget.type === 'before-element') {
        // Insert before the element
        newElements.splice(overIndex, 0, draggedItem)
      } else {
        // Insert after the element
        newElements.splice(overIndex + 1, 0, draggedItem)
      }

      setElements(newElements)
      setActiveElement(null)
      setActiveItemFromGroup(null)
      setDropTarget(null)
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
          setDropTarget(null)
          return
        }

        // Only add to group if dropping inside, not before or after
        if (dropTarget.type === 'inside-group') {
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
        } else {
          // Handle before/after group placement
          const newElements = [...elements]
          const item = elements[itemIndex]

          // Remove the item
          newElements.splice(itemIndex, 1)

          // Put it before or after the group
          const targetIndex = newElements.findIndex((el) => el.id === overId)
          if (targetIndex !== -1) {
            if (dropTarget.type === 'before-element') {
              newElements.splice(targetIndex, 0, item)
            } else {
              newElements.splice(targetIndex + 1, 0, item)
            }
          }

          setElements(newElements)
        }

        setActiveElement(null)
        setDropTarget(null)
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
    setDropTarget(null)
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
              const isActiveDropTarget = dropTarget?.id === element.id

              if (element.type === 'item') {
                return (
                  <Item
                    key={element.id}
                    id={element.id}
                    content={element.content}
                    isActiveDropTarget={isActiveDropTarget}
                    activeDropType={
                      isActiveDropTarget
                        ? (dropTarget?.type as
                            | 'before-element'
                            | 'after-element')
                        : null
                    }
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
                    isActiveDropTarget={isActiveDropTarget}
                    activeDropType={
                      isActiveDropTarget
                        ? (dropTarget?.type as
                            | 'inside-group'
                            | 'before-element'
                            | 'after-element')
                        : null
                    }
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
