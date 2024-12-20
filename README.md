# Airship Expo Plugin

Airship [Expo Config Plugin](https://docs.expo.dev/guides/config-plugins/). This plugin modifies the managed workflow builds to enable Push Notifications on both iOS and Android.

## Installing

```sh
expo install airship-expo-plugin
yarn add urbanairship-react-native
```

### Configuring the plugin

Add the plugin to the app.json:

```json
  "plugins":[
    [
      "airship-expo-plugin",
      {
        "android":{
          "icon": "./assets/ic_notification.png",
          "customNotificationChannels": "./assets/notification_channels.xml",
          "airshipExtender": "./assets/AirshipExtender.kt"
        },
        "ios":{
          "mode": "development",
          "notificationService": "./assets/NotificationService.swift",
          "notificationServiceInfo": "./assets/NotificationServiceExtension-Info.plist",
          "notificationServiceTargetName": "NotificationServiceExtension",
          "developmentTeamID": "MY_TEAM_ID",
          "airshipExtender": "./assets/AirshipPluginExtender.swift"
        }
      }
    ]
  ]
```

Android Config:
- icon: Required. Local path to an image to use as the icon for push notifications. 96x96 all-white png with transparency. The name of the icon will be the resource name.
- customNotificationChannels: Optional. The local path to a Custom Notification Channels resource file.
- airshipExtender: Optional. The local path to a AirshipExtender.kt file.

iOS Config:
- mode: Required. The APNS entitlement. Either `development` or `production`.
- notificationService: Optional. The local path to a custom Notification Service Extension or `DEFAULT_AIRSHIP_SERVICE_EXTENSION` for Airship's default one.
- notificationServiceInfo: Optional. Airship will use a default one if not provided. The local path to a Notification Service Extension Info.plist.
- notificationServiceTargetName: Optional. Defaults to NotificationServiceExtension if not provided.
- developmentTeamID: Optional. The Apple Development Team ID used to configure the Notification Service Extension target.
- airshipExtender: Optional. The local path to a AirshipPluginExtender.swift file.

## Calling takeOff

Call takeOff in the app initializes:

```ts
import { UrbanAirship } from 'urbanairship-react-native';

UrbanAirship.takeOff({
  default: {
    appSecret: "REPLACE_WITH_YOUR_APP_SECRET",
    appKey: "REPLACE_WITH_YOUR_APP_KEY"
  },
  site: "us",
  urlAllowList: ["*"],
  android: {
    notificationConfig: {
      icon: "ic_notification", // should match file name above
      accentColor: "#00ff00"
    }
  }
});
```

The Airship SDK can only be initialized once, and after being initialized the config will be applied
on the next app start. Calling takeOff from React multiple times is allowed, but the config will not
be applied until the next app run.
