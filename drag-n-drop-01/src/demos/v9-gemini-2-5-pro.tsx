import {
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
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
import React, { useCallback, useMemo, useState } from 'react'

// --- Types ---

type Id = string

interface BaseItem {
  id: Id
}

interface Item extends BaseItem {
  type: 'item'
  content: string
  groupId: Id | null // null if item is at root level
}

interface Group extends BaseItem {
  type: 'group'
  title: string
  itemIds: Id[] // IDs of items within this group
}

type DraggableItem = Item | Group
type DraggableType = DraggableItem['type']

// Helper type for easier state management
type AppState = {
  rootOrder: Id[] // Order of items and groups at the root level
  items: Record<Id, Item>
  groups: Record<Id, Group>
}

// --- Data ---

const initialData: AppState = (() => {
  const items: Record<Id, Item> = {
    'item-1': {
      id: 'item-1',
      type: 'item',
      content: 'Item 1 (Root)',
      groupId: null,
    },
    'item-2': {
      id: 'item-2',
      type: 'item',
      content: 'Item 2 (Group A)',
      groupId: 'group-a',
    },
    'item-3': {
      id: 'item-3',
      type: 'item',
      content: 'Item 3 (Group A)',
      groupId: 'group-a',
    },
    'item-4': {
      id: 'item-4',
      type: 'item',
      content: 'Item 4 (Root)',
      groupId: null,
    },
    'item-5': {
      id: 'item-5',
      type: 'item',
      content: 'Item 5 (Group B)',
      groupId: 'group-b',
    },
    'item-6': {
      id: 'item-6',
      type: 'item',
      content: 'Item 6 (Root)',
      groupId: null,
    },
    'item-7': {
      id: 'item-7',
      type: 'item',
      content: 'Item 7 (Group B)',
      groupId: 'group-b',
    },
  }

  const groups: Record<Id, Group> = {
    'group-a': {
      id: 'group-a',
      type: 'group',
      title: 'Group A',
      itemIds: ['item-2', 'item-3'],
    },
    'group-b': {
      id: 'group-b',
      type: 'group',
      title: 'Group B',
      itemIds: ['item-5', 'item-7'],
    },
  }

  const rootOrder: Id[] = ['item-1', 'group-a', 'item-4', 'group-b', 'item-6']

  return { items, groups, rootOrder }
})()

// --- Utility Functions ---

const findItem = (id: Id, state: AppState): Item | undefined => state.items[id]
const findGroup = (id: Id, state: AppState): Group | undefined =>
  state.groups[id]

// 1. Individual Item Component
interface SortableItemProps {
  item: Item
  isOverlay?: boolean
}

const SortableItem = React.memo(
  ({ item, isOverlay = false }: SortableItemProps) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({
      id: item.id,
      data: { type: 'item', item }, // Pass item data for context in handlers
    })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging && !isOverlay ? 0.5 : 1,
      cursor: isOverlay ? 'grabbing' : 'grab',
    }

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`p-2 border border-gray-300 bg-white rounded mb-1 ${
          isOverlay ? 'shadow-lg' : ''
        }`}
      >
        {item.content}
      </div>
    )
  }
)
SortableItem.displayName = 'SortableItem'

// 2. Group Component (includes internal sorting context)
interface SortableGroupProps {
  group: Group
  items: Item[] // Items belonging to this group
  isOverlay?: boolean
}

const SortableGroup = React.memo(
  ({ group, items, isOverlay = false }: SortableGroupProps) => {
    const {
      attributes,
      listeners,
      setNodeRef: setGroupNodeRef,
      transform,
      transition,
      isDragging: isGroupDragging,
    } = useSortable({
      id: group.id,
      data: { type: 'group', group }, // Pass group data
    })

    const groupStyle = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isGroupDragging && !isOverlay ? 0.5 : 1,
      cursor: isOverlay ? 'grabbing' : 'grab',
    }

    const itemIds = useMemo(() => items.map((item) => item.id), [items])

    return (
      <div
        ref={setGroupNodeRef}
        style={groupStyle}
        className={`p-3 border-2 border-blue-500 bg-blue-50 rounded mb-1 ${
          isOverlay ? 'shadow-xl' : ''
        }`}
      >
        {/* Group Header (Draggable Handle for the Group itself) */}
        <div
          {...attributes}
          {...listeners}
          className="font-bold mb-2 cursor-grab active:cursor-grabbing"
        >
          {group.title}
        </div>

        {/* Internal Sortable Context for Items within the Group */}
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <div className="min-h-[30px] border border-dashed border-blue-300 p-1 rounded bg-blue-100">
            {items.length > 0 ? (
              items.map((item) => <SortableItem key={item.id} item={item} />)
            ) : (
              <div className="text-xs text-gray-500 italic p-1 text-center">
                Drop items here
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    )
  }
)
SortableGroup.displayName = 'SortableGroup'

// 3. Dedicated Drop Zones Above/Below Groups
// These use useDroppable, not useSortable
interface DroppableZoneProps {
  id: Id // e.g., 'above-group-a' or 'below-group-a'
  groupId: Id
  type: 'above' | 'below'
  isActiveDrop: boolean // Highlight when a compatible item is over it
}

const DroppableZone = ({
  id,
  groupId,
  type,
  isActiveDrop,
}: DroppableZoneProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
    data: {
      type: `dropzone-${type}`,
      groupId: groupId,
      accepts: ['item'], // Only accept items
    },
  })

  const showZone = isActiveDrop // Only clearly visible when actively dragging an item

  return (
    <div
      ref={setNodeRef}
      className={`h-2 my-0.5 rounded transition-all duration-150 ease-in-out ${
        showZone
          ? 'bg-green-300 h-8 border border-dashed border-green-600'
          : 'bg-transparent'
      } ${isOver && showZone ? 'ring-2 ring-green-500 ring-offset-1' : ''}`}
      aria-label={`Drop zone ${type} group ${groupId}`}
    >
      {/* Optional: Text visible only when active */}
      {isOver && showZone && (
        <div className="text-xs text-green-800 text-center leading-8">
          {`Drop here (${type} group)`}
        </div>
      )}
    </div>
  )
}

// Wrapper to conditionally render drop zones based on active drag item type
interface DropZoneWrapperProps {
  groupId: Id
  children: React.ReactNode
  isItemDragging: boolean // Only show zones if an item is being dragged
}

const DropZoneWrapper = ({
  groupId,
  children,
  isItemDragging,
}: DropZoneWrapperProps) => {
  const aboveId = `above-group-${groupId}`
  const belowId = `below-group-${groupId}`

  return (
    <div>
      {isItemDragging && (
        <DroppableZone
          id={aboveId}
          groupId={groupId}
          type="above"
          isActiveDrop={isItemDragging}
        />
      )}
      {children}
      {isItemDragging && (
        <DroppableZone
          id={belowId}
          groupId={groupId}
          type="below"
          isActiveDrop={isItemDragging}
        />
      )}
    </div>
  )
}

// 4. Main Application Component
const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(initialData)
  const [activeId, setActiveId] = useState<Id | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Memoize derived data
  const activeItem = useMemo(
    () => (activeId ? findItem(activeId, appState) : null),
    [activeId, appState.items]
  )
  const activeGroup = useMemo(
    () => (activeId ? findGroup(activeId, appState) : null),
    [activeId, appState.groups]
  )
  const activeType = useMemo(
    () => (activeGroup ? 'group' : activeItem ? 'item' : null),
    [activeItem, activeGroup]
  )

  const rootItemsAndGroups = useMemo(() => {
    return appState.rootOrder.map(
      (id) => appState.items[id] || appState.groups[id]
    )
  }, [appState.rootOrder, appState.items, appState.groups])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    console.log('Drag Start:', event.active.id, event.active.data.current?.type)
    setActiveId(event.active.id as Id)
  }, [])

  const handleDragOver = useCallback(() => {
    // Optional: Add visual cues during drag over, e.g., highlighting potential drop zones
    // console.log("Drag Over:", event.over?.id);
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null) // Clear active drag item

    if (!over || !active) {
      console.log('Drag cancelled (no target)')
      return
    }

    if (active.id === over.id) {
      console.log('Drag ended on same item')
      return
    }

    const activeId = active.id as Id
    const overId = over.id as Id
    const activeType = active.data.current?.type as DraggableType | undefined
    const overType = over.data.current?.type as
      | DraggableType
      | `dropzone-${'above' | 'below'}`
      | undefined
    const overData = over.data.current

    console.log(
      `Drag End: Active=${activeId}(${activeType}) Over=${overId}(${overType})`
    )
    // console.log("Over Data:", overData);

    setAppState((prevState) => {
      const nextState = JSON.parse(JSON.stringify(prevState)) as AppState // Deep clone for immutability

      const activeItem = findItem(activeId, nextState)
      const activeGroup = findGroup(activeId, nextState)

      const sourceContainerId =
        activeItem?.groupId ??
        (nextState.rootOrder.includes(activeId) ? 'root' : null)

      // --- Core Logic ---

      // 1. Moving a Group (Root Level Only)
      if (activeType === 'group' && activeGroup) {
        const activeIndex = nextState.rootOrder.indexOf(activeId)
        let overIndex = nextState.rootOrder.indexOf(overId)

        // If dropping over an item within a group, target the group itself in the root list
        const overItem = findItem(overId, nextState)
        if (overItem && overItem.groupId) {
          overIndex = nextState.rootOrder.indexOf(overItem.groupId)
        } else if (overType?.startsWith('dropzone-') && overData?.groupId) {
          // If dropping on a dropzone, target the associated group's position
          overIndex = nextState.rootOrder.indexOf(overData.groupId)
          if (overType === 'dropzone-below') overIndex++
        }

        if (
          activeIndex !== -1 &&
          overIndex !== -1 &&
          activeIndex !== overIndex
        ) {
          console.log(
            `Moving Group ${activeId} from index ${activeIndex} to ${overIndex} in root`
          )
          nextState.rootOrder = arrayMove(
            nextState.rootOrder,
            activeIndex,
            overIndex
          )
        }
        return nextState // Group moves handled, return
      }

      // 2. Moving an Item
      if (activeType === 'item' && activeItem) {
        const targetIsGroup = overType === 'group'
        const targetIsItemInGroup =
          overType === 'item' && overData?.item?.groupId
        const targetGroupId = targetIsGroup
          ? overId
          : targetIsItemInGroup
          ? overData?.item?.groupId
          : null
        const targetIsDropZone = overType?.startsWith('dropzone-')
        const dropZoneTargetGroupId = targetIsDropZone
          ? overData?.groupId
          : null

        // A. Remove item from its original location
        const sourceIsRoot = sourceContainerId === 'root'
        const sourceGroupId = !sourceIsRoot ? sourceContainerId : null

        if (sourceIsRoot) {
          const index = nextState.rootOrder.indexOf(activeId)
          if (index > -1) nextState.rootOrder.splice(index, 1)
        } else if (sourceGroupId && nextState.groups[sourceGroupId]) {
          const group = nextState.groups[sourceGroupId]
          const index = group.itemIds.indexOf(activeId)
          if (index > -1) group.itemIds.splice(index, 1)
        }
        // Ensure item's groupId is cleared initially if removed
        nextState.items[activeId].groupId = null

        // B. Add item to its new location

        // B.1 Dropping onto a Group (or an item within a group)
        if (targetGroupId) {
          console.log(`Moving Item ${activeId} into Group ${targetGroupId}`)
          const targetGroup = nextState.groups[targetGroupId]
          if (targetGroup) {
            const overItemId = overType === 'item' ? overId : null
            const targetItemIndex = overItemId
              ? targetGroup.itemIds.indexOf(overItemId)
              : -1

            if (targetItemIndex > -1) {
              // Insert before the item we dropped onto
              targetGroup.itemIds.splice(targetItemIndex, 0, activeId)
            } else {
              // Add to the end of the group
              targetGroup.itemIds.push(activeId)
            }
            nextState.items[activeId].groupId = targetGroupId // Update item's parent group
          }
        }
        // B.2 Dropping onto a Dedicated Drop Zone (Above/Below Group)
        else if (targetIsDropZone && dropZoneTargetGroupId) {
          console.log(
            `Moving Item ${activeId} ${overType} Group ${dropZoneTargetGroupId}`
          )
          const targetGroupIndexInRoot = nextState.rootOrder.indexOf(
            dropZoneTargetGroupId
          )
          if (targetGroupIndexInRoot !== -1) {
            const insertIndex =
              overType === 'dropzone-above'
                ? targetGroupIndexInRoot
                : targetGroupIndexInRoot + 1
            nextState.rootOrder.splice(insertIndex, 0, activeId)
            nextState.items[activeId].groupId = null // Now at root level
          } else {
            console.warn('Target group for dropzone not found in root!')
            // Fallback: add to root end? Or revert? For now, add to end.
            nextState.rootOrder.push(activeId)
            nextState.items[activeId].groupId = null
          }
        }
        // B.3 Dropping onto the Root list (or an item at the root level)
        else {
          console.log(`Moving Item ${activeId} to Root`)
          const targetIndexInRoot = nextState.rootOrder.indexOf(overId)

          if (targetIndexInRoot !== -1) {
            // If dropped over a root item/group, insert before it
            nextState.rootOrder.splice(targetIndexInRoot, 0, activeId)
          } else {
            // Attempt to find the correct drop position if overId wasn't directly in rootOrder
            // This might happen if dropping in an empty space or near the end
            // A more robust solution might involve collision detection strategies,
            // but for simplicity, let's try finding the closest root element visually.
            // Or just append if index not found.
            console.warn(
              `Could not find exact target index for ${overId} in root. Appending.`
            )
            nextState.rootOrder.push(activeId) // Fallback: Add to end
          }
          nextState.items[activeId].groupId = null // Ensure item is marked as root
        }
      }

      return nextState
    })
  }, [])

  const renderOverlay = () => {
    if (!activeId) return null

    if (activeType === 'item' && activeItem) {
      return <SortableItem item={activeItem} isOverlay />
    }
    if (activeType === 'group' && activeGroup) {
      const groupItems = activeGroup.itemIds
        .map((id) => appState.items[id])
        .filter(Boolean) as Item[]
      return <SortableGroup group={activeGroup} items={groupItems} isOverlay />
    }
    return null
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners} // Might need refinement for nested + zones
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="container mx-auto p-4 max-w-md">
        <h1 className="text-2xl font-bold mb-4">Complex DnD List</h1>

        <SortableContext
          items={appState.rootOrder}
          strategy={verticalListSortingStrategy}
        >
          <div className="p-4 bg-gray-100 rounded border border-gray-300 min-h-[300px]">
            {rootItemsAndGroups.map((itemOrGroup) => {
              if (itemOrGroup.type === 'item') {
                return (
                  <SortableItem
                    key={itemOrGroup.id}
                    item={itemOrGroup as Item}
                  />
                )
              } else if (itemOrGroup.type === 'group') {
                const group = itemOrGroup as unknown as Group
                const groupItems = group.itemIds
                  .map((id) => appState.items[id])
                  .filter(Boolean) as Item[]
                return (
                  // Wrap Group with Drop Zones, only active when an *item* is dragging
                  <DropZoneWrapper
                    key={group.id}
                    groupId={group.id}
                    isItemDragging={activeType === 'item'}
                  >
                    <SortableGroup group={group} items={groupItems} />
                  </DropZoneWrapper>
                )
              }
              return null
            })}
            {rootItemsAndGroups.length === 0 && (
              <div className="text-center text-gray-500 italic p-4">
                List is empty
              </div>
            )}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={null}>{renderOverlay()}</DragOverlay>
      </div>
    </DndContext>
  )
}

export default App
