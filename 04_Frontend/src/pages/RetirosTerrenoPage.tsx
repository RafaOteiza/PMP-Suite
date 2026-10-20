import { ClipboardList } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import TerrainWithdrawalAssignments from '../components/TerrainWithdrawalAssignments';

export default function RetirosTerrenoPage() {
  return <div className="page">
    <PageHeader title="Retiros de terreno" eyebrow="Operación" description="Coordina los retiros físicos pendientes y asigna al técnico responsable." icon={<ClipboardList size={21}/>}/>
    <TerrainWithdrawalAssignments/>
  </div>;
}
