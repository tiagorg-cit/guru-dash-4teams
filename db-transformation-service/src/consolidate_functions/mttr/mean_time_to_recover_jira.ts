import { IPoint } from "influx";
import { consolidate } from "./mttr_engine/mttr_consolidate_engine";
import { IIncidentData, IMeanTimeToRecoverMeasure } from "../../database/database.types";

export async function consolidateMeanTimeToRecoverFromJira(metricName: string){
    await consolidate(
        metricName, 
        mapPoints
    );   
}

function mapPoints(metricName: string, productId:string, productName: string, dateKey:Date, 
        arrayOfIncidentsByMonthYear:IIncidentData[]): IPoint[]{
    const points: IPoint[] = [];
    if(arrayOfIncidentsByMonthYear && arrayOfIncidentsByMonthYear.length > 0){
        const quantityOfIncidentsByMonthYear = arrayOfIncidentsByMonthYear.length;
        if(quantityOfIncidentsByMonthYear > 0){
            const mttr = calculateUnavailabilityTime(arrayOfIncidentsByMonthYear) / quantityOfIncidentsByMonthYear;
            //Push to array to persist in InfluxDB the measurement with Mean Time to Recover history data.
            points.push(mapMeanTimeToRecover(
                metricName, 
                {
                "productId": productId,
                "productName": productName,
                "numberOfIncidents": quantityOfIncidentsByMonthYear,
                "mttr": mttr,
                "time": dateKey
                }
            ));
        }
    }        
    return points;
}

function calculateUnavailabilityTime(arrayOfIncidentsByMonthYear:IIncidentData[]): number {
    let totalUnavailabilityTime: number = 0;
    if(arrayOfIncidentsByMonthYear && arrayOfIncidentsByMonthYear.length > 0){
        for(const incident of arrayOfIncidentsByMonthYear){
            totalUnavailabilityTime += incident.crisisduration;
        }
    }
    return totalUnavailabilityTime;
}

function mapMeanTimeToRecover(metricName: string, measure: IMeanTimeToRecoverMeasure): IPoint {
    return {
        measurement: metricName,
        tags: {
            productName: measure.productName,
        },
        fields: {
            productId: measure.productId,
            mttr: measure.mttr,
            numberOfIncidents: measure.numberOfIncidents
        },
        timestamp: measure.time
    };
  }