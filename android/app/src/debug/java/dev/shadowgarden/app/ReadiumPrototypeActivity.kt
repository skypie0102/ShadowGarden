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
import org.readium.r2.navigator.epub.EpubPreferences
import org.readium.r2.shared.ExperimentalReadiumApi
import org.readium.r2.shared.publication.Locator
import org.readium.r2.shared.publication.Publication
import org.readium.r2.shared.util.asset.AssetRetriever
import org.readium.r2.shared.util.getOrElse
import org.readium.r2.shared.util.http.DefaultHttpClient
import org.readium.r2.shared.util.toUrl
import org.readium.r2.streamer.PublicationOpener
import org.readium.r2.streamer.parser.epub.EpubParser

/** Debug-only test host. It is not a production reader or an import surface. */
@OptIn(ExperimentalReadiumApi::class)
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
        val preferences = getSharedPreferences(PREFERENCES, MODE_PRIVATE)
        val container = FrameLayout(this).apply { id = R.id.readium_prototype_container }
        val width = preferences.getInt(VIEWPORT_WIDTH, 0)
        val height = preferences.getInt(VIEWPORT_HEIGHT, 0)
        if (width > 0 && height > 0) {
            val density = resources.displayMetrics.density
            setContentView(FrameLayout(this).apply {
                addView(container, FrameLayout.LayoutParams((width * density).toInt(), (height * density).toInt()))
            })
        } else {
            setContentView(container)
        }
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
                val saved = preferences.getString(LOCATION, null)
                val locator = saved?.let { Locator.fromJSON(JSONObject(it)) }
                val fontSize = preferences.getFloat(FONT_SIZE, 1f).toDouble()
                supportFragmentManager.fragmentFactory = EpubNavigatorFactory(opened).createFragmentFactory(
                    initialLocator = locator, initialPreferences = EpubPreferences(fontSize = fontSize)
                )
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

    // Explicitly selected text, for a comparison with the EPUB.js range-CFI test.
    private fun passageLocator(): Locator? {
        val book = publication ?: return null
        val link = book.readingOrder.getOrNull(11) ?: return null
        return book.locatorFromLink(link)?.copy(text = Locator.Text(highlight = PASSAGE))
    }

    fun goToPassage(): Boolean = passageLocator()?.let { navigator?.go(it) } ?: false

    fun savePassage(): Boolean {
        val locator = passageLocator() ?: return false
        return getSharedPreferences(PREFERENCES, MODE_PRIVATE).edit()
            .putString(LOCATION, locator.toJSON().toString()).commit()
    }

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
        const val VIEWPORT_WIDTH = "viewport-width"
        const val VIEWPORT_HEIGHT = "viewport-height"
        const val FONT_SIZE = "font-size"
        const val PASSAGE = "Chapter 12 paragraph 40."
        private const val TAG = "readium-prototype"
    }
}
