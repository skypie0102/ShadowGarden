plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "dev.shadowgarden.app"
    compileSdk = 35
    buildToolsVersion = "35.0.0"

    defaultConfig {
        applicationId = "dev.shadowgarden.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
    // Ship the same pinned EPUB.js and JSZip files used by the website.
    sourceSets.getByName("main").assets.srcDir(rootProject.file("../public/assets/vendor"))
    // The experimental Android test uses the site's pinned runtime directly.
    // These files are packaged in the test APK only, not the application APK.
    sourceSets.getByName("androidTest").assets.srcDir(rootProject.file("../public/assets/vendor"))
    // Reader experiments require an app with no Internet permission. Normal
    // debug builds retain Internet access for the public catalog.
    if (providers.gradleProperty("offlineReaderTests").orNull == "true") {
        sourceSets.getByName("debug").manifest.srcFile("src/offlineReaderTests/AndroidManifest.xml")
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.7")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
    // Experimental Readium comparison; never included in release builds.
    debugImplementation("org.readium.kotlin-toolkit:readium-streamer:3.0.0")
    debugImplementation("org.readium.kotlin-toolkit:readium-navigator:3.0.0")
    debugImplementation("androidx.fragment:fragment-ktx:1.8.5")
    debugImplementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation(platform("androidx.compose:compose-bom:2024.12.01"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
}
