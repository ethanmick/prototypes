import {
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  DropAnimation,
  KeyboardSensor,
  PointerSensor,
  UniqueIdentifier,
  closestCorners,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  AnimateLayoutChanges,
  SortableContext,
  arrayMove,
  defaultAnimateLayoutChanges,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import React, { useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

// --- Tailwind Styles (Minimal) ---
const itemClasses =
  'block p-3 border border-gray-300 bg-white rounded mb-2 shadow-sm hover:bg-gray-50 cursor-grab'
// **MODIFIED**: Added `relative` for positioning context if needed later
const groupClasses =
  'relative block p-3 border border-blue-400 bg-blue-50 rounded mb-2 shadow-sm'
// **MODIFIED**: Added `cursor-grab` directly here
const groupHeaderClasses = 'flex justify-between items-center mb-2 cursor-grab'
const groupTitleClasses = 'font-semibold text-blue-800'
const groupRemoveButtonClasses =
  'text-xs text-red-600 hover:text-red-800 focus:outline-none px-1 cursor-pointer' // Ensure button is clickable
const groupItemsContainerClasses =
  'ml-4 pl-4 border-l border-blue-300 min-h-[20px]'
const overlayItemClasses =
  'p-3 border border-gray-400 bg-gray-100 rounded shadow-lg cursor-grabbing'
const overlayGroupClasses =
  'p-3 border border-blue-500 bg-blue-100 rounded shadow-lg cursor-grabbing opacity-90'
const dropIndicatorClasses =
  'bg-blue-200 border-dashed border-2 border-blue-500 h-1 my-1 rounded'
const addGroupButtonClasses =
  'mt-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600'
const draggingOpacity = 'opacity-30' // Make original item more faded

// --- Types ---
interface BaseItem {
  id: UniqueIdentifier
}

interface ItemType extends BaseItem {
  type: 'item'
  content: string
}

interface GroupType extends BaseItem {
  type: 'group'
  name: string
  items: ItemType[]
}

type ListItem = ItemType | GroupType

// --- Helper Functions ---
const generateId = (prefix: 'item' | 'group' = 'item') =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

// --- Components ---

interface ItemComponentProps {
  item: ItemType
  isOverlay?: boolean
  isDragging?: boolean
  // **ADDED**: Pass attributes/listeners for the grab handle
  attributes?: React.HTMLAttributes<HTMLDivElement>
  listeners?: ReturnType<typeof useSortable>['listeners']
}
const ItemComponent: React.FC<ItemComponentProps> = React.memo(
  ({ item, isOverlay, isDragging, attributes, listeners }) => {
    const style = isOverlay ? overlayItemClasses : itemClasses
    return (
      // Apply listeners/attributes to the main draggable element
      <div
        className={`${style} ${isDragging ? draggingOpacity : ''}`}
        {...attributes} // Spread DnDKit attributes for accessibility etc.
        {...listeners} // Spread DnDKit listeners for grab interactions
      >
        Item: {item.content}
      </div>
    )
  }
)

interface GroupComponentProps {
  group: GroupType
  isOverlay?: boolean
  isDragging?: boolean
  isOver?: boolean
  onRemove?: (id: UniqueIdentifier) => void
  children?: React.ReactNode
  // **ADDED**: Pass attributes/listeners specifically for the header grab handle
  headerAttributes?: React.HTMLAttributes<HTMLDivElement>
  headerListeners?: ReturnType<typeof useSortable>['listeners']
}
const GroupComponent: React.FC<GroupComponentProps> = React.memo(
  ({
    group,
    isOverlay,
    isDragging,
    isOver,
    onRemove,
    children,
    headerAttributes, // Receive header-specific attributes/listeners
    headerListeners,
  }) => {
    const style = isOverlay ? overlayGroupClasses : groupClasses
    const borderStyle = isOver && !isDragging ? 'border-blue-600 border-2' : ''

    return (
      // The outer div is positioned by SortableGroup's ref, but doesn't have drag listeners itself
      <div
        className={`${style} ${
          isDragging ? draggingOpacity : ''
        } ${borderStyle}`}
      >
        {/* Apply drag listeners ONLY to the header div */}
        <div
          className={groupHeaderClasses}
          {...headerAttributes} // Apply DnDKit attributes to header
          {...headerListeners} // Apply DnDKit listeners to header
        >
          <span className={groupTitleClasses}>Group: {group.name}</span>
          {!isOverlay && onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation() // VERY IMPORTANT: Prevent drag start when clicking button
                onRemove(group.id)
              }}
              className={groupRemoveButtonClasses}
              aria-label={`Remove group ${group.name}`}
            >
              × Remove
            </button>
          )}
        </div>
        {/* Render children (items) only if not an overlay */}
        {!isOverlay && (
          <div className={groupItemsContainerClasses}>{children}</div>
        )}
        {isOverlay && (
          <div className="text-xs text-blue-700 mt-1 pl-4">
            {group.items.length} item(s)
          </div>
        )}
      </div>
    )
  }
)

// --- Sortable Components ---

interface SortableItemProps {
  item: ItemType
  isOver?: boolean
}
const SortableItem: React.FC<SortableItemProps> = ({ item, isOver }) => {
  const {
    attributes, // Attributes for accessibility etc.
    listeners, // Listeners for drag handles
    setNodeRef, // Ref for dnd-kit to track the element
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { type: 'item', item },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
  }

  return (
    // setNodeRef on the outer container that gets transformed
    <div ref={setNodeRef} style={style}>
      {isOver && <div className={dropIndicatorClasses}></div>}
      {/* Pass attributes/listeners TO the ItemComponent to apply to the grab area */}
      <ItemComponent
        item={item}
        isDragging={isDragging}
        attributes={attributes}
        listeners={listeners}
      />
    </div>
  )
}

interface SortableGroupItemProps {
  item: ItemType
  groupId: UniqueIdentifier
  isOver?: boolean
}
const SortableGroupItem: React.FC<SortableGroupItemProps> = ({
  item,
  groupId,
  isOver,
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
    data: { type: 'groupItem', item, groupId },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
  }

  return (
    // setNodeRef on the outer container that gets transformed
    <div ref={setNodeRef} style={style}>
      {isOver && <div className={dropIndicatorClasses}></div>}
      {/* Pass attributes/listeners TO the ItemComponent */}
      <ItemComponent
        item={item}
        isDragging={isDragging}
        attributes={attributes}
        listeners={listeners}
      />
    </div>
  )
}

interface SortableGroupProps {
  group: GroupType
  onRemoveGroup: (id: UniqueIdentifier) => void
  activeId: UniqueIdentifier | null
  overId: UniqueIdentifier | null
}
const SortableGroup: React.FC<SortableGroupProps> = ({
  group,
  onRemoveGroup,
  activeId,
  overId,
}) => {
  const {
    attributes, // These are for the GROUP's drag handle (header)
    listeners, // These are for the GROUP's drag handle (header)
    setNodeRef: setGroupNodeRef, // Ref for the ENTIRE group block for positioning
    transform,
    transition,
    isDragging,
    isOver: isOverGroupContainer,
  } = useSortable({
    id: group.id,
    data: { type: 'group', group },
  })

  const groupStyle = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
  }

  const groupItemIds = useMemo(
    () => group.items.map((item) => item.id),
    [group.items]
  )

  const isOverGroupDirectly = isOverGroupContainer && overId === group.id
  const activeItem = activeId ? findItemOrGroupGlobally(activeId)?.item : null
  const isDraggingItem = activeItem?.type === 'item'

  return (
    // setNodeRef for the entire block that dnd-kit will move
    <div ref={setGroupNodeRef} style={groupStyle}>
      <GroupComponent
        group={group}
        isDragging={isDragging}
        isOver={isOverGroupDirectly && isDraggingItem}
        onRemove={onRemoveGroup}
        // **MODIFIED**: Pass the group's attributes/listeners specifically for the header
        headerAttributes={attributes}
        headerListeners={listeners}
      >
        {/* Sortable context for ITEMS INSIDE the group */}
        <SortableContext
          items={groupItemIds}
          strategy={verticalListSortingStrategy}
        >
          {isOverGroupDirectly &&
            isDraggingItem &&
            group.items.length === 0 && (
              <div
                className={`${itemClasses} opacity-50 border-dashed border-blue-400`}
              >
                Drop item here
              </div>
            )}
          {group.items.map((item) => (
            <SortableGroupItem
              key={item.id}
              item={item}
              groupId={group.id}
              isOver={overId === item.id && activeId !== item.id}
            />
          ))}
          {isOverGroupDirectly && isDraggingItem && group.items.length > 0 && (
            <div className={dropIndicatorClasses}></div>
          )}
        </SortableContext>
      </GroupComponent>
    </div>
  )
}

// --- Global Helper Function (accessible outside component scope if needed, or passed down) ---
// eslint-disable-next-line prefer-const
let globalItemsRef: React.MutableRefObject<ListItem[]> = { current: [] }

const findItemOrGroupGlobally = (
  id: UniqueIdentifier
): { item: ListItem | ItemType | null; parentId: UniqueIdentifier | null } => {
  const items = globalItemsRef.current
  if (!items) return { item: null, parentId: null } // Guard against initial render
  const topLevelItem = items.find((i) => i.id === id)
  if (topLevelItem) {
    return { item: topLevelItem, parentId: null }
  }
  for (const group of items) {
    if (group.type === 'group') {
      const itemInGroup = group.items.find((i) => i.id === id)
      if (itemInGroup) {
        return { item: itemInGroup, parentId: group.id }
      }
    }
  }
  return { item: null, parentId: null }
}

// Add this for smooth animations
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true })

// --- Main App Component ---
const DragDropList: React.FC = () => {
  const [items, setItems] = useState<ListItem[]>([
    { id: 'item-1', type: 'item', content: 'Oranges' },
    {
      id: 'group-1',
      type: 'group',
      name: 'Fruits',
      items: [
        { id: 'item-2', type: 'item', content: 'Apples' },
        { id: 'item-3', type: 'item', content: 'Bananas' },
      ],
    },
    { id: 'item-4', type: 'item', content: 'Bread' },
    {
      id: 'group-2',
      type: 'group',
      name: 'Vegetables',
      items: [{ id: 'item-5', type: 'item', content: 'Carrots' }],
    },
    { id: 'item-6', type: 'item', content: 'Milk' },
    { id: 'group-3', type: 'group', name: 'Empty Group', items: [] },
  ])

  globalItemsRef.current = items

  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null)

  const sensors = useSensors(
    // Wait a few pixels before starting drag to allow button clicks etc.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const findItemOrGroup = findItemOrGroupGlobally

  const activeItemData = useMemo(() => {
    if (!activeId) return null
    return findItemOrGroup(activeId).item
  }, [activeId])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    console.log('Drag Start:', event.active.id, event.active.data.current?.type)
    setActiveId(event.active.id)
    setOverId(null)
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event
    const currentOverId = over ? over.id : null
    setOverId((prevOverId) =>
      prevOverId !== currentOverId ? currentOverId : prevOverId
    )
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)
      setOverId(null)

      if (!over) return

      const activeId = active.id
      const overId = over.id

      if (activeId === overId) return

      const activeData = active.data.current as {
        type: string
        item?: ItemType
        group?: GroupType
        groupId?: UniqueIdentifier
      }
      const overData = over.data.current as {
        type: string
        item?: ItemType
        group?: GroupType
        groupId?: UniqueIdentifier
      }

      console.log('Drag End:', {
        activeId,
        activeType: activeData?.type,
        activeGroupId: activeData?.groupId,
        overId,
        overType: overData?.type,
        overGroupId: overData?.groupId,
      })

      setItems((currentItems) => {
        const { item: draggedItem, parentId: sourceParentId } =
          findItemOrGroup(activeId)
        if (!draggedItem) return currentItems

        let targetParentId: UniqueIdentifier | null = null
        let targetIndex: number = -1

        const isOverGroupItem =
          overData?.type === 'groupItem' && overData.groupId
        const isOverGroupContainer = overData?.type === 'group'
        const isOverTopLevelItem = overData?.type === 'item'

        // 1. Determine Target Parent and Index
        if (isOverGroupItem) {
          targetParentId = overData.groupId!
          const targetGroup = currentItems.find(
            (g) => g.id === targetParentId && g.type === 'group'
          ) as GroupType | undefined
          targetIndex =
            targetGroup?.items.findIndex((i) => i.id === overId) ?? -1
        } else if (isOverGroupContainer) {
          const targetGroup = currentItems.find(
            (g) => g.id === overId && g.type === 'group'
          ) as GroupType | undefined
          if (targetGroup) {
            if (draggedItem.type === 'item') {
              // Dropping item onto group container?
              targetParentId = overId
              targetIndex = targetGroup.items.length // Add to end
            } else {
              // Dropping group onto another group container? Target top level before it.
              targetParentId = null
              targetIndex = currentItems.findIndex((i) => i.id === overId)
            }
          }
        } else if (isOverTopLevelItem) {
          targetParentId = null
          targetIndex = currentItems.findIndex((i) => i.id === overId)
        } else {
          // Fallback / Dropping near edge / Into empty space
          const topLevelIndex = currentItems.findIndex((i) => i.id === overId)
          if (topLevelIndex !== -1) {
            // Dropped on a top-level item/group boundary
            targetParentId = null
            targetIndex = topLevelIndex
          } else if (sourceParentId) {
            // Dragging out of a group into space? Place after source group.
            const sourceGroupIndex = currentItems.findIndex(
              (g) => g.id === sourceParentId
            )
            if (sourceGroupIndex !== -1) {
              targetParentId = null
              targetIndex = sourceGroupIndex + 1
            } else {
              // Fallback: end of list
              targetParentId = null
              targetIndex = currentItems.length
            }
          } else {
            // Fallback: end of list
            targetParentId = null
            targetIndex = currentItems.length
          }
        }

        if (targetIndex === -1) {
          console.warn('Could not determine target index, falling back to end.')
          // Attempt recovery
          if (targetParentId) {
            const targetGroup = currentItems.find(
              (g) => g.id === targetParentId && g.type === 'group'
            ) as GroupType | undefined
            targetIndex = targetGroup?.items.length ?? 0
          } else {
            targetIndex = currentItems.length
          }
        }

        // Prevent nesting groups
        if (targetParentId && draggedItem.type === 'group') return currentItems

        console.log('Determined Target:', {
          targetParentId: targetParentId ?? 'root',
          targetIndex,
        })

        // 2. Perform Move
        const newItems = [...currentItems]

        // If moving within the same container, use arrayMove
        if (sourceParentId === targetParentId) {
          if (targetParentId === null) {
            // Root level
            const oldIndex = newItems.findIndex((i) => i.id === activeId)
            if (oldIndex !== -1)
              return arrayMove(newItems, oldIndex, targetIndex)
          } else {
            // Same group
            const groupIndex = newItems.findIndex(
              (g) => g.id === targetParentId
            )
            if (groupIndex !== -1 && newItems[groupIndex].type === 'group') {
              const group = newItems[groupIndex] as GroupType
              const oldIndex = group.items.findIndex((i) => i.id === activeId)
              // Adjust targetIndex for arrayMove if moving down in the same list
              const correctedTargetIndex =
                oldIndex < targetIndex ? targetIndex - 1 : targetIndex
              if (oldIndex !== -1) {
                const updatedItems = arrayMove(
                  group.items,
                  oldIndex,
                  correctedTargetIndex
                )
                newItems[groupIndex] = { ...group, items: updatedItems }
                return newItems
              }
            }
          }
        }
        // If moving between containers, remove from source, insert into target
        else {
          let itemToMove: ItemType | GroupType | null = null
          // Remove from source
          if (sourceParentId) {
            const sourceGroupIndex = newItems.findIndex(
              (g) => g.id === sourceParentId
            )
            if (
              sourceGroupIndex > -1 &&
              newItems[sourceGroupIndex].type === 'group'
            ) {
              const sourceGroup = newItems[sourceGroupIndex] as GroupType
              const itemIndex = sourceGroup.items.findIndex(
                (i) => i.id === activeId
              )
              if (itemIndex > -1) {
                itemToMove = sourceGroup.items[itemIndex]
                const updatedItems = [...sourceGroup.items]
                updatedItems.splice(itemIndex, 1)
                newItems[sourceGroupIndex] = {
                  ...sourceGroup,
                  items: updatedItems,
                }
              }
            }
          } else {
            const itemIndex = newItems.findIndex((i) => i.id === activeId)
            if (itemIndex > -1) {
              ;[itemToMove] = newItems.splice(itemIndex, 1)
            }
          }

          if (!itemToMove) return currentItems // Failed to remove

          // Insert into target
          if (targetParentId) {
            // Target is a group
            const targetGroupIndex = newItems.findIndex(
              (g) => g.id === targetParentId
            )
            if (
              targetGroupIndex > -1 &&
              newItems[targetGroupIndex].type === 'group'
            ) {
              const targetGroup = newItems[targetGroupIndex] as GroupType
              const updatedItems = [...targetGroup.items]
              const safeTargetIndex = Math.max(
                0,
                Math.min(targetIndex, updatedItems.length)
              )
              updatedItems.splice(safeTargetIndex, 0, itemToMove as ItemType)
              newItems[targetGroupIndex] = {
                ...targetGroup,
                items: updatedItems,
              }
            } else {
              return currentItems /* Target group not found */
            }
          } else {
            // Target is root
            const safeTargetIndex = Math.max(
              0,
              Math.min(targetIndex, newItems.length)
            )
            newItems.splice(safeTargetIndex, 0, itemToMove)
          }
          return newItems
        }
        return currentItems // Return original if no move logic matched
      })
    },
    [findItemOrGroup]
  )

  const handleAddGroup = () => {
    const newGroupId = generateId('group')
    const newGroup: GroupType = {
      id: newGroupId,
      type: 'group',
      name: `New Group ${items.filter((i) => i.type === 'group').length + 1}`,
      items: [],
    }
    setItems((prevItems) => [...prevItems, newGroup])
  }

  const handleRemoveGroup = useCallback((groupId: UniqueIdentifier) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== groupId))
  }, [])

  const topLevelIds = useMemo(() => items.map((item) => item.id), [items])
  const collisionDetectionStrategy: CollisionDetection = closestCorners
  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: '0.5' } },
    }),
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null)
        setOverId(null)
      }}
      // **ADDED**: Enable layout animations
      // animateLayoutChanges={animateLayoutChanges}
    >
      <div className="p-4 max-w-md mx-auto">
        <h1 className="text-xl font-bold mb-4">Complex Drag & Drop List</h1>

        <SortableContext
          items={topLevelIds}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => {
            if (item.type === 'group') {
              return (
                <SortableGroup
                  key={item.id}
                  group={item}
                  onRemoveGroup={handleRemoveGroup}
                  activeId={activeId}
                  overId={overId}
                />
              )
            } else {
              return (
                <SortableItem
                  key={item.id}
                  item={item}
                  isOver={overId === item.id && activeId !== item.id}
                />
              )
            }
          })}
        </SortableContext>

        <button onClick={handleAddGroup} className={addGroupButtonClasses}>
          + Add New Group
        </button>

        {createPortal(
          <DragOverlay
            dropAnimation={dropAnimation}
            style={{ pointerEvents: 'none' }}
          >
            {activeId && activeItemData ? (
              activeItemData.type === 'group' ? (
                <GroupComponent group={activeItemData as GroupType} isOverlay />
              ) : (
                <ItemComponent item={activeItemData as ItemType} isOverlay />
              )
            ) : null}
          </DragOverlay>,
          document.body
        )}
      </div>
    </DndContext>
  )
}

export default DragDropList
