package dev.shadowgarden.app.catalog

import android.content.pm.PackageManager
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Manual opt-in: one read-only request to the public Main catalog. */
@RunWith(AndroidJUnit4::class)
class LiveCatalogTest {
    @Test fun readsLiveMainCatalog() {
        assumeTrue("Live catalog probe is manual-only", InstrumentationRegistry.getArguments().getString("catalogLive") == "true")
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        @Suppress("DEPRECATION")
        val permissions = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_PERMISSIONS)
            .requestedPermissions.orEmpty()
        assertTrue("Live probe needs the normal network-enabled app", permissions.contains("android.permission.INTERNET"))
        val series = MainCatalogClient().load()
        assertTrue("Parsed series identifiers must be unique", series.map { it.id }.toSet().size == series.size)
    }
}
