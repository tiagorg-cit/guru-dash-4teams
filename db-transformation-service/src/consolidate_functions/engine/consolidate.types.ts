import { IPoint } from "influx";
import { IDeployData } from "../../database/database.types";
import { IPodRelationsMetaItem } from "../../providers/strapi/strapi.types";

export type QueryDeployFunction = (repositoryId: string) => Promise<IDeployData[]>;
export type MapDeploymentPointsFunction = (metricName: string, relation: IPodRelationsMetaItem, deploysPerMonth: any) => IPoint[];