import { $log } from '@tsed/logger';

$log.name = 'TootFeedBot';
$log.level = process.env.LOG_LEVEL || "info";

export const logger = $log;