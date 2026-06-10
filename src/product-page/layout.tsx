import type { ReactNode } from "react";
import "./styles.css";

export const metadata = {
  title: "Product — copy slot (t3)",
  description: "Description slot — t3 to fill",
};

export default function ProductPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="pp-root" data-theme="signature">
      <a className="pp-skip-link" href="#main">
        Skip to main content
      </a>
      {children}
    </div>
  );
}
