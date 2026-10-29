import "@/estilos/app-autenticada.scss";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function LayoutPrivado({ children }) {
  return children;
}
