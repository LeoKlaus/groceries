import React, { createContext, useState, useContext, useEffect, useRef} from "react";
import { NavContext } from "@ionic/react";
import { usePouch} from 'use-pouchdb';
import { Preferences } from '@capacitor/preferences';
import { cloneDeep, pick, keys, isEqual } from 'lodash';
import { isJsonString, urlPatternValidation, emailPatternValidation,DEFAULT_DB_NAME, DEFAULT_DB_URL_PREFIX, DEFAULT_API_URL } from '../components/Utilities'; 
import { CapacitorHttp, HttpResponse } from '@capacitor/core';


import PouchDB from 'pouchdb';
// import { ConnectionStatus } from "./RemoteUtilities";

export type RemoteDBState = {
    remoteDB: PouchDB.Database | undefined,
    dbCreds: DBCreds,
    syncStatus: SyncStatus,
    connectionStatus: ConnectionStatus,
    dbUUIDAction: DBUUIDAction,
    credsError: boolean,
    credsErrorText: string
}

export interface RemoteDBStateContextType {
    remoteDBState: RemoteDBState,
    setRemoteDBState: React.SetStateAction<RemoteDBState>,
    startSync: any,
    errorCheckCreds: any,
    checkDBUUID: DBUUIDCheck,
    assignDBAndSync: boolean,
    setDBCredsValue: any
}

export enum SyncStatus {
    init = 0,
    active = 1,
    paused = 2,
    error = 3,
    denied = 4,
    offline = 5
  }

export enum DBUUIDAction {
    none = 0,
    exit_no_uuid_on_server = 1,
    destroy_needed = 2
}  

export type DBUUIDCheck = {
    checkOK: boolean,
    dbUUIDAction: DBUUIDAction
}
  
const DBUUIDCheckInit: DBUUIDCheck = {
    checkOK: true,
    dbUUIDAction: DBUUIDAction.none
}

export type CredsCheck = {
    credsError: boolean,
    errorText: string
}

const CredsCheckInit: CredsCheck = {
    credsError: false,
    errorText: ""
}

export enum ConnectionStatus {
    cannotStart = 0,
    navToLoginScreen = 12,
    onLoginScreen = 13,
    loginComplete = 14,
    initialNavComplete = 15
}

export interface DBCreds {
    apiServerURL: string | null,
    couchBaseURL: string | null,
    database: string | null,
    dbUsername: string | null,
    email: string | null,
    fullName: string | null,
    JWT: string | null,
    remoteDBUUID: string | null
}

export const DBCredsInit: DBCreds = {
    apiServerURL: null, couchBaseURL: null, database: null,
    dbUsername: null, email: null, fullName: null, JWT: null, remoteDBUUID: null
}

const initialState: RemoteDBState = {
    remoteDB: undefined ,
    dbCreds: DBCredsInit,
    syncStatus: SyncStatus.init,
    connectionStatus: ConnectionStatus.cannotStart,
    dbUUIDAction: DBUUIDAction.none,
    credsError: false,
    credsErrorText: ""
}

const initialContext = {
    remoteDBState: initialState,
    setRemoteDBState: (state: RemoteDBState ) => {},
    startSync: () => {},
    errorCheckCreds: (credsObj: DBCreds,background: boolean, creatingNewUser: boolean = false, password: string = "", verifyPassword: string = ""): CredsCheck => {return CredsCheckInit},
    checkDBUUID: async (remoteDB: PouchDB.Database,credsObj: DBCreds): Promise<DBUUIDCheck> => {return DBUUIDCheckInit },
    assignDBAndSync: async (credsObj: DBCreds): Promise<boolean> => {return false},
    setDBCredsValue: (key: any, value: any) => {}
}

export const RemoteDBStateContext = createContext(initialContext)

type RemoteDBStateProviderProps = {
    children: React.ReactNode;
}

export const RemoteDBStateProvider: React.FC<RemoteDBStateProviderProps> = (props: RemoteDBStateProviderProps) => {
    const [remoteDBState,setRemoteDBState] = useState<RemoteDBState>(initialState);
    const db=usePouch();
    const {navigate} = useContext(NavContext);
    const loginAttempted = useRef(false);

    function setSyncStatus(status: number) {
        setRemoteDBState(prevState => ({...prevState,syncStatus: status}))
    }

    function setDBCredsValue(key: any, value: any) {
        setRemoteDBState(prevState => ({...prevState, dbCreds: {...prevState.dbCreds,[key]: value}}))
    }

    function startSync(remoteDB: PouchDB.Database) {
        const sync = db.sync((remoteDB), {
            back_off_function: function(delay) {
                console.log("going offline");
                setSyncStatus(SyncStatus.offline);
                if (delay===0) {return 1000};
                if (delay < 60000) {return delay*1.5} else {return 60000};
            },
            retry: true,
            live: true,
          }).on('paused', () => { setSyncStatus(SyncStatus.paused)})
            .on('active', () => { setSyncStatus(SyncStatus.active)})
            .on('denied', (err) => { setSyncStatus(SyncStatus.denied); console.log("sync denied: ",{err})})
            .on('error', (err) => { console.log ("error state",{err}) ; 
                              setSyncStatus(SyncStatus.error)})
        console.log("sync started");
    }

    async function  getPrefsDBCreds()  {
        let { value: credsStr } = await Preferences.get({ key: 'dbcreds'});
        let credsObj: DBCreds = DBCredsInit;
        const credsOrigKeys = keys(credsObj);
        if (isJsonString(String(credsStr))) {
          credsObj=JSON.parse(String(credsStr));
          let credsObjFiltered=pick(credsObj,['apiServerURL','couchBaseURL','database','dbUsername','email','fullName','JWT',"remoteDBUUID"])
          setRemoteDBState(prevstate => ({...prevstate,dbCreds: credsObjFiltered}))
          return (credsObjFiltered);
        }
        const credKeys = keys(credsObj);
        if (credsObj == null || (credsObj as any).apiServerURL == undefined || (!isEqual(credsOrigKeys.sort(),credKeys.sort()))) {
            credsObj = { apiServerURL: DEFAULT_API_URL,
                couchBaseURL: DEFAULT_DB_URL_PREFIX,
                database: DEFAULT_DB_NAME,
                dbUsername:"",
                JWT:"",
                email: "",
                fullName: "",
                remoteDBUUID:"" };
            setRemoteDBState(prevstate => ({...prevstate, dbCreds: credsObj}))
            return (credsObj);
        }
      }
    
      function errorCheckCreds(credsObj: DBCreds,background: boolean, creatingNewUser: boolean = false, password: string = "", verifyPassword: string = "") {
        let credsCheck={
            credsError: false,
            errorText: ""
        }
        function setError(err: string) {
            credsCheck.credsError = true; credsCheck.errorText=err;
        }
        if (background && (credsObj.JWT == null || credsObj.JWT == "")) {
            setError("No existing credentials found"); return credsCheck;}
        if (credsObj.apiServerURL == null || credsObj.apiServerURL == "") {
            setError("No API Server URL entered"); return credsCheck;}    
        if ((background) && (credsObj.couchBaseURL == null || credsObj.couchBaseURL == "")) {
            setError("No CouchDB URL found"); return credsCheck;}
        if (!urlPatternValidation(credsObj.apiServerURL)) {
            setError("Invalid API URL"); return credsCheck;}
        if ((background) && (!urlPatternValidation(String(credsObj.couchBaseURL)))) {
            setError("Invalid CouchDB URL"); return credsCheck;}
        if (credsObj.apiServerURL.endsWith("/")) {
            credsObj.apiServerURL = String(credsObj.apiServerURL?.slice(0,-1))}
        if (String(credsObj.couchBaseURL).endsWith("/")) {
            credsObj.couchBaseURL = String(credsObj.couchBaseURL?.slice(0,-1))}
        if ((background) && (credsObj.database == null || credsObj.database == "")) {
            setError("No database name found"); return credsCheck;}
        if (credsObj.dbUsername == null || credsObj.dbUsername == "") {
            setError("No database user name entered"); return credsCheck;}
        if ((creatingNewUser) && (credsObj.email == null || credsObj.email == "")) {
            setError("No email entered"); return credsCheck;}
        if ((creatingNewUser) && (!emailPatternValidation(String(credsObj.email)))) {
            setError("Invalid email format"); return credsCheck;}
        if ((!background && !creatingNewUser) && (password == undefined || password == "")) {
            setError("No password entered"); return credsCheck;}
        if ((creatingNewUser) && (password != verifyPassword)) {
            setError("Passwords do not match"); return credsCheck;}
        return credsCheck;
    }
    
    async function checkJWT(credsObj: DBCreds) {
        let JWTOK = false;
        let response: HttpResponse | undefined;
        const options = {
            url: String(credsObj.couchBaseURL+"/_session"),
            method: "GET",
            headers: { 'Content-Type': 'application/json',
                       'Accept': 'application/json',
                       'Authorization': 'Bearer '+ credsObj.JWT },
              };
        response = await CapacitorHttp.get(options);
        if ((response?.status == 200) && (response.data?.userCtx?.name != null)) {
            JWTOK = true;
        } else {
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: "Invalid JWT credentials"}));
        }
        return JWTOK;
    } 

    async function checkDBUUID(remoteDB: PouchDB.Database, credsObj: DBCreds) {
        let UUIDCheck: DBUUIDCheck = {
            checkOK: true,
            dbUUIDAction: DBUUIDAction.none
        }
        console.log("In Compare Remote DBUUID");
        let UUIDResults = await (remoteDB as PouchDB.Database).find({
            selector: { "type": { "$eq": "dbuuid"} } })
        let UUIDResult : null|string = null;
        if (UUIDResults.docs.length > 0) {
          UUIDResult = (UUIDResults.docs[0] as any).uuid;
        }
        if (UUIDResult == null) {
          console.log("ERROR: No database UUID defined in server todos database. Cannot continue");
          UUIDCheck.checkOK = false; UUIDCheck.dbUUIDAction = DBUUIDAction.exit_no_uuid_on_server;
          return UUIDCheck;
        }
          // compare to current DBCreds one.
        if (credsObj.remoteDBUUID == UUIDResult) {
          console.log("Compared the same");
          return UUIDCheck;
        } 
        let localDBInfo = null;
        let localHasRecords = false;
        try { localDBInfo = await db.info();} catch(e) {localHasRecords=false};
        if (localDBInfo != null && localDBInfo.doc_count > 0) { localHasRecords = true}
        console.log({localDBInfo,localHasRecords});
        if (localHasRecords) {
          let localDBAllDocs = null;
          try { localDBAllDocs = await db.allDocs({include_docs: true});} catch(e) {console.log(e)};
          console.log(localDBAllDocs);
          if ((localDBAllDocs != null) &&
              (localDBInfo?.doc_count == 1) &&
             ((localDBAllDocs.rows[0]?.doc) as any).language == "query")
             { localHasRecords = false }
        }  
  
          // if current DBCreds doesn't have one, set it to the remote one.
        if ((credsObj.remoteDBUUID == null || credsObj.remoteDBUUID == "" ) && !localHasRecords) {
            credsObj.remoteDBUUID = UUIDResult;
          console.log("none defined locally, setting");
          return UUIDCheck;
        }
        UUIDCheck.checkOK = false; UUIDCheck.dbUUIDAction = DBUUIDAction.destroy_needed;
        return UUIDCheck;

      }
  
    async function setPrefsDBCreds(credsObj: DBCreds) {
        let credsStr = JSON.stringify(credsObj);
        setRemoteDBState(prevState => ({...prevState,dbCreds: credsObj}))
        await Preferences.set({key: 'dbcreds', value: credsStr})  
    }


    async function assignDBAndSync(credsObj: DBCreds): Promise<boolean> {
        let assignSuccessful = true;
        let remoteDB = new PouchDB(credsObj.couchBaseURL+"/"+credsObj.database, 
        { fetch: (url, opts: any) => ( 
             fetch(url, { ...opts, credentials: 'include', headers:
              { ...opts.headers, 'Authorization': 'Bearer '+credsObj.JWT, 'Content-type': 'application/json' }})
              )} );
        setRemoteDBState(prevState => ({...prevState,remoteDB: remoteDB}));
        let DBUUIDCheck = await checkDBUUID(remoteDB,credsObj);
        if (!DBUUIDCheck.checkOK) {
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: "Invalid DBUUID", dbUUIDAction: DBUUIDCheck.dbUUIDAction}))
            assignSuccessful = false;
        } else {
            await setPrefsDBCreds(credsObj);
            startSync(remoteDB);
        }
        return assignSuccessful;
    }

    async function attemptFullLogin() {
        let credsObj = await getPrefsDBCreds();
        let credsCheck =  errorCheckCreds(credsObj,true);
        console.log({credsCheck});
        if (credsCheck.credsError) {
            setRemoteDBState(prevState => ({...prevState,credsError: true, credsErrorText: credsCheck.errorText, connectionStatus: ConnectionStatus.navToLoginScreen}))
            console.log("was creds error, about to navigate");
//            navigate("/login");
            return;
        } 
        let JWTCheck = await checkJWT(credsObj);
        if (!JWTCheck) {
             console.log("JWT Check Error");
//            navigate("/login");
        }
        let assignSuccess = await assignDBAndSync(credsObj);
        console.log("assign success: ",assignSuccess);
//        if (!assignSuccess) {navigate("/login")};
    }

    useEffect(() => {      
        console.log("initializing in useeffect attempted:,",loginAttempted);;
        if (!loginAttempted.current) {
            console.log("attempting login...");
            attemptFullLogin()
            loginAttempted.current = true;
            setRemoteDBState(prevState => ({...prevState,loginAttempted: true}))
        }
      },[])
  
    useEffect(() => {
        if (remoteDBState.syncStatus == SyncStatus.active || remoteDBState.syncStatus == SyncStatus.paused) {
            setRemoteDBState(prevState => ({...prevState,connectionStatus: ConnectionStatus.loginComplete}));
        }
    },[remoteDBState.syncStatus])



    let value: any = {remoteDBState, setRemoteDBState, startSync, errorCheckCreds, checkDBUUID, assignDBAndSync, setDBCredsValue};
    return (
        <RemoteDBStateContext.Provider value={value}>{props.children}</RemoteDBStateContext.Provider>
      );
}


