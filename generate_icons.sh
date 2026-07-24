#!/bin/bash
ICON_SRC="/home/acquaint/.gemini/antigravity/brain/36a8f904-8310-4766-99e9-9aaea6a9d461/atlas_app_icon_1784891947499.png"
ANDROID_RES="/home/acquaint/Chirag/atlas/AtlasProject/android/app/src/main/res"
IOS_ICON="/home/acquaint/Chirag/atlas/AtlasProject/ios/AtlasProject/Images.xcassets/AppIcon.appiconset"

convert "$ICON_SRC" -resize 48x48   "$ANDROID_RES/mipmap-mdpi/ic_launcher.png"
convert "$ICON_SRC" -resize 48x48   "$ANDROID_RES/mipmap-mdpi/ic_launcher_round.png"
convert "$ICON_SRC" -resize 72x72   "$ANDROID_RES/mipmap-hdpi/ic_launcher.png"
convert "$ICON_SRC" -resize 72x72   "$ANDROID_RES/mipmap-hdpi/ic_launcher_round.png"
convert "$ICON_SRC" -resize 96x96   "$ANDROID_RES/mipmap-xhdpi/ic_launcher.png"
convert "$ICON_SRC" -resize 96x96   "$ANDROID_RES/mipmap-xhdpi/ic_launcher_round.png"
convert "$ICON_SRC" -resize 144x144 "$ANDROID_RES/mipmap-xxhdpi/ic_launcher.png"
convert "$ICON_SRC" -resize 144x144 "$ANDROID_RES/mipmap-xxhdpi/ic_launcher_round.png"
convert "$ICON_SRC" -resize 192x192 "$ANDROID_RES/mipmap-xxxhdpi/ic_launcher.png"
convert "$ICON_SRC" -resize 192x192 "$ANDROID_RES/mipmap-xxxhdpi/ic_launcher_round.png"

# iOS sizes: 40, 58, 60, 80, 87, 120, 180, 1024
convert "$ICON_SRC" -resize 40x40   "$IOS_ICON/Icon-40.png"
convert "$ICON_SRC" -resize 58x58   "$IOS_ICON/Icon-58.png"
convert "$ICON_SRC" -resize 60x60   "$IOS_ICON/Icon-60.png"
convert "$ICON_SRC" -resize 80x80   "$IOS_ICON/Icon-80.png"
convert "$ICON_SRC" -resize 87x87   "$IOS_ICON/Icon-87.png"
convert "$ICON_SRC" -resize 120x120 "$IOS_ICON/Icon-120.png"
convert "$ICON_SRC" -resize 180x180 "$IOS_ICON/Icon-180.png"
convert "$ICON_SRC" -resize 1024x1024 "$IOS_ICON/Icon-1024.png"

echo "All icons generated"
