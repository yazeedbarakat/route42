import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme";

export function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      onClick={toggleTheme}
      title={isLight ? "Switch to Dark Theme" : "Switch to Light Theme"}
      className="theme-sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
    >
      {isLight ? (
        <Moon size={17} className="shrink-0" />
      ) : (
        <Sun size={17} className="shrink-0" />
      )}
      <span className="text-sm font-medium">
        {isLight ? "Dark Theme" : "Light Theme"}
      </span>
    </button>
  );
}
