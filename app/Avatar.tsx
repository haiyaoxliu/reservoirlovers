/** Strava serves a generic grey silhouette at avatar/athlete/*.png when the
 * user never uploaded a photo — treat it the same as having no URL at all. */
function isPlaceholder(url: string): boolean {
  return url.includes("avatar/athlete");
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function Avatar({
  url,
  name,
  color,
  size = 28,
}: {
  url: string | null;
  name: string;
  color?: string;
  size?: number;
}) {
  if (url && !isPlaceholder(url)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} style={{ borderRadius: size / 2 }} />;
  }
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: color ?? "#333c4a",
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.4),
        fontWeight: 600,
        letterSpacing: 0.5,
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {initials(name)}
    </span>
  );
}
