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

type RootItem = Item | Group

// Item Component
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
  } = useSortable({
    id: item.id,
    data: { type: 'ITEM', parentId },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-2 my-1 bg-white border rounded shadow cursor-grab ${
        parentId ? 'ml-4' : ''
      } ${isDragging ? 'ring-2 ring-green-400' : ''}`}
      {...attributes}
      {...listeners}
    >
      {item.content}
    </div>
  )
}

// Group Component
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
  } = useSortable({
    id: group.id,
    data: { type: 'GROUP' },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  }

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onRemoveGroup(group.id)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 my-2 bg-gray-50 border rounded shadow ${
        isDragging ? 'ring-2 ring-blue-400' : ''
      }`}
    >
      <div
        className="flex justify-between items-center mb-2 cursor-grab"
        {...attributes}
        {...listeners}
      >
        <h3 className="font-medium">{group.name}</h3>
        <button
          onClick={handleRemoveClick}
          className="bg-red-50 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-100"
          type="button"
        >
          Remove
        </button>
      </div>
      <div className="pl-2 pt-1 border-t">
        {group.items.map((item) => (
          <SortableItem
            key={item.id.toString()}
            item={item}
            parentId={group.id}
          />
        ))}
        {group.items.length === 0 && (
          <div className="text-gray-400 text-sm italic p-2">
            Drag items here
          </div>
        )}
      </div>
    </div>
  )
}

// Droppable Overlay Indicator
const DroppableOverlay = ({
  isOver,
  isGroup = false,
}: {
  isOver: boolean
  isGroup?: boolean
}) => {
  if (!isOver) return null

  return (
    <div
      className={`absolute inset-0 border-2 border-dashed rounded pointer-events-none ${
        isGroup
          ? 'bg-blue-100 bg-opacity-20 border-blue-400'
          : 'bg-green-100 bg-opacity-20 border-green-400'
      }`}
    />
  )
}

// Main Component
const DragNDropDemo = () => {
  // State
  const [rootItems, setRootItems] = useState<RootItem[]>([
    { id: 'item-1', type: 'ITEM', content: 'Item 1' },
    { id: 'item-2', type: 'ITEM', content: 'Item 2' },
    {
      id: 'group-1',
      type: 'GROUP',
      name: 'Group A',
      items: [
        { id: 'item-3', type: 'ITEM', content: 'Item 3' },
        { id: 'item-4', type: 'ITEM', content: 'Item 4' },
      ],
    },
    { id: 'item-5', type: 'ITEM', content: 'Item 5' },
    {
      id: 'group-2',
      type: 'GROUP',
      name: 'Group B',
      items: [{ id: 'item-6', type: 'ITEM', content: 'Item 6' }],
    },
  ])

  const [, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [activeParentId, setActiveParentId] = useState<UniqueIdentifier | null>(
    null
  )
  const [overGroup, setOverGroup] = useState<UniqueIdentifier | null>(null)

  // IDs for sortable context - root items
  const rootIds = useMemo(() => {
    return rootItems.map((item) => item.id)
  }, [rootItems])

  // Get all groups
  const groups = useMemo(() => {
    return rootItems.filter((item) => item.type === 'GROUP') as Group[]
  }, [rootItems])

  // Helper functions
  const findItemById = (id: UniqueIdentifier): RootItem | Item | undefined => {
    // Check in root items
    const rootItem = rootItems.find((item) => item.id === id)
    if (rootItem) return rootItem

    // Check in group items
    for (const group of groups) {
      const groupItem = group.items.find((item) => item.id === id)
      if (groupItem) return groupItem
    }

    return undefined
  }

  const findGroupContainingItem = (
    itemId: UniqueIdentifier
  ): Group | undefined => {
    return groups.find((group) =>
      group.items.some((item) => item.id === itemId)
    )
  }

  // Sensors setup
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Drag event handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    setActiveId(active.id)

    // Store parent id for dragged item
    const parentGroup = findGroupContainingItem(active.id)
    setActiveParentId(parentGroup?.id || null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event

    if (!over || !active) return

    const activeItem = findItemById(active.id)
    if (!activeItem) return

    // Dropping an item over a group
    if (activeItem.type === 'ITEM' && over.data.current?.type === 'GROUP') {
      setOverGroup(over.id)
      return
    }

    // Group being dragged over another group
    if (activeItem.type === 'GROUP' && over.data.current?.type === 'GROUP') {
      setOverGroup(over.id)
      return
    }

    // Reset over group if not over a group
    if (overGroup) {
      setOverGroup(null)
    }

    // Handle dropping an item over another item in a group
    if (
      activeItem.type === 'ITEM' &&
      over.data.current?.type === 'ITEM' &&
      over.data.current?.parentId
    ) {
      setOverGroup(over.data.current.parentId)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || !active) {
      setActiveId(null)
      setActiveParentId(null)
      setOverGroup(null)
      return
    }

    const activeItem = findItemById(active.id)
    if (!activeItem) {
      setActiveId(null)
      setActiveParentId(null)
      setOverGroup(null)
      return
    }

    // Handle Group sorting
    if (activeItem.type === 'GROUP') {
      const overItem = findItemById(over.id)

      setRootItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)

        // Determine the new index based on what item is being dragged over
        let newIndex: number

        // If dropping over a group, use that group's index
        if (overItem?.type === 'GROUP') {
          newIndex = items.findIndex((item) => item.id === over.id)
        }
        // If dropping over an item in the root (not in any group),
        // use that item's index
        else if (overItem?.type === 'ITEM' && !over.data.current?.parentId) {
          newIndex = items.findIndex((item) => item.id === over.id)
        }
        // If dropping over an item in a group, don't do anything
        else {
          setActiveId(null)
          setActiveParentId(null)
          setOverGroup(null)
          return items
        }

        if (oldIndex !== -1 && newIndex !== -1) {
          return arrayMove(items, oldIndex, newIndex)
        }
        return items
      })
    }
    // Handle Item sorting within root
    else if (activeItem.type === 'ITEM' && over.data.current?.type === 'ITEM') {
      // Get parent IDs
      const activeParent = findGroupContainingItem(active.id)
      const overParent = findGroupContainingItem(over.id)

      // If both items are in root
      if (!activeParent && !overParent) {
        setRootItems((items) => {
          const oldIndex = items.findIndex((item) => item.id === active.id)
          const newIndex = items.findIndex((item) => item.id === over.id)
          return arrayMove(items, oldIndex, newIndex)
        })
      }
      // If both items are in the same group
      else if (
        activeParent &&
        overParent &&
        activeParent.id === overParent.id
      ) {
        setRootItems((items) => {
          return items.map((item) => {
            if (item.id === activeParent.id && item.type === 'GROUP') {
              const oldIndex = item.items.findIndex((i) => i.id === active.id)
              const newIndex = item.items.findIndex((i) => i.id === over.id)
              return {
                ...item,
                items: arrayMove(item.items, oldIndex, newIndex),
              }
            }
            return item
          })
        })
      }
      // If moving from group to root
      else if (activeParent && !overParent) {
        setRootItems((items) => {
          // Create a copy of the dragged item
          const draggedItem = activeParent.items.find(
            (item) => item.id === active.id
          )
          if (!draggedItem) return items

          // Remove from original group
          const itemsWithoutGroup = items.map((item) => {
            if (item.id === activeParent.id && item.type === 'GROUP') {
              return {
                ...item,
                items: item.items.filter((i) => i.id !== active.id),
              }
            }
            return item
          })

          // Find target index
          const targetIndex = itemsWithoutGroup.findIndex(
            (item) => item.id === over.id
          )

          // Insert at new position
          return [
            ...itemsWithoutGroup.slice(0, targetIndex + 1),
            draggedItem,
            ...itemsWithoutGroup.slice(targetIndex + 1),
          ]
        })
      }
      // If moving from root to group
      else if (!activeParent && overParent) {
        setRootItems((items) => {
          // Get the dragged item
          const draggedItem = items.find(
            (item) => item.id === active.id
          ) as Item
          if (!draggedItem) return items

          // Remove from root
          const filteredItems = items.filter((item) => item.id !== active.id)

          // Add to target group
          return filteredItems.map((item) => {
            if (item.id === overParent.id && item.type === 'GROUP') {
              const targetIndex = item.items.findIndex((i) => i.id === over.id)
              const newItems = [...item.items]
              newItems.splice(targetIndex + 1, 0, draggedItem)
              return { ...item, items: newItems }
            }
            return item
          })
        })
      }
      // If moving from one group to another
      else if (
        activeParent &&
        overParent &&
        activeParent.id !== overParent.id
      ) {
        setRootItems((items) => {
          // Find the dragged item
          const draggedItem = activeParent.items.find(
            (item) => item.id === active.id
          )
          if (!draggedItem) return items

          // Remove from source group and add to target group
          return items.map((item) => {
            // Remove from source group
            if (item.id === activeParent.id && item.type === 'GROUP') {
              return {
                ...item,
                items: item.items.filter((i) => i.id !== active.id),
              }
            }
            // Add to target group
            if (item.id === overParent.id && item.type === 'GROUP') {
              const targetIndex = item.items.findIndex((i) => i.id === over.id)
              const newItems = [...item.items]
              newItems.splice(targetIndex + 1, 0, draggedItem)
              return { ...item, items: newItems }
            }
            return item
          })
        })
      }
    }

    // Handle dropping an item directly over a group
    else if (
      activeItem.type === 'ITEM' &&
      over.data.current?.type === 'GROUP'
    ) {
      const targetGroup = groups.find((g) => g.id === over.id)
      if (!targetGroup) {
        setActiveId(null)
        setActiveParentId(null)
        setOverGroup(null)
        return
      }

      setRootItems((items) => {
        // Handle item coming from root
        if (!activeParentId) {
          // Remove item from root
          const filteredItems = items.filter((item) => item.id !== active.id)
          // Get the dragged item
          const draggedItem = items.find(
            (item) => item.id === active.id
          ) as Item

          // Add to target group
          return filteredItems.map((item) => {
            if (item.id === targetGroup.id && item.type === 'GROUP') {
              return {
                ...item,
                items: [...item.items, draggedItem],
              }
            }
            return item
          })
        }
        // Handle item coming from another group
        else {
          const sourceGroup = groups.find((g) => g.id === activeParentId)
          if (!sourceGroup) return items

          // Get the dragged item
          const draggedItem = sourceGroup.items.find(
            (item) => item.id === active.id
          )
          if (!draggedItem) return items

          // Remove from source group and add to target group
          return items.map((item) => {
            // Remove from source group
            if (item.id === sourceGroup.id && item.type === 'GROUP') {
              return {
                ...item,
                items: item.items.filter((i) => i.id !== active.id),
              }
            }
            // Add to target group
            if (item.id === targetGroup.id && item.type === 'GROUP') {
              return {
                ...item,
                items: [...item.items, draggedItem],
              }
            }
            return item
          })
        }
      })
    }

    setActiveId(null)
    setActiveParentId(null)
    setOverGroup(null)
  }

  // Adding new groups
  const handleAddGroup = () => {
    const newId = `group-${Date.now()}`
    setRootItems([
      ...rootItems,
      {
        id: newId,
        type: 'GROUP',
        name: `Group ${groups.length + 1}`,
        items: [],
      },
    ])
  }

  // Removing groups
  const handleRemoveGroup = (groupId: UniqueIdentifier) => {
    setRootItems((items) => {
      // Find the group
      const groupToRemove = items.find(
        (item) => item.id === groupId && item.type === 'GROUP'
      ) as Group | undefined

      if (!groupToRemove) return items

      // Extract items from the group
      const itemsFromGroup = groupToRemove.items

      // Remove the group and add its items to the root level
      return [...items.filter((item) => item.id !== groupId), ...itemsFromGroup]
    })
  }

  // Render
  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Drag and Drop Demo</h1>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-2 min-h-[400px]">
          <SortableContext
            items={rootIds}
            strategy={verticalListSortingStrategy}
          >
            {rootItems.map((item) => {
              if (item.type === 'ITEM') {
                return <SortableItem key={item.id.toString()} item={item} />
              }

              if (item.type === 'GROUP') {
                return (
                  <div key={item.id.toString()} className="relative">
                    {overGroup === item.id && (
                      <DroppableOverlay isOver={true} isGroup={true} />
                    )}
                    <SortableGroup
                      group={item}
                      onRemoveGroup={handleRemoveGroup}
                    />
                  </div>
                )
              }

              return null
            })}
          </SortableContext>
        </div>
      </DndContext>

      <div className="mt-4">
        <button
          onClick={handleAddGroup}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 px-3 rounded text-sm flex items-center"
          type="button"
        >
          <span className="mr-1">+</span> Add Group
        </button>
      </div>
    </div>
  )
}

export default DragNDropDemo
