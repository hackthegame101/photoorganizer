import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Photo } from '../../firebase/firestore';

interface PhotoCardProps {
  photo: Photo;
  isSelected: boolean;
  showSelection: boolean;
  onClick: () => void;
  onSelect: () => void;
  viewMode?: 'edit' | 'preview' | 'premium';
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

  // For preview mode, use minimal Google Photos style
  if (viewMode === 'preview' || viewMode === 'premium') {
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
              src={photo.thumbnailUrl || photo.url}
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
            src={photo.thumbnailUrl || photo.url}
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