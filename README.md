# Haven - Find Your Parent Community

Connect with local families who have kids the same age. Build your village, find your people.

## About Haven

Haven is a location-based app designed specifically for homeschooling families to find and connect with each other. Whether you're new to homeschooling, new to an area, or just looking to expand your community, Haven helps you discover families with similar-aged children nearby.

**Development Location:** This desktop folder (`~/Desktop/haven-app`) is the primary development environment for Haven.

🚀 **Auto-Deploy Test:** GitHub → Vercel pipeline connected!

## Tech Stack

- **Frontend:** Next.js 16 + React 19 + Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Real-time, Storage)  
- **Maps:** Mapbox GL JS
- **Deployment:** Vercel
- **Database:** PostgreSQL with Row Level Security

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Features

- 📍 Location-based family discovery
- 🗺️ Interactive map view with family locations
- 📅 Community events with RSVP
- 💬 Direct messaging between families
- 🔒 Privacy-first design (suburb-level location sharing)
- 📱 PWA-ready for mobile installation

## Database

Database schemas are in the `/database/` folder. The app connects to Supabase project: `lpatbzdghfrghzximywg`
