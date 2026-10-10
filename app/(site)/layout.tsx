import SiteShell from "@/components/site/SiteShell";
import Splash from "@/components/site/Splash";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Splash />
      <SiteShell>{children}</SiteShell>
    </>
  );
}
