import { IPoint } from "influx";
import { logger } from '../../shared/logger';
import { 
    IDistinctProductIncidentData, 
    IMeanCrisisDuration, 
    IMeanTimeToRecoverInLastPeriodMeasure 
} from "../../database/database.types";
import { 
    getProductsWithIncidentsInLastDays, 
    getMeanOfDurationCrisisByPeriod 
} from "../../database/database.incident";
import { dropMeasurement, parsePoints, save } from "../../database/database.functions";

const LAST_PERIOD_IN_DAYS = 90;

export async function consolidateMeanTimeToRecoverFromJiraLastPeriod(metricName: string){
    try{
        const distinctProductIdsDbResponse: IDistinctProductIncidentData[] | null = 
            await getProductsWithIncidentsInLastDays(LAST_PERIOD_IN_DAYS);
        if(distinctProductIdsDbResponse && distinctProductIdsDbResponse.length > 0){
            const pointsToSave: IPoint[] = [];
            for(const productDbResponse of distinctProductIdsDbResponse){
                const productId = productDbResponse.productId;
                if(productId){
                    const meanCrisisDurationDbResponse: IMeanCrisisDuration | null = 
                        await getMeanOfDurationCrisisByPeriod(LAST_PERIOD_IN_DAYS, productId);
                    if(meanCrisisDurationDbResponse && meanCrisisDurationDbResponse.meanOfCrisisDuration){
                        pointsToSave.push(mapPoint(metricName, productId, meanCrisisDurationDbResponse.meanOfCrisisDuration))
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
        logger.error(err, `Error consolidating metric ${metricName}`);
    }       
}

function mapPoint(metricName: string, productId:string, mttrInPeriod:number): IPoint {
    return mapMeanTimeToRecoverInLastPeriod(
            metricName, 
            {
            "productId": productId,
            "mttrInPeriod": mttrInPeriod,
            "time": new Date()
            }
        );
}

function mapMeanTimeToRecoverInLastPeriod(metricName: string, measure: IMeanTimeToRecoverInLastPeriodMeasure): IPoint {
    return {
        measurement: metricName,
        fields: {
            productId: measure.productId,
            mttrInPeriod: measure.mttrInPeriod
        },
        timestamp: measure.time
    };
  }