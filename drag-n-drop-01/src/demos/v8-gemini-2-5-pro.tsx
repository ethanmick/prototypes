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
  'block p-3 border border-gray-300 bg-white rounded shadow-sm hover:bg-gray-50 cursor-grab' // Removed mb-2, handled by wrapper
const groupClasses =
  'relative block p-3 border border-blue-400 bg-blue-50 rounded shadow-sm'
const groupHeaderClasses = 'flex justify-between items-center mb-2 cursor-grab'
const groupTitleClasses = 'font-semibold text-blue-800'
const groupRemoveButtonClasses =
  'text-xs text-red-600 hover:text-red-800 focus:outline-none px-1 cursor-pointer'
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
const draggingOpacity = 'opacity-30'
// Consistent spacing for sortable items/groups
const sortableWrapperMargin = 'mt-2 first:mt-0' // Apply margin-top to all except the very first element

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
  attributes?: React.HTMLAttributes<HTMLDivElement>
  listeners?: ReturnType<typeof useSortable>['listeners']
}
const ItemComponent: React.FC<ItemComponentProps> = React.memo(
  ({ item, isOverlay, isDragging, attributes, listeners }) => {
    const style = isOverlay ? overlayItemClasses : itemClasses
    return (
      <div
        className={`${style} ${isDragging ? draggingOpacity : ''}`}
        {...attributes}
        {...listeners}
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
    headerAttributes,
    headerListeners,
  }) => {
    const style = isOverlay ? overlayGroupClasses : groupClasses
    const borderStyle = isOver && !isDragging ? 'border-blue-600 border-2' : ''

    return (
      <div
        className={`${style} ${
          isDragging ? draggingOpacity : ''
        } ${borderStyle}`}
      >
        <div
          className={groupHeaderClasses}
          {...headerAttributes}
          {...headerListeners}
        >
          <span className={groupTitleClasses}>Group: {group.name}</span>
          {!isOverlay && onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove(group.id)
              }}
              className={groupRemoveButtonClasses}
              aria-label={`Remove group ${group.name}`}
            >
              × Remove
            </button>
          )}
        </div>
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
    attributes,
    listeners,
    setNodeRef,
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
    <div ref={setNodeRef} style={style} className={sortableWrapperMargin}>
      {isOver && <div className={dropIndicatorClasses}></div>}
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
    // Apply margin only if not the first item inside the group visually
    <div ref={setNodeRef} style={style} className={sortableWrapperMargin}>
      {isOver && <div className={dropIndicatorClasses}></div>}
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
    attributes,
    listeners,
    setNodeRef: setGroupNodeRef,
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
    <div
      ref={setGroupNodeRef}
      style={groupStyle}
      className={sortableWrapperMargin}
    >
      <GroupComponent
        group={group}
        isDragging={isDragging}
        isOver={isOverGroupDirectly && isDraggingItem}
        onRemove={onRemoveGroup}
        headerAttributes={attributes}
        headerListeners={listeners}
      >
        <SortableContext
          items={groupItemIds}
          strategy={verticalListSortingStrategy}
        >
          {isOverGroupDirectly &&
            isDraggingItem &&
            group.items.length === 0 && (
              <div
                className={`${itemClasses} opacity-50 border-dashed border-blue-400 ${sortableWrapperMargin}`}
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

// --- Global Helper Function ---
// eslint-disable-next-line prefer-const
let globalItemsRef: React.MutableRefObject<ListItem[]> = { current: [] }

const findItemOrGroupGlobally = (
  id: UniqueIdentifier
): { item: ListItem | ItemType | null; parentId: UniqueIdentifier | null } => {
  const items = globalItemsRef.current
  if (!items) return { item: null, parentId: null }
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

// --- Layout Animation Function ---
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

  // Use the modified handleDragEnd from above
  const handleDragEndCallback = useCallback(
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

        // --- Determine Target Parent and Index ---

        // Special Handling: Dragging FROM a group TO the root level
        // Check if source was a group and target is NOT a group item or group container
        const isDraggingOutOfGroup =
          sourceParentId && !isOverGroupItem && !isOverGroupContainer

        if (isDraggingOutOfGroup) {
          targetParentId = null // Target is definitely the root

          const sourceGroupIndex = currentItems.findIndex(
            (g) => g.id === sourceParentId
          )
          const currentOverIndex = currentItems.findIndex(
            (i) => i.id === overId
          ) // Index of element hovered over in root

          if (sourceGroupIndex !== -1) {
            // If dropped on/before the original group position, target index is the group's original index
            if (
              currentOverIndex !== -1 &&
              currentOverIndex <= sourceGroupIndex
            ) {
              targetIndex = sourceGroupIndex
            }
            // If dropped after the original group position (could be on item or in space)
            else if (
              currentOverIndex !== -1 &&
              currentOverIndex > sourceGroupIndex
            ) {
              // Target index should be where the hovered item is (will insert before it)
              targetIndex = currentOverIndex
            } else {
              // Dropped in empty space after the group? Place right after the group's original position.
              targetIndex = sourceGroupIndex + 1
            }
          } else {
            // Fallback if source group not found
            targetIndex = currentItems.length
          }
          console.log(
            `Special Case: Dragging out of Group ${sourceParentId}. Determined Target Index: ${targetIndex}`
          )

          // --- Standard Target Determination (Moving within root, within group, into group) ---
        } else if (isOverGroupItem) {
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
              targetParentId = overId
              targetIndex = targetGroup.items.length // Add to end
            } else {
              // Dragging group over group -> target root before hovered group
              targetParentId = null
              targetIndex = currentItems.findIndex((i) => i.id === overId)
            }
          }
        } else if (isOverTopLevelItem) {
          // Moving within root OR dragging group over top-level item
          targetParentId = null
          targetIndex = currentItems.findIndex((i) => i.id === overId) // Target before hovered item
        } else {
          // --- Fallback for Ambiguous Drops (e.g., end of list, or over context) ---
          // Check if overId matches *any* top-level item/group ID
          const topLevelIndex = currentItems.findIndex((i) => i.id === overId)
          if (topLevelIndex !== -1) {
            // If it matches, assume drop is intended before this item/group in root
            targetParentId = null
            targetIndex = topLevelIndex
          } else {
            // Fallback: end of root list
            targetParentId = null
            targetIndex = currentItems.length
          }
          console.log('Fallback Target Determination:', {
            targetParentId: targetParentId ?? 'root',
            targetIndex,
          })
        }

        // Failsafe check for targetIndex (should be less likely now)
        if (targetIndex === -1) {
          console.warn('Target index calculation failed. Falling back.')
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

        console.log('Final Determined Target:', {
          targetParentId: targetParentId ?? 'root',
          targetIndex,
        })

        // --- Perform Move ---
        let newItems = [...currentItems]

        // Use arrayMove if moving within the SAME container
        if (sourceParentId === targetParentId) {
          console.log('Moving within container:', targetParentId ?? 'Root')
          if (targetParentId === null) {
            // Root level
            const oldIndex = newItems.findIndex((i) => i.id === activeId)
            if (oldIndex !== -1) {
              return arrayMove(newItems, oldIndex, targetIndex)
            }
          } else {
            // Same group
            const groupIndex = newItems.findIndex(
              (g) => g.id === targetParentId
            )
            if (groupIndex !== -1 && newItems[groupIndex].type === 'group') {
              const group = newItems[groupIndex] as GroupType
              const oldIndex = group.items.findIndex((i) => i.id === activeId)
              if (oldIndex !== -1) {
                const updatedItems = arrayMove(
                  group.items,
                  oldIndex,
                  targetIndex
                )
                newItems[groupIndex] = { ...group, items: updatedItems }
                return newItems
              }
            }
          }
        }
        // Use remove/insert if moving BETWEEN different containers
        else {
          console.log(
            'Moving between containers:',
            sourceParentId ?? 'Root',
            '->',
            targetParentId ?? 'Root'
          )
          let itemToMove: ItemType | GroupType | null = null

          // Remove from source (modifies newItems directly or updates group within newItems)
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
                const updatedGroupItems = sourceGroup.items.filter(
                  (i) => i.id !== activeId
                )
                newItems[sourceGroupIndex] = {
                  ...sourceGroup,
                  items: updatedGroupItems,
                } // Update group in newItems
              }
            }
          } else {
            // Remove from root level
            const itemIndex = newItems.findIndex((i) => i.id === activeId)
            if (itemIndex > -1) {
              itemToMove = newItems[itemIndex]
              newItems = newItems.filter((i) => i.id !== activeId) // Reassign newItems without the element
            }
          }

          if (!itemToMove) {
            console.error('Failed to remove itemToMove')
            return currentItems
          }

          // Insert into target (modifies newItems array further)
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
              updatedItems.splice(safeTargetIndex, 0, itemToMove as ItemType) // Assert ItemType
              newItems[targetGroupIndex] = {
                ...targetGroup,
                items: updatedItems,
              } // Update group in newItems
            } else {
              console.error('Target group for insert not found', targetParentId)
              return currentItems
            }
          } else {
            // Target is root
            const safeTargetIndex = Math.max(
              0,
              Math.min(targetIndex, newItems.length)
            )
            newItems.splice(safeTargetIndex, 0, itemToMove) // Insert into newItems
          }
          return newItems // Return the final state of newItems
        }
        console.warn('Move logic did not return new items array.')
        return currentItems
      })
    },
    [findItemOrGroup]
  ) // Dependency injection for findItemOrGroup

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
      onDragEnd={handleDragEndCallback} // Use the renamed callback
      onDragCancel={() => {
        setActiveId(null)
        setOverId(null)
      }}
      // animateLayoutChanges={animateLayoutChanges} // Enable for smoother visuals
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
