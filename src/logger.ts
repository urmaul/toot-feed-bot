import { $log } from '@tsed/logger';

$log.name = process.env.APP_NAME || 'TootFeedBot';

export const logger = $log;