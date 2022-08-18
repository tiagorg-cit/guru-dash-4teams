import axios from 'axios';
import { InfluxDB, IPoint } from 'influx';
import { IAzureResponse, IAzureBuild, IAzureMetadata, IAzureTimeline, IRecordAzureTimeline } from '../azure.types';
import { IGalaxyDeployments, IGalaxyDeploymentsResponse } from '../../../galaxy/galaxy.types';
import { logger } from '../../../shared/logger';
import { sendToGalaxy } from '../../../galaxy/galaxy.service'
import { sendToGalaxyDataIngestion } from '../../../galaxy/galaxy.data-ingestion.service';

/**
 * In this fork, in azure pipeline builds, build and release are presents in the same pipeline build with diferent stages
 * @param metadata 
 * @returns IPoint[]
 */
export async function getBuilds(metadata: IAzureMetadata) {
  logger.info(`Getting Build Information from Azure Devops for ${metadata.organization} - ${metadata.project}`);
  const stepInsert:Boolean = metadata?.stepInsert;
  const influxDBInstance: InfluxDB = new InfluxDB(process.env.INFLUXDB!);

  if(metadata?.deployOnBuild){
    const buildsAndReleases: IPoint[] = [];
    if(metadata?.builds){
      const metadataBuildDefinitions = metadata.builds.repositories;
      const lastNumMonths = metadata.builds.getLastNumMonths;
      const defaultBuildStepName = metadata.builds.defaultBuildStep;
      const defaultDeployStepName = metadata.builds.defaultDeployStep;

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
        const customBuildSteps: string[] = metadataBuild.buildSteps;
        const customDeploySteps: string[] = metadataBuild.deploySteps;
        const deployBranch: string | undefined = metadataBuild.deployBranch;
        
        logger.info(`Getting BUILD and RELEASE information for repository: ${repositoryName}`);
        
        const buildsAndReleasesResponse: IPoint[] = 
              await getBuildsAndReleasesResponse(metadata, repositoryId, repositoryType, defaultBuildStepName, customBuildSteps, defaultDeployStepName, customDeploySteps, deployBranch, minDate)
        buildsAndReleases.push(...buildsAndReleasesResponse);  
        
        if(stepInsert){
          try {
            logger.debug(`Writing InfluxDB points in BABY STEPS for REPO NAME: ${repositoryName}`);
            await influxDBInstance.writePoints(buildsAndReleasesResponse);
          } catch (error: any){
            logger.error(error, `Error to write InfluxDB points into database for repo ${repositoryName}`);
          }
          
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
      await influxDBInstance.writePoints(response);
    }
    logger.info(`Finishing BUILD and RELEASE information from Azure Devops for ${metadata.organization} - ${metadata.project}!`);

    return response;
  }

}

function predicate(build: IAzureBuild) {
  return build?.result === 'succeeded' || build?.result === 'succeededWithIssues' || build?.result === 'failed';
}

async function getBuildsAndReleasesResponse(metadata: IAzureMetadata, 
  repositoryId:string, repositoryType:string, defaultBuildStepName: string, 
  customBuildStepNames: string[], defaultDeployStepName: string, 
  customDeployStepNames: string[], deployBranch:string | undefined, minTime:string){
    
    let continuationToken = '';
    const buildsAndReleases: IPoint[] = [];
    const deploysToGalaxy: IGalaxyDeployments = { "deployments" : [] };
    const deploysToDataIngestionGalaxy: IGalaxyDeployments = { "deployments" : [] };
    
    do {  
      const buildResponse = await callAzureBuild(
        metadata.key, metadata.organization, metadata.project, continuationToken, 
        repositoryId, repositoryType, minTime);

      for(let buildItem of buildResponse.data.value){
        const timelineHref = buildItem?._links?.timeline?.href;

        logger.debug(`For build number: ${buildItem?.buildNumber}, with result: ${buildItem?.result}, we get timeline steps in ${timelineHref}`);

        if(timelineHref){
          try {
            let timelineResponse;
            try{
              timelineResponse = await axios.get<IAzureTimeline>(
                `${timelineHref}`,
                { auth: { username: 'username', password: metadata.key } }
              );
            } catch(err: any){
              logger.error(err, `Error while GET timeline information about build number: ${buildItem?.buildNumber}`);
              continue;
            }     

            logger.debug(`The build number: ${buildItem?.buildNumber} returned: ${timelineResponse?.data?.records?.length} timeline items!`);

            if(timelineResponse?.data?.records?.length > 0){
              
              const buildsFiltered = timelineResponse?.data?.records?.filter((timelineItem: IRecordAzureTimeline) => {
                return filterTimelineItem(timelineItem, defaultBuildStepName, customBuildStepNames);
              });

              let releasesFiltered: IRecordAzureTimeline[] = [];

              if(deployBranch){
                if(deployBranch === buildItem.sourceBranch){
                  releasesFiltered = timelineResponse?.data?.records?.filter((timelineItem: IRecordAzureTimeline) => {
                    return filterTimelineItem(timelineItem, defaultDeployStepName, customDeployStepNames);  
                  });
                }
              } else {
                releasesFiltered = timelineResponse?.data?.records?.filter((timelineItem: IRecordAzureTimeline) => {
                  return filterTimelineItem(timelineItem, defaultDeployStepName, customDeployStepNames);  
                });
              }
              
              logger.debug(`The timeline of build number: ${buildItem?.buildNumber} returned: ${buildsFiltered?.length} filtered items by BUILD filter predicates!`);
              logger.debug(`The timeline of build number: ${buildItem?.buildNumber} returned: ${releasesFiltered?.length} filtered items by RELEASE filter predicates!`);

              for(let buildFiltered of buildsFiltered){
                buildsAndReleases.push(mapBuilds(buildItem?.repository?.id, buildItem?.repository?.name, buildFiltered));
              }

              for(let releaseFiltered of releasesFiltered){
                buildsAndReleases.push(mapReleases(buildItem?.repository?.id, buildItem?.repository?.name, buildsFiltered[0], releaseFiltered));
                if(metadata?.connectors?.galaxy){
                  deploysToDataIngestionGalaxy.deployments.push({
                      "buildNumber": buildItem?.buildNumber,
                      "projectId": buildItem?.repository?.id, 
                      "project": buildItem?.repository?.name,
                      "timestamp": releaseFiltered.startTime ? new Date(releaseFiltered.startTime) : new Date(buildsFiltered[0].finishTime),
                      "success": releaseFiltered.result === 'succeeded' || releaseFiltered.result === 'succeededWithIssues'
                  });
                  deploysToGalaxy.deployments.push({ 
                    "project": buildItem?.repository?.name,
                    "timestamp": releaseFiltered.startTime ? new Date(releaseFiltered.startTime) : new Date(buildsFiltered[0].finishTime),
                    "duration":  releaseFiltered.finishTime ? new Date(releaseFiltered.finishTime).getTime() - new Date(buildsFiltered[0].finishTime).getTime() : 0,
                    "success": releaseFiltered.result === 'succeeded' || releaseFiltered.result === 'succeededWithIssues'
                  });
                }
              }
            }
          } catch (err: any){
            logger.error(err, `Error while PROCESS timeline information about build number: ${buildItem?.buildNumber}`);
          }
        }
      }
      
      continuationToken = buildResponse.headers['x-ms-continuationtoken'];
      continuationToken && logger.debug(`Getting next page continuationToken: ${continuationToken}`);
    } while(continuationToken != null);
    //MANDAR PARA O GALAXY A LISTA DE DEPLOYS
    if(deploysToGalaxy.deployments?.length > 0){
      await sendToGalaxy<IGalaxyDeploymentsResponse>(metadata, "POST", deploysToGalaxy);
      await sendToGalaxyDataIngestion(metadata, "POST", deploysToDataIngestionGalaxy);
    }
    return buildsAndReleases;
}

function filterTimelineItem(timelineItem: IRecordAzureTimeline, defaultStepName: string, customStepNames: string[]){
  return (timelineItem?.type === 'Stage' || timelineItem?.type === 'Phase')
            && timelineItem?.state === 'completed' 
            && (timelineItem?.result === 'succeeded' || timelineItem?.result === 'succeededWithIssues' || timelineItem?.result === 'failed')
            && filterIdentifier(timelineItem?.identifier, defaultStepName, customStepNames);
}

function filterIdentifier(timelineIdentifier: string, defaultIdentifier: string, customIdentifiers: string[]){
  logger.debug(`timelineIdentifier: ${timelineIdentifier} | defaultIdentifier: ${defaultIdentifier} | customIdentifiers: ${customIdentifiers}`);
  if(customIdentifiers && customIdentifiers.length > 0){
    for(let customIdentifier of customIdentifiers){
      if(timelineIdentifier === customIdentifier){
        return true;
      }
    }
  }
  return timelineIdentifier === defaultIdentifier;
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
      duration: release.finishTime ? new Date(release.finishTime).getTime() - new Date(build.finishTime).getTime() : 0,
      success: release.result === 'succeeded' || release.result === 'succeededWithIssues' ? 1 : 0,
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