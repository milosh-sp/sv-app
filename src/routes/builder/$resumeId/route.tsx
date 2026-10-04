import type React from "react";

import { Trans } from "@lingui/react/macro";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { orpc } from "@/integrations/orpc/client";

import { BuilderHeader } from "./-components/header";
import { BuilderSidebarLeft } from "./-sidebar/left";
import { BuilderSidebarRight } from "./-sidebar/right";
import { useBuilderSidebar, useBuilderSidebarStore } from "./-store/sidebar";

export const Route = createFileRoute("/builder/$resumeId")({
  component: RouteComponent,
  beforeLoad: async ({ context, location }) => {
    if (!context.session) throw redirect({ to: "/auth/login", replace: true });
    if (!context.session.user.emailVerified) {
      throw redirect({
        to: "/auth/verify-email",
        search: { callbackURL: location.href },
        replace: true,
      });
    }

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
    meta: loaderData ? [{ title: `${loaderData.name} - Skill Verdict` }] : undefined,
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
    // ponytail: a focus refetch must not wipe edits still waiting on the debounced save
    initialize(resume);
    return () => initialize(null);
  }, [resumeId, initialize]);

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
  const historyRevision = useResumeStore((state) => state.historyRevision);

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

  if (isMobile) return <MobileBuilderLayout {...props} />;

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
          <BuilderSidebarLeft key={historyRevision} />
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
          <BuilderSidebarRight key={historyRevision} />
        </ResizablePanel>
      </ResizableGroup>
    </div>
  );
}

function MobileBuilderLayout(props: React.ComponentProps<"div">) {
  const historyRevision = useResumeStore((state) => state.historyRevision);
  const leftSheetOpen = useBuilderSidebarStore((state) => state.leftSheetOpen);
  const rightSheetOpen = useBuilderSidebarStore((state) => state.rightSheetOpen);
  const setLeftSheetOpen = useBuilderSidebarStore((state) => state.setLeftSheetOpen);
  const setRightSheetOpen = useBuilderSidebarStore((state) => state.setRightSheetOpen);

  return (
    <div className="h-svh overflow-hidden" {...props}>
      <BuilderHeader />

      <main className="h-svh">
        <Outlet />
      </main>

      <Sheet open={leftSheetOpen} onOpenChange={setLeftSheetOpen}>
        <SheetContent
          side="left"
          className="w-[min(100dvw,28rem)] gap-0 overflow-hidden p-0 pb-[env(safe-area-inset-bottom)] sm:max-w-none"
        >
          <SheetHeader className="h-14 shrink-0 justify-center border-b px-4 py-0">
            <SheetTitle>
              <Trans>Content</Trans>
            </SheetTitle>
          </SheetHeader>

          <BuilderSidebarLeft key={historyRevision} />
        </SheetContent>
      </Sheet>

      <Sheet open={rightSheetOpen} onOpenChange={setRightSheetOpen}>
        <SheetContent
          side="right"
          className="w-[min(100dvw,28rem)] gap-0 overflow-hidden p-0 pb-[env(safe-area-inset-bottom)] sm:max-w-none"
        >
          <SheetHeader className="h-14 shrink-0 justify-center border-b px-4 py-0">
            <SheetTitle>
              <Trans>Design</Trans>
            </SheetTitle>
          </SheetHeader>

          <BuilderSidebarRight key={historyRevision} />
        </SheetContent>
      </Sheet>
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
  .validator(incomingLayoutSchema)
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
