import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  UniqueIdentifier,
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
import { AnimatePresence, motion } from 'motion/react' // Note: 'framer-motion' might be intended here if using that lib
import { createContext, useContext, useMemo, useState } from 'react'

// === Constants ===
const LEFT_COLUMN_ID = 'left-column-drop-area' // ID for the empty left column drop zone

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

type DraggableItem = Item | Group

// Preview position type
interface PreviewPosition {
  targetId: string
  targetType: 'item' | 'group' | 'dropZone' | 'container' // Added 'container' type
  // For items/groups - are we inserting before or after target?
  insertPosition?: 'before' | 'after'
  // For groups - are we adding to group?
  addToGroup?: boolean
  // For empty container drop
  isOverContainer?: boolean // Flag for dropping into empty container
}

// === Context ===
interface DragContextType {
  activeId: string | null
  activeItemType: 'item' | 'group' | null // Added type of active item
  isDraggingItem: boolean
  isDraggingGroup: boolean
  overDropZone: string | null
  previewPosition: PreviewPosition | null
  isOverLeftColumn: boolean // Added flag for hovering over left column
}

const DragContext = createContext<DragContextType>({
  activeId: null,
  activeItemType: null,
  isDraggingItem: false,
  isDraggingGroup: false,
  overDropZone: null,
  previewPosition: null,
  isOverLeftColumn: false,
})

// === Helper Functions ===
// Finds where an item currently resides
const findItemLocation = (
  itemId: string,
  leftItems: string[],
  rightItems: string[],
  groups: Group[]
):
  | { containerId: 'left'; index: number }
  | { containerId: 'right-root'; index: number }
  | { containerId: 'right-group'; groupId: string; index: number }
  | null => {
  const leftIndex = leftItems.indexOf(itemId)
  if (leftIndex !== -1) {
    return { containerId: 'left', index: leftIndex }
  }

  const rightRootIndex = rightItems.indexOf(itemId)
  if (rightRootIndex !== -1) {
    return { containerId: 'right-root', index: rightRootIndex }
  }

  for (const group of groups) {
    const groupItemIndex = group.items.findIndex((item) => item.id === itemId)
    if (groupItemIndex !== -1) {
      return {
        containerId: 'right-group',
        groupId: group.id,
        index: groupItemIndex,
      }
    }
  }

  return null
}

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
    data: { type: 'item' }, // Add type to data for easier checking
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
        layout // Add layout prop for smoother animations
      >
        {item.content}
      </motion.div>
      {showAfterPreview && <PreviewIndicator />}
    </>
  )
}

const DropZoneItem: React.FC<{ dropZone: DropZone }> = ({ dropZone }) => {
  const { overDropZone } = useContext(DragContext)
  const { setNodeRef } = useSortable({
    id: dropZone.id,
    data: { type: 'dropZone', groupId: dropZone.groupId }, // Add type and group info
  })

  const isActive = overDropZone === dropZone.id

  // Drop zones are only visual cues, not directly interactive with listeners/attributes
  return (
    <motion.div
      ref={setNodeRef}
      className={`h-2 my-1 rounded-md transition-colors ${
        isActive ? 'bg-blue-400' : 'bg-transparent'
      }`}
      initial={{ opacity: isActive ? 1 : 0.3 }}
      animate={{ opacity: isActive ? 1 : 0.3 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      layout // Add layout prop
    />
  )
}

const SortableGroup: React.FC<{ group: Group; dropZones: DropZone[] }> = ({
  group,
  dropZones,
}) => {
  const { activeId, isDraggingItem, previewPosition } = useContext(DragContext)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: group.id,
    data: { type: 'group' }, // Add type to data
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

  // Show drop zones when dragging items (not other groups)
  const showDropZones = isDraggingItem // Only show for items

  return (
    <>
      {showBeforePreview && !isDraggingItem && <PreviewIndicator />}{' '}
      {/* Only show group move preview if not dragging item */}
      {topDropZone && showDropZones && <DropZoneItem dropZone={topDropZone} />}
      <motion.div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`relative p-3 mb-2 bg-blue-50 border-2 rounded-md shadow-sm ${
          activeId === group.id ? 'border-blue-500' : 'border-blue-200'
        } ${showAddToGroupPreview ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
        initial={{ opacity: 1, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.15 }}
        layout // Add layout prop
      >
        {/* Inner SortableContext for items within the group */}
        <SortableContext
          items={group.items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
          id={group.id} // Give context an ID related to the group
        >
          <div className="mb-2 font-medium text-blue-700">{group.title}</div>
          <AnimatePresence mode="popLayout">
            {group.items.length === 0 && isDraggingItem && (
              <div className="h-10 border border-dashed border-blue-300 rounded flex items-center justify-center text-sm text-blue-400">
                Drop here to add
              </div>
            )}
            {group.items.map((item) => (
              <SortableItem key={item.id} item={item} />
            ))}
          </AnimatePresence>
        </SortableContext>
      </motion.div>
      {bottomDropZone && showDropZones && (
        <DropZoneItem dropZone={bottomDropZone} />
      )}
      {showAfterPreview && !isDraggingItem && <PreviewIndicator />}{' '}
      {/* Only show group move preview if not dragging item */}
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

  // Group Overlay
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
        {/* Add placeholder if group is empty in overlay */}
        {(item as Group).items.length === 0 && (
          <div className="h-10 border border-dashed border-blue-300 rounded flex items-center justify-center text-sm text-blue-400 opacity-50">
            Group Content
          </div>
        )}
      </div>
    </div>
  )
}

// === Main Component ===
const DragNDropDemo = () => {
  // Keep original items state
  const [items] = useState<Item[]>([
    { id: 'item-1', type: 'item', content: 'Item 1 (Right)' },
    { id: 'item-2', type: 'item', content: 'Item 2 (Right)' },
    { id: 'item-3', type: 'item', content: 'Item 3 (Right)' },
    { id: 'item-4', type: 'item', content: 'Item 4 (Right)' },
    { id: 'item-5', type: 'item', content: 'Item 5 (Group A)' },
    { id: 'item-6', type: 'item', content: 'Item 6 (Group B)' },
    { id: 'item-7', type: 'item', content: 'Item 7 (Left)' },
    { id: 'item-8', type: 'item', content: 'Item 8 (Left)' },
  ])

  // State for items in the left column (stores IDs)
  const [leftColumnItems, setLeftColumnItems] = useState<string[]>([
    'item-7',
    'item-8',
  ])

  // State for groups (only in the right column)
  const [groups, setGroups] = useState<Group[]>([
    {
      id: 'group-1',
      type: 'group',
      title: 'Group A',
      items: [items.find((i) => i.id === 'item-5')!],
    }, // Add item 5
    {
      id: 'group-2',
      type: 'group',
      title: 'Group B',
      items: [items.find((i) => i.id === 'item-6')!],
    }, // Add item 6
    { id: 'group-3', type: 'group', title: 'Group C (Empty)', items: [] },
  ])

  // State for root-level items/groups in the right column (stores IDs)
  const [rightColumnItems, setRightColumnItems] = useState<string[]>([
    'item-1',
    'group-1',
    'item-2',
    'item-3',
    'group-2',
    'item-4',
    'group-3',
  ])

  // Generate drop zones based on groups in the right column
  const dropZones = useMemo(() => {
    const zones: DropZone[] = []
    groups.forEach((group) => {
      // Only add drop zones if the group itself is in the right column root
      if (rightColumnItems.includes(group.id)) {
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
      }
    })
    return zones
  }, [groups, rightColumnItems]) // Depend on rightColumnItems as well

  // Track active element and dragging state
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeItem, setActiveItem] = useState<DraggableItem | null>(null)
  const [overDropZone, setOverDropZone] = useState<string | null>(null)
  const [previewPosition, setPreviewPosition] =
    useState<PreviewPosition | null>(null)
  const [isOverLeftColumn, setIsOverLeftColumn] = useState(false) // Track hover over left col

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Get the type of an item by ID (simple lookup for demo)
  const getItemType = (
    id: string | UniqueIdentifier | null
  ): 'item' | 'group' | 'dropZone' | 'container' | null => {
    if (!id) return null
    const idStr = String(id)
    if (idStr === LEFT_COLUMN_ID) return 'container'
    if (items.some((item) => item.id === idStr)) return 'item'
    if (groups.some((group) => group.id === idStr)) return 'group'
    if (dropZones.some((dz) => dz.id === idStr)) return 'dropZone'
    return null
  }

  // Provide context for drag state
  const dragContextValue = useMemo(
    () => ({
      activeId,
      activeItemType: activeItem?.type ?? null,
      isDraggingItem: activeItem?.type === 'item',
      isDraggingGroup: activeItem?.type === 'group',
      overDropZone,
      previewPosition,
      isOverLeftColumn,
    }),
    [activeId, activeItem, overDropZone, previewPosition, isOverLeftColumn]
  )

  // Find the item or group by ID from master lists
  const findDraggableById = (id: string): DraggableItem | null => {
    const item = items.find((item) => item.id === id)
    if (item) return item
    const group = groups.find((group) => group.id === id)
    if (group) return group
    return null
  }

  // === Drag Handlers ===

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const id = active.id as string
    setActiveId(id)
    const foundItem = findDraggableById(id)
    setActiveItem(foundItem)
    setOverDropZone(null) // Reset on start
    setPreviewPosition(null) // Reset on start
    setIsOverLeftColumn(false) // Reset on start
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    const activeId = active.id as string
    const overId = over?.id as string | null

    if (!overId || activeId === overId) {
      // If hovering over empty space or itself, reset previews
      setPreviewPosition(null)
      setOverDropZone(null)
      setIsOverLeftColumn(false)
      return
    }

    const activeType = activeItem?.type
    const overType = getItemType(overId)
    const overData = over?.data?.current // Access custom data if available

    // Reset previews initially for each move
    setPreviewPosition(null)
    setOverDropZone(null)
    setIsOverLeftColumn(false)

    // --- Dragging an ITEM ---
    if (activeType === 'item') {
      // 1. Over the Left Column Container (potentially empty)
      if (overId === LEFT_COLUMN_ID) {
        setIsOverLeftColumn(true)
        setPreviewPosition({
          targetId: LEFT_COLUMN_ID,
          targetType: 'container',
          isOverContainer: true,
        })
        return // Handled, exit
      }

      // 2. Over an Item in the Left Column
      if (
        overType === 'item' &&
        leftColumnItems.includes(overId) &&
        leftColumnItems.includes(activeId)
      ) {
        const activeIndex = leftColumnItems.indexOf(activeId)
        const overIndex = leftColumnItems.indexOf(overId)
        setPreviewPosition({
          targetId: overId,
          targetType: 'item',
          insertPosition: activeIndex < overIndex ? 'after' : 'before',
        })
        setIsOverLeftColumn(true) // Indicate we are over the left column area
        return
      }
      // Over an Item in the Left Column (but dragging from Right)
      if (
        overType === 'item' &&
        leftColumnItems.includes(overId) &&
        !leftColumnItems.includes(activeId)
      ) {
        // Default to inserting before when coming from another column
        setPreviewPosition({
          targetId: overId,
          targetType: 'item',
          insertPosition: 'before',
        })
        setIsOverLeftColumn(true) // Indicate we are over the left column area
        return
      }

      // --- Right Column Logic ---
      setIsOverLeftColumn(false) // Not over left column if we reach here

      // 3. Over a Drop Zone (Right Column)
      if (overType === 'dropZone' && overData?.groupId) {
        setOverDropZone(overId)
        const groupId = overData.groupId
        const position = dropZones.find((dz) => dz.id === overId)?.position

        if (position === 'top') {
          setPreviewPosition({
            targetId: groupId,
            targetType: 'group',
            insertPosition: 'before',
          })
        } else {
          setPreviewPosition({
            targetId: groupId,
            targetType: 'group',
            insertPosition: 'after',
          })
        }
        return // Handled
      }

      // 4. Over a Group (Right Column) - Indicate adding TO the group
      if (overType === 'group') {
        // Check if over the group itself, not an item inside it via event bubbling
        if (overId === overData?.id || over?.id === overId) {
          setPreviewPosition({
            targetId: overId,
            targetType: 'group',
            addToGroup: true,
          })
          return // Handled
        }
      }

      // 5. Over an Item (Right Column - Root or Inside Group)
      if (overType === 'item') {
        const overLocation = findItemLocation(
          overId,
          leftColumnItems,
          rightColumnItems,
          groups
        )
        const activeLocation = findItemLocation(
          activeId,
          leftColumnItems,
          rightColumnItems,
          groups
        )

        if (!overLocation) return // Should not happen if overType is item

        // 5a. Both items in Right Root
        if (
          overLocation.containerId === 'right-root' &&
          activeLocation?.containerId === 'right-root'
        ) {
          setPreviewPosition({
            targetId: overId,
            targetType: 'item',
            insertPosition:
              activeLocation.index < overLocation.index ? 'after' : 'before',
          })
          return
        }

        // 5b. Both items in the SAME Group
        if (
          overLocation.containerId === 'right-group' &&
          activeLocation?.containerId === 'right-group' &&
          overLocation.groupId === activeLocation.groupId
        ) {
          setPreviewPosition({
            targetId: overId,
            targetType: 'item',
            insertPosition:
              activeLocation.index < overLocation.index ? 'after' : 'before',
          })
          return
        }

        // 5c. Dragging into a different context (Root -> Group, Group -> Root, Left -> Right Root, Left -> Right Group)
        // Default to inserting 'before' the target item in these cross-context scenarios
        if (
          overLocation.containerId === 'right-root' ||
          overLocation.containerId === 'right-group'
        ) {
          setPreviewPosition({
            targetId: overId,
            targetType: 'item',
            insertPosition: 'before', // Default insertion point when crossing context
          })
          return
        }
      }
    }
    // --- Dragging a GROUP --- (Can only happen within Right Column Root)
    else if (activeType === 'group') {
      setIsOverLeftColumn(false) // Groups cannot go to left column

      // 1. Over a Drop Zone (Right Column)
      if (
        overType === 'dropZone' &&
        overData?.groupId &&
        overData.groupId !== activeId
      ) {
        // Allow dropping via dropzone only if it's not the active group's own dropzone
        setOverDropZone(overId)
        const targetGroupId = overData.groupId
        const position = dropZones.find((dz) => dz.id === overId)?.position

        setPreviewPosition({
          targetId: targetGroupId,
          targetType: 'group', // Target is the group associated with the dropzone
          insertPosition: position === 'top' ? 'before' : 'after',
        })
        return // Handled
      }

      // 2. Over another Item or Group in the Right Column Root
      if (
        (overType === 'item' || overType === 'group') &&
        rightColumnItems.includes(overId) &&
        rightColumnItems.includes(activeId)
      ) {
        const activeIndex = rightColumnItems.indexOf(activeId)
        const overIndex = rightColumnItems.indexOf(overId)

        // Don't allow previewing dropping a group onto an item inside another group
        if (overType === 'item' && !rightColumnItems.includes(overId)) return

        setPreviewPosition({
          targetId: overId,
          targetType: overType, // Target type depends on what's being hovered
          insertPosition: activeIndex < overIndex ? 'after' : 'before',
        })
        return // Handled
      }
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    // Reset visual states
    setActiveId(null)
    setActiveItem(null)
    setOverDropZone(null)
    setPreviewPosition(null)
    setIsOverLeftColumn(false)

    if (!over || !active) {
      return // Drag cancelled or invalid
    }

    const activeId = active.id as string
    const overId = over.id as string
    const activeType = getItemType(activeId)
    const overType = getItemType(overId)
    const overData = over?.data?.current // Get data associated with the 'over' element

    if (activeId === overId && overType !== 'group') {
      // Don't do anything if dropped on itself, unless it's dropping into a group
      // Check specifically if dropping item onto group it came from
      const activeLocation = findItemLocation(
        activeId,
        leftColumnItems,
        rightColumnItems,
        groups
      )
      if (
        !(
          activeLocation?.containerId === 'right-group' &&
          activeLocation.groupId === overId
        )
      ) {
        return
      }
    }

    const draggedItem = items.find((i) => i.id === activeId) // Find the actual item data

    // --- ITEM Drag End Logic ---
    if (activeType === 'item' && draggedItem) {
      const sourceLocation = findItemLocation(
        activeId,
        leftColumnItems,
        rightColumnItems,
        groups
      )

      // --- TARGET: Left Column ---
      if (
        overId === LEFT_COLUMN_ID ||
        (overType === 'item' && leftColumnItems.includes(overId)) ||
        isOverLeftColumn
      ) {
        let newLeftItems = [...leftColumnItems]
        const targetIndex =
          overType === 'item' && leftColumnItems.includes(overId)
            ? leftColumnItems.indexOf(overId) +
              (previewPosition?.insertPosition === 'after' ? 1 : 0)
            : newLeftItems.length // Default to end if dropping on container or predicted via isOverLeftColumn

        // 1. Remove from source
        let newRightItems = [...rightColumnItems]
        const newGroups = JSON.parse(JSON.stringify(groups)) as Group[] // Deep copy for modification

        if (sourceLocation?.containerId === 'left') {
          newLeftItems = newLeftItems.filter((id) => id !== activeId)
        } else if (sourceLocation?.containerId === 'right-root') {
          newRightItems = newRightItems.filter((id) => id !== activeId)
        } else if (sourceLocation?.containerId === 'right-group') {
          const groupIndex = newGroups.findIndex(
            (g) => g.id === sourceLocation.groupId
          )
          if (groupIndex !== -1) {
            newGroups[groupIndex].items = newGroups[groupIndex].items.filter(
              (item) => item.id !== activeId
            )
          }
        }

        // 2. Add to left column at target index (ensure it's not already there)
        if (!newLeftItems.includes(activeId)) {
          const finalIndex = Math.max(
            0,
            Math.min(targetIndex, newLeftItems.length)
          ) // Clamp index
          newLeftItems.splice(finalIndex, 0, activeId)
        }

        setLeftColumnItems(newLeftItems)
        setRightColumnItems(newRightItems)
        setGroups(newGroups)
        return // Handled
      }

      // --- TARGET: Right Column ---
      let newLeftItems = [...leftColumnItems]
      let newRightItems = [...rightColumnItems]
      const newGroups = JSON.parse(JSON.stringify(groups)) as Group[] // Deep copy

      // 1. Remove from Source (MUST do this first)
      if (sourceLocation?.containerId === 'left') {
        newLeftItems = newLeftItems.filter((id) => id !== activeId)
      } else if (sourceLocation?.containerId === 'right-root') {
        newRightItems = newRightItems.filter((id) => id !== activeId)
      } else if (sourceLocation?.containerId === 'right-group') {
        const groupIndex = newGroups.findIndex(
          (g) => g.id === sourceLocation.groupId
        )
        if (groupIndex !== -1) {
          newGroups[groupIndex].items = newGroups[groupIndex].items.filter(
            (item) => item.id !== activeId
          )
        }
      }

      // 2. Add to Destination (Right Column)

      // 2a. Dropped onto a Drop Zone (insert into root relative to group)
      if (overType === 'dropZone' && overData?.groupId) {
        const targetGroupId = overData.groupId
        const position = dropZones.find((dz) => dz.id === overId)?.position
        const targetGroupIndex = newRightItems.indexOf(targetGroupId)

        if (targetGroupIndex !== -1) {
          if (position === 'top') {
            newRightItems.splice(targetGroupIndex, 0, activeId)
          } else {
            newRightItems.splice(targetGroupIndex + 1, 0, activeId)
          }
        } else {
          // Fallback: Add to end if group somehow not found (shouldn't happen)
          newRightItems.push(activeId)
        }
      }
      // 2b. Dropped onto a Group (add to group's items)
      else if (overType === 'group') {
        const targetGroupIndex = newGroups.findIndex((g) => g.id === overId)
        if (targetGroupIndex !== -1) {
          // Avoid duplicates if somehow already there
          if (
            !newGroups[targetGroupIndex].items.some((i) => i.id === activeId)
          ) {
            newGroups[targetGroupIndex].items.push(draggedItem) // Add to the end
          }
        }
      }
      // 2c. Dropped onto an Item (reorder within root or group)
      else if (overType === 'item') {
        const targetLocation = findItemLocation(
          overId,
          newLeftItems, // Use potentially updated list
          newRightItems,
          newGroups
        )

        if (targetLocation?.containerId === 'right-root') {
          let targetIndex = newRightItems.indexOf(overId)
          // Adjust index based on preview calculation if available, otherwise default based on target index
          if (
            previewPosition &&
            previewPosition.targetId === overId &&
            previewPosition.insertPosition
          ) {
            targetIndex =
              targetIndex + (previewPosition.insertPosition === 'after' ? 1 : 0)
          } else if (
            sourceLocation?.containerId === 'right-root' &&
            sourceLocation.index < targetIndex
          ) {
            // If moved down within the same list, target index doesn't need adjustment after removal
          } else if (
            sourceLocation?.containerId === 'right-root' &&
            sourceLocation.index > targetIndex
          ) {
            // If moved up, target index stays same relative to original position
          } else {
            // Default insertion: usually before when coming from different context or unsure
            // targetIndex = targetIndex // Place before
          }
          targetIndex = Math.max(0, Math.min(targetIndex, newRightItems.length)) // Clamp
          newRightItems.splice(targetIndex, 0, activeId)
        } else if (targetLocation?.containerId === 'right-group') {
          const groupIndex = newGroups.findIndex(
            (g) => g.id === targetLocation.groupId
          )
          if (groupIndex !== -1) {
            let targetIndex = newGroups[groupIndex].items.findIndex(
              (i) => i.id === overId
            )
            // Adjust index based on preview calculation if available, otherwise default
            if (
              previewPosition &&
              previewPosition.targetId === overId &&
              previewPosition.insertPosition
            ) {
              targetIndex =
                targetIndex +
                (previewPosition.insertPosition === 'after' ? 1 : 0)
            } else if (
              sourceLocation?.containerId === 'right-group' &&
              sourceLocation.groupId === targetLocation.groupId &&
              sourceLocation.index < targetIndex
            ) {
              // Move down within same group
            } else if (
              sourceLocation?.containerId === 'right-group' &&
              sourceLocation.groupId === targetLocation.groupId &&
              sourceLocation.index > targetIndex
            ) {
              // Move up within same group
            } else {
              // Default insertion into group: usually before
              // targetIndex = targetIndex // Place before
            }
            targetIndex = Math.max(
              0,
              Math.min(targetIndex, newGroups[groupIndex].items.length)
            ) // Clamp
            newGroups[groupIndex].items.splice(targetIndex, 0, draggedItem)
          }
        } else {
          // Fallback: if target item not found in right col, add to end of root
          newRightItems.push(activeId)
        }
      }
      // 2d. Fallback: If dropped somewhere else unexpected in the right column, add to end of root
      else if (!leftColumnItems.includes(overId) && overId !== LEFT_COLUMN_ID) {
        newRightItems.push(activeId)
      }

      // Update state for right column changes
      setLeftColumnItems(newLeftItems) // Update left in case item moved from there
      setRightColumnItems(newRightItems)
      setGroups(newGroups)
      return // Handled item move to right
    }

    // --- GROUP Drag End Logic --- (Only within Right Column Root)
    if (activeType === 'group' && rightColumnItems.includes(activeId)) {
      let newRightItems = [...rightColumnItems]
      const activeIndex = newRightItems.indexOf(activeId)

      // 1. Dropped onto a Drop Zone
      if (overType === 'dropZone' && overData?.groupId) {
        const targetGroupId = overData.groupId
        const position = dropZones.find((dz) => dz.id === overId)?.position
        const targetGroupIndex = newRightItems.indexOf(targetGroupId)

        if (activeIndex !== -1 && targetGroupIndex !== -1) {
          newRightItems = newRightItems.filter((id) => id !== activeId) // Remove first
          const finalTargetIndex = newRightItems.indexOf(targetGroupId) // Find index after removal

          if (position === 'top') {
            newRightItems.splice(finalTargetIndex, 0, activeId)
          } else {
            newRightItems.splice(finalTargetIndex + 1, 0, activeId)
          }
          setRightColumnItems(newRightItems)
        }
      }
      // 2. Dropped onto another Item or Group in the Root
      else if (
        (overType === 'item' || overType === 'group') &&
        rightColumnItems.includes(overId)
      ) {
        const overIndex = newRightItems.indexOf(overId)
        if (activeIndex !== -1 && overIndex !== -1) {
          setRightColumnItems(arrayMove(newRightItems, activeIndex, overIndex))
        }
      }
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        Two Column Drag & Drop
      </h1>

      <DragContext.Provider value={dragContextValue}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Left Column */}
            <div className="flex-1 p-4 bg-gray-100 rounded-lg border border-gray-300 min-h-[200px]">
              <h2 className="text-lg font-semibold mb-4 text-gray-700">
                Available Items (Left)
              </h2>
              <SortableContext
                items={[LEFT_COLUMN_ID, ...leftColumnItems]} // Include drop area ID
                strategy={verticalListSortingStrategy}
                id={LEFT_COLUMN_ID} // Give context an ID
              >
                {/* Special Drop Zone for Empty List */}
                <div
                  ref={
                    useSortable({
                      id: LEFT_COLUMN_ID,
                      data: { type: 'container' },
                    }).setNodeRef
                  } // Make the container itself sortable
                  className={`min-h-[100px] transition-colors rounded-md ${
                    isOverLeftColumn &&
                    leftColumnItems.length === 0 &&
                    activeItem?.type === 'item'
                      ? 'bg-blue-100 border-2 border-dashed border-blue-400'
                      : ''
                  } ${leftColumnItems.length > 0 ? 'mb-2' : ''} `} // Style when active and empty
                >
                  <AnimatePresence mode="popLayout">
                    {leftColumnItems.map((id) => {
                      const item = items.find((i) => i.id === id)
                      return item ? <SortableItem key={id} item={item} /> : null
                    })}
                    {leftColumnItems.length === 0 && !isOverLeftColumn && (
                      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        Drop items here
                      </div>
                    )}
                    {isOverLeftColumn &&
                      leftColumnItems.length === 0 &&
                      activeItem?.type === 'item' && (
                        <div className="flex items-center justify-center h-full text-blue-500 text-sm font-medium">
                          Drop here
                        </div>
                      )}
                  </AnimatePresence>
                </div>
              </SortableContext>
            </div>

            {/* Right Column */}
            <div className="flex-1 p-4 bg-gray-50 rounded-lg border border-gray-200 min-h-[200px]">
              <h2 className="text-lg font-semibold mb-4 text-gray-700">
                Structure (Right)
              </h2>
              <SortableContext
                // Include all draggable IDs in the right column + drop zones
                items={[...rightColumnItems, ...dropZones.map((dz) => dz.id)]}
                strategy={verticalListSortingStrategy}
                id="right-column" // Give context an ID
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
                            )} // Pass only relevant drop zones
                          />
                        ) : null
                      }
                      return null // Should not render drop zones directly here
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
          <li>Drag items between the Left and Right columns.</li>
          <li>Drag items within the Left column to reorder.</li>
          <li>
            Drag items within the Right column (outside groups) to reorder.
          </li>
          <li>Drag items into groups in the Right column.</li>
          <li>
            Drag items out of groups into the Right column root or Left column.
          </li>
          <li>Drag items between groups in the Right column.</li>
          <li>Drag groups within the Right column to reorder them.</li>
          <li>Groups cannot be moved to the Left column.</li>
          <li>
            Drop zones appear above/below groups when dragging items or groups.
          </li>
          <li>
            The Left column will highlight when you can drop an item into it
            (even if empty).
          </li>
        </ul>
      </div>
    </div>
  )
}

export default DragNDropDemo
