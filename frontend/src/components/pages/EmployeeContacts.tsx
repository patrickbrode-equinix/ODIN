import { EnterprisePageShell, EnterpriseCard, EnterpriseHeader } from "../layout/EnterpriseLayout";
import { EmployeeContactsPanel } from "../shiftplan/EmployeeContactsPanel";
import { useLanguage } from "../../context/LanguageContext";

export default function EmployeeContacts() {
  const { t } = useLanguage();
  return (
    <EnterprisePageShell>
      <EnterpriseHeader title={t("employeeContacts.title")} subtitle={t("employeeContacts.subtitle")} />
      <EnterpriseCard>
        <EmployeeContactsPanel />
      </EnterpriseCard>
    </EnterprisePageShell>
  );
}
