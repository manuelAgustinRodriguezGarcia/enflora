import { ProveedorDemo } from "@/componentes/demo/proveedor-demo";
import { SalidaDemo } from "@/componentes/demo/salida-demo";

export const metadata = {
  title: "Demo",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LayoutDemo({ children }) {
  return (
    <ProveedorDemo>
      <SalidaDemo />
      {children}
    </ProveedorDemo>
  );
}
