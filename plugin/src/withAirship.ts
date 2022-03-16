import { ConfigPlugin, createRunOncePlugin } from '@expo/config-plugins';

import { withAirshipAndroid } from './withAirshipAndroid';
import { withAirshipIOS } from './withAirshipIOS';

const pkg = require('airship-expo-plugin/package.json');

export type AirshipAndroidPluginProps = {
    icon: string;
};

export type AirshipIOSPluginProps = {
    mode: 'development' | 'production';
}

export type AirshipPluginProps = {
    android?: AirshipAndroidPluginProps;
    ios?: AirshipIOSPluginProps;
};

const withAirship: ConfigPlugin<AirshipPluginProps> = (config, props) => {
  if (props.android) {
    config = withAirshipAndroid(config, props.android);
  }
  
  if (props.ios) {
    config = withAirshipIOS(config, props.ios);
  }
  return config;
};

export default createRunOncePlugin(withAirship, pkg.name, pkg.version);
