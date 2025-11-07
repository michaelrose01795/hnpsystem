import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";

const FADE_DURATION_MS = 300;

const DEFAULT_TARGET_SELECTOR = "[data-loader-region]";

const CustomLoader = ({
  isVisible = true,
  className = "",
  targetSelector = DEFAULT_TARGET_SELECTOR,
}) => {
  const [shouldRender, setShouldRender] = useState(isVisible);
  const [animationClass, setAnimationClass] = useState(
    isVisible ? "fade-in" : "fade-out"
  );
  const [targetNode, setTargetNode] = useState(null);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setAnimationClass("fade-in");
    } else {
      setAnimationClass("fade-out");
    }
  }, [isVisible]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let observer;

    const resolveTarget = () => {
      if (!targetSelector) {
        return document.body;
      }
      return document.querySelector(targetSelector) || document.body;
    };

    const nextTarget = resolveTarget();
    setTargetNode(nextTarget);

    if (targetSelector && nextTarget === document.body) {
      observer = new MutationObserver(() => {
        const scoped = document.querySelector(targetSelector);
        if (scoped) {
          setTargetNode(scoped);
          observer.disconnect();
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => observer?.disconnect();
  }, [targetSelector, isVisible]);

  const handleAnimationEnd = useCallback(() => {
    if (!isVisible) {
      setShouldRender(false);
    }
  }, [isVisible]);

  if (!shouldRender) {
    return null;
  }

  const overlay = (
    <div
      className={`loader-overlay ${animationClass} ${className}`.trim()}
      onAnimationEnd={handleAnimationEnd}
      role="status"
      aria-live="polite"
    >
      <div className="loader-content" aria-hidden="true">
        <div className="loader-glass" />
        <img
          src="/images/loading_car.png"
          alt="Loading indicator"
          className="loader-car"
          draggable="false"
        />
      </div>
      <style jsx>{`
        .loader-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.45),
            rgba(255, 214, 214, 0.35)
          );
          backdrop-filter: blur(6px);
          WebkitBackdropFilter: blur(6px);
          border-radius: inherit;
          z-index: 30;
          pointer-events: none;
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
          width: min(260px, 60vw);
          height: min(260px, 60vw);
          display: flex;
          justify-content: center;
          align-items: center;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.6);
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.12);
          overflow: hidden;
        }

        .loader-glass {
          position: absolute;
          inset: 0;
          background: radial-gradient(
              circle at 30% 30%,
              rgba(255, 255, 255, 0.9),
              transparent 65%
            ),
            rgba(255, 115, 115, 0.25);
          animation: shimmer 5s ease-in-out infinite;
          filter: blur(0.5px);
        }

        .loader-car {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 70%;
          height: auto;
          transform: translate(-50%, -50%);
          animation: carSlide 4s ease-in-out infinite;
          object-fit: contain;
          pointer-events: none;
          filter: drop-shadow(0 8px 20px rgba(0, 0, 0, 0.2));
        }

        @keyframes carSlide {
          0% {
            transform: translate(-60%, -50%);
          }
          50% {
            transform: translate(-40%, -53%);
          }
          100% {
            transform: translate(-60%, -50%);
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(20%);
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
            width: 70vw;
            height: 70vw;
          }
        }
      `}</style>
    </div>
  );

  if (targetNode) {
    return createPortal(overlay, targetNode);
  }

  return overlay;
};

export default CustomLoader;
