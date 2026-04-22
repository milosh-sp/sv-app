import { createFileRoute } from "@tanstack/react-router";

import { FAQ } from "./-sections/faq";
import { Features } from "./-sections/features";
import { Footer } from "./-sections/footer";
import { Hero } from "./-sections/hero";
import { HowItWorks } from "./-sections/how-it-works";
import { Statistics } from "./-sections/statistics";
import { Templates } from "./-sections/templates";

export const Route = createFileRoute("/_home/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <main id="main-content" className="relative">
      <Hero />

      <div className="container mx-auto px-4 sm:px-6 lg:px-12">
        <div className="flex flex-col gap-12 py-12 xl:gap-16 xl:py-16">
          <Statistics />
          <HowItWorks />
          <Features />
          <Templates />
          <FAQ />
          <Footer />
        </div>
      </div>
    </main>
  );
}
