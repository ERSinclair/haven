# 🗺️ Map Setup Guide

Haven includes an interactive map feature to help families discover others nearby. 

🎉 **Good news!** The map now works out of the box with a demo token for testing.

## Demo Token Included ✅

The app includes a **demo Mapbox token** for immediate testing:
- ✅ Works out of the box
- ✅ No signup required  
- ⚠️ Has usage limits (fine for testing/demos)
- ⚠️ Shared across all demo users

## For Production Use (5 minutes)

For a production app with your own users, get your own free token:

### 1. Get a Free Mapbox Token
- Visit [mapbox.com](https://mapbox.com)
- Sign up for a free account
- Go to your [account page](https://account.mapbox.com/)
- Copy your **Public Access Token**

### 2. Add Token to Environment
Add this line to your `.env.local` file:
```bash
NEXT_PUBLIC_MAPBOX_TOKEN=your_actual_token_here
```

### 3. Restart Development Server
```bash
npm run dev
```

## Features

✅ **Interactive Map** - Click and drag to explore  
✅ **Family Markers** - See families in your area  
✅ **Privacy-First** - Only shows suburb/area locations  
✅ **Smart Popups** - Hover for quick family info  
✅ **Integrated Filtering** - All search filters work on map  
✅ **Click to Message** - Click markers to start conversations  

## Privacy & Security

- **No exact addresses** - Only suburb/area level locations
- **Pre-defined coordinates** - Uses safe, general location points
- **No tracking** - Mapbox doesn't store user locations
- **Free tier friendly** - Generous usage limits

## Coverage Area

Currently optimized for **Surf Coast/Geelong region**:
- Torquay, Anglesea, Lorne
- Geelong, Ocean Grove, Barwon Heads  
- Bellarine Peninsula
- Colac, Winchelsea areas

Easy to extend to other regions by updating `LOCATION_COORDS` in `src/components/FamilyMap.tsx`.

## Troubleshooting

**Map not loading?**
- Check your token is correctly added to `.env.local`
- Restart the dev server
- Check browser console for errors

**Missing locations?**
- Add new suburbs to `LOCATION_COORDS` in `FamilyMap.tsx`
- Coordinates can be found at [latlong.net](https://www.latlong.net/)

## Cost

**Demo Token:**
- Free to use for testing
- Shared usage limits across all demo users
- Perfect for development and demos

**Your Own Token:**
- Free tier: 50,000 map loads/month
- Free tier: 100,000 geocoding requests/month  
- More than enough for local family apps!
- Your own dedicated usage limits