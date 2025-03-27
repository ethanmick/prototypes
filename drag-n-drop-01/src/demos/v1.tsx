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
        <button
          onClick={() => onRemoveGroup(group.id)}
          className="bg-red-100 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-200"
        >
          Remove
        </button>
      </div>
      <div className="pl-2">
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
  const [items, setItems] = useState<Item[]>([
    { id: 'item-1', type: 'ITEM', content: 'Item 1' },
    { id: 'item-2', type: 'ITEM', content: 'Item 2' },
    { id: 'item-3', type: 'ITEM', content: 'Item 3' },
  ])

  const [groups, setGroups] = useState<Group[]>([
    {
      id: 'group-1',
      type: 'GROUP',
      name: 'Group 1',
      items: [
        { id: 'item-4', type: 'ITEM', content: 'Item 4' },
        { id: 'item-5', type: 'ITEM', content: 'Item 5' },
      ],
    },
    {
      id: 'group-2',
      type: 'GROUP',
      name: 'Group 2',
      items: [{ id: 'item-6', type: 'ITEM', content: 'Item 6' }],
    },
  ])

  const [activeParentId, setActiveParentId] = useState<UniqueIdentifier | null>(
    null
  )

  // All IDs for top-level sortable context
  const rootIds = useMemo(() => {
    return [...items.map((item) => item.id), ...groups.map((group) => group.id)]
  }, [items, groups])

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

    const activeData = active.data.current
    const overId = over.id

    // Skip if not dragging an item or hovering over the same item
    if (activeData?.type !== 'ITEM' || active.id === overId) return

    // Find the group we're dragging over (if any)
    const overGroup = groups.find((group) => group.id === overId)

    // Only handle item drops into groups
    if (overGroup) {
      setItems((items) => items.filter((item) => item.id !== active.id))

      // If item was in another group, remove it from there
      if (activeParentId) {
        setGroups((currentGroups) => {
          return currentGroups.map((group) => {
            if (group.id === activeParentId) {
              return {
                ...group,
                items: group.items.filter((item) => item.id !== active.id),
              }
            }
            return group
          })
        })
      }

      // Add item to the new group
      setGroups((currentGroups) => {
        return currentGroups.map((group) => {
          if (group.id === overGroup.id) {
            // Only add if it's not already there
            if (!group.items.some((item) => item.id === active.id)) {
              const activeItem = activeParentId
                ? groups
                    .find((g) => g.id === activeParentId)
                    ?.items.find((i) => i.id === active.id)
                : items.find((i) => i.id === active.id)

              if (activeItem) {
                return {
                  ...group,
                  items: [...group.items, activeItem as Item],
                }
              }
            }
          }
          return group
        })
      })

      setActiveParentId(overGroup.id)
    }
  }

  // Drag end handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) {
      setActiveParentId(null)
      return
    }

    const activeItemId = active.id
    const overId = over.id

    if (activeItemId === overId) {
      setActiveParentId(null)
      return
    }

    const activeData = active.data.current
    const activeType = activeData?.type
    const activeParent = activeData?.parentId

    // Case 1: Sorting items within the same group
    if (activeType === 'ITEM' && activeParent) {
      // Check if this is a within-group sort or moving to root
      const isOverGroup = groups.some((g) => g.id === overId)

      if (isOverGroup) {
        // This is handled in the dragOver event for moving between groups
        // Here we just handle sorting within the same group
        const parentGroup = groups.find((group) => group.id === activeParent)
        const overIsInSameGroup = parentGroup?.items.some(
          (item) => item.id === overId
        )

        if (parentGroup && overIsInSameGroup) {
          const oldIndex = parentGroup.items.findIndex(
            (item) => item.id === activeItemId
          )
          const newIndex = parentGroup.items.findIndex(
            (item) => item.id === overId
          )

          if (oldIndex !== -1 && newIndex !== -1) {
            setGroups((groups) => {
              return groups.map((group) => {
                if (group.id === activeParent) {
                  const newItems = arrayMove(group.items, oldIndex, newIndex)
                  return { ...group, items: newItems }
                }
                return group
              })
            })
          }
        }
      } else {
        // Case 2: Moving an item from a group to the root level
        // Remove from group
        setGroups((groups) => {
          return groups.map((group) => {
            if (group.id === activeParent) {
              return {
                ...group,
                items: group.items.filter((item) => item.id !== activeItemId),
              }
            }
            return group
          })
        })

        // Add to root items
        const itemToMove = groups
          .find((g) => g.id === activeParent)
          ?.items.find((i) => i.id === activeItemId)

        if (itemToMove) {
          // Find the correct position in root items
          const overItemIndex = items.findIndex((item) => item.id === overId)

          if (overItemIndex !== -1) {
            const newItems = [...items]
            newItems.splice(overItemIndex, 0, itemToMove)
            setItems(newItems)
          } else {
            setItems([...items, itemToMove])
          }
        }
      }
    }
    // Case 3: Sorting top-level items (either standalone items or groups)
    else {
      const isItem = items.some((item) => item.id === activeItemId)
      const isGroup = groups.some((group) => group.id === activeItemId)

      if (isItem) {
        const oldIndex = items.findIndex((item) => item.id === activeItemId)
        const isOverGroup = groups.some((group) => group.id === overId)

        if (!isOverGroup) {
          const newIndex = items.findIndex((item) => item.id === overId)
          if (oldIndex !== -1 && newIndex !== -1) {
            setItems((items) => arrayMove(items, oldIndex, newIndex))
          }
        }
      } else if (isGroup) {
        const oldIndex = groups.findIndex((group) => group.id === activeItemId)
        const newIndex = groups.findIndex((group) => group.id === overId)

        if (oldIndex !== -1 && newIndex !== -1) {
          setGroups((groups) => arrayMove(groups, oldIndex, newIndex))
        }
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
    setGroups([...groups, newGroup])
  }

  // Remove a group and move its items to the root
  const handleRemoveGroup = (groupId: UniqueIdentifier) => {
    const group = groups.find((g) => g.id === groupId)
    if (group) {
      // Move items to root
      setItems([...items, ...group.items])
      // Remove the group
      setGroups(groups.filter((g) => g.id !== groupId))
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
          {/* Render top-level items */}
          {items.map((item) => (
            <SortableItem key={item.id.toString()} item={item} />
          ))}

          {/* Render groups */}
          {groups.map((group) => (
            <SortableGroup
              key={group.id.toString()}
              group={group}
              onRemoveGroup={handleRemoveGroup}
            />
          ))}
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
