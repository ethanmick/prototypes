import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

function App() {
  const [rotateX, setRotateX] = useState(0)
  const [rotateY, setRotateY] = useState(0)
  const [rotateZ, setRotateZ] = useState(0)
  const [scale, setScale] = useState(1)
  const [shadowX, setShadowX] = useState(0)
  const [shadowY, setShadowY] = useState(0)
  const [gradientPosition, setGradientPosition] = useState({ x: 50, y: 50 })
  const [isDragging, setIsDragging] = useState(false)
  const [zIndex, setZIndex] = useState(1)
  const cardRef = useRef<HTMLDivElement>(null)
  const dragPositionRef = useRef({ x: 0, y: 0 })

  // Ensure smooth transitions and avoid flickering
  useEffect(() => {
    if (!isDragging && cardRef.current) {
      // Reset transform when drag is done to ensure clean state
      cardRef.current.style.transform = ''
    }
  }, [isDragging])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || isDragging) return

    const rect = cardRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    // Calculate mouse position relative to card center
    const percentX = (e.clientX - centerX) / (rect.width / 2)
    const percentY = (e.clientY - centerY) / (rect.height / 2)

    // Even more subtle rotation angles
    setRotateX(-percentY * 7)
    setRotateY(percentX * 7)
    setRotateZ(0)
    setScale(1.03)

    // Very subtle shadow
    setShadowX(-percentX * 3)
    setShadowY(percentY * 3)

    // Minimal gradient movement
    setGradientPosition({
      x: 50 + percentX * 5,
      y: 50 + percentY * 5,
    })
  }

  const handleMouseLeave = () => {
    if (!isDragging) {
      setRotateX(0)
      setRotateY(0)
      setRotateZ(0)
      setScale(1)
      setShadowX(0)
      setShadowY(0)
      setGradientPosition({ x: 50, y: 50 })
    }
  }

  const handleDragStart = (
    e: MouseEvent | TouchEvent | PointerEvent,
    info: {
      point: { x: number; y: number }
      delta: { x: number; y: number }
      offset: { x: number; y: number }
      velocity: { x: number; y: number }
    }
  ) => {
    setIsDragging(true)
    setScale(1.02)
    setZIndex(10)

    // Store initial drag position to prevent jumps
    dragPositionRef.current = info.point
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    setRotateX(0)
    setRotateY(0)
    setRotateZ(0)
    setScale(1)
    setShadowX(0)
    setShadowY(0)
    setGradientPosition({ x: 50, y: 50 })

    setTimeout(() => {
      setZIndex(1)
    }, 300)
  }

  const handleDrag = (
    e: MouseEvent | TouchEvent | PointerEvent,
    info: {
      point: { x: number; y: number }
      delta: { x: number; y: number }
      offset: { x: number; y: number }
      velocity: { x: number; y: number }
    }
  ) => {
    // Even more reduced sensitivity
    const velocityX = info.velocity.x * 0.03
    const velocityY = info.velocity.y * 0.03

    // Very subtle tilt angles
    const newRotateX = Math.max(-10, Math.min(10, velocityY))
    const newRotateY = Math.max(-10, Math.min(10, -velocityX))

    // Minimal z-rotation
    const newRotateZ = velocityX * 0.01 - velocityY * 0.01

    setRotateX(newRotateX)
    setRotateY(newRotateY)
    setRotateZ(newRotateZ)

    // Subtle shadow
    setShadowX(velocityX * 0.1)
    setShadowY(-velocityY * 0.1)

    // Minimal gradient shift
    setGradientPosition({
      x: 50 - velocityX * 0.1,
      y: 50 - velocityY * 0.1,
    })
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        drag
        dragConstraints={{ left: -80, right: 80, top: -80, bottom: 80 }}
        dragElastic={0.4}
        dragMomentum={true}
        dragTransition={{
          bounceStiffness: 150,
          bounceDamping: 30,
          power: 0.08,
          timeConstant: 500,
        }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDrag={handleDrag}
        initial={{ x: 0, y: 0 }}
        animate={{
          rotateX,
          rotateY,
          rotateZ,
          scale,
          boxShadow: `${shadowX}px ${shadowY}px 12px rgba(0, 0, 0, 0.12)`,
          background: `radial-gradient(circle at ${gradientPosition.x}% ${gradientPosition.y}%, rgba(255, 255, 255, 0.5) 0%, rgba(245, 245, 255, 0.15) 50%, rgba(250, 250, 255, 0.05) 100%)`,
          zIndex,
        }}
        transition={{
          type: 'spring',
          stiffness: isDragging ? 250 : 300,
          damping: isDragging ? 25 : 17,
          mass: 0.7,
        }}
        style={{
          transformStyle: 'preserve-3d',
          perspective: 600,
        }}
        className="w-64 h-96 rounded-lg shadow-xl flex items-center justify-center cursor-pointer absolute bg-white"
      >
        <span className="text-2xl font-bold text-gray-800">Tilt Card</span>
      </motion.div>
    </div>
  )
}

export default App
