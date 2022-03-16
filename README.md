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
          "icon":"./assets/ic_notification.png"
        },
        "ios":{
          "mode": "development"
        }
      }
    ]
  ]
```

Android Config:
- icon: Local path to an image to use as the icon for push notifications. 96x96 all-white png with transparency. The name of the icon will be the resource name.

iOS Config:
- mode: The APNS entitlement. Either `development` or `production`

## Calling takeOff

Call takeOff in the app initializes:

```ts
import { UrbanAirship } from 'urbanairship-react-native';

UrbanAirship.takeOff({
  default: {
    appSecret: "REPLACE_WITH_YOUR_APP_KEY",
    appKey: "REPLACE_WITH_YOUR_APP_SECRET"
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
