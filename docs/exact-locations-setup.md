# 🎯 Exact Locations for Events Setup

Haven now supports **exact locations for events** while keeping family profiles private at suburb-level.

## 🚀 Quick Setup

### 1. Database Migration
Run this SQL in your **Supabase SQL Editor**:

```sql
-- Add latitude and longitude columns to events table for exact location support
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS exact_address TEXT;

-- Add comments for clarity
COMMENT ON COLUMN events.latitude IS 'Latitude for exact event location (optional)';
COMMENT ON COLUMN events.longitude IS 'Longitude for exact event location (optional)';
COMMENT ON COLUMN events.exact_address IS 'Full geocoded address when exact location is enabled';
```

### 2. Your Mapbox Token is Ready ✅
Your token is already configured: `pk.eyJ1IjoiY2FuZXRyb3R0...`

## ✨ Features Added

### **Smart Location Input**
- **Toggle option:** "Use exact address" checkbox in event creation
- **General locations:** Simple text input for broad areas (e.g., "Torquay Beach")  
- **Exact locations:** Interactive search with Mapbox geocoding + map picker

### **Enhanced Event Creation**
- **Search as you type** - Finds real addresses, venues, parks
- **Click map to set location** - Visual location picker
- **Address validation** - Ensures real, geocoded locations
- **Location preview** - Shows selected address before saving

### **Better Event Display**
- **Exact addresses shown** when event creator enables them
- **"View on Maps" link** - Opens Google Maps for navigation
- **Privacy-friendly fallback** - Shows general location if exact disabled

### **Privacy Protection**
- **Family profiles:** Still suburb-level only for safety
- **Event choice:** Hosts decide exact vs general location per event
- **Clear indicators:** UI shows when exact location is enabled

## 🎯 Use Cases

**Perfect for exact locations:**
- 🏊‍♂️ Specific beaches, pools, or waterparks
- 🎮 Indoor play centres, libraries, cafes
- ⚽ Sports fields, tennis courts, skate parks
- 🎨 Art studios, museums, specific playgrounds

**Better as general locations:**
- 🏖️ "Torquay Beach area" (let people choose their spot)
- 🌳 "Geelong Botanic Gardens" (big area, meet anywhere)
- 🏪 "Ocean Grove shops" (general shopping area)

## 🛡️ Privacy & Safety

**Family Profiles:** Always suburb-level (no change)
**Event Locations:** Host chooses per event
- General location: Safe, approximate area
- Exact location: Specific venue/address

**Smart defaults:** Simple events default to general locations

## 🧪 Testing

1. **Create an event** → Events page → "Create" button
2. **Toggle "Use exact address"** 
3. **Search for a venue** (try "Torquay Life Saving Club")
4. **Click map icon** to use visual picker
5. **Create event** and check location display

Ready to use immediately with your Mapbox token! 🎉