import { DBCreds, RemoteDBState } from "./RemoteDBState";
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import jwt_decode from 'jwt-decode';
import { ListRow } from "./DataTypes";
import { History } from "history";

export async function navigateToFirstListID(phistory: History,remoteDBCreds: DBCreds, listRows: ListRow[]) {
    let firstListID = null;
    if (listRows.length > 0) {
      firstListID = listRows[0].listDoc._id;
    }
    if (firstListID == null) {
        phistory.push("/lists");
    } else {
        phistory.push("/items/list/"+firstListID)
    }  
  }

export async function createNewUser(remoteDBState: RemoteDBState,remoteDBCreds: DBCreds, password: string): Promise<(HttpResponse | undefined)> {
    let response: HttpResponse | undefined;
    const options = {
        url: String(remoteDBCreds.apiServerURL+"/registernewuser"),
        method: "POST",
        headers: { 'Content-Type': 'application/json',
                   'Accept': 'application/json',
                   'Authorization': 'Bearer '+remoteDBCreds.refreshJWT },
        data: {
            username: remoteDBCreds.dbUsername,
            password: password,
            email: remoteDBCreds.email,
            fullname: remoteDBCreds.fullName,
            deviceUUID: remoteDBState.deviceUUID
        }           
    };
    response = await CapacitorHttp.post(options);
    return response;
}

export function getTokenInfo(JWT: string) {
    let tokenResponse = {
        valid : false,
        expireDate: 0
    }
    let JWTDecode;
    let JWTDecodeValid = true;
    try { JWTDecode = jwt_decode(JWT);}
    catch(err) {console.log("INVALID access token:",err); JWTDecodeValid= false}
    if (JWTDecodeValid) {
        tokenResponse.valid = true;
        tokenResponse.expireDate = (JWTDecode as any).exp
    }
    return(tokenResponse);
}

export async function refreshToken(remoteDBCreds: DBCreds, devID: string) {
    console.log("refreshing token, device id: ", devID);
    console.log("apiserverURL:", remoteDBCreds.apiServerURL);
    let response: HttpResponse | undefined;
    const options = {
        url: String(remoteDBCreds.apiServerURL+"/refreshtoken"),
        method: "POST",
        headers: { 'Content-Type' : 'application/json',
                    'Accept': 'application/json',
                    'Authorization': 'Bearer '+remoteDBCreds.refreshJWT},
        connectTimeOut: 5,            
        data: {
            refreshJWT: remoteDBCreds.refreshJWT,
            deviceUUID: devID
        }            
    };
    try { response = await CapacitorHttp.post(options);}
    catch(err) { console.log(err);}
    return response;
}