import { createRoot } from 'react-dom/client'
import {
  createBrowserRouter,
  Link,
  Outlet,
  RouterProvider,
} from 'react-router-dom'

// Layout component with navigation
const Layout = () => {
  return (
    <div>
      <nav style={{ padding: '1rem', borderBottom: '1px solid #ccc' }}>
        <Link style={{ marginRight: '1rem' }} to="/">
          Home
        </Link>
        <Link style={{ marginRight: '1rem' }} to="/about">
          About
        </Link>
        <Link to="/contact">Contact</Link>
      </nav>
      <main style={{ padding: '1rem' }}>
        <Outlet />
      </main>
    </div>
  )
}

// Page components
const HomePage = () => <h2>Welcome to the Home Page!</h2>
const AboutPage = () => <h2>About Us</h2>
const ContactPage = () => <h2>Contact Us</h2>

// Create router configuration
const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'about',
        element: <AboutPage />,
      },
      {
        path: 'contact',
        element: <ContactPage />,
      },
    ],
  },
])

// Render the app with RouterProvider
const root = createRoot(document.body)
root.render(<RouterProvider router={router} />)
