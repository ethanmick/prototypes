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

// Drop Preview Interface
interface DropPreview {
  targetId: UniqueIdentifier | null
  targetType: 'ITEM' | 'GROUP' | 'AFTER_GROUP' | null
  position: 'before' | 'after' | 'inside'
  parentId: UniqueIdentifier | null
}

// Drop Preview Line Component
const DropPreviewLine = ({
  isActive,
  isHorizontal = false,
  isInGroup = false,
}: {
  isActive: boolean
  isHorizontal?: boolean
  isInGroup?: boolean
}) => {
  if (!isActive) return null

  return (
    <div
      className={`absolute ${
        isHorizontal ? 'h-0.5 left-0 right-0' : 'w-0.5 top-0 bottom-0'
      } bg-blue-500 z-10 rounded-full ${isInGroup ? 'ml-4' : ''}`}
    />
  )
}

// Item Component
const SortableItem = ({
  item,
  parentId = null,
  preview = null,
}: {
  item: Item
  parentId?: UniqueIdentifier | null
  preview?: DropPreview | null
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
    position: 'relative' as const,
  }

  const showTopPreview =
    preview?.targetId === item.id &&
    preview.position === 'before' &&
    preview.targetType === 'ITEM' &&
    preview.parentId === parentId

  const showBottomPreview =
    preview?.targetId === item.id &&
    preview.position === 'after' &&
    preview.targetType === 'ITEM' &&
    preview.parentId === parentId

  return (
    <div className="relative">
      {showTopPreview && (
        <div className="absolute top-0 left-0 right-0 -mt-1">
          <DropPreviewLine
            isActive={true}
            isHorizontal={true}
            isInGroup={!!parentId}
          />
        </div>
      )}
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
      {showBottomPreview && (
        <div className="absolute bottom-0 left-0 right-0 -mb-1">
          <DropPreviewLine
            isActive={true}
            isHorizontal={true}
            isInGroup={!!parentId}
          />
        </div>
      )}
    </div>
  )
}

// Group Component
const SortableGroup = ({
  group,
  onRemoveGroup,
  preview = null,
}: {
  group: Group
  onRemoveGroup: (id: UniqueIdentifier) => void
  preview?: DropPreview | null
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

  const showInsidePreview =
    preview?.targetId === group.id &&
    preview.position === 'inside' &&
    preview.targetType === 'GROUP'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 my-2 bg-gray-50 border rounded shadow ${
        isDragging ? 'ring-2 ring-blue-400' : ''
      } ${showInsidePreview ? 'ring-2 ring-blue-500' : ''}`}
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
      <div className="pl-2 pt-1 border-t relative">
        {showInsidePreview && group.items.length === 0 && (
          <div className="p-2 mb-2 border border-blue-400 bg-blue-50 bg-opacity-30 rounded">
            <div className="h-6 rounded bg-blue-100 bg-opacity-50 border border-dashed border-blue-400"></div>
          </div>
        )}
        {group.items.map((item) => (
          <SortableItem
            key={item.id.toString()}
            item={item}
            parentId={group.id}
            preview={preview}
          />
        ))}
        {group.items.length === 0 && !showInsidePreview && (
          <div className="text-gray-400 text-sm italic p-2">
            Drag items here
          </div>
        )}
      </div>
    </div>
  )
}

// Group container with droppable after-area
const GroupContainer = ({
  group,
  onRemoveGroup,
  isOverGroup,
  preview = null,
}: {
  group: Group
  onRemoveGroup: (id: UniqueIdentifier) => void
  isOverGroup: boolean
  preview?: DropPreview | null
}) => {
  const showTopPreview =
    preview?.targetId === group.id &&
    preview.position === 'before' &&
    preview.targetType === 'GROUP'

  return (
    <div className="relative">
      {isOverGroup && <DroppableOverlay isOver={true} isGroup={true} />}
      {showTopPreview && (
        <div className="absolute top-0 left-0 right-0 -mt-1 z-10">
          <DropPreviewLine isActive={true} isHorizontal={true} />
        </div>
      )}
      <SortableGroup
        group={group}
        onRemoveGroup={onRemoveGroup}
        preview={preview}
      />
    </div>
  )
}

// Droppable After Group Area
const DroppableAfterGroup = ({
  id,
  isActive,
}: {
  id: UniqueIdentifier
  isActive: boolean
}) => {
  const { setNodeRef } = useSortable({
    id: `${id}-after`,
    data: { type: 'AFTER_GROUP', groupId: id },
  })

  return (
    <div
      ref={setNodeRef}
      className={`h-3 -mt-1 mb-2 rounded ${
        isActive ? 'bg-green-200 border border-green-400' : 'hover:bg-gray-100'
      }`}
      style={{ transition: 'background-color 0.2s ease' }}
    />
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

// Additional DropIndicator component for the end of the list
const LastItemDropIndicator = ({ isActive }: { isActive: boolean }) => {
  if (!isActive) return null

  return (
    <div className="h-10 border-2 border-dashed border-blue-400 rounded bg-blue-50 bg-opacity-30 mb-2"></div>
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
  const [overAfterArea, setOverAfterArea] = useState<UniqueIdentifier | null>(
    null
  )
  const [dropPreview, setDropPreview] = useState<DropPreview>({
    targetId: null,
    targetType: null,
    position: 'after',
    parentId: null,
  })

  // IDs for sortable context - root items
  const rootIds = useMemo(() => {
    const ids = rootItems.map((item) => item.id)
    // Add "after-group" areas for each group
    const afterGroupIds = rootItems
      .filter((item) => item.type === 'GROUP')
      .map((group) => `${group.id}-after`)
    return [...ids, ...afterGroupIds]
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

    // Reset states first
    setOverGroup(null)
    setOverAfterArea(null)
    setDropPreview({
      targetId: null,
      targetType: null,
      position: 'after',
      parentId: null,
    })

    // Special handling for dropping at the end of the list
    if (over.id === 'end-of-list') {
      setDropPreview({
        targetId: 'end-of-list',
        targetType: 'ITEM',
        position: 'after',
        parentId: null,
      })
      return
    }

    // Check if we're over an "after group" area
    if (over.data.current?.type === 'AFTER_GROUP') {
      setOverAfterArea(over.data.current.groupId as UniqueIdentifier)
      setDropPreview({
        targetId: over.data.current.groupId as UniqueIdentifier,
        targetType: 'AFTER_GROUP',
        position: 'after',
        parentId: null,
      })
      return
    }

    // Dropping an item over a group
    if (activeItem.type === 'ITEM' && over.data.current?.type === 'GROUP') {
      setOverGroup(over.id)
      // Show as going inside the group
      setDropPreview({
        targetId: over.id,
        targetType: 'GROUP',
        position: 'inside',
        parentId: null,
      })
      return
    }

    // Group being dragged over another group
    if (activeItem.type === 'GROUP' && over.data.current?.type === 'GROUP') {
      setOverGroup(over.id)
      // Show as going before or after the group based on cursor position
      const overRect = over.rect
      const overCenter = overRect ? overRect.top + overRect.height / 2 : 0
      const overPos =
        event.activatorEvent instanceof PointerEvent
          ? event.activatorEvent.clientY
          : 0

      setDropPreview({
        targetId: over.id,
        targetType: 'GROUP',
        position: overPos < overCenter ? 'before' : 'after',
        parentId: null,
      })
      return
    }

    // Handle dropping an item over another item
    if (activeItem.type === 'ITEM' && over.data.current?.type === 'ITEM') {
      // Item over an item in a group
      if (over.data.current?.parentId) {
        setOverGroup(over.data.current.parentId)
      }

      // Determine whether it should appear before or after the target item
      const overRect = over.rect
      const overCenter = overRect ? overRect.top + overRect.height / 2 : 0
      const overPos =
        event.activatorEvent instanceof PointerEvent
          ? event.activatorEvent.clientY
          : 0

      setDropPreview({
        targetId: over.id,
        targetType: 'ITEM',
        position: overPos < overCenter ? 'before' : 'after',
        parentId: over.data.current?.parentId || null,
      })
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || !active) {
      setActiveId(null)
      setActiveParentId(null)
      setOverGroup(null)
      setOverAfterArea(null)
      setDropPreview({
        targetId: null,
        targetType: null,
        position: 'after',
        parentId: null,
      })
      return
    }

    const activeItem = findItemById(active.id)
    if (!activeItem) {
      setActiveId(null)
      setActiveParentId(null)
      setOverGroup(null)
      setOverAfterArea(null)
      setDropPreview({
        targetId: null,
        targetType: null,
        position: 'after',
        parentId: null,
      })
      return
    }

    // Handle dropping at the end of the list
    if (over.id === 'end-of-list') {
      if (activeItem.type === 'ITEM') {
        setRootItems((items) => {
          // Handle item from a group
          const activeParent = findGroupContainingItem(active.id)
          if (activeParent) {
            const draggedItem = activeParent.items.find(
              (item) => item.id === active.id
            ) as Item

            if (!draggedItem) return items

            // Remove from group and add to end of list
            return [
              ...items.map((item) => {
                if (item.id === activeParent.id && item.type === 'GROUP') {
                  return {
                    ...item,
                    items: item.items.filter((i) => i.id !== active.id),
                  }
                }
                return item
              }),
              draggedItem,
            ]
          }
          // If item is already at root, move it to the end
          else {
            const oldIndex = items.findIndex((item) => item.id === active.id)
            const newIndex = items.length - 1
            return arrayMove(items, oldIndex, newIndex)
          }
        })
      }
      // If a group is being moved to the end
      else if (activeItem.type === 'GROUP') {
        setRootItems((items) => {
          const oldIndex = items.findIndex((item) => item.id === active.id)
          const newIndex = items.length - 1
          return arrayMove(items, oldIndex, newIndex)
        })
      }

      setActiveId(null)
      setActiveParentId(null)
      setOverGroup(null)
      setOverAfterArea(null)
      setDropPreview({
        targetId: null,
        targetType: null,
        position: 'after',
        parentId: null,
      })
      return
    }

    // Handle dropping after a group
    if (over.data.current?.type === 'AFTER_GROUP') {
      const groupId = over.data.current.groupId as UniqueIdentifier

      // Only handle item drops after groups
      if (activeItem.type === 'ITEM') {
        setRootItems((items) => {
          // Find the group and its index
          const groupIndex = items.findIndex((item) => item.id === groupId)
          if (groupIndex === -1) return items

          // Handle removing the item from its current location
          let itemsWithoutDragged: RootItem[] = []
          let draggedItem: Item | null = null

          // If the item is from a group
          const activeParent = findGroupContainingItem(active.id)
          if (activeParent) {
            // Get the dragged item
            draggedItem = activeParent.items.find(
              (item) => item.id === active.id
            ) as Item

            // Remove from original group
            itemsWithoutDragged = items.map((item) => {
              if (item.id === activeParent.id && item.type === 'GROUP') {
                return {
                  ...item,
                  items: item.items.filter((i) => i.id !== active.id),
                }
              }
              return item
            })
          } else {
            // Item is at root level
            draggedItem = items.find((item) => item.id === active.id) as Item

            // Remove from root
            itemsWithoutDragged = items.filter((item) => item.id !== active.id)
          }

          if (!draggedItem) return items

          // Insert after the group
          return [
            ...itemsWithoutDragged.slice(0, groupIndex + 1),
            draggedItem,
            ...itemsWithoutDragged.slice(groupIndex + 1),
          ]
        })
      }
      // If dragging a group to after another group
      else if (activeItem.type === 'GROUP') {
        setRootItems((items) => {
          const oldIndex = items.findIndex((item) => item.id === active.id)
          const targetGroupIndex = items.findIndex(
            (item) => item.id === groupId
          )

          if (oldIndex === -1 || targetGroupIndex === -1) return items

          // We want to place it after the target group
          const newIndex =
            targetGroupIndex < oldIndex
              ? targetGroupIndex + 1
              : targetGroupIndex

          return arrayMove(items, oldIndex, newIndex)
        })
      }
    }
    // Handle Group sorting - direct group-to-group
    else if (activeItem.type === 'GROUP') {
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
          setOverAfterArea(null)
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
        setOverAfterArea(null)
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
    setOverAfterArea(null)
    setDropPreview({
      targetId: null,
      targetType: null,
      position: 'after',
      parentId: null,
    })
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
        <div className="space-y-1 min-h-[400px]">
          <SortableContext
            items={[...rootIds, 'end-of-list']}
            strategy={verticalListSortingStrategy}
          >
            {rootItems.map((item) => {
              if (item.type === 'ITEM') {
                return (
                  <SortableItem
                    key={item.id.toString()}
                    item={item}
                    preview={dropPreview}
                  />
                )
              }

              if (item.type === 'GROUP') {
                return (
                  <div key={item.id.toString()}>
                    <GroupContainer
                      group={item}
                      onRemoveGroup={handleRemoveGroup}
                      isOverGroup={overGroup === item.id}
                      preview={dropPreview}
                    />
                    <DroppableAfterGroup
                      id={item.id}
                      isActive={overAfterArea === item.id}
                    />
                  </div>
                )
              }

              return null
            })}

            {/* End of list drop indicator */}
            <div
              ref={
                useSortable({
                  id: 'end-of-list',
                  data: { type: 'END_OF_LIST' },
                }).setNodeRef
              }
              className="mt-2"
            >
              <LastItemDropIndicator
                isActive={dropPreview.targetId === 'end-of-list'}
              />
            </div>
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
