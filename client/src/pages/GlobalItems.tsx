import { IonContent, IonPage, IonList, IonItem } from '@ionic/react';
import { useFind } from 'use-pouchdb';
import { useRef } from 'react';
import { HistoryProps} from '../components/DataTypes';
import { GlobalItemDocs } from '../components/DBSchema';

import './GlobalItems.css';
import ErrorPage from './ErrorPage';
import { Loading } from '../components/Loading';
import PageHeader from '../components/PageHeader';

// The AllItems component is a master editor of all of the known items in the database.
// Each item has a name, along with data about each list the item is on (list ID, quantity, count of number of times bought,
// and status for active (on the list), and complete (on the list and checked off) )


const GlobalItems: React.FC<HistoryProps> = (props: HistoryProps) => {
  const { docs: globalItemDocs, loading: globalItemsLoading, error: globalItemsError} = useFind({
    index: { fields: [ "type","name"]},
    selector: { type: "globalitem","name": { $exists: true}}  })

  const screenLoading = useRef(true);


  if (globalItemsError ) { return (
    <ErrorPage errorText="Error Loading Global Item Information... Restart."></ErrorPage>
    )}

  if (globalItemsLoading) { 
    return ( <Loading isOpen={screenLoading.current} message="Loading Global Items..."    /> )
//    setIsOpen={() => {screenLoading.current = false}} /> )
  }
  
  screenLoading.current = false;

  (globalItemDocs as GlobalItemDocs).sort((a,b) => (
    a.name.toLocaleUpperCase().localeCompare(b.name.toLocaleUpperCase())
  ));

  return (
    <IonPage>
      <PageHeader title="Global Items" />
      <IonContent>
        {globalItemDocs.length === 0 ?(<IonList><IonItem>No Global Items Available</IonItem></IonList>) : <></> }
        {(globalItemDocs as GlobalItemDocs).map(gi => (
             <IonItem button key={gi._id} class="list-button" routerLink={("/globalitem/edit/" + gi._id)}>{gi.name}</IonItem>
        ))}
      </IonContent>
    </IonPage>
  );
};

export default GlobalItems;