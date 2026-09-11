import type { Metadata } from "next"; import { getSiteSettings } from "@/lib/site";
import "./globals.css";
import "./learning-review.css";
export async function generateMetadata():Promise<Metadata>{
  try {
    const s=await getSiteSettings();
    const base=new URL(process.env.APP_URL||"http://localhost:4173");return {metadataBase:base,title:s.seoTitle,description:s.seoDescription,alternates:{canonical:"/"},icons:{icon:"/favicon.png"},openGraph:{title:s.seoTitle,description:s.seoDescription,siteName:"TEDUENGLISH",locale:"vi_VN",type:"website",images:["/teduenglish-logo.png"]}};
  } catch {
    return {title:"TEDUENGLISH | Better English, Brighter Futures",description:"Không gian học tiếng Anh có lộ trình cùng thầy Lê Hữu Thanh Toàn.",icons:{icon:"/favicon.png"}};
  }
}
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="vi"><body>{children}</body></html>; }
