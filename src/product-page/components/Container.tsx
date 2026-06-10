import type { ReactNode } from "react";

type ContainerProps = {
  width?: "narrow" | "default" | "wide";
  children: ReactNode;
};

export function Container({ width = "default", children }: ContainerProps) {
  return <div className={`pp-container pp-container--${width}`}>{children}</div>;
}
