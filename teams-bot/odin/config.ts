import { getConfig } from "./src/config/index";

const config = {
  get MicrosoftAppId(): string {
    return getConfig().microsoftAppId;
  },
  get MicrosoftAppType(): string {
    return getConfig().botType;
  },
  get MicrosoftAppTenantId(): string {
    return getConfig().tenantId;
  },
  get MicrosoftAppPassword(): string {
    return getConfig().microsoftAppPassword;
  },
};

export default config;
