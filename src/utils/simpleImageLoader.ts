// Simple, fast image loading utility
const imageCache = new Map<string, HTMLImageElement>();

export const preloadImage = (url: string): Promise<HTMLImageElement> => {
  // Return cached image immediately
  if (imageCache.has(url)) {
    return Promise.resolve(imageCache.get(url)!);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      imageCache.set(url, img);
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
};

export const getCachedImage = (url: string): HTMLImageElement | null => {
  return imageCache.get(url) || null;
};