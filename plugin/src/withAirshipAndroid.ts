import {
    ConfigPlugin,
    withDangerousMod,
    withProjectBuildGradle
} from '@expo/config-plugins';

import { generateImageAsync, ImageOptions } from '@expo/image-utils';
import { readFile, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, basename, join } from 'path';

import { AirshipAndroidPluginProps } from './withAirship';

const iconSizeMap: Record<string, number> = {
  mdpi: 24,
  hdpi: 32,
  xhdpi: 48,
  xxhdpi: 72,
  xxxhdpi: 96,
};

const NOTIFICATIONS_CHANNELS_FILE_NAME = "ua_custom_notification_channels.xml";

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

// TODO copy the file from assets to xml res
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

export const withAirshipAndroid: ConfigPlugin<AirshipAndroidPluginProps> = (config, props) => {  
  config = withCompileSDKVersionFix(config, props);
  config = withNotificationIcons(config, props);
  config = withCustomNotificationChannels(config, props);
  return config;
};