import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  UniqueIdentifier,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMemo, useState } from 'react'

// Types
interface Item {
  id: UniqueIdentifier
  type: 'ITEM'
  content: string
}

interface Group {
  id: UniqueIdentifier
  type: 'GROUP'
  name: string
  items: Item[]
}

// Union type for items that can be in the root list
type RootItem = Item | Group

// Components
const SortableItem = ({
  item,
  parentId = null,
}: {
  item: Item
  parentId?: UniqueIdentifier | null
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, data: { type: 'ITEM', parentId } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 my-1 bg-white border rounded shadow cursor-grab ${
        parentId ? 'ml-6' : ''
      }`}
      {...attributes}
      {...listeners}
    >
      {item.content}
    </div>
  )
}

const SortableGroup = ({
  group,
  onRemoveGroup,
}: {
  group: Group
  onRemoveGroup: (id: UniqueIdentifier) => void
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id, data: { type: 'GROUP' } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleRemoveClick = (e: React.MouseEvent) => {
    // Prevent the event from being captured by the drag handler
    e.stopPropagation()
    e.preventDefault()
    // Immediately call onRemoveGroup with the group id
    onRemoveGroup(group.id)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-3 my-2 bg-gray-100 border rounded shadow"
    >
      <div
        className="flex justify-between items-center mb-2 cursor-grab"
        {...attributes}
        {...listeners}
      >
        <h3 className="font-medium">{group.name}</h3>
        {/* Move the button outside of the draggable area's attributes and listeners */}
      </div>
      <div className="pl-2">
        <div className="flex justify-end mb-2">
          <button
            onClick={handleRemoveClick}
            className="bg-red-100 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-200"
            type="button"
          >
            Remove
          </button>
        </div>
        {group.items.map((item) => (
          <SortableItem
            key={item.id.toString()}
            item={item}
            parentId={group.id}
          />
        ))}
      </div>
    </div>
  )
}

// Main Component
const DragNDropDemo = () => {
  // Our list of all root-level items (both standalone items and groups)
  const [rootItems, setRootItems] = useState<RootItem[]>([
    { id: 'item-1', type: 'ITEM', content: 'Item 1' },
    { id: 'item-2', type: 'ITEM', content: 'Item 2' },
    {
      id: 'group-1',
      type: 'GROUP',
      name: 'Group 1',
      items: [
        { id: 'item-3', type: 'ITEM', content: 'Item 3' },
        { id: 'item-4', type: 'ITEM', content: 'Item 4' },
      ],
    },
    { id: 'item-5', type: 'ITEM', content: 'Item 5' },
    {
      id: 'group-2',
      type: 'GROUP',
      name: 'Group 2',
      items: [{ id: 'item-6', type: 'ITEM', content: 'Item 6' }],
    },
    { id: 'item-7', type: 'ITEM', content: 'Item 7' },
  ])

  const [activeParentId, setActiveParentId] = useState<UniqueIdentifier | null>(
    null
  )

  // IDs for sortable context - we only need the IDs of root items
  const rootIds = useMemo(() => {
    return rootItems.map((item) => item.id)
  }, [rootItems])

  // Get all standalone items (not in groups)
  const standaloneItems = useMemo(() => {
    return rootItems.filter((item) => item.type === 'ITEM') as Item[]
  }, [rootItems])

  // Get all groups
  const groups = useMemo(() => {
    return rootItems.filter((item) => item.type === 'GROUP') as Group[]
  }, [rootItems])

  // Helper functions to work with our new data structure
  // Find an item or group by ID
  const findItemById = (id: UniqueIdentifier): RootItem | undefined => {
    // First check in root items
    const rootItem = rootItems.find((item) => item.id === id)
    if (rootItem) return rootItem

    // Then check in groups
    for (const group of groups) {
      const groupItem = group.items.find((item) => item.id === id)
      if (groupItem) return groupItem
    }

    return undefined
  }

  // Find the group that contains an item
  const findGroupContainingItem = (
    itemId: UniqueIdentifier
  ): Group | undefined => {
    return groups.find((group) =>
      group.items.some((item) => item.id === itemId)
    )
  }

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Drag start handler
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event

    // If it's an item inside a group, track the parent
    if (active.data.current?.parentId) {
      setActiveParentId(active.data.current.parentId)
    }
  }

  // Drag over handler
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event

    if (!over) return

    const activeId = active.id
    const overId = over.id

    if (activeId === overId) return

    const activeData = active.data.current
    const activeType = activeData?.type

    // Only handle dropping items into groups
    if (activeType !== 'ITEM') return

    // Check if we're dragging over a group
    const overItem = findItemById(overId)
    if (!overItem || overItem.type !== 'GROUP') return

    const overGroup = overItem as Group

    // Move item to the group
    setRootItems((rootItems) => {
      // If item is already in a group, remove it from there
      if (activeParentId) {
        // Create a new array with the item removed from its current group
        return rootItems.map((item) => {
          if (item.type === 'GROUP' && item.id === activeParentId) {
            return {
              ...item,
              items: item.items.filter((i) => i.id !== activeId),
            }
          }
          return item
        })
      } else {
        // Remove item from root items if it's there
        return rootItems.filter(
          (item) => !(item.type === 'ITEM' && item.id === activeId)
        )
      }
    })

    // Add item to the target group
    setRootItems((rootItems) => {
      return rootItems.map((item) => {
        if (item.type === 'GROUP' && item.id === overGroup.id) {
          // Find the item that we're moving
          const activeItem = activeParentId
            ? groups
                .find((g) => g.id === activeParentId)
                ?.items.find((i) => i.id === activeId)
            : standaloneItems.find((i) => i.id === activeId)

          if (activeItem) {
            // Only add if it's not already there
            if (!item.items.some((i) => i.id === activeId)) {
              return {
                ...item,
                items: [...item.items, activeItem],
              }
            }
          }
        }
        return item
      })
    })

    // Update parent tracking
    setActiveParentId(overGroup.id)
  }

  // Drag end handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) {
      setActiveParentId(null)
      return
    }

    const activeId = active.id
    const overId = over.id

    if (activeId === overId) {
      setActiveParentId(null)
      return
    }

    const activeData = active.data.current
    const activeType = activeData?.type
    const activeParent = activeData?.parentId

    // Case 1: Sorting items within the same group
    if (activeType === 'ITEM' && activeParent) {
      // Find the group containing the items
      const parentGroup = findGroupContainingItem(activeId)

      if (parentGroup) {
        // Check if the target is in the same group
        const isOverInSameGroup = parentGroup.items.some(
          (item) => item.id === overId
        )

        if (isOverInSameGroup) {
          // Sort within the group
          const oldIndex = parentGroup.items.findIndex(
            (item) => item.id === activeId
          )
          const newIndex = parentGroup.items.findIndex(
            (item) => item.id === overId
          )

          if (oldIndex !== -1 && newIndex !== -1) {
            setRootItems((rootItems) => {
              return rootItems.map((item) => {
                if (item.type === 'GROUP' && item.id === parentGroup.id) {
                  const newItems = arrayMove(item.items, oldIndex, newIndex)
                  return { ...item, items: newItems }
                }
                return item
              })
            })
          }
        } else {
          // Moving out of group to root level
          const overIsGroup = groups.some((group) => group.id === overId)

          if (!overIsGroup) {
            // Remove from current group
            setRootItems((rootItems) => {
              const updatedRootItems = rootItems.map((item) => {
                if (item.type === 'GROUP' && item.id === parentGroup.id) {
                  return {
                    ...item,
                    items: item.items.filter((i) => i.id !== activeId),
                  }
                }
                return item
              })

              // Find the item being moved
              const activeItem = parentGroup.items.find(
                (i) => i.id === activeId
              )

              if (activeItem) {
                // Find position to insert at
                const overIndex = updatedRootItems.findIndex(
                  (item) => item.id === overId
                )

                if (overIndex !== -1) {
                  // Insert at specific position
                  return [
                    ...updatedRootItems.slice(0, overIndex),
                    activeItem,
                    ...updatedRootItems.slice(overIndex),
                  ]
                } else {
                  // Append to end if position not found
                  return [...updatedRootItems, activeItem]
                }
              }

              return updatedRootItems
            })
          }
        }
      }
    }
    // Case 2: Sorting at root level or between root and groups
    else {
      // Moving root items (standalone items or groups)
      const activeIndex = rootItems.findIndex((item) => item.id === activeId)
      const overIndex = rootItems.findIndex((item) => item.id === overId)

      if (activeIndex !== -1 && overIndex !== -1) {
        setRootItems((items) => arrayMove(items, activeIndex, overIndex))
      }
    }

    setActiveParentId(null)
  }

  // Create a new group
  const handleAddGroup = () => {
    const newGroupId = `group-${Date.now()}`
    const newGroup: Group = {
      id: newGroupId,
      type: 'GROUP',
      name: `Group ${groups.length + 1}`,
      items: [],
    }
    setRootItems([...rootItems, newGroup])
  }

  // Remove a group and move its items to the root
  const handleRemoveGroup = (groupId: UniqueIdentifier) => {
    setRootItems((currentItems) => {
      // Find the group
      const groupIndex = currentItems.findIndex(
        (item) => item.type === 'GROUP' && item.id === groupId
      )

      if (groupIndex === -1) return currentItems

      const group = currentItems[groupIndex] as Group

      // Remove the group and add its items to the root level
      return [
        ...currentItems.slice(0, groupIndex),
        ...group.items,
        ...currentItems.slice(groupIndex + 1),
      ]
    })
  }

  // Render components based on type
  const renderItem = (item: RootItem) => {
    if (item.type === 'ITEM') {
      return <SortableItem key={item.id.toString()} item={item} />
    } else {
      return (
        <SortableGroup
          key={item.id.toString()}
          group={item}
          onRemoveGroup={handleRemoveGroup}
        />
      )
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Drag n Drop Demo</h1>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={rootIds} strategy={verticalListSortingStrategy}>
          {rootItems.map(renderItem)}
        </SortableContext>
      </DndContext>

      <button
        onClick={handleAddGroup}
        className="mt-4 w-full py-2 bg-gray-100 border border-dashed border-gray-300 rounded text-gray-600 hover:bg-gray-200"
      >
        + Add Group
      </button>
    </div>
  )
}

export default DragNDropDemo
