import { AxiosResponse } from 'axios';
import axios from 'axios';
import { logger } from '../shared/logger';
import { IGalaxyMetadataConnector } from './galaxy.types';

export async function sendToGalaxy<T = any>(metadata: any, method: string, body?: any): Promise<AxiosResponse<T> | undefined> {
    try {
        const galaxyConnector: IGalaxyMetadataConnector = metadata?.connectors?.galaxy;
        if(!galaxyConnector){
            const msg = `Galaxy connector is not present for this metadata!`;
            logger.error(msg);
            return Promise.reject(msg);
        }

        const galaxyHost = process.env.GALAXY_HOST || "";
        const galaxyApiUrl: string = metadata?.connectors?.galaxy.apiUrl;
        const galaxyApiKey: string = metadata?.connectors?.galaxy.apiKey;
        const galaxyUrlToCall = getUrlToCall(galaxyHost, galaxyApiUrl);
        const fnAxios = getMethod(method);

        logger.info(`Sending items to galaxy api ${galaxyApiUrl}`);

        return fnAxios<T>(
            galaxyUrlToCall, body, { headers: { 'gops-api-key': galaxyApiKey } }
        );
    } catch (err: any) {
        logger.error(err, `Error sending items to Galaxy`);
    }
}

function getUrlToCall(host:string, path: string) {
    if(!host || host.length == 0){
        throw new Error("Galaxy HOST is not present in configuration");
    }
    if(!path || path.length == 0){
        throw new Error("Galaxy API PATH is not present in configuration");
    }
    return host + '/' + path;
}

function getMethod(method:string) {
    if(method?.toLowerCase() === "get"){
        return axios.get;
    } else if (method?.toLowerCase() === "post"){
        return axios.post;
    }
    return axios.get;
}  