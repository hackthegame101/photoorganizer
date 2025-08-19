import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePhoto } from '../../contexts/PhotoContext';

interface PremiumViewProps {
  onExit: () => void;
}

const PremiumView: React.FC<PremiumViewProps> = ({ onExit }) => {
  const { state } = usePhoto();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [slideInterval, setSlideInterval] = useState(3000);
  const [showControls, setShowControls] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const filteredPhotos = React.useMemo(() => {
    let photos = state.photos;
    
    if (state.selectedCategory) {
      photos = photos.filter(photo => photo.categoryId === state.selectedCategory);
    }
    
    return photos;
  }, [state.photos, state.selectedCategory]);

  const currentPhoto = filteredPhotos[currentPhotoIndex];

  const navigatePhoto = useCallback((direction: number) => {
    setCurrentPhotoIndex((prev) => {
      const newIndex = prev + direction;
      if (newIndex < 0) return filteredPhotos.length - 1;
      if (newIndex >= filteredPhotos.length) return 0;
      return newIndex;
    });
  }, [filteredPhotos.length]);

  const handleExit = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onExit();
  }, [onExit]);

  // Initialize audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.3;
      audioRef.current.loop = true;
      audioRef.current.play().catch(console.error);
    }
  }, []);

  // Auto-advance slideshow
  useEffect(() => {
    if (isPlaying && filteredPhotos.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentPhotoIndex((prev) => (prev + 1) % filteredPhotos.length);
      }, slideInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, slideInterval, filteredPhotos.length]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          handleExit();
          break;
        case ' ':
          event.preventDefault();
          setIsPlaying(!isPlaying);
          break;
        case 'ArrowLeft':
          navigatePhoto(-1);
          break;
        case 'ArrowRight':
          navigatePhoto(1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying, handleExit, navigatePhoto]);

  if (!currentPhoto) {
    return (
      <div className="premium-view-empty">
        <div className="empty-message">
          <h2>No photos found</h2>
          <p>Please upload photos or select a different category</p>
          <button className="btn btn-primary" onClick={handleExit}>
            Exit Premium View
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="premium-view"
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Background Audio */}
      <audio ref={audioRef} src="/bmg.mp3" />

      {/* Main Photo Display */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPhoto.id}
          className="premium-photo-container"
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 1, ease: "easeInOut" }}
        >
          <motion.img
            src={currentPhoto.url}
            alt={currentPhoto.originalName}
            className="premium-photo"
            initial={{ filter: "brightness(0.7)" }}
            animate={{ filter: "brightness(1)" }}
            transition={{ duration: 1.5 }}
          />
          
          {/* Animated overlay effects */}
          <motion.div
            className="photo-overlay-effect"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2 }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Photo Information */}
      <motion.div
        className="premium-photo-info"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : 50 }}
        transition={{ duration: 0.3 }}
      >
        <h3>{currentPhoto.originalName}</h3>
        <p>{currentPhotoIndex + 1} of {filteredPhotos.length}</p>
        {state.selectedCategory && (
          <p className="category-name">
            {state.categories.find(cat => cat.id === state.selectedCategory)?.name || 'Category'}
          </p>
        )}
      </motion.div>

      {/* Navigation Controls */}
      <motion.div
        className="premium-controls"
        initial={{ opacity: 0 }}
        animate={{ opacity: showControls ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Previous Button */}
        <button
          className="nav-btn nav-prev"
          onClick={() => navigatePhoto(-1)}
          disabled={filteredPhotos.length <= 1}
        >
          ‹
        </button>

        {/* Next Button */}
        <button
          className="nav-btn nav-next"
          onClick={() => navigatePhoto(1)}
          disabled={filteredPhotos.length <= 1}
        >
          ›
        </button>

        {/* Bottom Controls */}
        <div className="bottom-controls">
          <div className="control-group">
            <button
              className="control-btn"
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>
            
            <select
              className="speed-control"
              value={slideInterval}
              onChange={(e) => setSlideInterval(Number(e.target.value))}
              title="Slideshow speed"
            >
              <option value={1000}>Fast (1s)</option>
              <option value={3000}>Normal (3s)</option>
              <option value={5000}>Slow (5s)</option>
              <option value={10000}>Very Slow (10s)</option>
            </select>

            <button
              className="control-btn"
              onClick={() => {
                if (audioRef.current) {
                  if (audioRef.current.paused) {
                    audioRef.current.play();
                  } else {
                    audioRef.current.pause();
                  }
                }
              }}
              title="Toggle music"
            >
              🎵
            </button>
          </div>

          <button className="exit-btn" onClick={handleExit}>
            Exit Premium View
          </button>
        </div>
      </motion.div>

      {/* Progress Indicator */}
      <div className="progress-indicator">
        {filteredPhotos.map((_, index) => (
          <motion.div
            key={index}
            className={`progress-dot ${index === currentPhotoIndex ? 'active' : ''}`}
            onClick={() => setCurrentPhotoIndex(index)}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.8 }}
          />
        ))}
      </div>

      {/* Animated background particles */}
      <div className="background-particles">
        {[...Array(20)].map((_, index) => (
          <motion.div
            key={index}
            className="particle"
            initial={{ 
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              opacity: 0
            }}
            animate={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              opacity: [0, 0.5, 0]
            }}
            transition={{
              duration: Math.random() * 10 + 5,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default PremiumView;