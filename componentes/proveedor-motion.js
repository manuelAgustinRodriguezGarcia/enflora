"use client";

import { MotionConfig } from "motion/react";
import { transicionRapida } from "@/lib/animaciones";

export function ProveedorMotion({ children }) {
  return (
    <MotionConfig reducedMotion="user" transition={transicionRapida}>
      {children}
    </MotionConfig>
  );
}
