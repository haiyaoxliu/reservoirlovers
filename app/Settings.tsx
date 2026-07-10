"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Units = "km" | "mi";
type Theme = "dark" | "light";
type MapWindow = "normal" | "wide";

/** Individually toggleable pieces of secondary chrome. All default to shown. */
export interface DetailPrefs {
  /** Section header stripes (leaderboard columns, timeline help, map pills). */
  headers: boolean;
  /** Leaderboard rank numbers and avatars; off also shrinks names. */
  rowChrome: boolean;
  /** Leaderboard PR / distance / loop-count columns; off enlarges the
   *  watermark tier numbers to carry the counts. */
  statColumns: boolean;
  /** Date-range text next to the map window slider. */
  sliderDates: boolean;
  /** Second line (date · activity) in the selection detail panel. */
  detailMeta: boolean;
  /** Timeline header row: the year/month/day stack plus the Strava mark. */
  timelineDates: boolean;
  /** Colour tint on the active member's timeline row. */
  userHighlight: boolean;
}

const DEFAULT_PREFS: DetailPrefs = {
  headers: true,
  rowChrome: true,
  statColumns: true,
  sliderDates: true,
  detailMeta: true,
  timelineDates: true,
  userHighlight: true,
};

const SettingsContext = createContext<{
  units: Units;
  theme: Theme;
  /** How many timeline date columns the map window spans: normal 4, wide 8. */
  mapWindow: MapWindow;
  prefs: DetailPrefs;
  setUnits: (u: Units) => void;
  setTheme: (t: Theme) => void;
  setMapWindow: (w: MapWindow) => void;
  setPref: (key: keyof DetailPrefs, value: boolean) => void;
}>({
  units: "km",
  theme: "dark",
  mapWindow: "normal",
  prefs: DEFAULT_PREFS,
  setUnits: () => {},
  setTheme: () => {},
  setMapWindow: () => {},
  setPref: () => {},
});

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [units, setUnitsState] = useState<Units>("km");
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mapWindow, setMapWindowState] = useState<MapWindow>("normal");
  const [prefs, setPrefsState] = useState<DetailPrefs>(DEFAULT_PREFS);

  // localStorage is read after mount so the server render hydrates cleanly;
  // theme and row-chrome CSS are applied pre-paint by the layout.tsx script.
  useEffect(() => {
    try {
      if (localStorage.getItem("rl-units") === "mi") setUnitsState("mi");
      if (localStorage.getItem("rl-theme") === "light") setThemeState("light");
      if (localStorage.getItem("rl-map-window") === "wide") setMapWindowState("wide");
      const stored = JSON.parse(localStorage.getItem("rl-detail") ?? "{}");
      setPrefsState({ ...DEFAULT_PREFS, ...stored });
    } catch {}
  }, []);

  const setUnits = (u: Units) => {
    setUnitsState(u);
    try {
      localStorage.setItem("rl-units", u);
    } catch {}
  };
  const setTheme = (t: Theme) => {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem("rl-theme", t);
    } catch {}
  };
  const setMapWindow = (w: MapWindow) => {
    setMapWindowState(w);
    try {
      localStorage.setItem("rl-map-window", w);
    } catch {}
  };
  const setPref = (key: keyof DetailPrefs, value: boolean) => {
    setPrefsState((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "rowChrome") {
        document.documentElement.dataset.rowchrome = value ? "on" : "off";
      }
      try {
        localStorage.setItem("rl-detail", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  return (
    <SettingsContext.Provider
      value={{ units, theme, mapWindow, prefs, setUnits, setTheme, setMapWindow, setPref }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

/** Renders children only when the given detail preference is shown. */
export function DetailOnly({
  pref,
  children,
}: {
  pref: keyof DetailPrefs;
  children: React.ReactNode;
}) {
  const { prefs } = useSettings();
  return prefs[pref] ? <>{children}</> : null;
}

const KM_PER_MI = 1.609344;

/** A distance in the viewer's preferred unit, e.g. "96.2 km" or "59.8 mi".
 *  With `bare`, just the number — for columns whose header carries the unit. */
export function Distance({ km, bare = false }: { km: number; bare?: boolean }) {
  const { units } = useSettings();
  const value = units === "km" ? km.toFixed(1) : (km / KM_PER_MI).toFixed(1);
  return <>{bare ? value : `${value} ${units}`}</>;
}

/** The viewer's preferred distance unit, e.g. for column headers. */
export function DistanceUnit() {
  const { units } = useSettings();
  return <>{units}</>;
}

function GearIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/** The standard sign-out glyph: an arrow leaving a frame to the right. */
function LogoutIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/** Sliders glyph for the detail-visibility controls. */
function SlidersIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

const iconButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 34,
  height: 34,
  background: "transparent",
  color: "var(--muted)",
  border: "1px solid var(--border-btn)",
  borderRadius: 8,
  cursor: "pointer",
  padding: 0,
};

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        border: "1px solid var(--border-btn)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          style={{
            padding: "6px 16px",
            fontSize: 13,
            border: "none",
            cursor: "pointer",
            background: value === o.v ? "var(--accent)" : "transparent",
            color: value === o.v ? "#04121f" : "var(--muted)",
            fontWeight: value === o.v ? 600 : 400,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 30,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          background: "var(--panel-2)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 20,
          minWidth: 280,
          maxWidth: 360,
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 26,
            height: 26,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            color: "var(--muted)",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 12,
      }}
    >
      <span style={{ fontSize: 14 }}>{label}</span>
      {children}
    </div>
  );
}

const DETAIL_TOGGLES: { key: keyof DetailPrefs; label: string }[] = [
  { key: "headers", label: "Section headers" },
  { key: "rowChrome", label: "Rank & avatars" },
  { key: "statColumns", label: "Stat columns" },
  { key: "timelineDates", label: "Timeline dates" },
  { key: "sliderDates", label: "Slider dates" },
  { key: "detailMeta", label: "Selection info" },
  { key: "userHighlight", label: "User highlight" },
];

/** Header buttons: detail visibility controls, settings, and sign-out. */
export function HeaderActions() {
  const [openSettings, setOpenSettings] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const { units, theme, mapWindow, prefs, setUnits, setTheme, setMapWindow, setPref } =
    useSettings();

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        aria-label="Detail visibility"
        title="Detail visibility"
        onClick={() => setOpenDetail(true)}
        style={iconButtonStyle}
      >
        <SlidersIcon />
      </button>
      <button
        aria-label="Settings"
        title="Settings"
        onClick={() => setOpenSettings(true)}
        style={iconButtonStyle}
      >
        <GearIcon />
      </button>
      <form action="/api/auth/logout" method="post">
        <button type="submit" aria-label="Sign out" title="Sign out" style={iconButtonStyle}>
          <LogoutIcon />
        </button>
      </form>

      {openDetail ? (
        <Modal onClose={() => setOpenDetail(false)}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Detail visibility</div>
          <Row label="Everything">
            <Segmented
              value={
                DETAIL_TOGGLES.every((t) => prefs[t.key])
                  ? "show"
                  : DETAIL_TOGGLES.every((t) => !prefs[t.key])
                    ? "hide"
                    : ("" as "show" | "hide")
              }
              options={[
                { v: "show", label: "Show" },
                { v: "hide", label: "Hide" },
              ]}
              onChange={(v) => DETAIL_TOGGLES.forEach((t) => setPref(t.key, v === "show"))}
            />
          </Row>
          <div style={{ borderTop: "1px solid var(--border)", margin: "0 0 12px" }} />
          {DETAIL_TOGGLES.map((t) => (
            <Row key={t.key} label={t.label}>
              <Segmented
                value={prefs[t.key] ? "show" : "hide"}
                options={[
                  { v: "show", label: "Show" },
                  { v: "hide", label: "Hide" },
                ]}
                onChange={(v) => setPref(t.key, v === "show")}
              />
            </Row>
          ))}
        </Modal>
      ) : null}

      {openSettings ? (
        <Modal onClose={() => setOpenSettings(false)}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Settings</div>
          <Row label="Units">
            <Segmented
              value={units}
              options={[
                { v: "km", label: "km" },
                { v: "mi", label: "mi" },
              ]}
              onChange={setUnits}
            />
          </Row>
          <Row label="Theme">
            <Segmented
              value={theme}
              options={[
                { v: "dark", label: "Dark" },
                { v: "light", label: "Light" },
              ]}
              onChange={setTheme}
            />
          </Row>
          <Row label="Map window">
            <Segmented
              value={mapWindow}
              options={[
                { v: "normal", label: "Normal" },
                { v: "wide", label: "Wide" },
              ]}
              onChange={setMapWindow}
            />
          </Row>
        </Modal>
      ) : null}
    </div>
  );
}
