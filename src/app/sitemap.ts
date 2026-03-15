import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://arcadiax.de',
      lastModified: new Date(),
    },
    {
      url: 'https://arcadiax.de/releases',
      lastModified: new Date(),
    },
    {
      url: 'https://arcadiax.de/profile',
      lastModified: new Date(),
    },
  ]
}