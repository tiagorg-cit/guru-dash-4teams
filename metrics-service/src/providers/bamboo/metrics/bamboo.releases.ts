import { InfluxDB, IPoint } from 'influx';
import { IBambooPlanList, IBambooProject, IBambooMetadata,IBambooRelease,IBambooReleaseProjet } from '../bamboo.types';
import { logger } from '../../../shared/logger';
import { getQuery } from '../bamboo.send';
import { IGalaxyDeployments, IGalaxyDeploymentsResponse } from '../../../galaxy/galaxy.types';
import { sendToGalaxy } from '../../../galaxy/galaxy.service'

//Get Plankeys for Project
export async function getPlanKey(url: string,authUser:string,authPass:string,listProjects:IBambooProject[]) {
  logger.info(`Bamboo: Task Getting Releases running`);
  const hasProjects = listProjects && listProjects.length > 0;
  const result:any[] = [];

  if(hasProjects){
    for(const field of listProjects){
      
      logger.info(`validate project ${field.name} exist - Bamboo`);
      const urlBambooProject = url.concat(`/rest/api/latest/project/${field.name}`);
      let getProject;
      try {
        getProject = await getQuery({auth: { username: authUser, password: authPass }}, urlBambooProject)
          .then((response) => { return response; });
        const statusResponse = getProject.status
        if (!getProject) {
          throw new Error(`Error getting Bamboo Projects with status: ${statusResponse}`);
        }
      } catch (err) {
        logger.error(`Error on validate project ${field.name} exists!`, err);
        continue;
      }
      
      if(getProject){
        const projetData = getProject.data;
        logger.info(`Current project key: ${projetData.key}`);

        let getPlans;
        try {
          getPlans = await getQuery({auth: { username: authUser, password: authPass }},
            urlBambooProject.concat(`.json?expand=plans&max-result=1000`))
          .then((response) => {
              return response;
          });
        } catch (err) {
          logger.error(`Error on get plans for project ${field.name}`, err);
          continue;
        }
        if(getPlans){
          const planObject = getPlans.data.plans.plan;
          if (planObject){
            for  (let i=0; i < planObject.length; i++){         
              let planObjectItem:IBambooPlanList = planObject[i];
              result.push(planObjectItem)
            }
          }
        }
      }
    }
  }
  return result;
}

//Get Deploys for PlanKey
export async function getReleases(metadata: IBambooMetadata) {

  const url:string = metadata.bambooServer
  const authUser:string = metadata.user
  const authPass:string = metadata.key
  const stepInsert:boolean = metadata.stepInsert || false;
  const influxDBInstance: InfluxDB = new InfluxDB(process.env.INFLUXDB!);

  const result:any[] = [];
  const listOfPlanKeys = await getPlanKey(url,authUser, authPass ,metadata.projects);

  const deploysToGalaxy: IGalaxyDeployments = { "deployments" : [] };

  for  (let i=0; i < listOfPlanKeys.length; i++){
    const plan:IBambooPlanList = listOfPlanKeys[i];

    const urlBambooDeployExists = url.concat(`/rest/api/latest/deploy/project/forPlan?planKey=${plan.key}`);
    let getDeploymentsExists;
    
    try{
      getDeploymentsExists = await getQuery({auth: { username: authUser, password: authPass }},
        urlBambooDeployExists)
      .then((response) => { return response.data; });
    } catch (err) {
      logger.error(`Error on get deploys for plan key ${plan.key}`, err);
      continue;
    }

    const deploymentIDs = getDeploymentsExists;

    for  (let i=0; i < deploymentIDs.length; i++){

      const deployProjectItem:IBambooReleaseProjet = deploymentIDs[i].id;
      logger.info(`Deployment id: ${deployProjectItem}`);
  
      if (deployProjectItem != null){

        const urlBambooDeployEnv = url.concat(`/rest/api/latest/deploy/project/${deployProjectItem}`);
        
        let getDeploymentsEnvs;
        try {
          getDeploymentsEnvs = await getQuery({auth: { username: authUser, password: authPass }},
            urlBambooDeployEnv)
          .then((response) => { return response; });
        } catch (err) {
          logger.error(`Error on get deploys environments for plan key ${plan.key}`, err);
          continue;
        }
      
        const deploymentEnvs = getDeploymentsEnvs.data.environments;
        if(deploymentEnvs){
          for (let i=0; i < deploymentEnvs.length; i++){
            const deployEnvResults = deploymentEnvs[i];

            if (verifyEnvironment(metadata.environments, deployEnvResults.name)) {

                const urlBambooDeployResult = url.concat(`/rest/api/latest/deploy/environment/${deployEnvResults.id}/results?max-result=1000`);
                let getDeploymentsResult;
                try {
                  getDeploymentsResult = await getQuery({auth: { username: authUser, password: authPass }},
                    urlBambooDeployResult)
                  .then((response) => { return response; });
                } catch(err) {
                  logger.error(`Error on get results of deploys for environment ${deployEnvResults.id} for plan key ${plan.key}`, err);
                  continue;
                }

                if(getDeploymentsResult){
                  const listOFDeployments = getDeploymentsResult.data;
                  const pointsToPersist: IPoint[] = [];
                  for  (let i=0; i < listOFDeployments.size; i++){
                    const deployResultList:IBambooRelease = listOFDeployments.results[i];
                    if (deployResultList){
                      const point:IPoint = map(deployResultList, plan);
                      pointsToPersist.push(point);
                      if(metadata?.connectors?.galaxy){
                        deploysToGalaxy.deployments.push({
                          "project": point.fields?.project,
                          "timestamp": new Date(deployResultList.startedDate),
                          "duration": new Date(deployResultList.finishedDate).getTime() - new Date(deployResultList.startedDate).getTime(),
                          "success": deployResultList.deploymentState === 'SUCCESS'
                        });
                      }
                    }
                  }
                  if(stepInsert){
                    logger.debug(`Writing InfluxDB points in BABY STEPS for ALL REPOs`);
                    await influxDBInstance.writePoints(pointsToPersist);
                  }
                  result.push(pointsToPersist);
                }
            }

          }
        }
      }
    }
  }
  //MANDAR PARA O GALAXY A LISTA DE DEPLOYS
  if(deploysToGalaxy.deployments?.length > 0){
    await sendToGalaxy<IGalaxyDeploymentsResponse>(metadata, "POST", deploysToGalaxy);
  }
  logger.info(`Bamboo: Task Getting Releases completed`);
  return result;
  
}

function verifyEnvironment(environments: string[], env: string): boolean {

    if (environments) {
        for (let i=0; i < environments.length; i++){

            if (environments[i] == env) {
                return true;
            }
        }

        return false;
    }

    return true;
}

function map(deploy: IBambooRelease, plan: IBambooPlanList): IPoint {
  const createdDate:Date = new Date(deploy.startedDate);

  let register:IPoint =  {
    measurement: 'deploy',
    timestamp: createdDate,
  };

  const ipointTags:any = {
    project: plan.shortName
  };

  const ipointFields:any = {
    duration: new Date(deploy.finishedDate).getTime() - new Date(deploy.startedDate).getTime(),
    success: deploy.deploymentState === 'SUCCESS' ? 1 : 0,
    project: plan.shortName,
    repositoryId: plan.key
  };

  register.tags = { ...ipointTags };
  register.fields = {...ipointFields };
  
  return register;
}


