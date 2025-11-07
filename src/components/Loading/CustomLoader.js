import { useEffect, useState, useCallback } from 'react';

const FADE_DURATION_MS = 300;

const CustomLoader = ({ isVisible = true, className = '' }) => {
  const [shouldRender, setShouldRender] = useState(isVisible);
  const [animationClass, setAnimationClass] = useState(
    isVisible ? 'fade-in' : 'fade-out'
  );

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setAnimationClass('fade-in');
    } else {
      setAnimationClass('fade-out');
    }
  }, [isVisible]);

  const handleAnimationEnd = useCallback(() => {
    if (!isVisible) {
      setShouldRender(false);
    }
  }, [isVisible]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={`loader-overlay ${animationClass} ${className}`.trim()}
      onAnimationEnd={handleAnimationEnd}
      role="status"
      aria-live="polite"
    >
      <div className="loader-content">
        <div className="logo-mask" aria-hidden="true" />
        <img
          src="/images/loading_car.png"
          alt="Loading indicator"
          className="logo-car"
          draggable="false"
        />
      </div>
      <style jsx>{`
        .loader-overlay {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fff;
          z-index: 9999;
          animation-duration: ${FADE_DURATION_MS}ms;
          animation-fill-mode: forwards;
          animation-timing-function: ease;
        }

        .fade-in {
          animation-name: fadeIn;
        }

        .fade-out {
          animation-name: fadeOut;
        }

        .loader-content {
          position: relative;
          width: min(420px, 80vw);
          max-width: 420px;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .logo-base {
          width: 100%;
          height: auto;
          user-select: none;
        }

        .logo-mask {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          width: 100%;
          background: #fff;
          animation: sweep 4s ease-in-out infinite;
        }

        .logo-car {
          position: absolute;
          top: 50%;
          left: -35.0586%;
          width: 35.0586%;
          height: auto;
          transform: translateY(-50%);
          animation: carSlide 4s ease-in-out infinite;
          object-fit: contain;
          pointer-events: none;
        }

        @keyframes carSlide {
          0% {
            left: -35.0586%;
          }
          45% {
            left: 57.03125%;
          }
          50% {
            left: 57.03125%;
          }
          95% {
            left: -35.0586%;
          }
          100% {
            left: -35.0586%;
          }
        }

        @keyframes sweep {
          0% {
            transform: translateX(0%);
          }
          45% {
            transform: translateX(100%);
          }
          50% {
            transform: translateX(100%);
          }
          95% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(0%);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        @media (max-width: 480px) {
          .loader-content {
            width: 90vw;
          }
        }
      `}</style>
    </div>
  );
};

export default CustomLoader;
