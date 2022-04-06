import { InfluxDB, IPoint } from 'influx';
import { IBambooPlanList, IBambooProject, IBambooMetadata,IBambooRelease,IBambooReleaseProjet } from '../bamboo.types';
import { logger } from '../../../shared/logger';
import { getQuery } from '../bamboo.send';



//Get Plankeys for Project
export async function getPlanKey(url: string,authUser:string,authPass:string,listProjects:IBambooProject[]) {
  logger.info(`Bamboo: Task Getting Releases running`);
  const hasProjects = listProjects && listProjects.length > 0;
  const result:any[] = [];

  if(hasProjects){
    for(const field of listProjects){
      
      logger.info(`validate project ${field.name} exist - Bamboo`);
      const urlBambooProject = url.concat(`/rest/api/latest/project/${field.name}`);

      const getProject = await getQuery({auth: { username: authUser, password: authPass }}, urlBambooProject)
      .then((response) => { return response; });
      const statusResponse = getProject.status

      if (!getProject) {
        throw new Error(`Error getting Bamboo Projects with status: ${statusResponse}`);
      }

      const projetData = getProject.data;
      logger.info(`Current project key: ${projetData.key}`);

      const getPlans = await getQuery({auth: { username: authUser, password: authPass }},
        urlBambooProject.concat(`.json?expand=plans`))
      .then((response) => {
          return response;
      });
      
      const planObject = getPlans.data.plans.plan;

      if (planObject){
        for  (let i=0; i < planObject.length; i++){         
          let planObjectItem:IBambooPlanList = planObject[i];
          result.push(planObjectItem)

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

  for  (let i=0; i < listOfPlanKeys.length; i++){

    const plan:IBambooPlanList = listOfPlanKeys[i];

    const urlBambooDeployExists = url.concat(`/rest/api/latest/deploy/project/forPlan?planKey=${plan.key}`);
    const getDeploymentsExists = await getQuery({auth: { username: authUser, password: authPass }},
      urlBambooDeployExists)
    .then((response) => { return response.data; });

    const deploymentIDs = getDeploymentsExists;
    for  (let i=0; i < deploymentIDs.length; i++){

      const deployProjectItem:IBambooReleaseProjet = deploymentIDs[i].id;
      logger.info(`Deployment id: ${deployProjectItem}`);
  
      if (deployProjectItem != null){

        const urlBambooDeployEnv = url.concat(`/rest/api/latest/deploy/project/${deployProjectItem}`);
        const getDeploymentsEnvs = await getQuery({auth: { username: authUser, password: authPass }},
          urlBambooDeployEnv)
        .then((response) => { return response; });
      
        const deploymentEnvs = getDeploymentsEnvs.data.environments;
        
        for  (let i=0; i < deploymentEnvs.length; i++){
  
          const deployEnvResults = deploymentEnvs[i];         
          const urlBambooDeployResult = url.concat(`/rest/api/latest/deploy/environment/${deployEnvResults.id}/results`);               
          const getDeploymentsResult = await getQuery({auth: { username: authUser, password: authPass }},
            urlBambooDeployResult)
          .then((response) => { return response; });
       
          const listOFDeployments = getDeploymentsResult.data;
          const pointsToPersist: IPoint[] = [];
          for  (let i=0; i < listOFDeployments.size; i++){
            const deployResultList:IBambooRelease = listOFDeployments.results[i];
            if (deployResultList){
              const point:IPoint = map(deployResultList, plan);
              pointsToPersist.push(point);
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
  logger.info(`Bamboo: Task Getting Releases completed`);
  return result;
  
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


