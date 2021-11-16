import { IPoint, IResults } from "influx";
import { influxInstance } from "./database.instance";

export async function save(data: IPoint[]) {
    await influxInstance.writePoints(data);
}

export async function query<T>(query: string): Promise<IResults<T>> {
    return await influxInstance.query(query);
}