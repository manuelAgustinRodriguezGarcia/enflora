"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

ScrollTrigger.config({
  ignoreMobileResize: true,
});

export { gsap, ScrollTrigger, useGSAP };
