package dev.shadowgarden.app

import android.os.Bundle
import android.widget.FrameLayout
import androidx.fragment.app.FragmentActivity
import androidx.fragment.app.commitNow
import androidx.lifecycle.lifecycleScope
import java.io.File
import kotlinx.coroutines.launch
import org.json.JSONObject
import org.readium.r2.navigator.epub.EpubNavigatorFactory
import org.readium.r2.navigator.epub.EpubNavigatorFragment
import org.readium.r2.shared.publication.Locator
import org.readium.r2.shared.publication.Publication
import org.readium.r2.shared.util.asset.AssetRetriever
import org.readium.r2.shared.util.getOrElse
import org.readium.r2.shared.util.http.DefaultHttpClient
import org.readium.r2.shared.util.toUrl
import org.readium.r2.streamer.PublicationOpener
import org.readium.r2.streamer.parser.epub.EpubParser

/** Debug-only test host. It is not a production reader or an import surface. */
class ReadiumPrototypeActivity : FragmentActivity() {
    var navigator: EpubNavigatorFragment? = null
        private set
    var failure: String? = null
        private set
    private var publication: Publication? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        // The prototype reopens its generated fixture and locator rather than
        // restoring Readium fragments from a stale in-memory Publication.
        // This deliberate test-only simplification is not a production design.
        super.onCreate(null)
        setContentView(FrameLayout(this).apply { id = R.id.readium_prototype_container })
        lifecycleScope.launch {
            try {
                val file = File(cacheDir, FIXTURE_NAME)
                val client = DefaultHttpClient()
                val retriever = AssetRetriever(contentResolver, client)
                val asset = retriever.retrieve(file.toUrl()).getOrElse { error(it.message) }
                val opened = PublicationOpener(EpubParser())
                    .open(asset, allowUserInteraction = false)
                    .getOrElse { error(it.message) }
                publication = opened
                val saved = getSharedPreferences(PREFERENCES, MODE_PRIVATE).getString(LOCATION, null)
                val locator = saved?.let { Locator.fromJSON(JSONObject(it)) }
                supportFragmentManager.fragmentFactory =
                    EpubNavigatorFactory(opened).createFragmentFactory(initialLocator = locator)
                supportFragmentManager.commitNow {
                    add(R.id.readium_prototype_container, EpubNavigatorFragment::class.java, null, TAG)
                }
                navigator = supportFragmentManager.findFragmentByTag(TAG) as EpubNavigatorFragment
            } catch (error: Exception) {
                failure = "${error.javaClass.simpleName}: ${error.message}"
            }
        }
    }

    fun goToChapter(index: Int): Boolean =
        publication?.readingOrder?.getOrNull(index)?.let { navigator?.go(it) } ?: false

    fun tableOfContentsSize(): Int = publication?.tableOfContents?.size ?: 0

    fun saveLocation(): Boolean {
        val locator = navigator?.currentLocator?.value ?: return false
        return getSharedPreferences(PREFERENCES, MODE_PRIVATE).edit()
            .putString(LOCATION, locator.toJSON().toString()).commit()
    }

    override fun onDestroy() {
        super.onDestroy()
        publication?.close()
        publication = null
        navigator = null
    }

    companion object {
        const val FIXTURE_NAME = "readium-prototype-fixture.epub"
        const val PREFERENCES = "readium-prototype-test"
        const val LOCATION = "location"
        private const val TAG = "readium-prototype"
    }
}
