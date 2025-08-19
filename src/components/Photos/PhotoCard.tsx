import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Photo } from '../../firebase/firestore';

interface PhotoCardProps {
  photo: Photo;
  isSelected: boolean;
  showSelection: boolean;
  onClick: () => void;
  onSelect: () => void;
  viewMode?: 'edit' | 'preview' | 'premium' | 'premtime';
}

const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  isSelected,
  showSelection,
  onClick,
  onSelect,
  viewMode = 'edit'
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentImageSrc, setCurrentImageSrc] = useState('');

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: any): string => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString();
  };

  // Progressive loading strategy for premium views
  React.useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    
    if (viewMode === 'premium' || viewMode === 'premtime') {
      // Start with thumbnail for instant loading
      if (photo.thumbnailUrl) {
        setCurrentImageSrc(photo.thumbnailUrl);
        
        // Then try to load compressed version in background
        const compressedImg = new Image();
        compressedImg.onload = () => {
          setCurrentImageSrc(photo.url); // Switch to compressed version
          setImageLoaded(false); // Reset to show loading for new image
        };
        compressedImg.onerror = () => {
          // If compressed fails, fallback to original if available
          if (photo.originalUrl && photo.originalUrl !== photo.url) {
            const originalImg = new Image();
            originalImg.onload = () => {
              setCurrentImageSrc(photo.originalUrl!);
              setImageLoaded(false); // Reset to show loading for new image
            };
            originalImg.src = photo.originalUrl;
          }
        };
        compressedImg.src = photo.url;
      } else {
        // No thumbnail, start with compressed
        setCurrentImageSrc(photo.url);
      }
    } else {
      // For preview and edit modes, use thumbnail
      setCurrentImageSrc(photo.thumbnailUrl || photo.url);
    }
  }, [photo, viewMode]);

  // For preview mode, use minimal Google Photos style
  if (viewMode === 'preview' || viewMode === 'premium' || viewMode === 'premtime') {
    return (
      <motion.div
        className={`photo-card preview-mode ${isSelected ? 'selected' : ''}`}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onClick}
      >
        <div className="photo-image-container">
          {!imageLoaded && !imageError && (
            <div className="photo-skeleton">
              <div className="skeleton-animation" />
            </div>
          )}
          
          {imageError ? (
            <div className="photo-error">
              <span>📷</span>
            </div>
          ) : (
            <img
              src={currentImageSrc}
              alt={photo.originalName}
              className={`photo-image ${imageLoaded ? 'loaded' : ''}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              loading="lazy"
            />
          )}
        </div>
      </motion.div>
    );
  }

  // Default edit mode with all details
  return (
    <motion.div
      className={`photo-card ${isSelected ? 'selected' : ''}`}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
    >
      {showSelection && (
        <div className="photo-selection">
          <button
            className={`selection-checkbox ${isSelected ? 'selected' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            {isSelected && '✓'}
          </button>
        </div>
      )}

      <div className="photo-image-container">
        {!imageLoaded && !imageError && (
          <div className="photo-skeleton">
            <div className="skeleton-animation" />
          </div>
        )}
        
        {imageError ? (
          <div className="photo-error">
            <span>📷</span>
            <p>Failed to load image</p>
          </div>
        ) : (
          <img
            src={currentImageSrc || photo.thumbnailUrl || photo.url}
            alt={photo.originalName}
            className={`photo-image ${imageLoaded ? 'loaded' : ''}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            loading="lazy"
          />
        )}

        <div className="photo-overlay">
          <div className="photo-actions">
            <button className="action-btn" title="Download">
              ⬇️
            </button>
            <button className="action-btn" title="Share">
              📤
            </button>
            <button className="action-btn" title="Edit">
              ✏️
            </button>
          </div>
        </div>
      </div>

      <div className="photo-info">
        <h4 className="photo-title">{photo.originalName}</h4>
        <div className="photo-metadata">
          <span className="photo-size">{formatFileSize(photo.metadata.size)}</span>
          {photo.metadata.width && photo.metadata.height && (
            <span className="photo-dimensions">
              {photo.metadata.width} × {photo.metadata.height}
            </span>
          )}
          <span className="photo-date">{formatDate(photo.createdAt)}</span>
        </div>
        
        {photo.tags.length > 0 && (
          <div className="photo-tags">
            {photo.tags.slice(0, 3).map((tag, index) => (
              <span key={index} className="tag">
                {tag}
              </span>
            ))}
            {photo.tags.length > 3 && (
              <span className="tag">+{photo.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default PhotoCard;