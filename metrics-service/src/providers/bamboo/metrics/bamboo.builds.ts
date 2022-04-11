import { InfluxDB, IPoint } from 'influx';
import { IBambooBuild, IBambooPlanList, IBambooProject, IBambooMetadata } from '../bamboo.types';
import { logger } from '../../../shared/logger';
import { getQuery } from '../bamboo.send';



//Get All Plans
export async function getPlans(listProjects:IBambooProject[],metadata: IBambooMetadata) {
  logger.info(`Bamboo: Task Getting Builds running`);
  const url:string = metadata.bambooServer
  const authUser:string = metadata.user
  const authPass:string = metadata.key
  const stepInsert:boolean = metadata.stepInsert || false;
  const influxDBInstance: InfluxDB = new InfluxDB(process.env.INFLUXDB!);

  const hasProjects = listProjects && listProjects.length > 0;
  const result: IPoint[] = [];

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

      let getPlans;
      try{
        getPlans = await getQuery({auth: { username: authUser, password: authPass }},
          urlBambooProject.concat(`.json?expand=plans`))
        .then((response) => {
            return response;
        });
      } catch(err){
        logger.error(`Error on get plans for builds from project ${field.name}`, err);
        continue;
      }
      
      const planObject = getPlans.data.plans.plan;

      if (planObject){
        for  (let i=0; i < planObject.length; i++){
          let planObjectItem:IBambooPlanList = planObject[i];

          const urlBambooBuildsExists = url.concat(`/rest/api/latest/result/${planObjectItem.key}`);
          let getBuildsExists;

          try {
            getBuildsExists = await getQuery({auth: { username: authUser, password: authPass }},
              urlBambooBuildsExists)
            .then((response) => { return response.data.results; });
          } catch(err) {
            logger.error(`Error on get build results from plan ${planObjectItem.key} of project ${field.name}`, err);
            continue;
          }
          
          if (getBuildsExists.size != 0){
            
            const urlBambooBuilds = url.concat(`/rest/api/latest/result/${planObjectItem.key}`).concat(`-latest.json`);
            logger.info(`Getting builds Information ${planObjectItem.key}`);
            
            let getBuilds;
            try {
              getBuilds = await getQuery({auth: { username: authUser, password: authPass }},
              urlBambooBuilds)
              .then((response) => { return response.data; });
            } catch (err) {
              logger.error(`Error on get last build results from plan ${planObjectItem.key} of project ${field.name}`, err);
              continue;
            }
            
            const iPointBuild:IPoint = map(getBuilds);
            result.push(iPointBuild);
            
            if(stepInsert){
              logger.debug(`Writing InfluxDB points in BABY STEPS for ALL REPOs`);
              await influxDBInstance.writePoints([iPointBuild]);
            }
          } else{
              logger.info(`Plan ${planObjectItem.key} without builds`);
          }          
        }
      }
    }
  }
  logger.info(`Bamboo: Task Getting Builds completed`);
  return result;
}

function map(build: IBambooBuild): IPoint {
  const createdDate:Date = new Date(build.buildStartedTime);

  let register:IPoint =  {
    measurement: 'build',
    timestamp: createdDate,
  };

  const ipointTags:any = {
    project: build.plan?.shortName,
    result: build.buildState
  };

  const ipointFields:any = {
    duration: new Date(build.buildCompletedTime).getTime() - new Date(build.buildStartedTime).getTime(),
    success: build.buildState === 'Successful' ? 1 : 0,
    project: build.plan?.shortName,
    repositoryId: build.plan?.key
  };

  register.tags = { ...ipointTags };
  register.fields = {...ipointFields };
  
  return register;
}