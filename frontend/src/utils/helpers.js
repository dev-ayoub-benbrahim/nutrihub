// Format cook time — e.g. 90 → "1h 30m", 25 → "25m"
export const formatCookTime = (minutes) => {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

// Get user initials for avatar
export const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');
};

// Truncate text with ellipsis
export const truncate = (text, max = 80) => {
  if (!text || text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '…';
};

// Extract a clean error message from an axios error
export const getErrorMessage = (error) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    'Something went wrong'
  );
};

// Format a number — 1200 → "1.2k"
export const formatCount = (n) => {
  if (!n && n !== 0) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};