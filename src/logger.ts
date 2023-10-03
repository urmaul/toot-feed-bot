import { $log } from '@tsed/logger';

$log.name = 'TootFeedBot';
$log.level = process.env.LOG_LEVEL || 'info';

export const logger = $log;

export const moduled = (module: string, f: () => void) => {
    $log.name = module;
    f();
    $log.name = 'TootFeedBot';
} 