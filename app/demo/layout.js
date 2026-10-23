import { ProveedorDemo } from "@/componentes/demo/proveedor-demo";

export const metadata = {
  title: "Demo",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LayoutDemo({ children }) {
  return <ProveedorDemo>{children}</ProveedorDemo>;
}
