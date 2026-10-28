import { rssResponse } from '../lib/rss';

export const GET = (context: { site: URL }) => rssResponse('zh', context.site);
