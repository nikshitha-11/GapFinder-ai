import "./globals.css";
export const metadata = { title: "GapFinder AI", description: "Find what you don't know you don't know." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
