import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
  style?: React.CSSProperties;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  onLoad,
  onError,
  style,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const handleLoad = () => {
    setLoaded(true);
    if (onLoad) onLoad();
  };

  const handleError = () => {
    setError(true);
    if (onError) onError();
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
      src={src}
      alt={alt}
      className={className}
      style={style}
      initial={{ opacity: 0 }}
      animate={{ opacity: loaded ? 1 : 0.5 }}
      transition={{ duration: 0.3 }}
      onLoad={handleLoad}
      onError={handleError}
      loading="eager"
      decoding="async"
    />
  );
};

export default OptimizedImage;