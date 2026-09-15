const FALLBACK_HOST = 'leaper-lake.vercel.app'

function headerValue(headers, name) {
  if (!headers) return undefined
  const lowerCaseName = name.toLowerCase()
  const key = Object.keys(headers).find((header) => header.toLowerCase() === lowerCaseName)
  const value = key ? headers[key] : undefined
  return Array.isArray(value) ? value[0] : value
}

function publicHost(request) {
  const forwardedHost = headerValue(request.headers, 'x-forwarded-host')
  const host = (forwardedHost || headerValue(request.headers, 'host') || FALLBACK_HOST)
    .split(',')[0]
    .trim()

  return /^[a-z0-9.-]+(?::\d+)?$/i.test(host) ? host : FALLBACK_HOST
}

function publicProtocol(request, host) {
  const forwardedProtocol = headerValue(request.headers, 'x-forwarded-proto')
  const protocol = (forwardedProtocol || '').split(',')[0].trim().toLowerCase()
  if (protocol === 'http' || protocol === 'https') return protocol
  return host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https'
}

export function getPublicSiteUrl(request) {
  const host = publicHost(request)
  return `${publicProtocol(request, host)}://${host}`
}

export function createSitemapXml(siteUrl) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${siteUrl}/</loc>\n  </url>\n</urlset>\n`
}

export function createRobotsTxt(siteUrl) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`
}
