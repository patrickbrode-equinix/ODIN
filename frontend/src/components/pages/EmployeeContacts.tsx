import { EnterprisePageShell, EnterpriseCard, EnterpriseHeader } from "../layout/EnterpriseLayout";
import { EmployeeContactsPanel } from "../shiftplan/EmployeeContactsPanel";

export default function EmployeeContacts() {
  return (
    <EnterprisePageShell>
      <EnterpriseHeader title="Mitarbeiter-Kontakte" subtitle="E-Mail-Adressen für Schichtplan-Benachrichtigungen" />
      <EnterpriseCard>
        <EmployeeContactsPanel />
      </EnterpriseCard>
    </EnterprisePageShell>
  );
}
