import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/utils/style";

const textClassName = cn("fill-transparent text-3xl leading-none font-bold tracking-tight");

type TextMaskEffectProps = {
  text: string;
  duration?: number;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
  /**
   * First stop of the reveal gradient shown on cursor hover.
   * Defaults to a neutral neon lime.
   */
  accentFrom?: string;
  /**
   * Second stop of the reveal gradient shown on cursor hover.
   * Defaults to a hot magenta.
   */
  accentTo?: string;
  /**
   * Tailwind class controlling the outline text stroke color.
   * Callers can override this to match their surface.
   */
  strokeClassName?: string;
};

export const TextMaskEffect = ({
  text,
  duration = 6,
  className,
  "aria-hidden": ariaHidden,
  accentFrom = "#c6ff00",
  accentTo = "#ff3d81",
  strokeClassName = "stroke-zinc-300 dark:stroke-zinc-700",
}: TextMaskEffectProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [maskPosition, setMaskPosition] = useState({ cx: "50%", cy: "50%" });

  useEffect(() => {
    if (svgRef.current && cursor.x !== null && cursor.y !== null) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const cxPercentage = ((cursor.x - svgRect.left) / svgRect.width) * 100;
      const cyPercentage = ((cursor.y - svgRect.top) / svgRect.height) * 100;

      setMaskPosition({ cx: `${cxPercentage}%`, cy: `${cyPercentage}%` });
    }
  }, [cursor]);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox="0 0 300 40"
      aria-hidden={ariaHidden}
      className={cn("select-none", className)}
      xmlns="http://www.w3.org/2000/svg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={(e) => {
        setCursor({ x: e.clientX, y: e.clientY });
      }}
    >
      <defs>
        <linearGradient id="textGradient" gradientUnits="userSpaceOnUse" cx="50%" cy="50%" r="25%">
          {hovered && (
            <>
              <stop offset="0%" stopColor={accentFrom} />
              <stop offset="100%" stopColor={accentTo} />
            </>
          )}
        </linearGradient>

        <motion.radialGradient
          r="20%"
          id="revealMask"
          animate={maskPosition}
          gradientUnits="userSpaceOnUse"
          initial={{ cx: "50%", cy: "50%" }}
          transition={{ duration: 0, ease: "easeOut" }}
        >
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </motion.radialGradient>

        <mask id="textMask">
          <rect x="0" y="0" width="100%" height="100%" fill="url(#revealMask)" />
        </mask>
      </defs>

      <text
        x="50%"
        y="50%"
        strokeWidth="0.3"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ opacity: hovered ? 0.7 : 0 }}
        className={cn(textClassName, strokeClassName)}
      >
        {text}
      </text>

      <motion.text
        x="50%"
        y="50%"
        strokeWidth="0.3"
        textAnchor="middle"
        dominantBaseline="middle"
        transition={{ duration, ease: "easeInOut" }}
        initial={{ strokeDashoffset: 1000, strokeDasharray: 1000 }}
        whileInView={{ strokeDashoffset: 0, strokeDasharray: 1000 }}
        className={cn(textClassName, strokeClassName)}
      >
        {text}
      </motion.text>

      <text
        x="50%"
        y="50%"
        strokeWidth="0.3"
        textAnchor="middle"
        mask="url(#textMask)"
        dominantBaseline="middle"
        stroke="url(#textGradient)"
        className={cn(textClassName)}
      >
        {text}
      </text>
    </svg>
  );
};
