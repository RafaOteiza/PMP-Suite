const {getDefaultConfig}=require('expo/metro-config');
const path=require('node:path');
const config=getDefaultConfig(__dirname);
// Share only pure PMP contracts; retain Expo's resolver and existing React installation.
config.watchFolders=[path.resolve(__dirname,'../shared')];
module.exports=config;
