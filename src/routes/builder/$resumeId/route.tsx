import type React from "react";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { useEffect } from "react";
import { type Layout, usePanelRef } from "react-resizable-panels";
import { useDebounceCallback } from "usehooks-ts";
import z from "zod";

import { LoadingScreen } from "@/components/layout/loading-screen";
import { useCSSVariables } from "@/components/resume/hooks/use-css-variables";
import { useResumeStore } from "@/components/resume/store/resume";
import { ResizableGroup, ResizablePanel, ResizableSeparator } from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import { orpc } from "@/integrations/orpc/client";

import { BuilderHeader } from "./-components/header";
import { BuilderSidebarLeft } from "./-sidebar/left";
import { BuilderSidebarRight } from "./-sidebar/right";
import { useBuilderSidebar, useBuilderSidebarStore } from "./-store/sidebar";

export const Route = createFileRoute("/builder/$resumeId")({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    if (!context.session) throw redirect({ to: "/auth/login", replace: true });
    return { session: context.session };
  },
  loader: async ({ params, context }) => {
    const [layout, resume] = await Promise.all([
      getBuilderLayoutServerFn(),
      context.queryClient.ensureQueryData(orpc.resume.getById.queryOptions({ input: { id: params.resumeId } })),
    ]);

    return { layout, name: resume.name };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.name} - Reactive Resume` }] : undefined,
  }),
});

function RouteComponent() {
  const { layout: initialLayout } = Route.useLoaderData();

  const { resumeId } = Route.useParams();
  const { data: resume } = useSuspenseQuery(orpc.resume.getById.queryOptions({ input: { id: resumeId } }));

  const style = useCSSVariables(resume.data);
  const isReady = useResumeStore((state) => state.isReady);
  const initialize = useResumeStore((state) => state.initialize);

  useEffect(() => {
    initialize(resume);
    return () => initialize(null);
  }, [resume, initialize]);

  if (!isReady) return <LoadingScreen />;

  return <BuilderLayout style={style} initialLayout={initialLayout} />;
}

type BuilderLayoutProps = React.ComponentProps<"div"> & {
  initialLayout: Layout;
};

function BuilderLayout({ initialLayout, ...props }: BuilderLayoutProps) {
  const isMobile = useIsMobile();

  const leftSidebarRef = usePanelRef();
  const rightSidebarRef = usePanelRef();

  const setLeftSidebar = useBuilderSidebarStore((state) => state.setLeftSidebar);
  const setRightSidebar = useBuilderSidebarStore((state) => state.setRightSidebar);

  const { maxSidebarSize, collapsedSidebarSize } = useBuilderSidebar((state) => ({
    maxSidebarSize: state.maxSidebarSize,
    collapsedSidebarSize: state.collapsedSidebarSize,
  }));

  const onLayoutChange = useDebounceCallback((layout: Layout) => {
    void setBuilderLayoutServerFn({
      data: { left: layout.left, artboard: layout.artboard, right: layout.right },
    });
  }, 200);

  useEffect(() => {
    if (!leftSidebarRef || !rightSidebarRef) return;

    setLeftSidebar(leftSidebarRef);
    setRightSidebar(rightSidebarRef);
  }, [leftSidebarRef, rightSidebarRef, setLeftSidebar, setRightSidebar]);

  const leftSidebarSize = isMobile ? 0 : initialLayout.left;
  const rightSidebarSize = isMobile ? 0 : initialLayout.right;
  const artboardSize = isMobile ? 100 : initialLayout.artboard;

  return (
    <div className="flex h-svh flex-col" {...props}>
      <BuilderHeader />

      <ResizableGroup orientation="horizontal" className="mt-14 flex-1" onLayoutChange={onLayoutChange}>
        <ResizablePanel
          collapsible
          id="left"
          panelRef={leftSidebarRef}
          maxSize={maxSidebarSize}
          minSize={collapsedSidebarSize * 2}
          collapsedSize={collapsedSidebarSize}
          defaultSize={leftSidebarSize}
          className="z-20 h-[calc(100svh-3.5rem)]"
        >
          <BuilderSidebarLeft />
        </ResizablePanel>
        <ResizableSeparator withHandle className="z-50 border-s" />
        <ResizablePanel id="artboard" defaultSize={artboardSize} className="h-[calc(100svh-3.5rem)]">
          <Outlet />
        </ResizablePanel>
        <ResizableSeparator withHandle className="z-50 border-e" />
        <ResizablePanel
          collapsible
          id="right"
          panelRef={rightSidebarRef}
          maxSize={maxSidebarSize}
          minSize={collapsedSidebarSize * 2}
          collapsedSize={collapsedSidebarSize}
          defaultSize={rightSidebarSize}
          className="z-20 h-[calc(100svh-3.5rem)]"
        >
          <BuilderSidebarRight />
        </ResizablePanel>
      </ResizableGroup>
    </div>
  );
}

type BuilderLayout = {
  left: number;
  artboard: number;
  right: number;
};

const defaultLayout: BuilderLayout = { left: 14, artboard: 72, right: 14 };
const BUILDER_LAYOUT_COOKIE_NAME = "builder_layout";

const storedLayoutSchema = z.object({
  left: z.number(),
  artboard: z.number(),
  right: z.number(),
});

const incomingLayoutSchema = z
  .union([
    storedLayoutSchema,
    z.tuple([z.number(), z.number(), z.number()]).transform(([left, artboard, right]) => ({ left, artboard, right })),
  ])
  .transform((layout) => {
    const total = layout.left + layout.artboard + layout.right;
    if (total <= 0) return defaultLayout;

    return {
      left: (layout.left / total) * 100,
      artboard: (layout.artboard / total) * 100,
      right: (layout.right / total) * 100,
    };
  });

const setBuilderLayoutServerFn = createServerFn({ method: "POST" })
  .inputValidator(incomingLayoutSchema)
  .handler(async ({ data }) => {
    setCookie(BUILDER_LAYOUT_COOKIE_NAME, JSON.stringify(data));
  });

const getBuilderLayoutServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const layout = getCookie(BUILDER_LAYOUT_COOKIE_NAME);
  if (!layout) return defaultLayout;

  try {
    return incomingLayoutSchema.parse(JSON.parse(layout));
  } catch {
    return defaultLayout;
  }
});
