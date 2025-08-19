import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Photo } from '../../firebase/firestore';
import { downloadSinglePhoto, prepareForPrint, printSizes } from '../../utils/downloadUtils';

interface PhotoModalProps {
  photo: Photo;
  photos: Photo[];
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

const PhotoModal: React.FC<PhotoModalProps> = ({
  photo,
  photos,
  onClose,
  onNext,
  onPrevious
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showInfo, setShowInfo] = useState(false);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [lastTap, setLastTap] = useState(0);
  const [showMobileHint, setShowMobileHint] = useState(false);

  useEffect(() => {
    // Show mobile hint on small screens
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      setShowMobileHint(true);
      const timer = setTimeout(() => setShowMobileHint(false), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          onPrevious();
          break;
        case 'ArrowRight':
          onNext();
          break;
        case 'i':
        case 'I':
          setShowInfo(!showInfo);
          break;
        case '+':
        case '=':
          setZoom(prev => Math.min(prev * 1.2, 5));
          break;
        case '-':
          setZoom(prev => Math.max(prev / 1.2, 0.5));
          break;
        case '0':
          setZoom(1);
          setPan({ x: 0, y: 0 });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onClose, onNext, onPrevious, showInfo]);

  const handleDownload = async () => {
    try {
      await downloadSinglePhoto(photo);
    } catch (error) {
      console.error('Error downloading photo:', error);
    }
  };

  const handlePrint = async (printSizeIndex: number) => {
    try {
      const printSize = printSizes[printSizeIndex];
      const printUrl = await prepareForPrint(photo, printSize);
      
      const printWindow = window.open('');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head><title>Print ${photo.originalName}</title></head>
            <body style="margin:0;padding:0;">
              <img src="${printUrl}" style="width:100%;height:100%;object-fit:contain;" />
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (error) {
      console.error('Error preparing for print:', error);
    }
    setShowPrintOptions(false);
  };

  const formatDate = (date: any): string => {
    if (!date) return 'Unknown';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleString();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle double tap to close on mobile
  const handleTouchEnd = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (lastTap && (now - lastTap) < DOUBLE_TAP_DELAY) {
      onClose();
    } else {
      setLastTap(now);
    }
  };

  return (
    <motion.div
      className="photo-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="photo-modal"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <h3>{photo.originalName}</h3>
            <span className="photo-index">
              {photos.findIndex(p => p.id === photo.id) + 1} of {photos.length}
            </span>
          </div>
          
          <div className="modal-actions">
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => setShowInfo(!showInfo)}
              title="Info (I)"
            >
              ℹ️
            </button>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={handleDownload}
              title="Download"
            >
              ⬇️
            </button>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => setShowPrintOptions(!showPrintOptions)}
              title="Print"
            >
              🖨️
            </button>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Navigation */}
        {photos.length > 1 && (
          <>
            <button 
              className="nav-btn nav-prev"
              onClick={onPrevious}
              title="Previous (←)"
            >
              ←
            </button>
            <button 
              className="nav-btn nav-next"
              onClick={onNext}
              title="Next (→)"
            >
              →
            </button>
          </>
        )}

        {/* Image Container */}
        <div className="photo-container" onTouchEnd={handleTouchEnd}>
          <motion.img
            src={photo.url}
            alt={photo.originalName}
            className="modal-photo"
            style={{
              scale: zoom,
              x: pan.x,
              y: pan.y,
            }}
            drag={zoom > 1}
            onDrag={(e, info) => {
              setPan({
                x: pan.x + info.delta.x,
                y: pan.y + info.delta.y,
              });
            }}
          />
        </div>

        {/* Zoom Controls */}
        <div className="zoom-controls">
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => setZoom(prev => Math.max(prev / 1.2, 0.5))}
            title="Zoom out (-)"
          >
            −
          </button>
          <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => setZoom(prev => Math.min(prev * 1.2, 5))}
            title="Zoom in (+)"
          >
            +
          </button>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            title="Reset (0)"
          >
            Reset
          </button>
        </div>

        {/* Info Panel */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              className="info-panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
            >
              <h4>Photo Information</h4>
              <div className="info-grid">
                <div className="info-item">
                  <span className="label">Filename:</span>
                  <span className="value">{photo.originalName}</span>
                </div>
                <div className="info-item">
                  <span className="label">Size:</span>
                  <span className="value">{formatFileSize(photo.metadata.size)}</span>
                </div>
                <div className="info-item">
                  <span className="label">Dimensions:</span>
                  <span className="value">
                    {photo.metadata.width} × {photo.metadata.height}
                  </span>
                </div>
                <div className="info-item">
                  <span className="label">Type:</span>
                  <span className="value">{photo.metadata.type}</span>
                </div>
                <div className="info-item">
                  <span className="label">Uploaded:</span>
                  <span className="value">{formatDate(photo.createdAt)}</span>
                </div>
                {photo.tags.length > 0 && (
                  <div className="info-item">
                    <span className="label">Tags:</span>
                    <div className="tags">
                      {photo.tags.map((tag, index) => (
                        <span key={index} className="tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Hint */}
        <AnimatePresence>
          {showMobileHint && (
            <motion.div
              className="mobile-hint"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="hint-content-modal">
                <span className="tap-icon">👆</span>
                <p>Double tap photo to close</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Print Options */}
        <AnimatePresence>
          {showPrintOptions && (
            <motion.div
              className="print-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
            >
              <h4>Print Sizes</h4>
              <div className="print-sizes">
                {printSizes.map((size, index) => (
                  <button
                    key={index}
                    className="print-size-btn"
                    onClick={() => handlePrint(index)}
                  >
                    <span className="size-name">{size.name}</span>
                    <span className="size-details">
                      {size.width}" × {size.height}" at {size.dpi} DPI
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

export default PhotoModal;