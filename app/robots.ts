import type { MetadataRoute } from "next";
export default function robots():MetadataRoute.Robots{return {rules:[{userAgent:"*",allow:["/","/gioi-thieu","/chuong-trinh","/thoi-khoa-bieu","/dang-ky-tu-van"],disallow:["/cms/","/hoc-tap/","/api/","/tai-khoan"]}],sitemap:`${process.env.APP_URL||"http://localhost:4173"}/sitemap.xml`}}
