package dev.shadowgarden.app.catalog

import android.content.pm.PackageManager
import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertTrue
import org.junit.Assert.assertNotNull
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import kotlinx.coroutines.runBlocking

/** Manual opt-in: read the public Main catalog and one available cover. */
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
        val cover = series.firstNotNullOfOrNull { it.cover }
        if (cover == null) Log.i("SGCoverProbe", "Live catalog has no supported cover to check")
        else {
            assertNotNull("A public cover should decode", runBlocking { PublicCoverLoader().load(cover) })
            Log.i("SGCoverProbe", "Live public cover decoded")
        }
    }
}
