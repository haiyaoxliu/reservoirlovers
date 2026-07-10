"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Units = "km" | "mi";
type Theme = "dark" | "light";
type MapWindow = "normal" | "wide";
type Display = "detail" | "clean";

const SettingsContext = createContext<{
  units: Units;
  theme: Theme;
  /** How many timeline date columns the map window spans: normal 4, wide 8. */
  mapWindow: MapWindow;
  /** "clean" hides section headers and secondary text. */
  display: Display;
  setUnits: (u: Units) => void;
  setTheme: (t: Theme) => void;
  setMapWindow: (w: MapWindow) => void;
  setDisplay: (d: Display) => void;
}>({
  units: "km",
  theme: "dark",
  mapWindow: "normal",
  display: "detail",
  setUnits: () => {},
  setTheme: () => {},
  setMapWindow: () => {},
  setDisplay: () => {},
});

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [units, setUnitsState] = useState<Units>("km");
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mapWindow, setMapWindowState] = useState<MapWindow>("normal");
  const [display, setDisplayState] = useState<Display>("detail");

  // localStorage is read after mount so the server render (km/dark) hydrates
  // cleanly; the theme itself is applied pre-paint by the inline script in
  // layout.tsx, so there is no visual flash.
  useEffect(() => {
    try {
      if (localStorage.getItem("rl-units") === "mi") setUnitsState("mi");
      if (localStorage.getItem("rl-theme") === "light") setThemeState("light");
      if (localStorage.getItem("rl-map-window") === "wide") setMapWindowState("wide");
      if (localStorage.getItem("rl-display") === "clean") setDisplayState("clean");
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
  const setDisplay = (d: Display) => {
    setDisplayState(d);
    try {
      localStorage.setItem("rl-display", d);
    } catch {}
  };

  return (
    <SettingsContext.Provider
      value={{ units, theme, mapWindow, display, setUnits, setTheme, setMapWindow, setDisplay }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

/** Renders children only in "detail" display mode — for section headers and
 *  other secondary chrome that "clean" hides. */
export function DetailOnly({ children }: { children: React.ReactNode }) {
  const { display } = useSettings();
  return display === "detail" ? <>{children}</> : null;
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

/** Header buttons: settings gear (opens the modal) and sign-out. */
export function HeaderActions() {
  const [open, setOpen] = useState(false);
  const { units, theme, mapWindow, display, setUnits, setTheme, setMapWindow, setDisplay } =
    useSettings();

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button aria-label="Settings" title="Settings" onClick={() => setOpen(true)} style={iconButtonStyle}>
        <GearIcon />
      </button>
      <form action="/api/auth/logout" method="post">
        <button type="submit" aria-label="Sign out" title="Sign out" style={iconButtonStyle}>
          <LogoutIcon />
        </button>
      </form>

      {open ? (
        <div
          onClick={() => setOpen(false)}
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
              background: "var(--panel-2)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 20,
              minWidth: 260,
              maxWidth: 340,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Settings</div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 14 }}>Units</span>
              <Segmented
                value={units}
                options={[
                  { v: "km", label: "km" },
                  { v: "mi", label: "mi" },
                ]}
                onChange={setUnits}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 14 }}>Theme</span>
              <Segmented
                value={theme}
                options={[
                  { v: "dark", label: "Dark" },
                  { v: "light", label: "Light" },
                ]}
                onChange={setTheme}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 14 }}>Map window</span>
              <Segmented
                value={mapWindow}
                options={[
                  { v: "normal", label: "Normal" },
                  { v: "wide", label: "Wide" },
                ]}
                onChange={setMapWindow}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <span style={{ fontSize: 14 }}>Display</span>
              <Segmented
                value={display}
                options={[
                  { v: "detail", label: "Detail" },
                  { v: "clean", label: "Clean" },
                ]}
                onChange={setDisplay}
              />
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                marginTop: 18,
                background: "transparent",
                color: "var(--muted)",
                border: "1px solid var(--border-btn)",
                borderRadius: 8,
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
