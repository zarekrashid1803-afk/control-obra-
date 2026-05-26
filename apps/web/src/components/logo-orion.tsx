type Props = {
  className?: string;
  /** Color: por defecto hereda con currentColor (negro sobre fondo claro, blanco sobre oscuro) */
  color?: string;
};

/**
 * Logo "Proyect Orion" — wordmark con brackets, "Proyect" en bold sólido + "Orion" con outline.
 * Render como SVG inline (escala perfecto, sin dependencia de fuentes externas).
 */
export function LogoOrion({ className = 'h-12 w-auto', color = 'currentColor' }: Props) {
  return (
    <svg
      viewBox="0 0 360 130"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Proyect Orion"
      className={className}
    >
      {/* Bracket izquierdo [ */}
      <path
        d="M 32 14 L 14 14 L 14 116 L 32 116"
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinejoin="miter"
        strokeLinecap="square"
      />
      {/* Bracket derecho ] */}
      <path
        d="M 328 14 L 346 14 L 346 116 L 328 116"
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinejoin="miter"
        strokeLinecap="square"
      />

      {/* "Proyect" — bold, fill sólido */}
      <text
        x="40"
        y="74"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="58"
        fontWeight="900"
        fill={color}
        letterSpacing="-2"
      >
        Proyect
      </text>

      {/* "Orion" — outline (stroke sin fill) */}
      <text
        x="210"
        y="110"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="34"
        fontWeight="600"
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        letterSpacing="0.5"
      >
        Orion
      </text>
    </svg>
  );
}
