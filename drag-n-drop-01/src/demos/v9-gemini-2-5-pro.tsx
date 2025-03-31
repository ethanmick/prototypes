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

// --- Components ---

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
        } ${isDragging ? 'z-10 relative' : ''}`}
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
        } ${isGroupDragging ? 'z-10 relative' : ''}`}
      >
        {/* Group Header (Draggable Handle for the Group itself) */}
        <div
          {...attributes} // Group drag handle here
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

  // Memoize derived data based on activeId and appState
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
    return appState.rootOrder
      .map((id) => appState.items[id] || appState.groups[id])
      .filter(Boolean) // Ensure no undefined entries
  }, [appState.rootOrder, appState.items, appState.groups])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    // console.log("Drag Start:", event.active.id, event.active.data.current?.type);
    setActiveId(event.active.id as Id)
  }, [])

  const handleDragOver = useCallback(() => {
    // console.log("Drag Over:", event.over?.id);
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over || !active || active.id === over.id) {
        // console.log("Drag ended without move or cancelled");
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

      // console.log(`Drag End: Active=${activeId}(${activeType}) Over=${overId}(${overType})`);
      // console.log("Over Data:", overData);

      setAppState((prevState) => {
        const nextState = JSON.parse(JSON.stringify(prevState)) as AppState

        const activeItem = findItem(activeId, nextState)
        const activeGroup = findGroup(activeId, nextState)
        const overItem = findItem(overId, nextState)
        const overGroup = findGroup(overId, nextState)

        // Determine source container
        const sourceContainerId =
          activeItem?.groupId ??
          (nextState.rootOrder.includes(activeId) ? 'root' : null)

        // Determine target container/location info
        let targetContainerId: Id | 'root' | null = null
        let targetIndex = -1 // Index within the target container's direct children list (rootOrder or itemIds)
        const targetIsDropZone = overType?.startsWith('dropzone-')
        const dropZoneType: 'above' | 'below' | null = targetIsDropZone
          ? (overType?.split('-')[1] as 'above' | 'below')
          : null
        const dropZoneGroupId: Id | null = targetIsDropZone
          ? overData?.groupId
          : null

        // Determine target container based on what is being hovered over
        if (overGroup) {
          // Dropped onto a group header/area
          targetContainerId = overId
          // If an item is dragged, it targets the group's item list
          // If a group is dragged, it targets the root list position relative to this group
        } else if (overItem) {
          // Dropped onto an item
          targetContainerId = overItem.groupId ?? 'root' // The container is where the overItem resides
          if (targetContainerId === 'root') {
            targetIndex = nextState.rootOrder.indexOf(overId)
          } else if (nextState.groups[targetContainerId]) {
            targetIndex =
              nextState.groups[targetContainerId].itemIds.indexOf(overId)
          }
        } else if (targetIsDropZone && dropZoneGroupId) {
          // Dropped onto a drop zone
          targetContainerId = 'root' // Drop zones always resolve to root placement
          const relatedGroupIndex = nextState.rootOrder.indexOf(dropZoneGroupId)
          if (relatedGroupIndex !== -1) {
            targetIndex =
              dropZoneType === 'above'
                ? relatedGroupIndex
                : relatedGroupIndex + 1
          } else {
            targetIndex = nextState.rootOrder.length // Fallback: append if group not found?
            console.warn(
              `Dropzone's related group ${dropZoneGroupId} not found in rootOrder`
            )
          }
        } else if (nextState.rootOrder.includes(overId)) {
          // Dropped onto another root item/group ID (should be covered by overItem/overGroup)
          targetContainerId = 'root'
          targetIndex = nextState.rootOrder.indexOf(overId)
        } else {
          // Fallback: Attempt to resolve based on overId type if possible, otherwise assume root append
          if (findGroup(overId, nextState)) {
            // Maybe dropped on group container background?
            targetContainerId = overId // Target the group
          } else {
            console.warn(`Unclear drop target ${overId}. Assuming root append.`)
            targetContainerId = 'root'
            targetIndex = nextState.rootOrder.length // Append to end
          }
        }

        // --- Core Logic ---

        // 1. Moving a Group (must stay in root)
        if (activeType === 'group' && activeGroup) {
          const activeIndex = nextState.rootOrder.indexOf(activeId)
          let groupTargetIndex = -1 // Target index within rootOrder

          if (targetContainerId === 'root') {
            // Target is root level (via item, another group, dropzone, or root itself)
            groupTargetIndex = targetIndex // Use the calculated root index
          } else if (targetContainerId && nextState.groups[targetContainerId]) {
            // Dropped onto an item *within* a group, target the group's root position
            groupTargetIndex = nextState.rootOrder.indexOf(targetContainerId)
          }

          // Sanity check target index
          if (
            groupTargetIndex < 0 ||
            groupTargetIndex > nextState.rootOrder.length
          ) {
            console.warn(
              'Calculated invalid target index for group move:',
              groupTargetIndex
            )
            groupTargetIndex = nextState.rootOrder.length // Fallback append
          }

          if (activeIndex !== -1 && activeIndex !== groupTargetIndex) {
            // console.log(`Moving Group ${activeId} from root index ${activeIndex} to ${groupTargetIndex}`);
            nextState.rootOrder = arrayMove(
              nextState.rootOrder,
              activeIndex,
              groupTargetIndex
            )
          } else {
            // console.log("Group move cancelled or target invalid.");
          }
          return nextState
        }

        // 2. Moving an Item
        if (
          activeType === 'item' &&
          activeItem &&
          sourceContainerId !== null &&
          targetContainerId !== null
        ) {
          // Adjust target container if dropping item onto group header - should be group ID
          if (overGroup && overId === targetContainerId) {
            targetContainerId = overId // Ensure target is the group ID
            targetIndex =
              nextState.groups[targetContainerId]?.itemIds.length ?? 0 // Target end of group
          }

          // A. Sorting within the SAME container
          if (sourceContainerId === targetContainerId && !targetIsDropZone) {
            if (targetContainerId === 'root') {
              const activeIndex = nextState.rootOrder.indexOf(activeId)
              const overIndex = nextState.rootOrder.indexOf(overId) // Target the item/group being hovered over
              if (activeIndex !== -1 && overIndex !== -1) {
                // console.log(`Sorting Item ${activeId} in Root from ${activeIndex} to ${overIndex}`);
                nextState.rootOrder = arrayMove(
                  nextState.rootOrder,
                  activeIndex,
                  overIndex
                )
              } else {
                console.warn('Root sort failed: indices not found', {
                  activeId,
                  overId,
                  activeIndex,
                  overIndex,
                })
              }
            } else {
              // Sorting within a group
              const group = nextState.groups[targetContainerId]
              if (group) {
                const activeIndex = group.itemIds.indexOf(activeId)
                let overIndex = group.itemIds.indexOf(overId)
                // If dropped onto group container (not an item), append to end
                if (overId === targetContainerId) {
                  overIndex = group.itemIds.length
                }

                if (activeIndex !== -1 && overIndex !== -1) {
                  // console.log(`Sorting Item ${activeId} in Group ${targetContainerId} from ${activeIndex} to ${overIndex}`);
                  group.itemIds = arrayMove(
                    group.itemIds,
                    activeIndex,
                    overIndex
                  )
                } else {
                  console.warn('Group sort failed: indices not found', {
                    activeId,
                    overId,
                    activeIndex,
                    overIndex,
                    targetContainerId,
                  })
                }
              }
            }
          }
          // B. Moving BETWEEN containers (or using drop zones)
          else {
            // console.log(`Moving Item ${activeId} from ${sourceContainerId} to ${targetContainerId} (targetIndex: ${targetIndex}, dropzone: ${targetIsDropZone})`);

            // Remove from source
            if (sourceContainerId === 'root') {
              const index = nextState.rootOrder.indexOf(activeId)
              if (index > -1) nextState.rootOrder.splice(index, 1)
            } else if (nextState.groups[sourceContainerId]) {
              const group = nextState.groups[sourceContainerId]
              const index = group.itemIds.indexOf(activeId)
              if (index > -1) group.itemIds.splice(index, 1)
            }

            // Add to target
            if (targetContainerId === 'root') {
              nextState.items[activeId].groupId = null // Update item state
              // Use the pre-calculated targetIndex for root insertion
              if (
                targetIndex >= 0 &&
                targetIndex <= nextState.rootOrder.length
              ) {
                // console.log(`Inserting item ${activeId} into root at index ${targetIndex}`);
                nextState.rootOrder.splice(targetIndex, 0, activeId)
              } else {
                console.warn(
                  `Could not determine valid target index ${targetIndex} in root for ${overId}. Appending.`
                )
                nextState.rootOrder.push(activeId) // Fallback append
              }
            } else if (nextState.groups[targetContainerId]) {
              // Moving into a group
              nextState.items[activeId].groupId = targetContainerId // Update item state
              const group = nextState.groups[targetContainerId]
              // Use pre-calculated targetIndex if dropping on item, otherwise use determined index (e.g., end for group header)
              const insertionIndex =
                targetIndex !== -1 && targetIndex <= group.itemIds.length
                  ? targetIndex
                  : group.itemIds.length

              // console.log(`Inserting item ${activeId} into group ${targetContainerId} at index ${insertionIndex}`);
              group.itemIds.splice(insertionIndex, 0, activeId)
            } else {
              console.error('Invalid target container ID:', targetContainerId)
              return prevState // Revert state if target is invalid
            }
          }
        }

        return nextState
      })
    },
    [appState]
  ) // Add appState dependency

  const renderOverlay = () => {
    if (!activeId) return null

    if (activeType === 'item' && activeItem) {
      return <SortableItem item={activeItem} isOverlay />
    }
    if (activeType === 'group' && activeGroup) {
      // Ensure we get current items for the overlay, as state might have changed slightly
      const currentGroupState = findGroup(activeGroup.id, appState)
      const groupItems = currentGroupState
        ? (currentGroupState.itemIds
            .map((id) => appState.items[id])
            .filter(Boolean) as Item[])
        : []
      return <SortableGroup group={activeGroup} items={groupItems} isOverlay />
    }
    return null
  }

  // Prepare items for SortableContext, including group drop zones potentially
  const rootSortableItems = useMemo(() => {
    const items = [...appState.rootOrder]
    // Add dropzone IDs if an item is being dragged - Note: This might interfere with arrayMove if not handled carefully
    // For simplicity, let's keep sortable items just the groups and root items. Dropzones are handled separately.
    // if (activeType === 'item') {
    //     const dropZoneIds: string[] = [];
    //     appState.rootOrder.forEach(id => {
    //         if (appState.groups[id]) {
    //             dropZoneIds.push(`above-group-${id}`, `below-group-${id}`);
    //         }
    //     });
    //     // This insertion strategy is complex; better rely on Droppable for zones.
    // }
    return items
  }, [appState.rootOrder /*, activeType*/])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="container mx-auto p-4 max-w-md">
        <h1 className="text-2xl font-bold mb-4">Complex DnD List</h1>

        <SortableContext
          items={rootSortableItems}
          strategy={verticalListSortingStrategy}
        >
          <div className="p-4 bg-gray-100 rounded border border-gray-300 min-h-[300px] space-y-1">
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
