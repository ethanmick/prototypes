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

type DraggableItem = Item | Group

// === Context ===
interface DragContextType {
  activeId: string | null
  isDraggingItem: boolean
  isDraggingGroup: boolean
  overDropZone: string | null
}

const DragContext = createContext<DragContextType>({
  activeId: null,
  isDraggingItem: false,
  isDraggingGroup: false,
  overDropZone: null,
})

// === Components ===
const SortableItem: React.FC<{ item: Item }> = ({ item }) => {
  const { activeId } = useContext(DragContext)
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

  return (
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
  const { activeId, isDraggingItem } = useContext(DragContext)
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

  return (
    <>
      {topDropZone && isDraggingItem && <DropZoneItem dropZone={topDropZone} />}
      <motion.div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`p-3 mb-2 bg-blue-50 border-2 rounded-md shadow-sm ${
          activeId === group.id ? 'border-blue-500' : 'border-blue-200'
        }`}
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
      {bottomDropZone && isDraggingItem && (
        <DropZoneItem dropZone={bottomDropZone} />
      )}
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

  // Root-level items that are not in any group
  const [rootItems, setRootItems] = useState<string[]>([
    'item-1',
    'group-1',
    'item-2',
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
  const [overDropZone, setOverDropZone] = useState<string | null>(null)

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

  // Get all sortable IDs including dropZones when dragging
  const sortableIds = useMemo(() => {
    const isDraggingItem = activeItem?.type === 'item'
    if (isDraggingItem) {
      return [...rootItems, ...dropZones.map((dz) => dz.id)]
    }
    return rootItems
  }, [rootItems, dropZones, activeItem])

  // Provide context for drag state
  const dragContextValue = useMemo(
    () => ({
      activeId,
      isDraggingItem: activeItem?.type === 'item',
      isDraggingGroup: activeItem?.type === 'group',
      overDropZone,
    }),
    [activeId, activeItem, overDropZone]
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
  }

  // Handle drag over event
  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event

    if (!over) {
      setOverDropZone(null)
      return
    }

    const overId = over.id as string

    // Check if we're over a drop zone
    if (overId.startsWith('dropzone-')) {
      setOverDropZone(overId)
    } else {
      setOverDropZone(null)
    }
  }

  // Handle drag end event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) {
      setActiveId(null)
      setActiveItem(null)
      setOverDropZone(null)
      return
    }

    const activeId = active.id as string
    const overId = over.id as string

    if (activeId === overId) {
      setActiveId(null)
      setActiveItem(null)
      setOverDropZone(null)
      return
    }

    const activeType = getItemType(activeId)
    const overType = getItemType(overId)

    // Case 1: Dragging an item
    if (activeType === 'item') {
      // 1a: Over a drop zone - add to or remove from group
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

            // Make sure to remove the item from the root list first
            // whether it's there or being moved from a group
            const newRootItems = rootItems.filter((id) => id !== activeId)

            // Get the group's position in the root list
            const groupIndex = newRootItems.indexOf(targetGroup.id)

            if (position === 'top') {
              // Insert the item above the group in the root list
              newRootItems.splice(groupIndex, 0, activeId)
            } else {
              // Insert the item below the group in the root list
              newRootItems.splice(groupIndex + 1, 0, activeId)
            }

            setRootItems(newRootItems)
            setGroups(newGroups)
          }
        }
      }
      // 1b: Over a group - add to group
      else if (overType === 'group') {
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

            // Make sure to remove the item from the root list
            // to prevent duplicate keys
            const newRootItems = rootItems.filter((id) => id !== activeId)

            setRootItems(newRootItems)
            setGroups(updatedGroups)
          }
        }
      }
      // 1c: Over another item - reorder in the list
      else if (overType === 'item') {
        // If both items are in the root list, just reorder
        if (rootItems.includes(activeId) && rootItems.includes(overId)) {
          const activeIndex = rootItems.indexOf(activeId)
          const overIndex = rootItems.indexOf(overId)

          if (activeIndex !== -1 && overIndex !== -1) {
            setRootItems(arrayMove(rootItems, activeIndex, overIndex))
          }
        }
        // If target item is in root but active is in a group, move to root
        else if (!rootItems.includes(activeId) && rootItems.includes(overId)) {
          // Find which group contains the active item
          const updatedGroups = [...groups]

          groups.forEach((group, groupIndex) => {
            const itemIndex = group.items.findIndex(
              (item) => item.id === activeId
            )
            if (itemIndex >= 0) {
              updatedGroups[groupIndex] = {
                ...group,
                items: group.items.filter((item) => item.id !== activeId),
              }
            }
          })

          // Make sure the item is not already in the root list
          const newRootItems = rootItems.filter((id) => id !== activeId)

          // Add to root items near the over item
          const overIndex = newRootItems.indexOf(overId)
          newRootItems.splice(overIndex, 0, activeId)

          setRootItems(newRootItems)
          setGroups(updatedGroups)
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
    // Case 2: Dragging a group
    else if (activeType === 'group' && rootItems.includes(activeId)) {
      // We only reorder groups in the root list
      if (rootItems.includes(overId)) {
        const activeIndex = rootItems.indexOf(activeId)
        const overIndex = rootItems.indexOf(overId)

        if (activeIndex !== -1 && overIndex !== -1) {
          setRootItems(arrayMove(rootItems, activeIndex, overIndex))
        }
      }
    }

    setActiveId(null)
    setActiveItem(null)
    setOverDropZone(null)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        Complex Drag and Drop Demo
      </h1>

      <DragContext.Provider value={dragContextValue}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              <AnimatePresence mode="popLayout">
                {rootItems.map((id) => {
                  const itemType = getItemType(id)

                  if (itemType === 'item') {
                    const item = items.find((i) => i.id === id)
                    return item ? <SortableItem key={id} item={item} /> : null
                  }

                  if (itemType === 'group') {
                    const group = groups.find((g) => g.id === id)
                    return group ? (
                      <SortableGroup
                        key={id}
                        group={group}
                        dropZones={dropZones.filter((dz) => dz.groupId === id)}
                      />
                    ) : null
                  }

                  return null
                })}
              </AnimatePresence>
            </div>
          </SortableContext>

          <DragOverlay>
            <DragOverlayContent item={activeItem} />
          </DragOverlay>
        </DndContext>
      </DragContext.Provider>

      <div className="mt-8 p-4 bg-gray-50 rounded-md border border-gray-200 text-sm">
        <p className="mb-2 font-medium">Instructions:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Drag items to reorder them in the list</li>
          <li>Drag items into or out of groups</li>
          <li>Drag items between groups</li>
          <li>Drag groups to reorder them</li>
          <li>
            Use the highlight zones above and below groups to position items
          </li>
        </ul>
      </div>
    </div>
  )
}

export default DragNDropDemo
