import { IPoint } from "influx";
import { consolidate } from "./mttr_engine/mttr_consolidate_engine";
import { IIncidentData, IMttrByCountryMeasure } from "../../database/database.types";

export async function consolidateMTTRByCountry(metricName: string){  
    await consolidate(
        metricName, 
        mapPoints
    ); 
}

function mapPoints(metricName: string, productId:string, productName: string, dateKey:Date, 
    arrayOfIncidentsByMonthYear:IIncidentData[]): IPoint[]{
    const points: IPoint[] = [];
    if(arrayOfIncidentsByMonthYear && arrayOfIncidentsByMonthYear.length > 0){
        const mapByCountry: any = 
            mapIssuesByCountry(arrayOfIncidentsByMonthYear);
        for (const platformKey in mapByCountry){
            const crisisDuration: number = mapByCountry[platformKey];
            
            points.push(mapMttrByCountry(
                metricName, 
                {
                "productId": productId,
                "productName": productName,
                "crisisDuration": crisisDuration,
                "country": platformKey,
                "time": dateKey
                }
            ));
        }
    }

    return points;
}

function mapIssuesByCountry(arrayOfIncidentsByMonthYear: IIncidentData[]): any {
    const mapByCountry: any = {};
    for (const incidentData of arrayOfIncidentsByMonthYear) {
        const affectedCountries = incidentData?.affectedcountries?.split(',');
        if(affectedCountries && affectedCountries.length > 0){
            for(const affectedCountry of affectedCountries){
                if (mapByCountry[affectedCountry]
                    && mapByCountry[affectedCountry] > 0) {
                        mapByCountry[affectedCountry] += incidentData.crisisduration;
                } else {
                    mapByCountry[affectedCountry] = incidentData.crisisduration;
                }
            }
        }
    }
    return mapByCountry;
}

function mapMttrByCountry(metricName: string, measure: IMttrByCountryMeasure): IPoint {
    return {
        measurement: metricName,
        tags: {
            productName: measure.productName,
            country: measure.country,
        },
        fields: {
            productId: measure.productId,
            country: measure.country,
            crisisDuration: measure.crisisDuration
        },
        timestamp: measure.time
    };
  }

