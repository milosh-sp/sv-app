import { APP_NAME } from "@/constants/brand";
import { cn } from "@/utils/style";

type Props = React.ComponentProps<"img"> & {
  variant?: "logo" | "icon";
  /**
   * When set, render only the light- or dark-theme asset regardless of the
   * current app theme. Useful on surfaces with a fixed background color (e.g.
   * an always-lime brand chip in the homepage header) where the default
   * theme-swap would produce poor contrast.
   */
  forceTheme?: "light" | "dark";
};

export function BrandIcon({ variant = "logo", forceTheme, className, ...props }: Props) {
  if (forceTheme) {
    return (
      <img
        src={`/${variant}/${forceTheme}.svg`}
        alt={APP_NAME}
        className={cn("size-12", className)}
        {...props}
      />
    );
  }

  return (
    <>
      <img
        src={`/${variant}/dark.svg`}
        alt={APP_NAME}
        className={cn("hidden size-12 dark:block", className)}
        {...props}
      />
      <img
        src={`/${variant}/light.svg`}
        alt={APP_NAME}
        className={cn("block size-12 dark:hidden", className)}
        {...props}
      />
    </>
  );
}
