'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Mapbox access token - get this from mapbox.com (free tier available)
// Demo token for development/testing (has usage limits)
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoiZXhhbXBsZXMiLCJhIjoiY2p1dDl6Z3VrMDA1cjQzb3g3aTFha2U5cyJ9.95uWRjjYsGF7v3HfqZ4Gig';

type Family = {
  id: string;
  name: string;
  location_name: string;
  kids_ages: number[];
  status: string;
  bio?: string;
  interests?: string[];
  is_verified: boolean;
  created_at: string;
};

interface FamilyMapProps {
  families: Family[];
  onFamilyClick?: (family: Family) => void;
  className?: string;
}

// Predefined coordinates for common locations around Torquay/Geelong area
const LOCATION_COORDS: { [key: string]: [number, number] } = {
  'Torquay': [144.3256, -38.3305],
  'Geelong': [144.3580, -38.1499],
  'Surf Coast': [144.2500, -38.3000],
  'Bellarine Peninsula': [144.5000, -38.2500],
  'Ocean Grove': [144.5208, -38.2575],
  'Barwon Heads': [144.4958, -38.2683],
  'Anglesea': [144.1856, -38.4089],
  'Lorne': [143.9781, -38.5433],
  'Winchelsea': [143.9856, -38.2475],
  'Colac': [143.5856, -38.3422],
  'Portarlington': [144.6550, -38.0833],
  'Queenscliff': [144.6658, -38.2650],
  'Point Lonsdale': [144.6161, -38.2917],
  'Drysdale': [144.5775, -38.1689],
  'Leopold': [144.4489, -38.1856],
  'Melbourne': [144.9631, -37.8136], // In case some families are from Melbourne
};

// Function to get coordinates for a location
const getLocationCoords = (locationName: string): [number, number] => {
  // Try exact match first
  if (LOCATION_COORDS[locationName]) {
    return LOCATION_COORDS[locationName];
  }
  
  // Try partial match
  const partialMatch = Object.keys(LOCATION_COORDS).find(key =>
    locationName.toLowerCase().includes(key.toLowerCase()) ||
    key.toLowerCase().includes(locationName.toLowerCase())
  );
  
  if (partialMatch) {
    return LOCATION_COORDS[partialMatch];
  }
  
  // Default to Torquay if no match
  return LOCATION_COORDS['Torquay'];
};

export default function FamilyMap({ families, onFamilyClick, className = '' }: FamilyMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // This should now work with the demo token, but keeping the fallback just in case
  if (!MAPBOX_TOKEN) {
    return (
      <div className={`relative ${className}`}>
        <div className="w-full h-[500px] rounded-xl bg-gradient-to-br from-teal-50 to-emerald-50 border-2 border-dashed border-teal-200 flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <div className="w-16 h-16 bg-teal-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-3xl">🗺️</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Map Token Missing</h3>
            <p className="text-gray-600 text-sm mb-4">
              The Mapbox token seems to be missing. This shouldn't happen with the demo token!
            </p>
            <p className="text-xs text-gray-500">
              Showing {families.length} families that would appear on the map
            </p>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!mapContainer.current) return;

    // Set mapbox access token
    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [144.3256, -38.3305], // Torquay center
      zoom: 10,
      attributionControl: false,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setIsLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  // Update markers when families change
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    // Clear existing markers
    const existingMarkers = document.querySelectorAll('.family-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Add family markers
    families.forEach(family => {
      const coords = getLocationCoords(family.location_name);
      
      // Create marker element
      const markerElement = document.createElement('div');
      markerElement.className = 'family-marker w-10 h-10 bg-teal-600 rounded-full border-2 border-white shadow-lg cursor-pointer flex items-center justify-center text-white font-semibold text-sm hover:bg-teal-700 transition-colors';
      markerElement.innerHTML = family.name.charAt(0).toUpperCase();
      
      // Add click handler
      markerElement.addEventListener('click', () => {
        if (onFamilyClick) {
          onFamilyClick(family);
        }
      });

      // Create popup
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        closeOnClick: false
      }).setHTML(`
        <div class="p-2">
          <div class="font-semibold text-gray-900">${family.name}</div>
          <div class="text-sm text-gray-600">📍 ${family.location_name}</div>
          <div class="text-sm text-gray-600">Kids: ${family.kids_ages?.length ? family.kids_ages.join(', ') + ' years' : 'No info'}</div>
          ${family.is_verified ? '<div class="text-green-600 text-sm">✓ Verified</div>' : ''}
        </div>
      `);

      // Create marker
      const marker = new mapboxgl.Marker(markerElement)
        .setLngLat(coords)
        .setPopup(popup)
        .addTo(map.current!);

      // Show popup on hover
      markerElement.addEventListener('mouseenter', () => {
        popup.addTo(map.current!);
      });
      
      markerElement.addEventListener('mouseleave', () => {
        popup.remove();
      });
    });

    // Fit map to show all families if there are any
    if (families.length > 0) {
      const coords = families.map(family => getLocationCoords(family.location_name));
      const bounds = new mapboxgl.LngLatBounds();
      coords.forEach(coord => bounds.extend(coord));
      
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 12
      });
    }
  }, [families, isLoaded, onFamilyClick]);

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={mapContainer} 
        className="w-full h-[500px] rounded-xl overflow-hidden shadow-lg"
      />
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-100 rounded-xl flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-gray-600 text-sm">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
}