// Consistent avatar colors based on name
const avatarColors = [
  'bg-rose-500',
  'bg-orange-500', 
  'bg-amber-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-teal-500',
  'bg-teal-500',
  'bg-violet-500',
  'bg-purple-500',
  'bg-fuchsia-500',
  'bg-pink-500',
];

// Generate consistent color from name
export function getAvatarColor(name: string): string {
  if (!name) return 'bg-gray-400';
  
  // Simple hash from name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % avatarColors.length;
  return avatarColors[index];
}

// Status colors - more vibrant
export const statusColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  considering: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    border: 'border-amber-400',
    dot: 'bg-amber-500',
  },
  new: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-700', 
    border: 'border-emerald-400',
    dot: 'bg-emerald-500',
  },
  experienced: {
    bg: 'bg-teal-100',
    text: 'text-teal-700',
    border: 'border-teal-400',
    dot: 'bg-teal-500',
  },
  connecting: {
    bg: 'bg-violet-100',
    text: 'text-violet-700',
    border: 'border-violet-400',
    dot: 'bg-violet-500',
  },
};

export const statusLabels: Record<string, string> = {
  considering: 'Considering homeschool',
  new: 'Just started',
  experienced: 'Experienced',
  connecting: 'Looking to connect',
};

export const statusIcons: Record<string, string> = {
  considering: '🤔',
  new: '🌱',
  experienced: '⭐',
  connecting: '🤝',
};
