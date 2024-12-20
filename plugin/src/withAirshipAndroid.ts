import {
    ConfigPlugin,
    AndroidConfig,
    withDangerousMod,
    withProjectBuildGradle,
    withAndroidManifest
} from '@expo/config-plugins';

import { generateImageAsync, ImageOptions } from '@expo/image-utils';
import { readFile, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, basename, join } from 'path';

import assert from 'assert';

import { AirshipAndroidPluginProps } from './withAirship';

const iconSizeMap: Record<string, number> = {
  mdpi: 24,
  hdpi: 32,
  xhdpi: 48,
  xxhdpi: 72,
  xxxhdpi: 96,
};

const NOTIFICATIONS_CHANNELS_FILE_NAME = "ua_custom_notification_channels.xml";

const AIRSHP_PLUGIN_EXTENDER_CLASS_NAME = "AirshipExtender";

const { addMetaDataItemToMainApplication, getMainApplicationOrThrow } = AndroidConfig.Manifest;

async function writeNotificationIconImageFilesAsync(props: AirshipAndroidPluginProps, projectRoot: string) {
  const fileName = basename(props.icon)
  await Promise.all(
    Object.entries(iconSizeMap).map(async (entry) => {
      const iconSizePx = entry[1]
      const resourceDir = resolve(projectRoot, 'android/app/src/main/res/', "drawable-" + entry[0]);

      if (!existsSync(resourceDir)) {
        mkdirSync(resourceDir, { recursive: true });
      }

      const options = {
        projectRoot: projectRoot,
        cacheType: 'airship'
      };

      const imageOptions: ImageOptions = {
        src: props.icon,
        width: iconSizePx,
        height: iconSizePx,
        resizeMode: 'cover',
        backgroundColor: 'transparent',
      };

      const result = await generateImageAsync(options, imageOptions);
      writeFileSync(resolve(resourceDir, fileName), result.source);
    })
  );
};

const withNotificationIcons: ConfigPlugin<AirshipAndroidPluginProps> = (config, props) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      await writeNotificationIconImageFilesAsync(props, config.modRequest.projectRoot);
      return config;
    },
  ]);
};

const withCompileSDKVersionFix: ConfigPlugin<AirshipAndroidPluginProps> = (config, props) => {
  return withProjectBuildGradle(config, (gradle) => {
    if (!gradle.modResults.contents.includes(`compileSdkVersion = 30`)) {
      return gradle;
    }

    gradle.modResults.contents = gradle.modResults.contents.replace(
      'compileSdkVersion = 30',
      'compileSdkVersion = 31'
    );
    return gradle;
  });
};

const withCustomNotificationChannels: ConfigPlugin<AirshipAndroidPluginProps> = (config, props) => {
  return withDangerousMod(config, [
    'android',
    async config => {
      await writeNotificationChannelsFileAsync(props, config.modRequest.projectRoot);
      return config;
    },
  ]);
}

async function writeNotificationChannelsFileAsync(props: AirshipAndroidPluginProps, projectRoot: string) {
  if (!props.customNotificationChannels) {
    return;
  }

  const xmlResPath = join(projectRoot, "android/app/src/main/res/xml");

  if (!existsSync(xmlResPath)) {
    mkdirSync(xmlResPath, { recursive: true });
  }

  // Copy the custom notification channels file into the Android expo project as ua_custom_notification_channels.xml.
  readFile(props.customNotificationChannels, 'utf8', (err, data) => {
    if (err || !data) {
      console.error("Airship couldn't read file " + props.customNotificationChannels);
      console.error(err);
      return;
    }
    writeFileSync(join(xmlResPath, NOTIFICATIONS_CHANNELS_FILE_NAME), data);
  });
};

const withAirshipExtender: ConfigPlugin<AirshipAndroidPluginProps> = (config, props) => {
  return withDangerousMod(config, [
    'android',
    async config => {
      assert(config.android?.package, "Missing 'android.package' in app config.")
      await writeAirshipExtenderFileAsync(props, config.modRequest.projectRoot, config.android.package);
      return config;
    },
  ]);
}

async function writeAirshipExtenderFileAsync(props: AirshipAndroidPluginProps, projectRoot: string, packageName: string) {
  if (!props.airshipExtender) {
    return;
  }

  const fileName = basename(props.airshipExtender)
  const extenderDestinationPath = join(projectRoot, "android/app/src/main/java", packageName.split('.').join('/'));

  if (!existsSync(extenderDestinationPath)) {
    mkdirSync(extenderDestinationPath, { recursive: true });
  }

  // Copy the Airship Extender file into the Android expo project.
  readFile(props.airshipExtender, 'utf8', (err, data) => {
    if (err || !data) {
      console.error("Airship couldn't read file " + (props.airshipExtender));
      console.error(err);
      return;
    }
    writeFileSync(join(extenderDestinationPath, fileName), data);
  });
};

const withAirshipExtenderInManifest: ConfigPlugin<AirshipAndroidPluginProps> = (config, props) => {
  return withAndroidManifest(config, async config => {
    assert(config.android?.package, "Missing 'android.package' in app config.")
    config.modResults = await setCustomConfigAsync(config.android.package, config.modResults);
    return config;
  });
};

async function setCustomConfigAsync(
  packageName: string,
  androidManifest: AndroidConfig.Manifest.AndroidManifest
): Promise<AndroidConfig.Manifest.AndroidManifest> {
  // Get the <application /> tag and assert if it doesn't exist.
  const mainApplication = getMainApplicationOrThrow(androidManifest);

  addMetaDataItemToMainApplication(
    mainApplication,
    // value for `android:name`
    'com.urbanairship.plugin.extender',
    // value for `android:value`
    `${packageName}.${AIRSHP_PLUGIN_EXTENDER_CLASS_NAME}`
  );

  return androidManifest;
}

export const withAirshipAndroid: ConfigPlugin<AirshipAndroidPluginProps> = (config, props) => {  
  config = withCompileSDKVersionFix(config, props);
  config = withNotificationIcons(config, props);
  config = withCustomNotificationChannels(config, props);
  if (props.airshipExtender) {
    config = withAirshipExtender(config, props);
    config = withAirshipExtenderInManifest(config, props);
  }
  return config;
};