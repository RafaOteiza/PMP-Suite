import { useOutletContext } from "react-router-dom";
import type { Me } from "../api/me";
import { can, PERMISSIONS } from "../app/rbac";
import LabEquipmentView from "../components/LabEquipmentView";

export default function LabValidadoresPage() {
  const me = useOutletContext<Me | null>();
  const canWrite = can(me, PERMISSIONS.LAB_WRITE);
  return <LabEquipmentView me={me} canWrite={canWrite} type="VALIDADOR" />;
}
