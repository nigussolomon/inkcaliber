export type ThemeColor = "light" | "dark";

export type Theme = {
  theme: ThemeColor;
  bgColor: string | undefined;
};

export const getStoredTheme = (): Theme => {
  const theme = localStorage.getItem("theme") as ThemeColor | null;
  const bgColor = localStorage.getItem("bgColor") as string | undefined;
  if (theme === "dark" || theme === "light") return {
    theme,
    bgColor
  };
  return {
    theme: "dark",
    bgColor: undefined
  };
};

export const setStoredTheme = (theme: ThemeColor) => {
  localStorage.setItem("theme", theme);
  window.location.reload();
};

export const setStoredBgColor = (bgColor: string | undefined) => {
  if(bgColor === undefined) return;
  localStorage.setItem("bgColor", bgColor);
  window.location.reload();
};
