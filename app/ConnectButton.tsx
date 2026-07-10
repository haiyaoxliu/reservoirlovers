export function ConnectButton({
  label = "Connect with Strava",
  href = "/api/auth/strava",
}: {
  label?: string;
  href?: string;
}) {
  return (
    <a
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: "#fc4c02",
        color: "#fff",
        fontWeight: 600,
        padding: "12px 20px",
        borderRadius: 10,
      }}
    >
      {label}
    </a>
  );
}
