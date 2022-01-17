import { IPoint, IResults } from "influx";
import { influxInstance } from "./database.instance";

export async function save(data: IPoint[]) {
    await influxInstance.writePoints(data);
}

export async function query<T>(query: string): Promise<IResults<T>> {
    return await influxInstance.query(query);
}

export function parsePoints(results: IPoint[]){
    for(let result of results){
        influxInstance.parsePoint(result);  
    }
}

export async function dropMeasurement(measurementName:string) {
    return await influxInstance.dropMeasurement(measurementName);
}