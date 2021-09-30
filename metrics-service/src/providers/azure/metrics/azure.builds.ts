import axios from 'axios';
import { IPoint } from 'influx';
import { IAzureResponse, IAzureBuild, IAzureMetadata, IAzureTimeline, IRecordAzureTimeline } from '../azure.types';
import { logger } from '../../../shared/logger';

/**
 * In this fork, in azure pipeline builds, build and release are presents in the same pipeline build with diferent stages
 * @param metadata 
 * @returns IPoint[]
 */
export async function getBuildsAndReleases(metadata: IAzureMetadata) {
  logger.info(`Getting Build Information from Azure Devops for ${metadata.organization} - ${metadata.project}`);
  
  const buildsAndReleases: IPoint[] = [];

  if(metadata?.builds){
    const metadataBuildDefinitions = metadata.builds.repositories;
    const lastNumMonths = metadata.builds.getLastNumMonths;
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

      logger.info(`Finishing BUILD and RELEASE information for repository: ${repositoryName}`);
    }
  } else {
    const allBuildsResponse: IPoint[] = await getAllBuildsAndReleasesResponse(metadata);
    buildsAndReleases.push(...allBuildsResponse);  
  }

  logger.info(`Finishing BUILD and RELEASE information from Azure Devops for ${metadata.organization} - ${metadata.project} with ${buildsAndReleases.length} items!`);

  return buildsAndReleases;
}

async function getAllBuildsAndReleasesResponse(metadata: IAzureMetadata){
    return await getBuildsAndReleasesResponse(metadata, '', '', '');
}

async function getBuildsAndReleasesResponse(metadata: IAzureMetadata, 
  repositoryId:string, repositoryType:string, minTime:string){
    
    let continuationToken = '';
    const buildsAndReleases: IPoint[] = [];
    
    do {  
      const buildResponse = await callAzureBuild(
        metadata.key, metadata.organization, metadata.project, continuationToken, 
        repositoryId, repositoryType, minTime);

      for(let buildItem of buildResponse.data.value){
        const timelineHref = buildItem?._links?.timeline?.href;

        logger.info(`For build number: ${buildItem?.buildNumber}, with result: ${buildItem?.result}, we get timeline steps in ${timelineHref}`);

        if(timelineHref){
          const timelineResponse = await axios.get<IAzureTimeline>(
            `${timelineHref}`,
            { auth: { username: 'username', password: metadata.key } }
          );

          logger.info(`The build number: ${buildItem?.buildNumber} returned: ${timelineResponse?.data?.records?.length} timeline items!`);

          if(timelineResponse?.data?.records?.length > 0){
            const buildsFiltered = timelineResponse?.data?.records?.filter(timelinePredicateForBuild);
            const releasesFiltered = timelineResponse?.data?.records?.filter(timelinePredicateForReleases);

            logger.info(`The timeline of build number: ${buildItem?.buildNumber} returned: ${buildsFiltered?.length} filtered items by BUILD filter predicates!`);
            logger.info(`The timeline of build number: ${buildItem?.buildNumber} returned: ${releasesFiltered?.length} filtered items by RELEASE filter predicates!`);

            for(let buildFiltered of buildsFiltered){
              buildsAndReleases.push(mapBuilds(buildItem?.definition?.name, buildFiltered));
            }

            for(let releaseFiltered of releasesFiltered){
              buildsAndReleases.push(mapReleases(buildItem?.definition?.name, buildsFiltered[0], releaseFiltered));
            }
          }
        }
      }
      
      continuationToken = buildResponse.headers['x-ms-continuationtoken'];
      continuationToken && logger.debug(`Getting next page continuationToken: ${continuationToken}`);
    } while(continuationToken != null);
    return buildsAndReleases;
}

function timelinePredicateForBuild(timelineItem: IRecordAzureTimeline) {
   return timelineItem?.type === 'Stage' 
      && timelineItem?.state === 'completed' 
      && (timelineItem?.result === 'succeeded' || timelineItem?.result === 'succeededWithIssues' || timelineItem?.result === 'failed')
      && timelineItem?.identifier === 'MASTER_CD';
}

function timelinePredicateForReleases(timelineItem: IRecordAzureTimeline) {
  return timelineItem?.type === 'Stage' 
     && timelineItem?.state === 'completed' 
     && (timelineItem?.result === 'succeeded' || timelineItem?.result === 'succeededWithIssues' || timelineItem?.result === 'failed')
     && timelineItem?.identifier === 'DeployPROD';
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

function mapBuilds(buildDefinitionName:string, build: IRecordAzureTimeline): IPoint {
  return {
    measurement: 'build',
    tags: { 
      project: buildDefinitionName,
      result: build.result
    },
    fields: { 
      duration: new Date(build.finishTime).getTime() - new Date(build.startTime).getTime(),
      success: build.result === 'succeeded' ? 1 : 0,
    },
    timestamp: new Date(build.startTime),
  }
}

function mapReleases(releaseDefinitionName:string, build: IRecordAzureTimeline, release: IRecordAzureTimeline): IPoint {
  return {
    measurement: 'deploy',
    tags: { 
      project: releaseDefinitionName,
    },
    fields: { 
      duration: release.result === 'succeeded'? new Date(release.finishTime).getTime() - new Date(build.finishTime).getTime() : 0,
      success: release.result === 'succeeded' ? 1 : 0,
    },
    timestamp: release.startTime ? new Date(release.startTime) : new Date(build.finishTime)
  }
}