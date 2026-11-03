import 'dotenv/config';
import { DataSource } from 'typeorm';
import { getDatabaseOptions } from './database.config';

export default new DataSource(getDatabaseOptions());
