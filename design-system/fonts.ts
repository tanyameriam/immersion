import localFont from "next/font/local";

// Brand typography - opt-in only. Not applied anywhere by default; apply the
// `font-satoshi` / `font-sardin` utility explicitly on a component when asked.
export const satoshi = localFont({
  variable: "--font-satoshi",
  display: "swap",
  src: [
    { path: "./fonts/satoshi/Satoshi-Light.otf", weight: "300", style: "normal" },
    { path: "./fonts/satoshi/Satoshi-LightItalic.otf", weight: "300", style: "italic" },
    { path: "./fonts/satoshi/Satoshi-Regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/satoshi/Satoshi-Italic.otf", weight: "400", style: "italic" },
    { path: "./fonts/satoshi/Satoshi-Medium.otf", weight: "500", style: "normal" },
    { path: "./fonts/satoshi/Satoshi-MediumItalic.otf", weight: "500", style: "italic" },
    { path: "./fonts/satoshi/Satoshi-Bold.otf", weight: "700", style: "normal" },
    { path: "./fonts/satoshi/Satoshi-BoldItalic.otf", weight: "700", style: "italic" },
    { path: "./fonts/satoshi/Satoshi-Black.otf", weight: "900", style: "normal" },
    { path: "./fonts/satoshi/Satoshi-BlackItalic.otf", weight: "900", style: "italic" },
  ],
});

// NOTE: bundled font file is a DEMO cut - personal-use only per its license
// (see `design-system/brand-source/Sardin/Readme (DEMO).txt`). Needs a
// commercial license from PandekaStudio before this ships on the live, paid
// Layrrrd site.
export const sardin = localFont({
  variable: "--font-sardin",
  display: "swap",
  src: [{ path: "./fonts/sardin/Sardin-DEMO.otf", weight: "700", style: "normal" }],
});
