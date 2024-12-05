import { ConfigPlugin, createRunOncePlugin } from '@expo/config-plugins';

import { withAirshipAndroid } from './withAirshipAndroid';
import { withAirshipIOS } from './withAirshipIOS';

const pkg = require('airship-expo-plugin/package.json');

export type AirshipAndroidPluginProps = {
  /**
   * Required. Local path to an image to use as the icon for push notifications.
   * 96x96 all-white png with transparency. The name of the icon will be the resource name.
   */
  icon: string;
  /**
   * Optional. The local path to a Custom Notification Channels resource file.
   */
  customNotificationChannels?: string;
};

export type AirshipIOSPluginProps = {
  /**
   * Required. The APNS entitlement. Either "development" or "production".
   */
  mode: 'development' | 'production';
  /**
   * Optional. The local path to a custom Notification Service Extension.
   */
  notificationService?: string;
  /**
   * Optional. Airship will use a default one if not provided.
   * The local path to a Notification Service Extension Info.plist.
   */
  notificationServiceInfo?: string;
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
