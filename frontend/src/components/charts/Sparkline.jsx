export default function Sparkline({ color, variant = 0 }) {
  return (
    <svg viewBox="0 0 200 55" aria-hidden="true">
      <path
        d={
          variant % 2
            ? "M2 44 C30 44 35 18 60 30 S94 48 120 21 S150 48 172 25 S190 30 198 7"
            : "M2 40 C25 16 35 47 58 25 S83 47 103 32 S127 0 145 23 S173 58 198 14"
        }
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
