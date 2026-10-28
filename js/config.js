/* Where the online server lives.
   Leave SERVER empty when the page is served by the Cloudflare Worker itself (workers.dev or local `wrangler dev`).
   When the page is hosted on Netlify (e.g. knucklebomb.poor.camp), set it to the Worker's address after `npx wrangler deploy`,
   for example: export const SERVER='https://knucklebomb.YOUR-SUBDOMAIN.workers.dev'; */
export const SERVER='';
