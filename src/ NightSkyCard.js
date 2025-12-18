import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./NightSkyCard.css";

// Monterey, CA (fixed for “business card” simplicity)
const LOCATION = { latitude: 36.6002, longitude: -121.8947 };

// Slider range (edit freely)
const RANGE_START = "1980-01-01";
const RANGE_END = "2000-12-31";

// Celebrity fallback set (you can swap these to “celebrity birthdays”, iconic dates, whatever)
const CELEB_FALLBACKS = [
  { label: "Prince Sky (1984-06-07)", date: "1984-06-07" },
  { label: "Madonna Sky (1985-09-14)", date: "1985-09-14" },
  { label: "Whitney Sky (1991-02-10)", date: "1991-02-10" },
  { label: "MJ Sky (1993-08-10)", date: "1993-08-10" },
];

function parseISO(s) {
  return new Date(`${s}T00:00:00Z`);
}
function toISO(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function daysBetween(a, b) {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}
function addDays(isoStart, days) {
  const d = parseISO(isoStart);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}
function pretty(iso) {
  return parseISO(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function cacheKey({ date, style }) {
  return `starchart:v1:${date}:${LOCATION.latitude}:${LOCATION.longitude}:${style}`;
}

export default function NightSkyCard() {
  // View direction (kept simple; you can expose these later if you want)
  const ra = 10;
  const dec = 20;
  const zoom = 3;

  // Date slider
  const totalDays = useMemo(() => daysBetween(RANGE_START, RANGE_END), []);
  const [dayOffset, setDayOffset] = useState(() => clamp(daysBetween(RANGE_START, "1990-04-20"), 0, totalDays));
  const date = useMemo(() => addDays(RANGE_START, dayOffset), [dayOffset]);

  // UI toggles
  const [labelsOn, setLabelsOn] = useState(true);
  const style = labelsOn ? "default" : "no_labels"; // pattern: adjust to whatever AstronomyAPI supports

  // Data
  const [imageUrl, setImageUrl] = useState(null);
  const [status, setStatus] = useState("Idle");
  const [source, setSource] = useState("—");
  const [imgLoaded, setImgLoaded] = useState(false);
  const inFlightKeyRef = useRef(null);

  async function loadChart(targetDate, { allowCache = true, fromFallback = false } = {}) {
    setStatus("Generating star chart…");
    setImgLoaded(false);

    const key = cacheKey({ date: targetDate, style });
    if (inFlightKeyRef.current === key) return;
    inFlightKeyRef.current = key;
    if (allowCache) {
      const cached = localStorage.getItem(key);
      if (cached) {
        setImageUrl(cached);
        setStatus("Loaded.");
        setSource(fromFallback ? "Celebrity cache" : "Cache");
        inFlightKeyRef.current = null;
        return;
      }
    }

    try {
      const res = await fetch("/api/star-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          style,
          observer: { ...LOCATION, date: targetDate },
          view: {
            type: "area",
            parameters: {
              position: { equatorial: { rightAscension: ra, declination: dec } },
              zoom,
            },
          },
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const json = await res.json();
      const url = json?.data?.imageUrl || json?.data?.image_url;
      if (!url) throw new Error("No imageUrl in response.");

      localStorage.setItem(key, url);
      setImageUrl(url);
      setStatus("Loaded.");
      setSource(fromFallback ? "Celebrity fallback (AstronomyAPI)" : "AstronomyAPI");
    } catch (e) {
      console.error(e);

      if (!fromFallback) {
        // Fallback: pick a “celebrity sky”
        const pick = CELEB_FALLBACKS[Math.floor(Math.random() * CELEB_FALLBACKS.length)];
        setStatus("API slow/unavailable — showing a celebrity sky.");
        setSource(`Fallback: ${pick.label}`);
        await loadChart(pick.date, { allowCache: true, fromFallback: true });
      } else {
        setStatus("Unable to load star chart.");
        setSource("—");
      }
    } finally {
      inFlightKeyRef.current = null;
    }
  }

  // Refresh when date or labels toggle changes
  useEffect(() => {
    loadChart(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, style]);

  function handlePrint() {
    window.print();
  }

  return (
    <section className="nsk-card">
      <header className="nsk-header">
        <div>
          <h1>Night Sky</h1>
          <p>Monterey, CA • {pretty(date)} (UTC)</p>
        </div>

        <div className="nsk-actions">
          <button type="button" className="nsk-btn" onClick={() => setLabelsOn(v => !v)}>
            Labels: {labelsOn ? "On" : "Off"}
          </button>
          <button type="button" className="nsk-btn" onClick={handlePrint}>
            Print
          </button>
        </div>
      </header>

      <div className="nsk-slider">
        <label>Date slider</label>
        <input
          type="range"
          min={0}
          max={totalDays}
          value={dayOffset}
          onChange={(e) => setDayOffset(Number(e.target.value))}
        />
        <div className="nsk-slider-hint">
          {RANGE_START} → {RANGE_END}
        </div>
      </div>

      <div className="nsk-canvas">
        <AnimatePresence mode="wait">
          {imageUrl ? (
            <motion.img
              key={imageUrl}
              src={imageUrl}
              alt="Star chart"
              onLoad={() => setImgLoaded(true)}
              initial={{ opacity: 0, scale: 1.01 }}
              animate={{ opacity: imgLoaded ? 1 : 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            />
          ) : (
            <motion.div
              key="loading"
              className="nsk-loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {status}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="nsk-meta">
        <div>
          <span>Status</span>
          <strong>{status}</strong>
        </div>
        <div>
          <span>Coordinates</span>
          <strong>{LOCATION.latitude.toFixed(4)}° N, {Math.abs(LOCATION.longitude).toFixed(4)}° W</strong>
        </div>
        <div>
          <span>Source</span>
          <strong>{source}</strong>
        </div>

        <button type="button" className="nsk-btn nsk-refresh" onClick={() => loadChart(date, { allowCache: false })}>
          Refresh
        </button>
      </footer>

      <p className="nsk-note">
        This widget is meant to be embedded on your portfolio “business card” page. It’s quiet, visual, and memorable —
        a conversation starter that also signals you can ship real UI.
      </p>
    </section>
  );
}
