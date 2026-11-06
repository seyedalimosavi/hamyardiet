import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/calories"],
      disallow: ["/api/"],
    },
    sitemap: "https://nutriclinic.ir/sitemap.xml",
  };
}
