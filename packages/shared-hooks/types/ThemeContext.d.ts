import { ReactNode } from 'react';

interface ThemeContextValue {
  isDarkMode: boolean;
  setIsDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  toggleDarkMode: () => void;
}

declare const ThemeContext: React.Context<ThemeContextValue | undefined>;

export interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element;
export function useTheme(): ThemeContextValue;
export default ThemeContext;
