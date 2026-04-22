import { CometCard } from "@/components/animation/comet-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/style";

type BaseCardProps = React.ComponentProps<"div"> & {
  title: string;
  description: string;
  tags?: string[];
  className?: string;
  children?: React.ReactNode;
  /** Renders in an absolute top bar above the main content (e.g. card actions). */
  header?: React.ReactNode;
};

export function BaseCard({ title, description, tags, className, children, header, ...props }: BaseCardProps) {
  return (
    <CometCard translateDepth={3} rotateDepth={6}>
      <div
        {...props}
        className={cn(
          "relative flex aspect-page size-full overflow-hidden rounded-md bg-popover shadow transition-shadow hover:shadow-xl",
          className,
        )}
      >
        {header && (
          <div className="absolute inset-x-0 top-0 z-20 flex w-full border-b border-white/10 bg-black/55 text-white backdrop-blur-xs">
            {header}
          </div>
        )}

        {children}

        <div className="absolute inset-x-0 bottom-0 flex w-full flex-col justify-end space-y-0.5 bg-background/40 px-4 py-3 backdrop-blur-xs">
          <h3 className="truncate font-medium tracking-tight">{title}</h3>
          <p className="truncate text-xs opacity-80">{description}</p>

          <div className={cn("mt-2 hidden flex-wrap items-center gap-1", tags && tags.length > 0 && "flex")}>
            {tags?.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </CometCard>
  );
}
