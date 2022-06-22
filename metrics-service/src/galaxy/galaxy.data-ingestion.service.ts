
import { randomUUID } from 'crypto';
import axios from 'axios';
import { logger } from '../shared/logger';
import { IGalaxyMetadataConnector, IGalaxyDeployments, IGalaxyDataIngestionDeployment, IGalaxyDataIngestionMetadataConnector } from './galaxy.types';

export async function sendToGalaxyDataIngestion(metadata: any, method: string, deploysToGalaxy: IGalaxyDeployments) {
    try {
        const galaxyConnector: IGalaxyMetadataConnector = metadata?.connectors?.galaxy;
        if(!galaxyConnector || !galaxyConnector.dataIngestion){
            const msg = `Galaxy data ingestion connector is not present for this metadata!`;
            logger.error(msg);
            return Promise.reject(msg);
        }

        const galaxyDataIngestionConnector: IGalaxyDataIngestionMetadataConnector = galaxyConnector.dataIngestion;
        const galaxyApiUrl:string = galaxyDataIngestionConnector.apiUrl || "";
        const galaxyApiType: string = galaxyDataIngestionConnector.type;
        const galaxyApiKey: string = metadata?.connectors?.galaxy.apiKey;
        const fnAxios = getMethod(method);
        const requestId = randomUUID();
        logger.info(`[{${requestId}}] Sending items to galaxy DATA INGESTION api ${galaxyApiUrl} of type ${galaxyApiType}`);

        if(deploysToGalaxy && deploysToGalaxy.deployments && deploysToGalaxy.deployments.length > 0){
            for(const deploy of deploysToGalaxy.deployments){
                const requestBody: IGalaxyDataIngestionDeployment = {
                    artifactId: deploy.projectId,
                    artifactName: deploy.project,
                    deploymentDate: deploy.timestamp,
                    deploymentSucceeded: deploy.success,
                    deploymentId: deploy.buildNumber
                };
                await fnAxios(
                    galaxyApiUrl, requestBody, { headers: { 'gops-api-token': galaxyApiKey, 'request-id': requestId, 'client-id': galaxyConnector.clientId} }
                );
            }
        }
        return Promise.resolve();       
    } catch (err) {
        logger.error(`Error sending items to Galaxy`, err);
    }
}


function getMethod(method:string) {
    if(method?.toLowerCase() === "get"){
        return axios.get;
    } else if (method?.toLowerCase() === "post"){
        return axios.post;
    }
    return axios.get;
}  