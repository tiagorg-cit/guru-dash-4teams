import { logger } from '../shared/logger';
import {getPodRelations} from "../providers/strapi/strapi.provider";
import { IDeployData, IDeploymentFrequencyMeasure } from "../database/database.types";
import { InfluxDB,IPoint } from 'influx';

export async function consolidateMetrics() {

  const podRelations = await getPodRelations();
  
  logger.info(`Starting consolidate metrics for: ${podRelations.name}`);

  try {
    if(podRelations?.meta?.relations?.length > 0){

      const influxInstance = new InfluxDB(process.env.INFLUXDB!);

        for(let relation of podRelations?.meta?.relations){
          const deploysPerMonth:any = {};
          //Getting deploy data for pod for each repository
          for(let repositoryId of relation.idRepositories){
            logger.debug(`
                  Getting deployment data for repo: ${repositoryId} 
                    for POD: ${relation.podName} 
                    of VS: ${relation.valueStreamName} 
                    of Product: ${relation.productName}`
                );
            const deployDBResponse:IDeployData[] = await influxInstance.query(
                `SELECT * FROM deploy WHERE repositoryId = '${repositoryId}' 
                    AND success = 1 ORDER BY time DESC`
              );
            logger.debug(`Retrieving ${deployDBResponse?.length} items!`);  
            if(deployDBResponse?.length > 0){
              /* Getting all deploy records to this repository and calculate number of 
              deploys for each month/year to know the deployment frequency for this repo for 
              this pod */
              for(let deployDB of deployDBResponse){
                const deployDate:Date = deployDB.time;
                const deployMonth = extractMonthOfDate(deployDate);
                const deployYear = extractYearOfDate(deployDate);
                const deployYearMonth = deployYear.concat('-').concat(deployMonth).concat('-01T00:00:00');
                if(deploysPerMonth[deployYearMonth]){
                  deploysPerMonth[deployYearMonth].push(deployDB);
                } else {
                  deploysPerMonth[deployYearMonth] = [deployDB];
                }
              }
            }            
          }
          /* With all deploys for all repos for this POD separated by year/month 
            we can persist in databse, calculating the deployment frequency 
            using the rational: <number of days in month>/<number of deployments in month> */
          const pointsForThisPOD: IPoint[] = [];  
          for(let dateKey in deploysPerMonth){
            const deploysByMonthYear = deploysPerMonth[dateKey].length;
            const daysInMonth = getDaysInMonth(dateKey);
            const deploymentFrequency: number = daysInMonth/deploysByMonthYear;      
            logger.debug(`
                FOR PODID: ${relation.podId} 
                Getting ${deploysByMonthYear} deploys in period ${dateKey}. 
                This month/year have ${daysInMonth} days! 
                Mean of Deployment frequency for this repo/pod is:
                1 DEPLOY of EACH ${deploymentFrequency} DAYS!`
            );
            //Persist in InfluxDB the measurement with deployment frequency history data.
            pointsForThisPOD.push(mapDeploymentFrequency(
              {
                "productId": relation.productId,
                "productName": relation.productName,
                "valueStreamId": relation.valueStreamId,
                "valueStreamName": relation.valueStreamName,
                "podId": relation.podId,
                "podName": relation.podName,
                "numberOfDeploys": deploysByMonthYear,
                "deploymentFrequency": deploymentFrequency,
                "time": new Date(dateKey)
              }
            ));
            influxInstance.writePoints(pointsForThisPOD);
          }
        }
    }
  } catch (err) {
    logger.error(err, `Error consolidating metrics for: ${podRelations.name}`);
  }
}

function extractMonthOfDate(date:Date): string{
  const month = date?.getMonth() + 1;
  return month < 10 ? "0" + month : month?.toString();  
}

function extractYearOfDate(date:Date): string {
  return date?.getFullYear()?.toString();
}

function getDaysInMonth (yearMonth: string): number {
  const spplitedDate = yearMonth.split("-");
  const year = Number.parseInt(spplitedDate[0]);
  const month = Number.parseInt(spplitedDate[1]);
  return new Date(year, month, 0).getDate();
}

function mapDeploymentFrequency(measure: IDeploymentFrequencyMeasure):IPoint {
  return {
    measurement: "deployment_frequency",
    tags: {
      podName: measure.podName,
      valueStreamName: measure.valueStreamName,
      productName: measure.productName,
    },
    fields: {
      productId: measure.productId,
      valueStreamId: measure.valueStreamId,
      podId: measure.podId,
      deploymentFrequencyValue: measure.deploymentFrequency,
      deploysPerMonth: measure.numberOfDeploys
    },
    timestamp: measure.time
  };
}
