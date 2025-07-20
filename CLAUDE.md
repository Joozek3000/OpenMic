# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenMic is a mobile-first (but desktop-compatible) social video platform designed for comedians and fans of comedy. Built with Next.js 15 and Firebase, it aims to create a space that feels like a mix between TikTok and a local comedy scene.

### Core Features (Current/Planned)
- **User accounts** with authentication
- **Short vertical video uploads** of comedy content (stand-up, sketches, riffs)
- **Feed experience** for discovering comedy videos
- **Social interactions** (likes, comments)
- **User profiles** with basic info and uploaded videos

### Future Features
- **Venue map** showing local open mic locations
- **Venue pages** with event listings and info
- **Search functionality**
- **Following system**
- **Dark mode** toggle
- Enhanced discovery features

### Design Philosophy
- **Mobile-first** with desktop compatibility
- **Modern, lightweight, clean** aesthetic
- **Modular and readable** code structure
- **Easy to build upon** for future features
- Focus on **usability** and **clean design**

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Architecture

### App Structure
- **Next.js App Router**: Uses the `src/app/` directory structure
- **Pages**: Home (`/`), Upload (`/upload`), Feed (`/feed`), Profile (`/profile`)
- **Components**: UI components in `src/components/ui/` (built with Radix UI)
- **Libraries**: Firebase utilities and hooks in `src/lib/`

### Current Implementation Status
- **Routing**: Complete app structure with all main pages (home, feed, upload, profile, search)
- **Firebase**: Full integration with anonymous auth, Firestore, and Storage
- **UI**: Clean, commented components with Tailwind CSS and Radix UI
- **Navigation**: Mobile-first bottom navbar with proper styling
- **Code Quality**: Well-documented, refactored codebase with clear comments

### Firebase Integration
- **Authentication**: Anonymous authentication via `useAnonAuth` hook (will transition to full user accounts)
- **Database**: Firestore for data persistence (videos, users, comments, likes)
- **Storage**: Firebase Storage for video uploads and user content
- **Configuration**: Firebase config in `src/lib/firebase.ts`

### Key Components
- `AuthBootstrap`: Client-side authentication initialization
- `useAnonAuth`: Custom hook for anonymous Firebase authentication
- UI components built with Radix UI and Tailwind CSS

### Styling
- **Tailwind CSS**: Primary styling framework for responsive, mobile-first design
- **Radix UI**: Headless UI components for accessibility and consistency
- **Dark Theme**: Default black background with white text (future: toggleable dark mode)
- **CSS Variables**: Configured via `class-variance-authority`
- **Mobile-first approach**: Responsive design prioritizing mobile experience

## TypeScript Configuration

- Path mapping: `@/*` maps to `./src/*`
- Strict mode enabled
- Next.js plugin configured

## Testing

No test framework is currently configured. When adding tests, prioritize:
- Component testing for UI elements
- Integration testing for Firebase interactions
- Mobile-responsive testing across devices

## Development Notes

### Firebase Security
Firebase configuration is exposed in the client code, which is standard for Firebase web applications. The security is handled through Firebase Security Rules (not included in this codebase).

### Video Requirements
- **Format**: Short vertical videos optimized for mobile viewing
- **Content**: Comedy-focused (stand-up, sketches, riffs, etc.)
- **Storage**: Firebase Storage for scalable video hosting

### Future Considerations
- Implement user authentication beyond anonymous
- Add video compression/optimization
- Consider CDN for video delivery
- Plan for venue/location features integration
- Design for social features (following, enhanced discovery)