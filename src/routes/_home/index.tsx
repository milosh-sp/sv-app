import { createFileRoute } from "@tanstack/react-router";

import { FAQ } from "./-sections/faq";
import { Features } from "./-sections/features";
import { Footer } from "./-sections/footer";
import { Hero } from "./-sections/hero";
import { Prefooter } from "./-sections/prefooter";
import { Statistics } from "./-sections/statistics";
import { Templates } from "./-sections/templates";

export const Route = createFileRoute("/_home/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <main id="main-content" className="relative overflow-x-clip">
      <Hero />

      <div className="relative">
        <Statistics />
        <Features />
        <Templates />
        <FAQ />
        <Prefooter />
        <Footer />
      </div>
    </main>
  );
}
