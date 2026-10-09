"use client";

import { Children, isValidElement } from "react";
import { motion } from "motion/react";
import { itemLista } from "@/lib/animaciones";

export function ListaEntrada({ children, className = "lista" }) {
  const items = Children.toArray(children);

  return (
    <motion.ul className={className} initial="oculto" animate="visible">
      {items.map((item, indice) => {
        if (!isValidElement(item)) return item;
        return (
          <motion.li
            key={item.key}
            className={item.props.className}
            custom={indice}
            variants={itemLista}
            initial="oculto"
            animate="visible"
          >
            {item.props.children}
          </motion.li>
        );
      })}
    </motion.ul>
  );
}
