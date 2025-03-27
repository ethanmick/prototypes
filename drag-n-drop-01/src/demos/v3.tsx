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

// Types
type ItemType = {
  id: string
  content: string
}

type GroupType = {
  id: string
  title: string
  items: ItemType[]
}

type ListItem = { id: string; type: 'item' } | { id: string; type: 'group' }

// New type for tracking drop indication
type DropIndicator = {
  id: string | null
  type: 'before' | 'after' | 'inside' | null
}

// Helper functions
const generateId = () =>
  `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// Components
const Item: React.FC<{
  id: string
  content: string
  isOverlay?: boolean
}> = ({ id, content, isOverlay = false }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0.4 : 1,
  }

  if (isOverlay) {
    return (
      <div className="p-3 bg-white border border-gray-300 rounded-md shadow-md">
        {content}
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-3 mb-2 bg-white border border-gray-200 rounded-md cursor-move"
      {...attributes}
      {...listeners}
    >
      {content}
    </div>
  )
}

// Droppable spacer component
const DroppableSpacer: React.FC<{
  id: string
  isHighlighted: boolean
}> = ({ id, isHighlighted }) => {
  const { setNodeRef } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`h-4 my-2 rounded transition-colors ${
        isHighlighted ? 'bg-blue-200' : 'bg-transparent'
      }`}
      data-spacer="true"
    />
  )
}

const Group: React.FC<{
  id: string
  title: string
  items: ItemType[]
  onRemove: () => void
  isOverlay?: boolean
  isDropTarget?: boolean
}> = ({
  id,
  title,
  items,
  onRemove,
  isOverlay = false,
  isDropTarget = false,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0.4 : 1,
  }

  const groupContent = (
    <>
      <div className="flex justify-between items-center p-2 bg-gray-100 rounded-t-md">
        <h3 className="font-medium">{title}</h3>
        {!isOverlay && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Remove
          </button>
        )}
      </div>
      <div
        className={`p-2 rounded-b-md transition-colors ${
          isDropTarget ? 'bg-blue-50' : 'bg-gray-50'
        }`}
      >
        {items.length === 0 ? (
          <div
            className={`text-sm p-2 text-center transition-colors ${
              isDropTarget ? 'text-blue-500' : 'text-gray-400'
            }`}
          >
            {isDropTarget ? 'Drop here' : 'Empty group'}
          </div>
        ) : (
          items.map((item) => (
            <Item
              key={`${id}-${item.id}`}
              id={item.id}
              content={item.content}
            />
          ))
        )}
      </div>
    </>
  )

  if (isOverlay) {
    return (
      <div className="border border-gray-300 rounded-md mb-3 shadow-md">
        {groupContent}
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-md mb-1 cursor-move transition-all ${
        isDropTarget ? 'border-blue-300 shadow-md' : 'border-gray-200'
      }`}
      {...attributes}
      {...listeners}
    >
      {groupContent}
    </div>
  )
}

// Main component
export default function DragAndDropDemo() {
  const [items, setItems] = useState<ItemType[]>([
    { id: 'standalone-item-1', content: 'Item 1' },
    { id: 'standalone-item-2', content: 'Item 2' },
    { id: 'standalone-item-3', content: 'Item 3' },
    { id: 'standalone-item-4', content: 'Item 4' },
  ])

  const [groups, setGroups] = useState<GroupType[]>([
    { id: 'group-1', title: 'Group 1', items: [] },
    {
      id: 'group-2',
      title: 'Group 2',
      items: [
        { id: 'group-2-item-1', content: 'Item 5' },
        { id: 'group-2-item-2', content: 'Item 6' },
      ],
    },
  ])

  // This represents the order of items and groups in our list
  const [mainList, setMainList] = useState<ListItem[]>([
    { id: 'standalone-item-1', type: 'item' },
    { id: 'group-1', type: 'group' },
    { id: 'standalone-item-2', type: 'item' },
    { id: 'group-2', type: 'group' },
    { id: 'standalone-item-3', type: 'item' },
    { id: 'standalone-item-4', type: 'item' },
  ])

  // Combined sortable items (main items + spacers)
  const sortableIds = (() => {
    const ids: string[] = []
    // Add a spacer before each item and the actual item
    mainList.forEach((item) => {
      ids.push(`spacer-before-${item.id}`)
      ids.push(item.id)
    })
    // Add a final spacer
    ids.push(`spacer-after-last`)
    return ids
  })()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<'item' | 'group' | null>(null)

  // New state for tracking where the item will be dropped
  const [dropIndicator, setDropIndicator] = useState<DropIndicator>({
    id: null,
    type: null,
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const findItemById = (id: string): ItemType | undefined => {
    // Check in standalone items
    let item = items.find((item) => item.id === id)
    if (item) return item

    // Check in groups
    for (const group of groups) {
      item = group.items.find((item) => item.id === id)
      if (item) return item
    }

    return undefined
  }

  const findGroupById = (id: string): GroupType | undefined => {
    return groups.find((group) => group.id === id)
  }

  const findGroupContainingItem = (itemId: string): string | null => {
    for (const group of groups) {
      if (group.items.some((item) => item.id === itemId)) {
        return group.id
      }
    }
    return null
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    setActiveId(active.id as string)

    // Determine if we're dragging an item or a group
    const isGroup = groups.some((group) => group.id === active.id)
    setActiveType(isGroup ? 'group' : 'item')

    // Reset the drop indicator
    setDropIndicator({ id: null, type: null })
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      setDropIndicator({ id: null, type: null })
      return
    }

    const activeId = active.id as string
    const overId = over.id as string

    // Is it a spacer?
    if (overId.startsWith('spacer-')) {
      // Extract the associated item or determine it's the last spacer
      if (overId === 'spacer-after-last') {
        setDropIndicator({ id: 'last', type: 'after' })
      } else {
        const targetItemId = overId.replace('spacer-before-', '')
        setDropIndicator({ id: targetItemId, type: 'before' })
      }
      return
    }

    // Is it a group and we're dragging an item?
    if (activeType === 'item') {
      const isOverGroup = groups.some((group) => group.id === overId)
      const activeGroupId = findGroupContainingItem(activeId)

      if (isOverGroup && activeGroupId !== overId) {
        // We're hovering over a group that the item is not already in
        setDropIndicator({ id: overId, type: 'inside' })
        return
      }
    }

    // Default - between items
    setDropIndicator({ id: overId, type: 'after' })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) {
      setActiveId(null)
      setActiveType(null)
      setDropIndicator({ id: null, type: null })
      return
    }

    const activeId = active.id as string
    const overId = over.id as string

    if (activeId === overId) {
      setActiveId(null)
      setActiveType(null)
      setDropIndicator({ id: null, type: null })
      return
    }

    // Handle spacers specially
    if (overId.startsWith('spacer-')) {
      let targetIndex: number

      // If it's the last spacer, add to the end
      if (overId === 'spacer-after-last') {
        targetIndex = mainList.length
      } else {
        // Otherwise find the index of the element the spacer precedes
        const targetItemId = overId.replace('spacer-before-', '')
        targetIndex = mainList.findIndex((item) => item.id === targetItemId)
      }

      // If active item is in a group, handle removing it
      const activeGroupId = findGroupContainingItem(activeId)
      if (activeType === 'item' && activeGroupId) {
        const activeItem = findItemById(activeId)
        if (!activeItem) return

        // Create new standalone item
        const newItemId = `standalone-item-${generateId()}`
        const newItem = {
          ...activeItem,
          id: newItemId,
        }

        // Remove from source group
        setGroups(
          groups.map((group) => {
            if (group.id === activeGroupId) {
              return {
                ...group,
                items: group.items.filter((item) => item.id !== activeId),
              }
            }
            return group
          })
        )

        // Add to standalone items
        setItems([...items, newItem])

        // Add to main list at the target position
        const newMainList = [...mainList]
        newMainList.splice(targetIndex, 0, { id: newItemId, type: 'item' })
        setMainList(newMainList)
      } else {
        // Handle normal reordering
        const activeIndex = mainList.findIndex((item) => item.id === activeId)
        if (activeIndex === -1) return

        const newMainList = [...mainList]
        const [movedItem] = newMainList.splice(activeIndex, 1)

        // Adjust target index if needed when moving an item from before to after
        const adjustedTargetIndex =
          activeIndex < targetIndex ? targetIndex - 1 : targetIndex

        newMainList.splice(adjustedTargetIndex, 0, movedItem)
        setMainList(newMainList)
      }

      setActiveId(null)
      setActiveType(null)
      setDropIndicator({ id: null, type: null })
      return
    }

    // Handle dropping onto a group for insertion
    if (activeType === 'item' && dropIndicator.type === 'inside') {
      const isOverGroup = groups.some((group) => group.id === overId)
      const activeGroupId = findGroupContainingItem(activeId)

      // If dropping an item onto a group
      if (isOverGroup && activeGroupId !== overId) {
        const activeItem = findItemById(activeId)
        if (!activeItem) return

        // Create a new item with a unique ID for the destination group
        const newItem = {
          ...activeItem,
          id: `${overId}-item-${generateId()}`,
        }

        // Remove item from its current location
        if (activeGroupId) {
          // Remove from source group
          setGroups(
            groups.map((group) => {
              if (group.id === activeGroupId) {
                return {
                  ...group,
                  items: group.items.filter((item) => item.id !== activeId),
                }
              }
              return group
            })
          )
        } else {
          // Remove from standalone items
          setItems(items.filter((item) => item.id !== activeId))
          // Remove from main list
          setMainList(
            mainList.filter(
              (item) => !(item.type === 'item' && item.id === activeId)
            )
          )
        }

        // Add to destination group
        setGroups(
          groups.map((group) => {
            if (group.id === overId) {
              return {
                ...group,
                items: [...group.items, newItem],
              }
            }
            return group
          })
        )
      }
    }
    // Handle reordering in the main list for non-spacer targets
    else {
      const activeIndex = mainList.findIndex((item) => item.id === activeId)
      const overIndex = mainList.findIndex((item) => item.id === overId)

      if (activeIndex !== -1 && overIndex !== -1) {
        setMainList(arrayMove(mainList, activeIndex, overIndex))
      }

      // Handle item moving from a group to outside (onto another item)
      if (activeType === 'item') {
        const activeGroupId = findGroupContainingItem(activeId)
        const isOverItem = mainList.some(
          (item) => item.type === 'item' && item.id === overId
        )

        // If moving from a group to a standalone item
        if (activeGroupId && isOverItem) {
          const activeItem = findItemById(activeId)
          if (!activeItem) return

          // Create a new unique ID for the standalone item
          const newItemId = `standalone-item-${generateId()}`
          const newItem = {
            ...activeItem,
            id: newItemId,
          }

          // Remove from source group
          setGroups(
            groups.map((group) => {
              if (group.id === activeGroupId) {
                return {
                  ...group,
                  items: group.items.filter((item) => item.id !== activeId),
                }
              }
              return group
            })
          )

          // Add to standalone items
          setItems([...items, newItem])

          // Add to main list at the appropriate position
          const newMainList = [...mainList]
          const overMainIndex = newMainList.findIndex(
            (item) => item.id === overId
          )
          newMainList.splice(overMainIndex + 1, 0, {
            id: newItemId,
            type: 'item',
          })
          setMainList(newMainList)
        }
      }
    }

    setActiveId(null)
    setActiveType(null)
    setDropIndicator({ id: null, type: null })
  }

  const handleAddGroup = () => {
    const newGroupId = `group-${generateId()}`
    const newGroup: GroupType = {
      id: newGroupId,
      title: `Group ${groups.length + 1}`,
      items: [],
    }

    setGroups([...groups, newGroup])
    setMainList([...mainList, { id: newGroupId, type: 'group' }])
  }

  const handleRemoveGroup = (groupId: string) => {
    // Find the group
    const group = findGroupById(groupId)
    if (!group) return

    // Create new standalone items with unique IDs
    const newStandaloneItems = group.items.map((item) => ({
      ...item,
      id: `standalone-item-${generateId()}`,
    }))

    // Move all items from the group to standalone items with new IDs
    setItems([...items, ...newStandaloneItems])

    // For each item in the group, add it to the main list
    // right after the group's position
    const groupIndex = mainList.findIndex(
      (item) => item.type === 'group' && item.id === groupId
    )

    const newMainList = [...mainList]
    const itemsToAdd = newStandaloneItems.map((item) => ({
      id: item.id,
      type: 'item' as const,
    }))
    newMainList.splice(groupIndex + 1, 0, ...itemsToAdd)

    // Remove the group
    setGroups(groups.filter((g) => g.id !== groupId))

    // Remove the group from the main list
    setMainList(
      newMainList.filter(
        (item) => !(item.type === 'group' && item.id === groupId)
      )
    )
  }

  const getActiveItem = () => {
    if (!activeId || !activeType) return null

    if (activeType === 'item') {
      const item = findItemById(activeId)
      if (item) {
        return <Item id={item.id} content={item.content} isOverlay />
      }
    } else if (activeType === 'group') {
      const group = findGroupById(activeId)
      if (group) {
        return (
          <Group
            id={group.id}
            title={group.title}
            items={group.items}
            onRemove={() => {}}
            isOverlay
          />
        )
      }
    }

    return null
  }

  // Function to determine if a spacer should be highlighted
  const isSpacerHighlighted = (spacerId: string) => {
    if (!dropIndicator.id || !dropIndicator.type) return false

    if (
      spacerId === 'spacer-after-last' &&
      dropIndicator.id === 'last' &&
      dropIndicator.type === 'after'
    ) {
      return true
    }

    if (
      dropIndicator.type === 'before' &&
      spacerId === `spacer-before-${dropIndicator.id}`
    ) {
      return true
    }

    return false
  }

  // Function to determine if a group should be highlighted as a drop target
  const isGroupHighlighted = (groupId: string) => {
    return dropIndicator.id === groupId && dropIndicator.type === 'inside'
  }

  // Render the component
  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Drag and Drop Demo</h1>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortableIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {/* First spacer */}
            <DroppableSpacer
              id={`spacer-before-${mainList[0]?.id}`}
              isHighlighted={isSpacerHighlighted(
                `spacer-before-${mainList[0]?.id}`
              )}
            />

            {/* Map through each item and add spacers between them */}
            {mainList.map((listItem, index) => (
              <React.Fragment key={listItem.id}>
                {listItem.type === 'item' ? (
                  <Item
                    key={listItem.id}
                    id={listItem.id}
                    content={findItemById(listItem.id)?.content || ''}
                  />
                ) : (
                  <Group
                    key={listItem.id}
                    id={listItem.id}
                    title={findGroupById(listItem.id)?.title || ''}
                    items={findGroupById(listItem.id)?.items || []}
                    onRemove={() => handleRemoveGroup(listItem.id)}
                    isDropTarget={isGroupHighlighted(listItem.id)}
                  />
                )}

                {/* Add spacer after each item */}
                {index < mainList.length - 1 && (
                  <DroppableSpacer
                    id={`spacer-before-${mainList[index + 1].id}`}
                    isHighlighted={isSpacerHighlighted(
                      `spacer-before-${mainList[index + 1].id}`
                    )}
                  />
                )}
              </React.Fragment>
            ))}

            {/* Last spacer */}
            <DroppableSpacer
              id="spacer-after-last"
              isHighlighted={isSpacerHighlighted('spacer-after-last')}
            />
          </div>
        </SortableContext>

        <DragOverlay>{getActiveItem()}</DragOverlay>
      </DndContext>

      <div className="mt-4">
        <button
          onClick={handleAddGroup}
          className="py-1 px-3 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
        >
          + Add Group
        </button>
      </div>
    </div>
  )
}
