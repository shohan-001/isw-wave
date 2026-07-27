#!/usr/bin/env bash
# Source this before Flutter/Android work so tools live on the 251GB volume,
# not the full Linux root disk.
#
#   source "./env.sh"

DEV_ROOT="/run/media/shohan/9E5A9CDF5A9CB58D/dev"
export JAVA_HOME="$DEV_ROOT/jdk-17"
export PATH="$JAVA_HOME/bin:$DEV_ROOT/flutter/bin:$DEV_ROOT/Android/Sdk/platform-tools:$DEV_ROOT/Android/Sdk/cmdline-tools/latest/bin:$PATH"
export PUB_CACHE="$DEV_ROOT/pub-cache"
export ANDROID_HOME="$DEV_ROOT/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export GRADLE_USER_HOME="$DEV_ROOT/gradle"
unset FLUTTER_STORAGE_BASE_URL

echo "Flutter: $(command -v flutter)"
echo "Java:    $($JAVA_HOME/bin/java -version 2>&1 | head -1)"
echo "ADB:     $(command -v adb)"
echo "SDK:     $ANDROID_HOME"
