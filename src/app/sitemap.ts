import { MetadataRoute } from "next";
import { getSeedData } from "../../server/engine/pipeline.js";

export default function sitemap(): MetadataRoute.Sitemap {
  const seed = getSeedData();
  const baseUrl = "https://nutriclinic.ir";
  const foodUrls = (seed.general_foods || []).map((f: any) => ({
    url: `${baseUrl}/calories/${f.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/calories`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...foodUrls,
  ];
}
