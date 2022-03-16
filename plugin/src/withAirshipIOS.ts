import {
  ConfigPlugin,
  withEntitlementsPlist,
  withInfoPlist
} from '@expo/config-plugins';

import { AirshipIOSPluginProps } from './withAirship';  

const withCapabilities: ConfigPlugin<AirshipIOSPluginProps> = (config, props) => {
  return withInfoPlist(config, (plist) => {
    if (!Array.isArray(plist.modResults.UIBackgroundModes)) {
      plist.modResults.UIBackgroundModes = [];
    }

    if (!plist.modResults.UIBackgroundModes.includes("remote-notification")) {
      plist.modResults.UIBackgroundModes.push("remote-notification");
    }
    return plist;
  });
};

const withAPNSEnvironment: ConfigPlugin<AirshipIOSPluginProps> = (config, props) => {
  return withEntitlementsPlist(config, (plist) => {
    plist.modResults['aps-environment'] = props.mode
    return plist;
  });
};

export const withAirshipIOS: ConfigPlugin<AirshipIOSPluginProps> = (config, props) => {
  config = withCapabilities(config, props)
  config = withAPNSEnvironment(config, props)
  return config;
};