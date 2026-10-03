import {
  ArticleIcon,
  BooksIcon,
  BriefcaseIcon,
  CertificateIcon,
  ChartLineIcon,
  CodeSimpleIcon,
  CompassToolIcon,
  DiamondsFourIcon,
  DownloadIcon,
  EnvelopeSimpleIcon,
  FileCssIcon,
  FootballIcon,
  GraduationCapIcon,
  HandHeartIcon,
  ImageIcon,
  LayoutIcon,
  MessengerLogoIcon,
  NotepadIcon,
  PaletteIcon,
  PhoneIcon,
  ReadCvLogoIcon,
  ShareFatIcon,
  StarIcon,
  TextTIcon,
  TranslateIcon,
  TrophyIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
}));

import { getSectionIcon, getSectionTitle, type SidebarSection } from "./section";

const sections: Array<[SidebarSection | "cover-letter", string, unknown]> = [
  ["picture", "Picture", ImageIcon],
  ["basics", "Basics", UserIcon],
  ["summary", "Summary", ArticleIcon],
  ["profiles", "Profiles", MessengerLogoIcon],
  ["experience", "Experience", BriefcaseIcon],
  ["education", "Education", GraduationCapIcon],
  ["projects", "Projects", CodeSimpleIcon],
  ["skills", "Skills", CompassToolIcon],
  ["languages", "Languages", TranslateIcon],
  ["interests", "Interests", FootballIcon],
  ["awards", "Awards", TrophyIcon],
  ["certifications", "Certifications", CertificateIcon],
  ["publications", "Publications", BooksIcon],
  ["volunteer", "Volunteer", HandHeartIcon],
  ["references", "References", PhoneIcon],
  ["custom", "Custom Sections", StarIcon],
  ["cover-letter", "Cover Letter", EnvelopeSimpleIcon],
  ["template", "Template", DiamondsFourIcon],
  ["layout", "Layout", LayoutIcon],
  ["typography", "Typography", TextTIcon],
  ["design", "Design", PaletteIcon],
  ["page", "Page", ReadCvLogoIcon],
  ["css", "Custom CSS", FileCssIcon],
  ["notes", "Notes", NotepadIcon],
  ["sharing", "Sharing", ShareFatIcon],
  ["statistics", "Statistics", ChartLineIcon],
  ["export", "Export", DownloadIcon],
];

describe("resume section titles and icons", () => {
  it("maps every sidebar section to its title and icon", () => {
    for (const [type, title, icon] of sections) {
      expect(getSectionTitle(type)).toBe(title);
      const node = getSectionIcon(type, { className: "extra" });
      expect(node).toMatchObject({ type: icon, props: { className: expect.stringContaining("extra") } });
    }
  });
});
