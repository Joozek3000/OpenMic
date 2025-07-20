import type { Metadata } from "next";
import "./globals.css";
import AuthBootstrap from "@/components/ui/AuthBootstrap"

// App metadata for SEO and browser display
export const metadata: Metadata = {
  title: "OpenMic - Comedy Video Platform",
  description: "A mobile-first social video platform for comedians and comedy fans",
};


/**
 * Root layout component that wraps all pages
 * - Sets up Firebase authentication
 * - Provides consistent dark theme styling
 * - Includes bottom navigation bar
 * - Adds padding to prevent content overlap with navbar
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        {/* Initialize Firebase authentication */}
        <AuthBootstrap />
        
        {/* Main content area with bottom padding to prevent navbar overlap */}
        <main style={{paddingBottom: '80px'}}>{children}</main>
        {/* Bottom navigation bar - mobile app style */}
        <nav style={{
          position: 'fixed',
          bottom: '0',
          left: '0',
          right: '0',
          backgroundColor: '#18181b', // Dark gray background
          borderTop: '1px solid #3f3f46', // Subtle border
          padding: '12px 16px',
          zIndex: 50 // Ensure it stays on top
        }}>
          {/* Navigation container with centered layout */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            maxWidth: '500px',
            margin: '0 auto'
          }}>
            {/* Home button - links to main feed */}
            <a href="/feed" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '8px',
              color: '#ffffff', // White for active/primary nav item
              textDecoration: 'none'
            }}>
              <div style={{fontSize: '28px', fontWeight: 'bold'}}>⌂</div>
              <span style={{fontSize: '12px'}}>Home</span>
            </a>
            {/* Search button - for finding content */}
            <a href="/search" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '8px',
              color: '#9ca3af', // Gray for inactive nav items
              textDecoration: 'none'
            }}>
              <div style={{fontSize: '28px', fontWeight: 'bold'}}>⚲</div>
              <span style={{fontSize: '12px'}}>Search</span>
            </a>
            {/* Upload button - special styling with white background */}
            <a href="/upload" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '8px',
              textDecoration: 'none'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                backgroundColor: 'white',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{color: 'black', fontSize: '28px', fontWeight: 'bold'}}>+</span>
              </div>
            </a>
            {/* Explore button - placeholder for future feature */}
            <a href="#" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '8px',
              color: '#9ca3af', // Gray for disabled/placeholder
              textDecoration: 'none'
            }}>
              <div style={{fontSize: '28px', fontWeight: 'bold'}}>◉</div>
              <span style={{fontSize: '12px'}}>Explore</span>
            </a>
            {/* Profile button - user account management */}
            <a href="/profile" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '8px',
              color: '#9ca3af', // Gray for inactive nav items
              textDecoration: 'none'
            }}>
              <div style={{fontSize: '28px', fontWeight: 'bold'}}>◐</div>
              <span style={{fontSize: '12px'}}>Profile</span>
            </a>
          </div>
        </nav>
      </body>
    </html>
  )
}