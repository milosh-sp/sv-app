import type { usePanelRef } from "react-resizable-panels";

import { useCallback, useMemo } from "react";
import { useWindowSize } from "usehooks-ts";
import { create } from "zustand/react";

import { useIsMobile } from "@/hooks/use-mobile";

type PanelImperativeHandle = ReturnType<typeof usePanelRef>;

interface BuilderSidebarState {
  leftSidebar: PanelImperativeHandle | null;
  leftSheetOpen: boolean;
  rightSidebar: PanelImperativeHandle | null;
  rightSheetOpen: boolean;
}

interface BuilderSidebarActions {
  setLeftSidebar: (ref: PanelImperativeHandle | null) => void;
  setLeftSheetOpen: (open: boolean) => void;
  setRightSidebar: (ref: PanelImperativeHandle | null) => void;
  setRightSheetOpen: (open: boolean) => void;
}

type BuilderSidebar = BuilderSidebarState & BuilderSidebarActions;

export const useBuilderSidebarStore = create<BuilderSidebar>((set) => ({
  isDragging: false,
  leftSidebar: null,
  leftSheetOpen: false,
  rightSidebar: null,
  rightSheetOpen: false,
  setLeftSidebar: (ref) => set({ leftSidebar: ref }),
  setLeftSheetOpen: (open) => set({ leftSheetOpen: open }),
  setRightSidebar: (ref) => set({ rightSidebar: ref }),
  setRightSheetOpen: (open) => set({ rightSheetOpen: open }),
}));

type UseBuilderSidebarReturn = {
  maxSidebarSize: string | number;
  collapsedSidebarSize: number;
  isCollapsed: (side: "left" | "right") => boolean;
  toggleSidebar: (side: "left" | "right", forceState?: boolean) => void;
};

export function useBuilderSidebar<T = UseBuilderSidebarReturn>(selector?: (builder: UseBuilderSidebarReturn) => T): T {
  const isMobile = useIsMobile();
  const { width } = useWindowSize();

  const maxSidebarSize = useMemo((): string | number => {
    if (!width) return 0;
    return isMobile ? "95%" : "28%";
  }, [width, isMobile]);

  const collapsedSidebarSize = useMemo((): number => {
    if (!width) return 0;
    return isMobile ? 0 : 48;
  }, [width, isMobile]);

  const expandSize = useMemo(() => (isMobile ? "95%" : "22%"), [isMobile]);

  const isCollapsed = useCallback((side: "left" | "right") => {
    const sidebar =
      side === "left"
        ? useBuilderSidebarStore.getState().leftSidebar?.current
        : useBuilderSidebarStore.getState().rightSidebar?.current;

    if (!sidebar) return false;
    return sidebar.isCollapsed();
  }, []);

  const toggleSidebar = useCallback(
    (side: "left" | "right", forceState?: boolean) => {
      if (isMobile) {
        const sheetKey = side === "left" ? "leftSheetOpen" : "rightSheetOpen";
        const setterKey = side === "left" ? "setLeftSheetOpen" : "setRightSheetOpen";
        const isOpen = useBuilderSidebarStore.getState()[sheetKey];
        useBuilderSidebarStore.getState()[setterKey](forceState ?? !isOpen);
        return;
      }

      const sidebar =
        side === "left"
          ? useBuilderSidebarStore.getState().leftSidebar?.current
          : useBuilderSidebarStore.getState().rightSidebar?.current;

      if (!sidebar) return;

      const shouldExpand = forceState === undefined ? sidebar.isCollapsed() : forceState;

      if (shouldExpand) sidebar.resize(expandSize);
      else sidebar.collapse();
    },
    [expandSize, isMobile],
  );

  const state = useMemo(() => {
    return {
      maxSidebarSize,
      collapsedSidebarSize,
      isCollapsed,
      toggleSidebar,
    };
  }, [maxSidebarSize, collapsedSidebarSize, isCollapsed, toggleSidebar]);

  return selector ? selector(state) : (state as T);
}
