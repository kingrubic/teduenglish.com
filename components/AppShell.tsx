import Link from "next/link";
import { logout } from "@/lib/actions";
import type { Actor } from "@/lib/auth";
import { getSiteSettings } from "@/lib/site";
import { MENU_ITEMS } from "@/lib/menu";
import { getAccessibleMenuKeys } from "@/lib/permissions";

const roleLabels={ADMIN:"Admin",MOD:"Mod",USER:"User"} as const;

export async function AppShell({actor,children}:{actor:Actor;children:React.ReactNode}){
  const [site,keys]=await Promise.all([getSiteSettings(),getAccessibleMenuKeys(actor)]);
  const menus=MENU_ITEMS.filter(item=>keys.has(item.key));
  const preferredScope=actor.role==="USER"&&!menus.some(item=>item.scope==="cms")?"portal":"cms";
  const visible=menus.filter(item=>item.scope===preferredScope);
  const alternate=menus.find(item=>item.scope!==preferredScope);
  return <div className="app-shell"><aside className="sidebar">
    <Link className="brand sidebar-brand" href={visible[0]?.href||"/khong-co-quyen"}><span className="brand-mark">LT</span><span>{site.brandName}</span></Link>
    <small className="account-label">{actor.name} · {roleLabels[actor.role]}</small>
    <nav>{visible.map(item=><Link key={item.key} href={item.href}>{item.label}</Link>)}</nav>
    {alternate&&<Link className="portal-switch" href={alternate.href}>{preferredScope==="cms"?"Mở cổng cá nhân":"Mở khu quản trị"} ↗</Link>}
    <Link className="portal-switch" href="/tai-khoan">Đổi mật khẩu</Link>
    <form action={logout}><button className="button secondary" type="submit">Đăng xuất</button></form>
  </aside><main className="content">{children}</main></div>;
}
