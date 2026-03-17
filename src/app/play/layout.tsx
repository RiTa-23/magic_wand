import type { ReactNode } from "react";
import styles from "./play-theme.module.css";

export default function PlayLayout({ children }: { children: ReactNode }) {
  return <div className={styles.theme}>{children}</div>;
}
