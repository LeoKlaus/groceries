import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonList, IonItem, IonButtons, 
  IonMenuButton, IonButton, IonFab, IonFabButton, IonIcon, IonLoading} from '@ionic/react';
import { useRef } from 'react';
import { add } from 'ionicons/icons';
import SyncIndicator from '../components/SyncIndicator';
import { HistoryProps, ListCombinedRow, RowType } from '../components/DataTypes';
import './ListGroups.css';
import { useLists } from '../components/Usehooks';
import ErrorPage from './ErrorPage';
import Loading  from '../components/Loading';

const ListGroups: React.FC<HistoryProps> = (props: HistoryProps) => {

  const { listRowsLoaded, listCombinedRows, dbError: listError} = useLists();
  const screenLoading = useRef(false);

  if (listError) { return(
    <ErrorPage errorText="Error Loading List Groups Information... Restart."></ErrorPage>
  )}

  if (!listRowsLoaded) { 
    return ( <Loading isOpen={screenLoading.current} message="Loading List Groups"
    setIsOpen={() => {screenLoading.current = false}} />
  )}

  screenLoading.current=false;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle class="ion-no-padding">List Groups</IonTitle>
          <SyncIndicator history={props.history}/>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList lines="full">
               {listCombinedRows.map((row: ListCombinedRow) => { 
                  if (row.rowType === RowType.listGroup) { return (
                  (<IonItem key={row.rowKey} >
                    <IonButton slot="start" class="textButton" fill="clear" routerLink={("/listgroup/edit/" + row.listGroupID)}>{row.rowName}</IonButton>
                  </IonItem>))} }
        )}
        </IonList>
      </IonContent>
      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton routerLink={"/listgroup/new/new"}>
          <IonIcon icon={add}></IonIcon>
        </IonFabButton>
      </IonFab>
    </IonPage>
  );
};

export default ListGroups;
