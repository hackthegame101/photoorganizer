import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface OptimizedImageProps {
  src: string;
  thumbnailSrc?: string;
  alt: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
  style?: React.CSSProperties;
  useFullSize?: boolean; // For modal/detail views
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  thumbnailSrc,
  alt,
  className = '',
  onLoad,
  onError,
  style,
  useFullSize = false,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [showFullSize, setShowFullSize] = useState(useFullSize);

  // Determine which image source to use
  const imageSrc = showFullSize || !thumbnailSrc ? src : thumbnailSrc;

  const handleLoad = () => {
    setLoaded(true);
    if (onLoad) onLoad();
    
    // If we loaded a thumbnail and full size is available, preload the full size
    if (!showFullSize && !useFullSize && thumbnailSrc && src !== thumbnailSrc) {
      const fullSizeImg = new Image();
      fullSizeImg.src = src; // Preload full size in background
    }
  };

  const handleError = () => {
    // If thumbnail fails and we have full size, try full size
    if (!showFullSize && thumbnailSrc && src !== thumbnailSrc) {
      setShowFullSize(true);
      setError(false);
      setLoaded(false);
      return;
    }
    
    setError(true);
    if (onError) onError();
  };

  const handleClick = () => {
    // Switch to full size on click if we're showing thumbnail
    if (!showFullSize && thumbnailSrc && src !== thumbnailSrc) {
      setShowFullSize(true);
      setLoaded(false);
    }
  };

  if (error) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          color: '#64748b',
          minHeight: '200px',
          ...style,
        }}
      >
        Failed to load image
      </div>
    );
  }

  return (
    <motion.img
      src={imageSrc}
      alt={alt}
      className={className}
      style={{ 
        cursor: (!showFullSize && thumbnailSrc && src !== thumbnailSrc) ? 'pointer' : 'default',
        ...style 
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: loaded ? 1 : 0.5 }}
      transition={{ duration: 0.3 }}
      onLoad={handleLoad}
      onError={handleError}
      onClick={handleClick}
      loading="lazy"
      decoding="async"
    />
  );
};

export default OptimizedImage;