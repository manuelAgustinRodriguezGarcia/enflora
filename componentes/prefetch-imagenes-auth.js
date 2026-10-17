"use client";

import { useEffect } from "react";
import { imagenesAuthTodas } from "@/lib/auth-imagenes";

export function PrefetchImagenesAuth() {
  useEffect(() => {
    imagenesAuthTodas.forEach((src) => {
      const imagen = new window.Image();
      imagen.decoding = "async";
      imagen.src = src;
    });
  }, []);

  return null;
}
