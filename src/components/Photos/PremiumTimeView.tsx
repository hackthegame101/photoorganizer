import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePhoto } from '../../contexts/PhotoContext';
import { preloadImage, preloadImages } from '../../utils/simpleImageLoader';
import OptimizedImage from '../common/OptimizedImage';

interface PremiumTimeViewProps {
  onExit: () => void;
}

const PremiumTimeView: React.FC<PremiumTimeViewProps> = ({ onExit }) => {
  const { state } = usePhoto();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [slideInterval, setSlideInterval] = useState(3000);
  const [showControls, setShowControls] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showPauseIndicator, setShowPauseIndicator] = useState(false);
  const [currentMusicIndex, setCurrentMusicIndex] = useState(0);
  const [isMusicPlaying, setIsMusicPlaying] = useState(true);
  const audioInitialized = true;
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set());
  const [isSlowDevice, setIsSlowDevice] = useState(false);
  const [imageLoadingStates, setImageLoadingStates] = useState<Map<number, 'loading' | 'loaded' | 'error'>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pauseIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const musicTracks = React.useMemo(() => ['/kut.mp3', '/kut1.mp3', '/bmg.mp3'], []);

  // Sort photos by timestamp (when photo was taken)
  const photosByTime = React.useMemo(() => {
    let photos = state.photos;
    
    if (state.selectedCategory) {
      photos = photos.filter(photo => photo.categoryId === state.selectedCategory);
    }
    
    // Sort photos by timestamp (newest first, then oldest first if no timestamp)
    const sortedPhotos = [...photos].sort((a, b) => {
      const getTimestamp = (date: string | Date | undefined) => {
        if (!date) return 0;
        try {
          return typeof date === 'string' ? new Date(date).getTime() : date.getTime();
        } catch {
          return 0;
        }
      };
      
      const aTime = getTimestamp(a.metadata?.dateTaken);
      const bTime = getTimestamp(b.metadata?.dateTaken);
      
      // If both have timestamps, sort by date (newest first)
      if (aTime && bTime) {
        return bTime - aTime;
      }
      
      // Photos with timestamps come before photos without timestamps
      if (aTime && !bTime) return -1;
      if (!aTime && bTime) return 1;
      
      // For photos without timestamps, sort by upload date (createdAt)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    return sortedPhotos;
  }, [state.photos, state.selectedCategory]);

  // Get image URLs for optimization
  const imageUrls = React.useMemo(() => {
    return photosByTime.map(photo => photo.url);
  }, [photosByTime]);

  const currentPhoto = photosByTime[currentPhotoIndex];
  const totalPhotos = photosByTime.length;

  const navigatePhoto = useCallback((direction: number) => {
    if (totalPhotos <= 1) return;
    
    let newIndex = currentPhotoIndex + direction;
    
    if (newIndex < 0) {
      newIndex = totalPhotos - 1;
    } else if (newIndex >= totalPhotos) {
      newIndex = 0;
    }
    
    setCurrentPhotoIndex(newIndex);
  }, [currentPhotoIndex, totalPhotos]);

  const jumpToPhoto = useCallback((index: number) => {
    if (index >= 0 && index < totalPhotos) {
      setCurrentPhotoIndex(index);
    }
  }, [totalPhotos]);

  const handleExit = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onExit();
  }, [onExit]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  const toggleMusic = useCallback(() => {
    if (audioRef.current) {
      if (isMusicPlaying) {
        audioRef.current.pause();
        setIsMusicPlaying(false);
      } else {
        audioRef.current.play().then(() => {
          setIsMusicPlaying(true);
        }).catch(console.error);
      }
    }
  }, [isMusicPlaying]);

  const togglePlayPause = useCallback(() => {
    const newPlayState = !isPlaying;
    setIsPlaying(newPlayState);
    
    // Sync music with slideshow
    if (audioRef.current) {
      if (!newPlayState) {
        // Pausing slideshow - pause music
        audioRef.current.pause();
        setIsMusicPlaying(false);
      } else {
        // Resuming slideshow - resume music
        audioRef.current.play().then(() => {
          setIsMusicPlaying(true);
        }).catch(console.error);
      }
    }
    
    if (!newPlayState) {
      setShowPauseIndicator(true);
      
      if (pauseIndicatorTimeoutRef.current) {
        clearTimeout(pauseIndicatorTimeoutRef.current);
      }
      
      pauseIndicatorTimeoutRef.current = setTimeout(() => {
        setShowPauseIndicator(false);
      }, 2000);
    } else {
      setShowPauseIndicator(false);
      if (pauseIndicatorTimeoutRef.current) {
        clearTimeout(pauseIndicatorTimeoutRef.current);
      }
    }
  }, [isPlaying]);

  const handleScreenClick = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    
    if (target.closest('button') || 
        target.closest('.premium-controls') || 
        target.closest('.premium-top-controls') || 
        target.closest('.bottom-controls') || 
        target.closest('.progress-indicator')) {
      return;
    }
    
    togglePlayPause();
  }, [togglePlayPause]);

  // Audio management (same as original)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.3;
    audio.preload = isSlowDevice ? 'metadata' : 'auto';
    if (isSlowDevice) {
      audio.crossOrigin = 'anonymous';
    }
    
    const loadAndPlayTrack = (index: number) => {
      const track = musicTracks[index];
      if (track && audio.src !== window.location.origin + track) {
        audio.src = track;
        audio.load();
        
        const playWhenReady = () => {
          if (isMusicPlaying && isPlaying && audioInitialized) {
            audio.play().catch(err => {
              console.log('Audio play failed:', err.message);
            });
          }
        };
        
        if (audio.readyState >= 2) {
          playWhenReady();
        } else {
          audio.addEventListener('canplay', playWhenReady, { once: true });
        }
      }
    };

    const handleTrackEnd = () => {
      const nextIndex = (currentMusicIndex + 1) % musicTracks.length;
      setCurrentMusicIndex(nextIndex);
    };

    loadAndPlayTrack(currentMusicIndex);
    audio.addEventListener('ended', handleTrackEnd);

    return () => {
      audio.removeEventListener('ended', handleTrackEnd);
    };
  }, [currentMusicIndex, isMusicPlaying, musicTracks, audioInitialized, isPlaying, isSlowDevice]);

  // Auto-start audio when component mounts
  useEffect(() => {
    const startAudio = async () => {
      if (audioRef.current && isPlaying) {
        try {
          await audioRef.current.play();
          console.log('Audio started automatically');
        } catch (err) {
          console.log('Auto-start audio failed (browser policy):', err);
          // Some browsers require user interaction before playing audio
          // The music will start when user interacts with the page
        }
      }
    };

    // Small delay to ensure audio element is ready
    const timer = setTimeout(startAudio, 500);
    return () => clearTimeout(timer);
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMusicPlaying && isPlaying && audioInitialized) {
      if (audio.paused && audio.readyState >= 2) {
        audio.play().catch(err => {
          console.log('Audio play failed:', err.message);
        });
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [isMusicPlaying, isPlaying, audioInitialized]);

  // Auto-advance slideshow
  useEffect(() => {
    if (isPlaying && totalPhotos > 1) {
      intervalRef.current = setInterval(() => {
        navigatePhoto(1);
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
  }, [isPlaying, slideInterval, totalPhotos, navigatePhoto]);

  // Device performance detection
  useEffect(() => {
    const detectSlowDevice = () => {
      const connection = (navigator as any).connection;
      const isSlowConnection = connection && connection.effectiveType && 
        ['slow-2g', '2g', '3g'].includes(connection.effectiveType);
      const deviceMemory = (navigator as any).deviceMemory;
      const isLowMemory = deviceMemory && deviceMemory < 4;
      const isSlowCPU = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      return isSlowConnection || isLowMemory || isSlowCPU || (isMobile && window.innerWidth < 768);
    };
    
    setIsSlowDevice(detectSlowDevice());
  }, []);

  // Simple preloading
  useEffect(() => {
    if (totalPhotos === 0) return;

    // Preload current image and next few images
    const urlsToPreload: string[] = [];
    for (let i = Math.max(0, currentPhotoIndex - 2); i <= Math.min(imageUrls.length - 1, currentPhotoIndex + 3); i++) {
      urlsToPreload.push(imageUrls[i]);
    }

    preloadImages(urlsToPreload).then(() => {
      setPreloadedImages(prev => {
        const newSet = new Set(prev);
        urlsToPreload.forEach(url => newSet.add(url));
        return newSet;
      });
    });

  }, [currentPhotoIndex, imageUrls, totalPhotos]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          handleExit();
          break;
        case ' ':
          event.preventDefault();
          togglePlayPause();
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
  }, [handleExit, navigatePhoto, togglePlayPause]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      if (pauseIndicatorTimeoutRef.current) {
        clearTimeout(pauseIndicatorTimeoutRef.current);
      }
    };
  }, []);

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

  const formatDate = (date: string | Date) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Unknown date';
    }
  };

  return (
    <div 
      className="premium-view"
      style={{ cursor: showControls ? 'default' : 'none' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
      onClick={handleScreenClick}
    >
      {/* Background Audio */}
      <audio ref={audioRef} />


      {/* Main Photo Display */}
      <AnimatePresence>
        <motion.div
          key={currentPhoto.id}
          className="premium-photo-container"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: isSlowDevice ? 0.3 : 0.7, ease: "easeInOut" }}
        >
          <OptimizedImage
            src={currentPhoto.url}
            alt={currentPhoto.originalName}
            className="premium-photo"
            style={{
              willChange: isSlowDevice ? 'auto' : 'opacity, transform',
              backfaceVisibility: 'hidden',
              transform: 'translateZ(0)',
            }}
            onLoad={() => {
              setImageLoadingStates(prev => new Map(prev).set(currentPhotoIndex, 'loaded'));
            }}
            onError={() => {
              setImageLoadingStates(prev => new Map(prev).set(currentPhotoIndex, 'error'));
            }}
          />
          
          <motion.div
            className="photo-overlay-effect"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2 }}
          />

          {/* Pause Indicator */}
          <AnimatePresence>
            {!isPlaying && showPauseIndicator && (
              <motion.div
                className="pause-indicator"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="pause-icon">⏸️</div>
                <div className="pause-text">Paused</div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* Photo Information */}
      {editMode && (
        <motion.div
          className="premium-photo-info"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : 50 }}
          transition={{ duration: 0.3 }}
        >
          <h3>{currentPhoto.originalName}</h3>
          <p>{currentPhotoIndex + 1} of {totalPhotos} photos</p>
          {currentPhoto.metadata?.dateTaken && (
            <p>📅 {formatDate(currentPhoto.metadata.dateTaken)}</p>
          )}
          {currentPhoto.metadata?.location && (
            <p>📍 {currentPhoto.metadata.location.lat.toFixed(4)}, {currentPhoto.metadata.location.lng.toFixed(4)}</p>
          )}
          {state.selectedCategory && (
            <p className="category-name">
              {state.categories.find(cat => cat.id === state.selectedCategory)?.name || 'Category'}
            </p>
          )}
        </motion.div>
      )}

      {/* Top Right Controls */}
      <motion.div
        className="premium-top-controls"
        initial={{ opacity: 0 }}
        animate={{ opacity: showControls ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <button
          className={`top-control-btn ${editMode ? 'active' : ''}`}
          onClick={() => setEditMode(!editMode)}
          title="Toggle edit mode"
        >
          ✏️
        </button>
        <button
          className="top-control-btn exit-btn-top"
          onClick={handleExit}
          title="Exit Premium View"
        >
          ✕
        </button>
      </motion.div>

      {/* Navigation Controls */}
      <motion.div
        className="premium-controls"
        initial={{ opacity: 0 }}
        animate={{ opacity: showControls ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <button
          className="nav-btn nav-prev"
          onClick={() => navigatePhoto(-1)}
          disabled={totalPhotos <= 1}
        >
          ‹
        </button>

        <button
          className="nav-btn nav-next"
          onClick={() => navigatePhoto(1)}
          disabled={totalPhotos <= 1}
        >
          ›
        </button>

        {editMode && (
          <div className="bottom-controls">
            <div className="control-group">
              <button
                className="control-btn"
                onClick={togglePlayPause}
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
                className={`control-btn ${!isMusicPlaying ? 'muted' : ''}`}
                onClick={toggleMusic}
                title={isMusicPlaying ? 'Mute music' : 'Unmute music'}
              >
                {isMusicPlaying ? '🎵' : '🔇'}
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Progress Indicator */}
      <motion.div
        className="progress-indicator"
        initial={{ opacity: 0 }}
        animate={{ opacity: showControls ? 0.8 : 0.2 }}
        transition={{ duration: 0.3 }}
      >
        {photosByTime.map((_, index) => (
          <motion.div
            key={index}
            className={`progress-dot ${index === currentPhotoIndex ? 'active' : ''}`}
            onClick={() => jumpToPhoto(index)}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.8 }}
          />
        ))}
      </motion.div>

      {/* Animated background particles */}
      {!isSlowDevice && (
        <div className="background-particles">
          {[...Array(isSlowDevice ? 8 : 20)].map((_, index) => (
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
                opacity: [0, 0.3, 0]
              }}
              transition={{
                duration: Math.random() * 15 + 10,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PremiumTimeView;