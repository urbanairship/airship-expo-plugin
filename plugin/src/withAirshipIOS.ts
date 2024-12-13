import {
  ConfigPlugin,
  withEntitlementsPlist,
  withInfoPlist,
  withDangerousMod,
  withXcodeProject,
  withPodfile
} from '@expo/config-plugins';

import { readFile, writeFileSync, existsSync, mkdirSync } from 'fs';
import { basename, join } from 'path';
import assert from 'assert';

import { ExpoConfig } from '@expo/config-types';

import { AirshipIOSPluginProps } from './withAirship';
import { mergeContents, MergeResults } from '@expo/config-plugins/build/utils/generateCode';

const DEFAULT_NOTIFICATION_SERVICE_EXTENSION_TARGET_NAME = "NotificationServiceExtension";
const NOTIFICATION_SERVICE_FILE_NAME = "AirshipNotificationService.swift";
const NOTIFICATION_SERVICE_INFO_PLIST_FILE_NAME = "NotificationServiceExtension-Info.plist";

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
    plist.modResults['aps-environment'] = props.mode;
    return plist;
  });
};

const withNotificationServiceExtension: ConfigPlugin<AirshipIOSPluginProps> = (config, props) => {
  return withDangerousMod(config, [
    'ios',
    async config => {
      await writeNotificationServiceFilesAsync(props, config.modRequest.projectRoot);
      return config;
    },
  ]);
};

async function writeNotificationServiceFilesAsync(props: AirshipIOSPluginProps, projectRoot: string) {
  if (!props.notificationService) {
    return;
  }

  const pluginDir = require.resolve("airship-expo-plugin/package.json");
  const sourceDir = join(pluginDir, "../plugin/NotificationServiceExtension/");
  const targetName = props.notificationServiceTargetName ?? DEFAULT_NOTIFICATION_SERVICE_EXTENSION_TARGET_NAME
  const extensionPath = join(projectRoot, "ios", targetName);

  if (!existsSync(extensionPath)) {
    mkdirSync(extensionPath, { recursive: true });
  }

  // Copy the NotificationService.swift file into the iOS expo project as AirshipNotificationService.swift.
  var notificationServiceFile = props.notificationService == "DEFAULT_AIRSHIP_SERVICE_EXTENSION" ? join(sourceDir, NOTIFICATION_SERVICE_FILE_NAME) : props.notificationService;
  readFile(notificationServiceFile, 'utf8', (err, data) => {
    if (err || !data) {
      console.error("Airship couldn't read file " + notificationServiceFile);
      console.error(err);
      return;
    }

    if (!props.notificationServiceInfo) {
      const regexp = /class [A-Za-z]+:/;
      const newSubStr = "class AirshipNotificationService:";
      data = data.replace(regexp, newSubStr);
    }

    writeFileSync(join(extensionPath, NOTIFICATION_SERVICE_FILE_NAME), data);
  });
  
  // Copy the Info.plist (default to NotificationServiceExtension-Info.plist if null) file into the iOS expo project.
  readFile(props.notificationServiceInfo ?? join(sourceDir, NOTIFICATION_SERVICE_INFO_PLIST_FILE_NAME), 'utf8', (err, data) => {
    if (err || !data) {
      console.error("Airship couldn't read file " + (props.notificationServiceInfo ?? join(sourceDir, NOTIFICATION_SERVICE_INFO_PLIST_FILE_NAME)));
      console.error(err);
      return;
    }
    const infoPlistFilename = props.notificationServiceTargetName ? props.notificationServiceTargetName + "-Info.plist" : NOTIFICATION_SERVICE_INFO_PLIST_FILE_NAME;
    writeFileSync(join(extensionPath, infoPlistFilename), data);
  });
};

const withExtensionTargetInXcodeProject: ConfigPlugin<AirshipIOSPluginProps> = (config, props) => {
  const targetName = props.notificationServiceTargetName ?? DEFAULT_NOTIFICATION_SERVICE_EXTENSION_TARGET_NAME

  return withXcodeProject(config, newConfig => {
    const xcodeProject = newConfig.modResults;
    if (!!xcodeProject.pbxTargetByName(targetName)) {
      console.log(targetName + " already exists in project. Skipping...");
      return newConfig;
    }

    const infoPlistFilename = props.notificationServiceTargetName ? props.notificationServiceTargetName + "-Info.plist" : NOTIFICATION_SERVICE_INFO_PLIST_FILE_NAME;
    // Create new PBXGroup for the extension
    const extGroup = xcodeProject.addPbxGroup(
      [NOTIFICATION_SERVICE_FILE_NAME, infoPlistFilename], 
      targetName, 
      targetName
    );

    // Add the new PBXGroup to the top level group. This makes the
    // files / folder appear in the file explorer in Xcode.
    const groups = xcodeProject.hash.project.objects["PBXGroup"];
    Object.keys(groups).forEach(function(key) {
      if (typeof groups[key] === "object" && groups[key].name === undefined && groups[key].path === undefined) {
        xcodeProject.addToPbxGroup(extGroup.uuid, key);
      }
    });

    // WORK AROUND for xcodeProject.addTarget BUG (making the pod install to fail somehow)
    // Xcode projects don't contain these if there is only one target in the app
    // An upstream fix should be made to the code referenced in this link:
    //   - https://github.com/apache/cordova-node-xcode/blob/8b98cabc5978359db88dc9ff2d4c015cba40f150/lib/pbxProject.js#L860
    const projObjects = xcodeProject.hash.project.objects;
    projObjects['PBXTargetDependency'] = projObjects['PBXTargetDependency'] || {};
    projObjects['PBXContainerItemProxy'] = projObjects['PBXTargetDependency'] || {};

    // Add the Notification Service Extension Target
    // This adds PBXTargetDependency and PBXContainerItemProxy
    const notificationServiceExtensionTarget = xcodeProject.addTarget(
      targetName, 
      "app_extension", 
      targetName, 
      `${config.ios?.bundleIdentifier}.${targetName}`
    );

    // Add build phases to the new Target
    xcodeProject.addBuildPhase(
      [NOTIFICATION_SERVICE_FILE_NAME],
      "PBXSourcesBuildPhase",
      "Sources",
      notificationServiceExtensionTarget.uuid
    );
    xcodeProject.addBuildPhase(
      [], 
      "PBXResourcesBuildPhase", 
      "Resources", 
      notificationServiceExtensionTarget.uuid
    );
    xcodeProject.addBuildPhase(
      [],
      "PBXFrameworksBuildPhase",
      "Frameworks",
      notificationServiceExtensionTarget.uuid
    );
   
    // Edit the new Target Build Settings and Deployment info
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      if (typeof configurations[key].buildSettings !== "undefined"
        && configurations[key].buildSettings.PRODUCT_NAME == `"${targetName}"`
      ) {
        const buildSettingsObj = configurations[key].buildSettings;
        buildSettingsObj.IPHONEOS_DEPLOYMENT_TARGET = "14.0";
        buildSettingsObj.SWIFT_VERSION = "5.0";
        buildSettingsObj.DEVELOPMENT_TEAM = props?.developmentTeamID;
        buildSettingsObj.CODE_SIGN_STYLE = "Automatic";
      }
    }

    // Add development teams to the target
    xcodeProject.addTargetAttribute("DevelopmentTeam", props?.developmentTeamID, notificationServiceExtensionTarget);

    return newConfig;
  });
};

const withAirshipServiceExtensionPod: ConfigPlugin<AirshipIOSPluginProps> = (config, props) => {
  const targetName = props.notificationServiceTargetName ?? DEFAULT_NOTIFICATION_SERVICE_EXTENSION_TARGET_NAME

  return withPodfile(config, async (config) => {
    const airshipServiceExtensionPodfileSnippet = `
    target '${targetName}' do
      use_frameworks! :linkage => podfile_properties['ios.useFrameworks'].to_sym if podfile_properties['ios.useFrameworks']
      use_frameworks! :linkage => ENV['USE_FRAMEWORKS'].to_sym if ENV['USE_FRAMEWORKS']
      pod 'AirshipServiceExtension'
    end
    `;

    let results: MergeResults;
    try {
      results = mergeContents({
        tag: "AirshipServiceExtension",
        src: config.modResults.contents,
        newSrc: airshipServiceExtensionPodfileSnippet,
        anchor: /target .* do/,
        offset: 0,
        comment: '#'
      });
    } catch (error: any) {
      if (error.code === 'ERR_NO_MATCH') {
        throw new Error(
          `Cannot add AirshipServiceExtension to the project's ios/Podfile because it's malformed. Please report this with a copy of your project Podfile.`
        );
      }
      throw error;
    }

    if (results.didMerge || results.didClear) {
      config.modResults.contents = results.contents;
    }
    
    return config;
  });
};

const withEasManagedCredentials: ConfigPlugin<AirshipIOSPluginProps> = (config, props) => {
  assert(config.ios?.bundleIdentifier, "Missing 'ios.bundleIdentifier' in app config.")
  config.extra = getEasManagedCredentialsConfigExtra(config as ExpoConfig, props);
  return config;
}

function getEasManagedCredentialsConfigExtra(config: ExpoConfig, props: AirshipIOSPluginProps): {[k: string]: any} {
  return {
    ...config.extra,
    eas: {
      ...config.extra?.eas,
      build: {
        ...config.extra?.eas?.build,
        experimental: {
          ...config.extra?.eas?.build?.experimental,
          ios: {
            ...config.extra?.eas?.build?.experimental?.ios,
            appExtensions: [
              ...(config.extra?.eas?.build?.experimental?.ios?.appExtensions ?? []),
              {
                // Sync up with the new target
                targetName: props.notificationServiceTargetName ?? DEFAULT_NOTIFICATION_SERVICE_EXTENSION_TARGET_NAME,
                bundleIdentifier: `${config?.ios?.bundleIdentifier}.${props.notificationServiceTargetName ?? DEFAULT_NOTIFICATION_SERVICE_EXTENSION_TARGET_NAME}`,
              }
            ]
          }
        }
      }
    }
  }
}

export const withAirshipIOS: ConfigPlugin<AirshipIOSPluginProps> = (config, props) => {
  config = withCapabilities(config, props);
  config = withAPNSEnvironment(config, props);
  if (props.notificationService) {
    config = withNotificationServiceExtension(config, props);
    config = withExtensionTargetInXcodeProject(config, props);
    config = withAirshipServiceExtensionPod(config, props);
    config = withEasManagedCredentials(config, props);
  }
  return config;
};