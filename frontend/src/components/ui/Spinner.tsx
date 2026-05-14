export default function Spinner(props: { size?: number; label?: string }) {
  const sz = props.size ?? 20;
  return (
    <span
      class="spinner"
      role="status"
      aria-label={props.label ?? "Se încarcă"}
      style={`width:${sz}px;height:${sz}px;display:inline-block;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:bs-spin 0.7s linear infinite`}
    />
  );
}
