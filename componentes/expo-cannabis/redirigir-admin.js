"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function RedirigirAdminExpo() {
  const router = useRouter();

  useEffect(() => {
    const ir = () => {
      const hash = window.location.hash.replace(/^#/, "").replace(/\/+$/, "");
      if (hash === "expo-cannabis/admin") router.replace("/expo-cannabis/admin");
    };

    ir();
    window.addEventListener("hashchange", ir);
    return () => window.removeEventListener("hashchange", ir);
  }, [router]);

  return null;
}
