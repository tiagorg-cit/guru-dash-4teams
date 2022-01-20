import {ICustomMetric, IStrapiMetadata, IGalaxyFromTo} from "./strapi.types";
import axios from "axios";
import {IPoint} from "influx";
import {IDataSource} from "../../shared/common.types";

async function getJWT(): Promise<string> {
  const res = await axios.post(process.env.STRAPI_URL! + '/auth/local', {
    identifier: process.env.STRAPI_USERNAME,
    password: process.env.STRAPI_PASSWORD,
  })

  return res.data.jwt;
}

export async function getDatasources(): Promise<IDataSource[]> {
  const jwt = await getJWT();
  const res = await axios.get<IDataSource[]>(process.env.STRAPI_URL! + '/datasources', {
    headers: {
      authorization: 'Bearer ' + jwt
    }
  });
  return res.data;
}

export async function getDatasourceByProviderName(providerName: string): Promise<IDataSource[]> {
  const result: IDataSource[] = [];
  const jwt = await getJWT();
  const res = await axios.get<IDataSource[]>(process.env.STRAPI_URL! + '/datasources', {
    headers: {
      authorization: 'Bearer ' + jwt
    }
  });
  if(res && res?.data && res?.data?.length > 0){
    for(const datasource of res.data){
      if(datasource?.provider === providerName){
        result.push(datasource);
      }
    }
  }
  return result;
}

export async function getGalaxyFromTo(): Promise<IGalaxyFromTo[]> {
  const jwt = await getJWT();
  const res = await axios.get<IGalaxyFromTo[]>(process.env.STRAPI_URL! + '/fromtoentries', {
    headers: {
      authorization: 'Bearer ' + jwt
    }
  });
  return res.data;
}

export async function getStrapiMetrics(metadata: IStrapiMetadata) {
  const jwt = await getJWT();
  const res = await axios.get<ICustomMetric[]>(process.env.STRAPI_URL! + '/custom-metrics', {
    headers: {
      authorization: 'Bearer ' + jwt
    }
  });
  return res.data.map(map);
}

function map(metric: ICustomMetric): IPoint {
  return {
    measurement: metric.name,
    fields: { value: metric.value },
    timestamp: new Date(metric.date),
  }
}
