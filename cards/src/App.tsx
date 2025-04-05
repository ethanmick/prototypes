import { motion } from 'motion/react'
import { useRef, useState } from 'react'

function App() {
  const [rotateX, setRotateX] = useState(0)
  const [rotateY, setRotateY] = useState(0)
  const [scale, setScale] = useState(1)
  const [shadowX, setShadowX] = useState(0)
  const [shadowY, setShadowY] = useState(0)
  const [gradientPosition, setGradientPosition] = useState({ x: 50, y: 50 })
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return

    const rect = cardRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    // Calculate mouse position relative to card center
    const percentX = (e.clientX - centerX) / (rect.width / 2)
    const percentY = (e.clientY - centerY) / (rect.height / 2)

    // Increase rotation angles for more pronounced effect
    setRotateX(-percentY * 25)
    setRotateY(percentX * 25)
    setScale(1.1)

    // Update shadow position based on tilt
    setShadowX(-percentX * 15)
    setShadowY(percentY * 15)

    // Update gradient position for light reflection effect
    setGradientPosition({
      x: 50 + percentX * 20,
      y: 50 + percentY * 20,
    })
  }

  const handleMouseLeave = () => {
    setRotateX(0)
    setRotateY(0)
    setScale(1)
    setShadowX(0)
    setShadowY(0)
    setGradientPosition({ x: 50, y: 50 })
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        animate={{
          rotateX,
          rotateY,
          scale,
          boxShadow: `${shadowX}px ${shadowY}px 30px rgba(0, 0, 0, 0.3)`,
          background: `radial-gradient(circle at ${gradientPosition.x}% ${gradientPosition.y}%, rgba(255, 255, 255, 0.8) 0%, rgba(200, 200, 255, 0.3) 50%, rgba(220, 220, 255, 0.1) 100%)`,
        }}
        transition={{
          type: 'spring',
          stiffness: 200,
          damping: 15,
          mass: 0.8,
        }}
        style={{
          transformStyle: 'preserve-3d',
          perspective: 1000,
        }}
        className="w-64 h-96 bg-white rounded-lg shadow-xl flex items-center justify-center cursor-pointer"
      >
        <span className="text-2xl font-bold text-gray-800">Tilt Card</span>
      </motion.div>
    </div>
  )
}

export default App
