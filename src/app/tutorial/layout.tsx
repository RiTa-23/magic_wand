import type { ReactNode } from "react";
import styles from "./tutorial-theme.module.css";

export default function TutorialLayout({ children }: { children: ReactNode }) {
  return <div className={styles.theme}>{children}</div>;
}
