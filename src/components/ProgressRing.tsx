import { useId, useEffect, useRef } from "react";
import { motion, useAnimation } from "framer-motion";

const R    = 38;
const SIZE = 96;
const SW   = 8;
const C    = 2 * Math.PI * R; // ≈ 238.76

interface ProgressRingProps {
  completed: number;
  total:     number;
  celebrate: boolean;
}

export function ProgressRing({ completed, total, celebrate }: ProgressRingProps) {
  const gradId     = useId();
  const controls   = useAnimation();
  const celebrated = useRef(false);

  const progress   = total > 0 ? Math.min(completed / total, 1) : 0;
  const dashOffset = C * (1 - progress);

  // Trigger pulse exactly once when all tasks flip to done
  useEffect(() => {
    if (celebrate && !celebrated.current) {
      celebrated.current = true;
      controls.start({
        scale:  [1, 1.09, 1, 1.05, 1],
        transition: { duration: 0.65, ease: "easeInOut" },
      });
    }
    if (!celebrate) celebrated.current = false;
  }, [celebrate, controls]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.div animate={controls}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          aria-label={`${completed} of ${total} today's tasks complete`}
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="var(--user-mom)"   />
              <stop offset="100%" stopColor="var(--user-nurse)" />
            </linearGradient>
          </defs>

          {/* Track */}
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none"
            strokeWidth={SW}
            style={{ stroke: "var(--border)", opacity: 0.5 }}
          />

          {/* Progress arc */}
          <motion.circle
            cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={SW}
            strokeLinecap="round"
            strokeDasharray={C}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ type: "spring", stiffness: 70, damping: 18 }}
            style={progress > 0 ? { filter: "drop-shadow(0 0 5px var(--user-nurse))" } : undefined}
          />

          {/* Fraction */}
          <text
            x={SIZE / 2}
            y={SIZE / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="14"
            fontWeight="700"
            style={{ fill: "var(--foreground)", fontFamily: "inherit" }}
          >
            {total > 0 ? `${completed}/${total}` : "—"}
          </text>
        </svg>
      </motion.div>

      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Today's Tasks
      </span>
    </div>
  );
}
