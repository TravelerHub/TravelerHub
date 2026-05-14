import { useEffect, useRef } from "react";

/**
 * LazyVideo
 *
 * A lightweight wrapper around <video> that defers loading and playback until
 * the element scrolls into view. Pauses playback when the element scrolls out
 * of view to keep CPU/network usage low.
 *
 * Use this for offscreen background/decorative videos. For the LCP/hero video,
 * keep an inline <video> with autoPlay so playback starts immediately.
 */
export default function LazyVideo({
  src,
  poster,
  className = "",
  rootMargin = "200px",
  threshold = 0.25,
  ...rest
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Best-effort play; ignore rejection (e.g. autoplay policy)
          const p = el.play();
          if (p && typeof p.catch === "function") p.catch(() => {});
        } else {
          el.pause();
        }
      },
      { rootMargin, threshold }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin, threshold]);

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      className={className}
      preload="none"
      muted
      loop
      playsInline
      {...rest}
    />
  );
}
