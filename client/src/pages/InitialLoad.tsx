import { IonHeader, IonPage, IonTitle, IonToolbar, IonLoading } from '@ionic/react';
import { useContext, useEffect, useRef} from 'react';
import { usePouch } from 'use-pouchdb';
import { ConnectionStatus, RemoteDBStateContext } from '../components/RemoteDBState';
import { navigateToFirstListID } from '../components/RemoteUtilities';
import { initialSetupActivities } from '../components/Utilities';
import ErrorPage from './ErrorPage';
import { History } from 'history';
import { GlobalDataContext } from '../components/GlobalDataProvider';
import { useTranslation } from 'react-i18next';

type InitialLoadProps = {
  history : History
}

const InitialLoad: React.FC<InitialLoadProps> = (props: InitialLoadProps) => {
    const { remoteDBState, remoteDBCreds, remoteDB,setConnectionStatus} = useContext(RemoteDBStateContext);
    const { listError ,listRowsLoaded, listRows } = useContext(GlobalDataContext)
    const db=usePouch();
    const screenLoading = useRef(true);
    const { t } = useTranslation();
  
    useEffect(() => {
        async function initialStartup() {
            await initialSetupActivities(remoteDB as PouchDB.Database, String(remoteDBCreds.dbUsername));
            screenLoading.current=false;
            await navigateToFirstListID(props.history,remoteDBCreds,listRows);
            setConnectionStatus(ConnectionStatus.initialNavComplete);
        }
        if (listRowsLoaded) {
            if ((remoteDBState.connectionStatus === ConnectionStatus.loginComplete)) {
                initialStartup();
            } 
        }      
    },[db, listRows, props.history, remoteDBCreds, remoteDBState.connectionStatus, listRowsLoaded])   

    useEffect(() => {
        async function dismissToLogin() {
            screenLoading.current = false;
            setConnectionStatus(ConnectionStatus.onLoginScreen);
            props.history.push("/login");
        }
        if (remoteDBState.connectionStatus === ConnectionStatus.navToLoginScreen) {
            dismissToLogin();
        }
    },[remoteDBState.connectionStatus])

    if (listError) {return (
        <ErrorPage errorText={t("error.loading_list_info") as string}></ErrorPage>
    )}

    return (
    <IonPage>
        <IonHeader>
            <IonToolbar>
                <IonTitle id="initialloadtitle">{t("general.loading")}</IonTitle>
                <IonLoading isOpen={screenLoading.current} onDidDismiss={() => {screenLoading.current=false;}} 
                            message={t("general.logging_in") as string} />
            </IonToolbar>
        </IonHeader>
    </IonPage>

    )

}

export default InitialLoad;
