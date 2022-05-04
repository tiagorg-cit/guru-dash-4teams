import { logger } from '../../shared/logger';
import axios from 'axios';

export async function getQuery(config:any, url: string){
    config['timeout'] = 5000;
    const res = await axios.get(url, config);
    return res;
}