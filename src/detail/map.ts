// The Leaflet map of a recording's GPS track. Leaflet is loaded from lib/leaflet.js as the global `L`.
import { cssVar } from "../dom";

export interface TrackMap {
  remove(): void;
  /** Shows the cursor dot at `point`, or hides it */
  showCursor(point: L.LatLngTuple | null): void;
  /** Highlights part of the track and zooms to it */
  highlight(points: L.LatLngTuple[]): void;
  /** Removes the highlight and zooms to the whole track */
  clearHighlight(): void;
  /** Re-reads the theme colors */
  applyTheme(): void;
}

export const leafletLoaded = () => typeof L !== "undefined";

/** Mouse within this many px of the track counts as hovering it */
const HOVER_DISTANCE = 26;

/**
 * Draws the track into the element with id `elementId`.
 * `onHover` gets the index into `points` of the track point under the mouse, or null.
 */
export function createTrackMap(
  elementId: string,
  points: L.LatLngTuple[],
  onHover: (pointIndex: number | null) => void,
): TrackMap {
  const map = L.map(elementId, {
    zoomControl: true,
    attributionControl: true,
    scrollWheelZoom: true,
  });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  // White casing under the track so it stands out on any map background
  L.polyline(points, {
    color: "#fff",
    weight: 7,
    opacity: 0.8,
    interactive: false,
  }).addTo(map);
  const track = L.polyline(points, {
    color: cssVar("--accent"),
    weight: 4,
    opacity: 0.95,
    interactive: false,
  }).addTo(map);
  const highlighted = L.polyline([], {
    color: cssVar("--s2"),
    weight: 5,
    opacity: 1,
    interactive: false,
  }).addTo(map);
  const endpoint = (point: L.LatLngTuple, colorVar: string, label: string) =>
    L.circleMarker(point, {
      radius: 6,
      color: "#fff",
      weight: 2,
      fillColor: cssVar(colorVar),
      fillOpacity: 1,
    })
      .bindTooltip(label)
      .addTo(map);
  endpoint(points[0], "--s6", "Start");
  endpoint(points[points.length - 1], "--s8", "Finish");
  const cursor = L.circleMarker(points[0], {
    radius: 7,
    color: "#fff",
    weight: 3,
    fillColor: cssVar("--text"),
    fillOpacity: 1,
    interactive: false,
  });
  const fitTrack = () =>
    map.fitBounds(track.getBounds(), { padding: [24, 24] });
  fitTrack();

  map.on("mousemove", (e) => {
    const mouse = e.containerPoint;
    let nearest: number | null = null,
      nearestDist = HOVER_DISTANCE ** 2;
    points.forEach((point, i) => {
      const p = map.latLngToContainerPoint(point);
      const dist = (p.x - mouse.x) ** 2 + (p.y - mouse.y) ** 2;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    onHover(nearest);
  });
  map.on("mouseout", () => onHover(null));

  return {
    remove: () => map.remove(),
    showCursor(point) {
      if (!point) {
        cursor.remove();
        return;
      }
      cursor.setLatLng(point);
      if (!map.hasLayer(cursor)) cursor.addTo(map);
    },
    highlight(part) {
      highlighted.setLatLngs(part);
      if (part.length > 1)
        map.fitBounds(L.latLngBounds(part), { padding: [30, 30], maxZoom: 17 });
    },
    clearHighlight() {
      highlighted.setLatLngs([]);
      fitTrack();
    },
    applyTheme() {
      track.setStyle({ color: cssVar("--accent") });
      highlighted.setStyle({ color: cssVar("--s2") });
    },
  };
}
