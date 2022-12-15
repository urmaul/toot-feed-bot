import { $log } from '@tsed/logger';
import { appConfig } from './config';

$log.name = appConfig.name;

export const logger = $log;