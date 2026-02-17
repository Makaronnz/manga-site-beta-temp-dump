# Manga Reading Platform

A high-performance and scalable manga reading and tracking platform built with modern web technologies. It allows users to discover, read, and add manga series to their libraries, as well as track their reading history. It operates by integrating with a global API (MangaDex) to offer a vast content pool and is optimized to run on Edge Computing (Cloudflare).

## Tech Stack

### Frontend & Framework
- **Next.js 15 (App Router):** Hybrid structure with Server-Side Rendering (SSR) and Static Site Generation (SSG) for high SEO performance and fast page loads.
- **TypeScript:** For type safety and a scalable codebase.
- **React 19:** Modern UI component architecture (Server Components & Client Components separation).
- **Tailwind CSS 4:** Responsive, modern, and customizable design system.

### Backend & Data Management
- **Supabase:** Backend-as-a-Service (BaaS) for user data, profiles, and library management, utilizing a PostgreSQL database.
- **MangaDex API Integration:** Data fetching from an external source (3rd party API), caching mechanisms, and data normalization layer.
- **Edge Computing:** Backend logic optimized with `open-next` to run on Cloudflare Workers and Pages.

### DevOps & Tools
- **Cloudflare Pages:** Global CDN distribution and serverless functions.
- **OpenNext:** Adaptation of the Next.js application for serverless/edge environments (Cloudflare).
- **ESLint:** For code quality and standards.
- **Git:** Version control.

## Key Features

- **Advanced Reading Experience:** Image loading optimizations, chapter navigation, and a user-friendly reader interface.
- **Personalized Library:** Users can track series with categories like "Reading", "Completed", "Plan to Read".
- **Reading History:** Resume where you left off (synchronization between localStorage and database).
- **Multi-language Support (i18n):** Content presentation and interface support in multiple languages.
- **Performant Search & Filtering:** Advanced content filtering by genre, publication status, and popularity.
- **Image Proxy & Optimization:** Proxy layer for secure and fast delivery of external source images.

## Highlighted Architectural Decisions

- **Hybrid Rendering:** Usage of static (SSG) and dynamic (SSR) rendering strategies together based on page content.
- **API Wrapper Pattern:** A custom fetch layer (`mdFetchJSON`) containing error handling (retry logic), timeouts, and typing (TypeScript generics) for MangaDex API requests.
- **Edge-Ready:** The application is designed to run on the Edge Runtime instead of a traditional Node.js server, ensuring low latency for global access.

---

*This project demonstrates proficiency in modern frontend architecture, 3rd party API integration, database management, and serverless deployment.*
