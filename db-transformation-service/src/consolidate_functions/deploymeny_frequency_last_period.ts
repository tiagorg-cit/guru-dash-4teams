import { logger } from '../shared/logger';
import { IPoint } from "influx";
import { IPodRelations, IPodRelationsMetaItem } from "../providers/strapi/strapi.types";
import { 
    IDeploymentFrequencyLastPeriodMeasure, 
    IDeploymentFrequencyLastPeriodMeasureResponse 
} from "../database/database.types";
import { getUniqueDeploysByRepositoryIdsForLastDays } from "../database/database.deploy";
import { dropMeasurement, parsePoints, save } from "../database/database.functions";

const LAST_PERIOD_IN_DAYS = 90;


export async function consolidateDeploymentFrequencyLastPeriod(metricName: string, 
    podRelations: IPodRelations){
    try{
        if(podRelations?.meta?.relations?.length > 0){
            const pointsToSave: IPoint[] = [];
            for(let relation of podRelations?.meta?.relations){
                const idRepositories = relation.idRepositories;
                if(idRepositories && idRepositories.length > 0){
                    const lastDeploysOnLastDays:IDeploymentFrequencyLastPeriodMeasureResponse | null = 
                        await getUniqueDeploysByRepositoryIdsForLastDays(LAST_PERIOD_IN_DAYS, idRepositories);
                    if(lastDeploysOnLastDays && lastDeploysOnLastDays.lastDeploysOnPeriod && lastDeploysOnLastDays.lastDeploysOnPeriod > 0){
                        logger.debug(`For POD ${relation.podName}, the Deployment Frequency Last Period query: ${lastDeploysOnLastDays.lastDeploysOnPeriod}`);    
                        const pointToSave: IPoint = 
                            getPoint(metricName, relation, lastDeploysOnLastDays.lastDeploysOnPeriod);
                        pointsToSave.push(pointToSave);    
                    } 
                }
            }
            if(pointsToSave.length > 0){
                parsePoints(pointsToSave);
                await dropMeasurement(metricName);
                await save(pointsToSave);
            }
        }
    } catch (err) {
        logger.error(err, `Error consolidating metric ${metricName} for: ${podRelations.name}`);
    }
}

/* With all succeeded deploys for this POD we can persist in databse, calculating 
    the deployment frequency in last period 
    using the rational: <number of days in period>/<number of deployments in period> */
function getPoint(metricName: string, relation:IPodRelationsMetaItem, numberOfUniqueDeploysInLastPeriod:number): IPoint {  
    const deploymentFrequency = 
        numberOfUniqueDeploysInLastPeriod && numberOfUniqueDeploysInLastPeriod > 0 
            ? (LAST_PERIOD_IN_DAYS / numberOfUniqueDeploysInLastPeriod) 
            : null;    
    //Return IPoint in InfluxDB the measurement with deployment frequency in period defined above.
    return mapDeploymentFrequencyLastPeriod(
        metricName, 
        {
        "productId": relation.productId,
        "productName": relation.productName,
        "valueStreamId": relation.valueStreamId,
        "valueStreamName": relation.valueStreamName,
        "podId": relation.podId,
        "podName": relation.podName,
        "numberOfUniqueDeploysInLastPeriod": numberOfUniqueDeploysInLastPeriod || null,
        "deploymentFrequency": deploymentFrequency || null,
        "time": new Date()
        }
    );
}

function mapDeploymentFrequencyLastPeriod(metricName: string, measure: IDeploymentFrequencyLastPeriodMeasure):IPoint {
    return {
      measurement: metricName,
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
        numberOfUniqueDeploysInLastPeriod: measure.numberOfUniqueDeploysInLastPeriod
      },
      timestamp: measure.time
    };
  }