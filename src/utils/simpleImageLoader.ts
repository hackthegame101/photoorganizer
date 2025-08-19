// Simple, fast image loading utility with cache management
const imageCache = new Map<string, { img: HTMLImageElement; lastUsed: number; size: number }>();
const MAX_CACHE_SIZE_MB = 100; // Maximum cache size in MB
const MAX_CACHE_ITEMS = 50; // Maximum number of cached images

// Estimate image memory usage (rough calculation)
const estimateImageSize = (img: HTMLImageElement): number => {
  return (img.naturalWidth * img.naturalHeight * 4) / (1024 * 1024); // 4 bytes per pixel, convert to MB
};

// Clean up cache when it gets too large
const cleanupCache = () => {
  if (imageCache.size <= MAX_CACHE_ITEMS) return;
  
  // Sort by last used (oldest first)
  const entries = Array.from(imageCache.entries()).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  
  // Remove oldest 20% of items
  const itemsToRemove = Math.floor(imageCache.size * 0.2);
  for (let i = 0; i < itemsToRemove; i++) {
    imageCache.delete(entries[i][0]);
  }
  
  console.log(`Image cache cleaned up: removed ${itemsToRemove} items, ${imageCache.size} remaining`);
};

// Check total cache size and clean if needed
const checkCacheSize = () => {
  const totalSize = Array.from(imageCache.values()).reduce((sum, item) => sum + item.size, 0);
  
  if (totalSize > MAX_CACHE_SIZE_MB) {
    // Remove oldest items until under size limit
    const entries = Array.from(imageCache.entries()).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    
    let currentSize = totalSize;
    for (const [url, item] of entries) {
      if (currentSize <= MAX_CACHE_SIZE_MB * 0.8) break; // Clean to 80% of max
      imageCache.delete(url);
      currentSize -= item.size;
    }
    
    console.log(`Image cache size reduced from ${totalSize.toFixed(1)}MB to ${currentSize.toFixed(1)}MB`);
  }
};

export const preloadImage = (url: string): Promise<HTMLImageElement> => {
  // Return cached image immediately and update last used
  if (imageCache.has(url)) {
    const cached = imageCache.get(url)!;
    cached.lastUsed = Date.now();
    return Promise.resolve(cached.img);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const size = estimateImageSize(img);
      imageCache.set(url, { 
        img, 
        lastUsed: Date.now(),
        size
      });
      
      // Clean up cache if needed
      cleanupCache();
      checkCacheSize();
      
      resolve(img);
    };
    
    img.onerror = reject;
    img.src = url;
  });
};

export const preloadImages = (urls: string[]): Promise<HTMLImageElement[]> => {
  return Promise.all(urls.map(url => preloadImage(url).catch(() => null)))
    .then(results => results.filter(Boolean) as HTMLImageElement[]);
};

export const clearImageCache = () => {
  imageCache.clear();
  console.log('Image cache cleared');
};

export const getCachedImage = (url: string): HTMLImageElement | null => {
  const cached = imageCache.get(url);
  if (cached) {
    cached.lastUsed = Date.now();
    return cached.img;
  }
  return null;
};

export const getCacheStats = () => {
  const totalSize = Array.from(imageCache.values()).reduce((sum, item) => sum + item.size, 0);
  return {
    items: imageCache.size,
    sizeMB: Math.round(totalSize * 100) / 100,
    maxItems: MAX_CACHE_ITEMS,
    maxSizeMB: MAX_CACHE_SIZE_MB
  };
};