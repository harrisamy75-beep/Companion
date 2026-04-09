import { createContext, useContext } from "react";

export const LogoutContext = createContext<(() => void) | null>(null);

export function useLogout() {
  return useContext(LogoutContext);
}
