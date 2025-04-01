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
import { AnimatePresence, motion } from 'motion/react'
import { createContext, useContext, useMemo, useState } from 'react'

// === Types ===
interface BaseItem {
  id: string
  type: 'item' | 'group' | 'dropZone'
}

interface Item extends BaseItem {
  type: 'item'
  content: string
}

interface Group extends BaseItem {
  type: 'group'
  title: string
  items: Item[]
}

interface DropZone extends BaseItem {
  type: 'dropZone'
  groupId: string
  position: 'top' | 'bottom'
}

// Define which column an item is in
type Column = 'left' | 'right'

type DraggableItem = Item | Group

// Preview position type
interface PreviewPosition {
  targetId: string
  targetType: 'item' | 'group' | 'dropZone'
  // For items/groups - are we inserting before or after target?
  insertPosition?: 'before' | 'after'
  // For groups - are we adding to group?
  addToGroup?: boolean
  // Tracking which column the preview is in
  column?: Column
}

// === Context ===
interface DragContextType {
  activeId: string | null
  isDraggingItem: boolean
  isDraggingGroup: boolean
  overDropZone: string | null
  previewPosition: PreviewPosition | null
  activeColumn: Column | null
}

const DragContext = createContext<DragContextType>({
  activeId: null,
  isDraggingItem: false,
  isDraggingGroup: false,
  overDropZone: null,
  previewPosition: null,
  activeColumn: null,
})

// === Components ===
// New component for preview indicator
const PreviewIndicator: React.FC = () => {
  return (
    <div className="h-1 my-1 bg-blue-500 rounded-full animate-pulse transition-all duration-150" />
  )
}

const SortableItem: React.FC<{ item: Item }> = ({ item }) => {
  const { activeId, previewPosition } = useContext(DragContext)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  // Determine if we should show preview indicators
  const showBeforePreview =
    previewPosition?.targetId === item.id &&
    previewPosition?.insertPosition === 'before'
  const showAfterPreview =
    previewPosition?.targetId === item.id &&
    previewPosition?.insertPosition === 'after'

  return (
    <>
      {showBeforePreview && <PreviewIndicator />}
      <motion.div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`p-3 mb-2 bg-white border rounded-md shadow-sm cursor-grab ${
          activeId === item.id ? 'border-blue-400' : 'border-gray-200'
        }`}
        initial={{ opacity: 1, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.15 }}
      >
        {item.content}
      </motion.div>
      {showAfterPreview && <PreviewIndicator />}
    </>
  )
}

const DropZoneItem: React.FC<{ dropZone: DropZone }> = ({ dropZone }) => {
  const { overDropZone } = useContext(DragContext)
  const { attributes, listeners, setNodeRef } = useSortable({
    id: dropZone.id,
  })

  const isActive = overDropZone === dropZone.id

  return (
    <motion.div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`h-2 my-1 rounded-md transition-colors ${
        isActive ? 'bg-blue-400' : 'bg-transparent'
      }`}
      initial={{ opacity: isActive ? 1 : 0.3 }}
      animate={{ opacity: isActive ? 1 : 0.3 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    />
  )
}

const SortableGroup: React.FC<{ group: Group; dropZones: DropZone[] }> = ({
  group,
  dropZones,
}) => {
  const { activeId, isDraggingItem, isDraggingGroup, previewPosition } =
    useContext(DragContext)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: group.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  // Find the drop zones for this group
  const topDropZone = dropZones.find(
    (dz) => dz.groupId === group.id && dz.position === 'top'
  )
  const bottomDropZone = dropZones.find(
    (dz) => dz.groupId === group.id && dz.position === 'bottom'
  )

  // Determine if we should show preview indicators
  const showBeforePreview =
    previewPosition?.targetId === group.id &&
    previewPosition?.insertPosition === 'before'
  const showAfterPreview =
    previewPosition?.targetId === group.id &&
    previewPosition?.insertPosition === 'after'
  const showAddToGroupPreview =
    previewPosition?.targetId === group.id && previewPosition?.addToGroup

  // Show drop zones when dragging either items or groups
  const showDropZones = isDraggingItem || isDraggingGroup

  return (
    <>
      {showBeforePreview && <PreviewIndicator />}
      {topDropZone && showDropZones && <DropZoneItem dropZone={topDropZone} />}
      <motion.div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`p-3 mb-2 bg-blue-50 border-2 rounded-md shadow-sm ${
          activeId === group.id ? 'border-blue-500' : 'border-blue-200'
        } ${showAddToGroupPreview ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
        initial={{ opacity: 1, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.15 }}
      >
        <div className="mb-2 font-medium text-blue-700">{group.title}</div>
        <AnimatePresence mode="popLayout">
          {group.items.map((item) => (
            <SortableItem key={item.id} item={item} />
          ))}
        </AnimatePresence>
      </motion.div>
      {bottomDropZone && showDropZones && (
        <DropZoneItem dropZone={bottomDropZone} />
      )}
      {showAfterPreview && <PreviewIndicator />}
    </>
  )
}

const DragOverlayContent: React.FC<{ item: DraggableItem | null }> = ({
  item,
}) => {
  if (!item) return null

  if (item.type === 'item') {
    return (
      <div className="p-3 mb-2 bg-white border border-blue-400 rounded-md shadow-md cursor-grabbing">
        {item.content}
      </div>
    )
  }

  return (
    <div className="p-3 mb-2 bg-blue-50 border-2 border-blue-400 rounded-md shadow-md cursor-grabbing">
      <div className="mb-2 font-medium text-blue-700">{item.title}</div>
      <div className="space-y-2">
        {(item as Group).items.map((groupItem) => (
          <div
            key={groupItem.id}
            className="p-3 bg-white border border-gray-200 rounded-md"
          >
            {groupItem.content}
          </div>
        ))}
      </div>
    </div>
  )
}

// === Main Component ===
const DragNDropDemo = () => {
  const [items] = useState<Item[]>([
    { id: 'item-1', type: 'item', content: 'Item 1' },
    { id: 'item-2', type: 'item', content: 'Item 2' },
    { id: 'item-3', type: 'item', content: 'Item 3' },
    { id: 'item-4', type: 'item', content: 'Item 4' },
    { id: 'item-5', type: 'item', content: 'Item 5' },
    { id: 'item-6', type: 'item', content: 'Item 6' },
  ])

  const [groups, setGroups] = useState<Group[]>([
    { id: 'group-1', type: 'group', title: 'Group A', items: [] },
    { id: 'group-2', type: 'group', title: 'Group B', items: [] },
    { id: 'group-3', type: 'group', title: 'Group C', items: [] },
  ])

  // Left column - only items
  const [leftColumnItems, setLeftColumnItems] = useState<string[]>([
    'item-1',
    'item-2',
  ])

  // Right column - can contain items and groups (renamed from rootItems)
  const [rightColumnItems, setRightColumnItems] = useState<string[]>([
    'group-1',
    'item-3',
    'group-2',
    'item-4',
    'group-3',
    'item-5',
    'item-6',
  ])

  // Generate drop zones - one above and below each group
  const dropZones = useMemo(() => {
    const zones: DropZone[] = []
    groups.forEach((group) => {
      zones.push({
        id: `dropzone-${group.id}-top`,
        type: 'dropZone',
        groupId: group.id,
        position: 'top',
      })
      zones.push({
        id: `dropzone-${group.id}-bottom`,
        type: 'dropZone',
        groupId: group.id,
        position: 'bottom',
      })
    })
    return zones
  }, [groups])

  // Track active element and dragging state
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeItem, setActiveItem] = useState<DraggableItem | null>(null)
  const [activeColumn, setActiveColumn] = useState<Column | null>(null)
  const [overDropZone, setOverDropZone] = useState<string | null>(null)
  const [previewPosition, setPreviewPosition] =
    useState<PreviewPosition | null>(null)

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Get the type of an item by ID
  const getItemType = (id: string): 'item' | 'group' | 'dropZone' | null => {
    if (id.startsWith('item-')) return 'item'
    if (id.startsWith('group-')) return 'group'
    if (id.startsWith('dropzone-')) return 'dropZone'
    return null
  }

  // Get column-specific sortable IDs
  const getColumnSortableIds = (column: Column): string[] => {
    const columnItems = column === 'left' ? leftColumnItems : rightColumnItems
    const isDraggingItem = activeItem?.type === 'item'
    const isDraggingGroup = activeItem?.type === 'group'

    // In the right column, include drop zones when dragging
    if (column === 'right' && (isDraggingItem || isDraggingGroup)) {
      return [...columnItems, ...dropZones.map((dz) => dz.id)]
    }

    return columnItems
  }

  // Get all sortable IDs for both columns
  const leftSortableIds = useMemo(
    () => getColumnSortableIds('left'),
    [leftColumnItems, activeItem, dropZones]
  )
  const rightSortableIds = useMemo(
    () => getColumnSortableIds('right'),
    [rightColumnItems, activeItem, dropZones]
  )

  // Determine which column an item is in
  const getItemColumn = (id: string): Column | null => {
    if (leftColumnItems.includes(id)) return 'left'
    if (rightColumnItems.includes(id)) return 'right'

    // Check if it's in a group in the right column
    for (const groupId of rightColumnItems) {
      if (!groupId.startsWith('group-')) continue
      const group = groups.find((g) => g.id === groupId)
      if (group && group.items.some((item) => item.id === id)) return 'right'
    }

    return null
  }

  // Provide context for drag state
  const dragContextValue = useMemo(
    () => ({
      activeId,
      isDraggingItem: activeItem?.type === 'item',
      isDraggingGroup: activeItem?.type === 'group',
      overDropZone,
      previewPosition,
      activeColumn,
    }),
    [activeId, activeItem, overDropZone, previewPosition, activeColumn]
  )

  // Find the item or group by ID
  const findItemById = (id: string): DraggableItem | null => {
    const itemType = getItemType(id)
    if (itemType === 'item') {
      return items.find((item) => item.id === id) || null
    } else if (itemType === 'group') {
      return groups.find((group) => group.id === id) || null
    }
    return null
  }

  // Handle drag start event
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const id = active.id as string
    setActiveId(id)

    const foundItem = findItemById(id)
    setActiveItem(foundItem)

    // Determine which column we're dragging from
    setActiveColumn(getItemColumn(id))
  }

  // Handle drag over event
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event

    if (!over) {
      setOverDropZone(null)
      setPreviewPosition(null)
      return
    }

    const activeId = active.id as string
    const overId = over.id as string
    const activeType = getItemType(activeId)
    const overType = getItemType(overId)

    // Determine which column we're over
    let overColumn: Column | null = null

    if (overType === 'dropZone') {
      // Drop zones are always in the right column
      overColumn = 'right'
    } else {
      overColumn = getItemColumn(overId)
    }

    if (!activeType || !overType || !overColumn) {
      setOverDropZone(null)
      setPreviewPosition(null)
      return
    }

    // Handle drop zone hover (only in right column)
    if (overType === 'dropZone') {
      setOverDropZone(overId)

      // Extract group ID and position from dropzone
      const dropZone = dropZones.find((dz) => dz.id === overId)
      if (dropZone) {
        const groupId = dropZone.groupId
        const position = dropZone.position

        if (activeType === 'item') {
          if (position === 'top') {
            setPreviewPosition({
              targetId: groupId,
              targetType: 'group',
              insertPosition: 'before',
              column: 'right',
            })
          } else {
            setPreviewPosition({
              targetId: groupId,
              targetType: 'group',
              insertPosition: 'after',
              column: 'right',
            })
          }
        } else if (activeType === 'group') {
          // Also handle group-to-dropzone for clearer previews
          if (position === 'top') {
            setPreviewPosition({
              targetId: groupId,
              targetType: 'group',
              insertPosition: 'before',
              column: 'right',
            })
          } else {
            setPreviewPosition({
              targetId: groupId,
              targetType: 'group',
              insertPosition: 'after',
              column: 'right',
            })
          }
        }
      }
      return
    } else {
      setOverDropZone(null)
    }

    // Preview for dragging an item
    if (activeType === 'item') {
      if (overType === 'item') {
        const columnItems =
          overColumn === 'left' ? leftColumnItems : rightColumnItems

        // If both items are in the same column list, just show preview
        if (columnItems.includes(activeId) && columnItems.includes(overId)) {
          const activeIndex = columnItems.indexOf(activeId)
          const overIndex = columnItems.indexOf(overId)

          if (activeIndex !== -1 && overIndex !== -1) {
            setPreviewPosition({
              targetId: overId,
              targetType: 'item',
              insertPosition: activeIndex < overIndex ? 'after' : 'before',
              column: overColumn,
            })
          }
        }
        // If item is moving between columns or from a group
        else {
          // For items moving from a group or another column
          setPreviewPosition({
            targetId: overId,
            targetType: 'item',
            insertPosition: 'before',
            column: overColumn,
          })

          // If we're dragging from a group in the right column
          if (
            !leftColumnItems.includes(activeId) &&
            !rightColumnItems.includes(activeId)
          ) {
            groups.forEach((group) => {
              const itemIndex = group.items.findIndex(
                (item) => item.id === activeId
              )
              if (itemIndex >= 0) {
                // Item is in a group, show preview relative to its position
                const overItemIndex = group.items.findIndex(
                  (item) => item.id === overId
                )
                if (overItemIndex >= 0) {
                  setPreviewPosition({
                    targetId: overId,
                    targetType: 'item',
                    insertPosition:
                      itemIndex < overItemIndex ? 'after' : 'before',
                    column: 'right',
                  })
                }
              }
            })
          }
        }
      } else if (overType === 'group' && overColumn === 'right') {
        // When dragging an item over a group, show a highlight to indicate it would be added to the group
        setPreviewPosition({
          targetId: overId,
          targetType: 'group',
          addToGroup: true,
          column: 'right',
        })
      }
    }
    // Preview for dragging a group (only possible in right column)
    else if (activeType === 'group' && rightColumnItems.includes(activeId)) {
      if (rightColumnItems.includes(overId)) {
        const activeIndex = rightColumnItems.indexOf(activeId)
        const overIndex = rightColumnItems.indexOf(overId)

        if (activeIndex !== -1 && overIndex !== -1) {
          setPreviewPosition({
            targetId: overId,
            targetType: overType,
            insertPosition: activeIndex < overIndex ? 'after' : 'before',
            column: 'right',
          })
        }
      }
    }
  }

  // Handle drag end event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) {
      setActiveId(null)
      setActiveItem(null)
      setActiveColumn(null)
      setOverDropZone(null)
      setPreviewPosition(null)
      return
    }

    const activeId = active.id as string
    const overId = over.id as string

    if (activeId === overId) {
      setActiveId(null)
      setActiveItem(null)
      setActiveColumn(null)
      setOverDropZone(null)
      setPreviewPosition(null)
      return
    }

    const activeType = getItemType(activeId)
    const overType = getItemType(overId)

    // Determine source and target columns
    const sourceColumn = getItemColumn(activeId)
    let targetColumn: Column | null = null

    if (overType === 'dropZone') {
      targetColumn = 'right' // Drop zones are always in the right column
    } else {
      targetColumn = getItemColumn(overId)
    }

    if (!activeType || !overType || !targetColumn) {
      setActiveId(null)
      setActiveItem(null)
      setActiveColumn(null)
      setOverDropZone(null)
      setPreviewPosition(null)
      return
    }

    // Case 1: Dragging an item
    if (activeType === 'item') {
      // 1a: Over a drop zone (right column only)
      if (overType === 'dropZone') {
        const dropZone = dropZones.find((dz) => dz.id === overId)
        if (dropZone) {
          const groupId = dropZone.groupId
          const position = dropZone.position

          // Get the group and item
          const targetGroup = groups.find((g) => g.id === groupId)
          const draggedItem = items.find((i) => i.id === activeId)

          if (targetGroup && draggedItem) {
            // Check if item is already in a group
            const newGroups = groups.map((group) => {
              const itemIndex = group.items.findIndex(
                (item) => item.id === activeId
              )
              if (itemIndex >= 0) {
                return {
                  ...group,
                  items: group.items.filter((item) => item.id !== activeId),
                }
              }
              return group
            })

            // Remove the item from its original location, either left column or right column root
            let newLeftColumnItems = [...leftColumnItems]
            let newRightColumnItems = [...rightColumnItems]

            if (leftColumnItems.includes(activeId)) {
              newLeftColumnItems = newLeftColumnItems.filter(
                (id) => id !== activeId
              )
            } else if (rightColumnItems.includes(activeId)) {
              newRightColumnItems = newRightColumnItems.filter(
                (id) => id !== activeId
              )
            }

            // Get the group's position in the right column
            const groupIndex = newRightColumnItems.indexOf(targetGroup.id)

            if (position === 'top') {
              // Insert the item above the group in the right column
              newRightColumnItems.splice(groupIndex, 0, activeId)
            } else {
              // Insert the item below the group in the right column
              newRightColumnItems.splice(groupIndex + 1, 0, activeId)
            }

            setLeftColumnItems(newLeftColumnItems)
            setRightColumnItems(newRightColumnItems)
            setGroups(newGroups)
          }
        }
      }
      // 1b: Over a group (right column only)
      else if (overType === 'group' && targetColumn === 'right') {
        // Only proceed if we are not over a highlighted dropzone
        if (!overDropZone) {
          const targetGroup = groups.find((g) => g.id === overId)
          const draggedItem = items.find((i) => i.id === activeId)

          if (targetGroup && draggedItem) {
            // Check if the item is already in a group
            const newGroups = groups.map((group) => {
              const itemIndex = group.items.findIndex(
                (item) => item.id === activeId
              )
              if (itemIndex >= 0) {
                return {
                  ...group,
                  items: group.items.filter((item) => item.id !== activeId),
                }
              }
              return group
            })

            // Add the item to the target group
            const updatedGroups = newGroups.map((group) => {
              if (group.id === overId) {
                return {
                  ...group,
                  items: [...group.items, draggedItem],
                }
              }
              return group
            })

            // Remove the item from either left or right column
            let newLeftColumnItems = [...leftColumnItems]
            let newRightColumnItems = [...rightColumnItems]

            if (leftColumnItems.includes(activeId)) {
              newLeftColumnItems = newLeftColumnItems.filter(
                (id) => id !== activeId
              )
            } else if (rightColumnItems.includes(activeId)) {
              newRightColumnItems = newRightColumnItems.filter(
                (id) => id !== activeId
              )
            }

            setLeftColumnItems(newLeftColumnItems)
            setRightColumnItems(newRightColumnItems)
            setGroups(updatedGroups)
          }
        }
      }
      // 1c: Over another item - handle moving between columns or reordering
      else if (overType === 'item') {
        // Case: Moving between columns
        if (sourceColumn !== targetColumn) {
          // Remove from source column
          if (sourceColumn === 'left') {
            setLeftColumnItems((prevItems) =>
              prevItems.filter((id) => id !== activeId)
            )
          } else if (sourceColumn === 'right') {
            // If in root items
            if (rightColumnItems.includes(activeId)) {
              setRightColumnItems((prevItems) =>
                prevItems.filter((id) => id !== activeId)
              )
            }
            // If in a group, remove from that group
            else {
              const updatedGroups = [...groups]
              groups.forEach((group, index) => {
                const itemIndex = group.items.findIndex(
                  (item) => item.id === activeId
                )
                if (itemIndex >= 0) {
                  updatedGroups[index] = {
                    ...group,
                    items: group.items.filter((item) => item.id !== activeId),
                  }
                }
              })
              setGroups(updatedGroups)
            }
          }

          // Add to target column
          if (targetColumn === 'left') {
            const overIndex = leftColumnItems.indexOf(overId)
            setLeftColumnItems((prevItems) => {
              const newItems = [...prevItems]
              newItems.splice(overIndex, 0, activeId)
              return newItems
            })
          } else if (targetColumn === 'right') {
            const overIndex = rightColumnItems.indexOf(overId)
            setRightColumnItems((prevItems) => {
              const newItems = [...prevItems]
              newItems.splice(overIndex, 0, activeId)
              return newItems
            })
          }
        }
        // Case: Reordering within the same column
        else {
          if (targetColumn === 'left') {
            const activeIndex = leftColumnItems.indexOf(activeId)
            const overIndex = leftColumnItems.indexOf(overId)
            if (activeIndex !== -1 && overIndex !== -1) {
              setLeftColumnItems(
                arrayMove(leftColumnItems, activeIndex, overIndex)
              )
            }
          } else if (targetColumn === 'right') {
            // If both items are in the root list, just reorder
            if (
              rightColumnItems.includes(activeId) &&
              rightColumnItems.includes(overId)
            ) {
              const activeIndex = rightColumnItems.indexOf(activeId)
              const overIndex = rightColumnItems.indexOf(overId)
              if (activeIndex !== -1 && overIndex !== -1) {
                setRightColumnItems(
                  arrayMove(rightColumnItems, activeIndex, overIndex)
                )
              }
            }
            // If both items are in the same group, reorder within the group
            else {
              // Find if both items are in the same group
              groups.forEach((group, groupIndex) => {
                const activeItemIndex = group.items.findIndex(
                  (item) => item.id === activeId
                )
                const overItemIndex = group.items.findIndex(
                  (item) => item.id === overId
                )

                if (activeItemIndex >= 0 && overItemIndex >= 0) {
                  const newGroupItems = arrayMove(
                    group.items,
                    activeItemIndex,
                    overItemIndex
                  )
                  const updatedGroups = [...groups]
                  updatedGroups[groupIndex] = {
                    ...group,
                    items: newGroupItems,
                  }
                  setGroups(updatedGroups)
                }
              })
            }
          }
        }
      }
    }
    // Case 2: Dragging a group (only in right column)
    else if (activeType === 'group' && rightColumnItems.includes(activeId)) {
      // Over a drop zone - position relative to the target group
      if (overType === 'dropZone') {
        const dropZone = dropZones.find((dz) => dz.id === overId)
        if (dropZone) {
          const groupId = dropZone.groupId
          const position = dropZone.position

          // Find positions in the right column
          const activeIndex = rightColumnItems.indexOf(activeId)
          const targetGroupIndex = rightColumnItems.indexOf(groupId)

          if (activeIndex !== -1 && targetGroupIndex !== -1) {
            const newRightColumnItems = [...rightColumnItems]

            // Remove the active group from its current position
            newRightColumnItems.splice(activeIndex, 1)

            // Calculate where to insert it
            let insertIndex = targetGroupIndex
            // If the target group comes before the active group,
            // we need to adjust the insert index down by 1
            if (targetGroupIndex > activeIndex) {
              insertIndex--
            }

            // Insert before or after the target group
            if (position === 'top') {
              newRightColumnItems.splice(insertIndex, 0, activeId)
            } else {
              newRightColumnItems.splice(insertIndex + 1, 0, activeId)
            }

            setRightColumnItems(newRightColumnItems)
          }
        }
      }
      // We only reorder groups in the right column
      else if (rightColumnItems.includes(overId)) {
        const activeIndex = rightColumnItems.indexOf(activeId)
        const overIndex = rightColumnItems.indexOf(overId)

        if (activeIndex !== -1 && overIndex !== -1) {
          setRightColumnItems(
            arrayMove(rightColumnItems, activeIndex, overIndex)
          )
        }
      }
    }

    setActiveId(null)
    setActiveItem(null)
    setActiveColumn(null)
    setOverDropZone(null)
    setPreviewPosition(null)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        Two-Column Drag and Drop Demo
      </h1>

      <DragContext.Provider value={dragContextValue}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-6">
            {/* Left Column - Items Only */}
            <div className="w-1/3 p-4 bg-gray-50 rounded-lg border border-gray-200 min-h-[500px]">
              <h2 className="text-lg font-semibold mb-4 text-gray-700">
                Items List
              </h2>
              <SortableContext
                items={leftSortableIds}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  <AnimatePresence mode="popLayout">
                    {leftColumnItems.map((id) => {
                      const item = items.find((i) => i.id === id)
                      return item ? <SortableItem key={id} item={item} /> : null
                    })}
                    {/* Show an empty state preview if the left column is empty and we're dragging an item */}
                    {leftColumnItems.length === 0 &&
                      activeItem?.type === 'item' && (
                        <div className="p-8 border-2 border-dashed border-gray-300 rounded-md text-center text-gray-500">
                          Drop here to add to list
                        </div>
                      )}
                  </AnimatePresence>
                </div>
              </SortableContext>
            </div>

            {/* Right Column - Items and Groups */}
            <div className="w-2/3 p-4 bg-gray-50 rounded-lg border border-gray-200 min-h-[500px]">
              <h2 className="text-lg font-semibold mb-4 text-gray-700">
                Items and Groups
              </h2>
              <SortableContext
                items={rightSortableIds}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  <AnimatePresence mode="popLayout">
                    {rightColumnItems.map((id) => {
                      const itemType = getItemType(id)

                      if (itemType === 'item') {
                        const item = items.find((i) => i.id === id)
                        return item ? (
                          <SortableItem key={id} item={item} />
                        ) : null
                      }

                      if (itemType === 'group') {
                        const group = groups.find((g) => g.id === id)
                        return group ? (
                          <SortableGroup
                            key={id}
                            group={group}
                            dropZones={dropZones.filter(
                              (dz) => dz.groupId === id
                            )}
                          />
                        ) : null
                      }

                      return null
                    })}
                  </AnimatePresence>
                </div>
              </SortableContext>
            </div>
          </div>

          <DragOverlay>
            <DragOverlayContent item={activeItem} />
          </DragOverlay>
        </DndContext>
      </DragContext.Provider>

      <div className="mt-8 p-4 bg-gray-50 rounded-md border border-gray-200 text-sm">
        <p className="mb-2 font-medium">Instructions:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Left column: Contains only items (no groups)</li>
          <li>Right column: Contains both items and groups</li>
          <li>Drag items between columns</li>
          <li>Drag items into or out of groups</li>
          <li>Drag items between groups</li>
          <li>Drag groups to reorder them (right column only)</li>
          <li>
            Use the highlight zones above and below groups to position items
          </li>
        </ul>
      </div>
    </div>
  )
}

export default DragNDropDemo
