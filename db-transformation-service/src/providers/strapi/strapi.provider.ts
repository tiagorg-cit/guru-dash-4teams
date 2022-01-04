import axios from "axios";
import {IPodRelations, IGalaxyFromTo} from "../strapi/strapi.types";

async function getJWT(): Promise<string> {
  const res = await axios.post(process.env.STRAPI_URL! + '/auth/local', {
    identifier: process.env.STRAPI_USERNAME,
    password: process.env.STRAPI_PASSWORD,
  })

  return res.data.jwt;
}

export async function getPodRelations(): Promise<IPodRelations> {
  const jwt = await getJWT();
  const res = await axios.get<IPodRelations>(process.env.STRAPI_URL! + '/pod-relations', {
    headers: {
      authorization: 'Bearer ' + jwt
    }
  });
  return res.data;
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
