import { rssResponse } from '../lib/rss';

export const GET = (context: { site: URL }) => rssResponse('en', context.site);
