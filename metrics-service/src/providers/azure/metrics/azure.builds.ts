import axios from 'axios';
import { InfluxDB, IPoint } from 'influx';
import { IAzureResponse, IAzureBuild, IAzureMetadata, IAzureTimeline, IRecordAzureTimeline } from '../azure.types';
import { IGalaxyDeployments, IGalaxyDeploymentsResponse } from '../../../galaxy/galaxy.types';
import { logger } from '../../../shared/logger';


let buildStepName = '';
let deployStepName = '';

/**
 * In this fork, in azure pipeline builds, build and release are presents in the same pipeline build with diferent stages
 * @param metadata 
 * @returns IPoint[]
 */
export async function getBuilds(metadata: IAzureMetadata) {
  logger.info(`Getting Build Information from Azure Devops for ${metadata.organization} - ${metadata.project}`);
  const stepInsert:Boolean = metadata?.stepInsert;
  let influxDBInstance: InfluxDB = new InfluxDB(process.env.INFLUXDB!);

  if(metadata?.deployOnBuild){
    const buildsAndReleases: IPoint[] = [];
    if(metadata?.builds){
      const metadataBuildDefinitions = metadata.builds.repositories;
      const lastNumMonths = metadata.builds.getLastNumMonths;
      buildStepName = metadata.builds.buildStepName;
      deployStepName = metadata.builds.deployStepName;

      let minDate = '';
  
      if(lastNumMonths){
        const now = new Date();
        now.setMonth(now.getMonth() - lastNumMonths);
        minDate = now.toISOString();
      }
  
      for(let metadataBuild of metadataBuildDefinitions){
        const repositoryId = metadataBuild.id;
        const repositoryName = metadataBuild.name;
        const repositoryType = metadataBuild.type;
        
        logger.info(`Getting BUILD and RELEASE information for repository: ${repositoryName}`);
        
        const buildsAndReleasesResponse: IPoint[] = await getBuildsAndReleasesResponse(metadata, repositoryId, repositoryType, minDate)
        buildsAndReleases.push(...buildsAndReleasesResponse);  
        
        if(stepInsert){
          logger.debug(`Writing InfluxDB points in BABY STEPS for REPO NAME: ${repositoryName}`);
          influxDBInstance.writePoints(buildsAndReleasesResponse);
        }

        logger.info(`Finishing BUILD and RELEASE information for repository: ${repositoryName}`);
      }
    } else {
      throw new Error(`Error getting Azure Devops Builds, 'builds' field is mandatory!`);
    }
    logger.info(`Finishing BUILD and RELEASE information from Azure Devops for ${metadata.organization} - ${metadata.project}!`);
    return buildsAndReleases;
  } else {
    const res = await axios.get<IAzureResponse<IAzureBuild>>(
      `https://dev.azure.com/${metadata.organization}/${metadata.project}/_apis/build/builds?api-version=6.0`,
      { auth: { username: 'username', password: metadata.key } }
    );
  
    if (!res.data.value) {
      throw new Error(`Error getting Azure Devops Builds, status code: ${res.status}`);
    }
  
    const response: IPoint[] = res.data.value.filter(predicate).map(map);
    
    if(stepInsert){
      logger.debug(`Writing InfluxDB points in BABY STEPS for ALL REPOs`);
      influxDBInstance.writePoints(response);
    }
    logger.info(`Finishing BUILD and RELEASE information from Azure Devops for ${metadata.organization} - ${metadata.project}!`);

    return response;
  }

}

function predicate(build: IAzureBuild) {
  return build?.result === 'succeeded' || build?.result === 'succeededWithIssues' || build?.result === 'failed';
}

async function getBuildsAndReleasesResponse(metadata: IAzureMetadata, 
  repositoryId:string, repositoryType:string, minTime:string){
    
    let continuationToken = '';
    const buildsAndReleases: IPoint[] = [];
    const deploysToGalaxy: IGalaxyDeployments = { "deployments" : [] }; 
    
    do {  
      const buildResponse = await callAzureBuild(
        metadata.key, metadata.organization, metadata.project, continuationToken, 
        repositoryId, repositoryType, minTime);

      for(let buildItem of buildResponse.data.value){
        const timelineHref = buildItem?._links?.timeline?.href;

        logger.debug(`For build number: ${buildItem?.buildNumber}, with result: ${buildItem?.result}, we get timeline steps in ${timelineHref}`);

        if(timelineHref){
          try {
            const timelineResponse = await axios.get<IAzureTimeline>(
              `${timelineHref}`,
              { auth: { username: 'username', password: metadata.key } }
            );

            logger.debug(`The build number: ${buildItem?.buildNumber} returned: ${timelineResponse?.data?.records?.length} timeline items!`);

            if(timelineResponse?.data?.records?.length > 0){
              const buildsFiltered = timelineResponse?.data?.records?.filter(timelinePredicateForBuild);
              const releasesFiltered = timelineResponse?.data?.records?.filter(timelinePredicateForReleases);

              logger.debug(`The timeline of build number: ${buildItem?.buildNumber} returned: ${buildsFiltered?.length} filtered items by BUILD filter predicates!`);
              logger.debug(`The timeline of build number: ${buildItem?.buildNumber} returned: ${releasesFiltered?.length} filtered items by RELEASE filter predicates!`);

              for(let buildFiltered of buildsFiltered){
                buildsAndReleases.push(mapBuilds(buildItem?.repository?.id, buildItem?.repository?.name, buildFiltered));
              }

              for(let releaseFiltered of releasesFiltered){
                buildsAndReleases.push(mapReleases(buildItem?.repository?.id, buildItem?.repository?.name, buildsFiltered[0], releaseFiltered));
                if(metadata?.connectors?.galaxy){
                  deploysToGalaxy.deployments.push({
                    "project": buildItem?.repository?.name,
                    "timestamp": releaseFiltered.startTime ? new Date(releaseFiltered.startTime) : new Date(buildsFiltered[0].finishTime),
                    "duration": releaseFiltered.result === 'succeeded'? new Date(releaseFiltered.finishTime).getTime() - new Date(buildsFiltered[0].finishTime).getTime() : 0,
                    "success": releaseFiltered.result === 'succeeded'
                  });
                }
              }
            }
          } catch (err){
            logger.error(err, `Error while get timeline information about build number: ${buildItem?.buildNumber}`);
          }
        }
      }
      
      continuationToken = buildResponse.headers['x-ms-continuationtoken'];
      continuationToken && logger.debug(`Getting next page continuationToken: ${continuationToken}`);
    } while(continuationToken != null);
    //MANDAR PARA O GALAXY A LISTA DE DEPLOYS
    if(metadata?.connectors?.galaxy){
      const galaxyResponse = await sendDeploysToGalaxy(metadata?.connectors?.galaxy.apiUrl, metadata?.connectors?.galaxy.apiKey, deploysToGalaxy);
      logger.info(`Enviado com sucesso os deploys para o client_id: ${galaxyResponse.data.client_id}`);
    }
    
  
    return buildsAndReleases;
}

async function sendDeploysToGalaxy(gopsApiUrl: string, gopsApiKey: string, deploysToGalaxy: IGalaxyDeployments){
  logger.info(`Enviando ${deploysToGalaxy.deployments.length} deploys para o galaxy para o gops-api-key: ${gopsApiKey}`);

  const galaxyResponse = await axios.post<IGalaxyDeploymentsResponse>(
    gopsApiUrl, deploysToGalaxy, { headers: { 'gops-api-key': gopsApiKey } }
  );

  return galaxyResponse;
}

function timelinePredicateForBuild(timelineItem: IRecordAzureTimeline) {
   return timelineItem?.type === 'Stage' 
      && timelineItem?.state === 'completed' 
      && (timelineItem?.result === 'succeeded' || timelineItem?.result === 'succeededWithIssues' || timelineItem?.result === 'failed')
      && timelineItem?.identifier === buildStepName;
}

function timelinePredicateForReleases(timelineItem: IRecordAzureTimeline) {
  return timelineItem?.type === 'Stage' 
     && timelineItem?.state === 'completed' 
     && (timelineItem?.result === 'succeeded' || timelineItem?.result === 'succeededWithIssues' || timelineItem?.result === 'failed')
     && timelineItem?.identifier === deployStepName;
}

async function callAzureBuild(key:string, organization: string, project: string, 
  continuationToken: string, repositoryId: string, repositoryType: string, minTime: string) {

    const apiVersion = '6.1-preview.7';
    const resultFilter = 'succeeded,partiallySucceeded,failed';
    const statusFilter = 'completed';
    
    const buildResponse = await axios.get<IAzureResponse<IAzureBuild>>(
      `https://dev.azure.com/${organization}/${project}/_apis/build/builds?api-version=${apiVersion}&statusFilter=${statusFilter}&resultFilter=${resultFilter}&continuationToken=${continuationToken}&repositoryId=${repositoryId}&repositoryType=${repositoryType}&minTime=${minTime}`,
      { auth: { username: 'username', password: key } }
    );
    return buildResponse;
}

function mapBuilds(repositoryId: string, repositoryName:string, build: IRecordAzureTimeline): IPoint {
  return {
    measurement: 'build',
    tags: { 
      project: repositoryName,
      result: build.result
    },
    fields: { 
      duration: new Date(build.finishTime).getTime() - new Date(build.startTime).getTime(),
      project: repositoryName,
      repositoryId: repositoryId,
      success: build.result === 'succeeded' ? 1 : 0,
    },
    timestamp: new Date(build.startTime),
  }
}

function mapReleases(repositoryId: string, repositoryName:string, build: IRecordAzureTimeline, release: IRecordAzureTimeline): IPoint {
  const timestamp = release.startTime ? new Date(release.startTime) : new Date(build.finishTime);
  return {
    measurement: 'deploy',
    tags: { 
      project: repositoryName,
    },
    fields: { 
      duration: release.result === 'succeeded' ? new Date(release.finishTime).getTime() - new Date(build.finishTime).getTime() : 0,
      success: release.result === 'succeeded' ? 1 : 0,
      project: repositoryName,
      repositoryId: repositoryId
    },
    timestamp: timestamp
  }
}

function map(build: IAzureBuild): IPoint {
  return {
    measurement: 'build',
    tags: { 
      project: build.repository?.name,
      result: build.result
    },
    fields: { 
      duration: new Date(build.finishTime).getTime() - new Date(build.startTime).getTime(),
      success: build.result === 'succeeded' ? 1 : 0,
      project: build.repository?.name,
      repositoryId: build.repository?.id
    },
    timestamp: new Date(build.startTime),
  };
}