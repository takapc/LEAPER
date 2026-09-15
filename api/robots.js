import { createRobotsTxt, getPublicSiteUrl } from './site-indexing.js'

export default function robotsHandler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    response.status(405).end()
    return
  }

  response.setHeader('Content-Type', 'text/plain; charset=utf-8')
  response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600')
  response.status(200).send(createRobotsTxt(getPublicSiteUrl(request)))
}
