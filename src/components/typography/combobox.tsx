import { useMemo } from "react";

import { cn } from "@/utils/style";

import type { LocalFont, WebFont } from "./types";

import { Combobox, type MultiComboboxProps, type SingleComboboxProps } from "../ui/combobox";
import { FontDisplay } from "./font-display";
import webFontListJSON from "./webfontlist.json";

type Weight = "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";

const localFontList = [
  { type: "local", category: "sans-serif", family: "Arial", weights: ["400", "600", "700"] },
  { type: "local", category: "sans-serif", family: "Calibri", weights: ["400", "600", "700"] },
  { type: "local", category: "sans-serif", family: "Helvetica", weights: ["400", "600", "700"] },
  { type: "local", category: "sans-serif", family: "Tahoma", weights: ["400", "600", "700"] },
  { type: "local", category: "sans-serif", family: "Trebuchet MS", weights: ["400", "600", "700"] },
  { type: "local", category: "sans-serif", family: "Verdana", weights: ["400", "600", "700"] },
  { type: "local", category: "serif", family: "Bookman", weights: ["400", "600", "700"] },
  { type: "local", category: "serif", family: "Cambria", weights: ["400", "600", "700"] },
  { type: "local", category: "serif", family: "Garamond", weights: ["400", "600", "700"] },
  { type: "local", category: "serif", family: "Georgia", weights: ["400", "600", "700"] },
  { type: "local", category: "serif", family: "Palatino", weights: ["400", "600", "700"] },
  { type: "local", category: "serif", family: "Times New Roman", weights: ["400", "600", "700"] },
] as LocalFont[];

const webFontList = webFontListJSON as WebFont[];

function buildWebFontMap() {
  const webFontMap = new Map<string, WebFont>();

  for (const font of webFontList) {
    webFontMap.set(font.family, font);
  }

  return webFontMap;
}

const webFontMap: Map<string, WebFont> = buildWebFontMap();

export function getNextWeights(fontFamily: string): Weight[] | null {
  const fontData = webFontMap.get(fontFamily);
  if (!fontData) return null;

  const uniqueWeights = Array.from(new Set(fontData.weights)) as Weight[];
  const weights: Weight[] = ["400"];
  if (uniqueWeights.includes("600")) weights.push("600");

  while (weights.length < 2 && uniqueWeights.length > 0) {
    const candidate = uniqueWeights[uniqueWeights.length - 1];
    if (weights.includes(candidate)) break;
    weights.push(candidate);
  }

  return weights;
}

type FontFamilyComboboxProps = Omit<SingleComboboxProps, "options">;

export function FontFamilyCombobox({ className, ...props }: FontFamilyComboboxProps) {
  const options = useMemo(() => {
    return [...webFontList, ...localFontList].map((font: LocalFont | WebFont) => ({
      value: font.family,
      keywords: [font.family],
      label: <FontDisplay name={font.family} type={font.type} url={"preview" in font ? font.preview : undefined} />,
    }));
  }, []);

  return <Combobox {...props} options={options} className={cn("w-full", className)} />;
}

type FontWeightComboboxProps = Omit<MultiComboboxProps, "options" | "multiple"> & { fontFamily: string };

export function FontWeightCombobox({ fontFamily, ...props }: FontWeightComboboxProps) {
  const options = useMemo(() => {
    const webFontData = webFontMap.get(fontFamily);
    const localFontData = localFontList.find((font) => font.family === fontFamily);

    let weights: string[] = [];

    if (webFontData && Array.isArray(webFontData.weights) && webFontData.weights.length > 0) {
      weights = webFontData.weights as string[];
    } else if (localFontData && Array.isArray(localFontData.weights) && localFontData.weights.length > 0) {
      weights = localFontData.weights as string[];
    } else {
      // Fallback to all possible weights
      weights = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];
    }

    return weights.map((variant: string) => ({
      value: variant,
      label: variant,
      keywords: [variant],
    }));
  }, [fontFamily]);

  return <Combobox {...props} multiple options={options} />;
}
