"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function RedirigirAdminExpo() {
  const router = useRouter();

  useEffect(() => {
    const ir = () => {
      const hash = window.location.hash.replace(/^#/, "").replace(/\/+$/, "");
      if (hash === "expo-cannabis/admin" || hash === "admin/expo") router.replace("/admin/expo");
    };

    ir();
    window.addEventListener("hashchange", ir);
    return () => window.removeEventListener("hashchange", ir);
  }, [router]);

  return null;
}
