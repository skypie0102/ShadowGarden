package dev.shadowgarden.app.progress

import android.app.Activity
import android.app.Application
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.LocalActivityResultRegistryOwner
import androidx.activity.result.ActivityResultRegistry
import androidx.activity.result.ActivityResultRegistryOwner
import androidx.activity.result.contract.ActivityResultContract
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.core.app.ActivityOptionsCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import dev.shadowgarden.app.PositionBackupScreen
import java.io.File
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PositionBackupScreenTest {
    @get:Rule val composeRule = createComposeRule()
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context = instrumentation.targetContext
    private val databaseName = "backup-ui-${UUID.randomUUID()}.db"
    private val files = mutableListOf<File>()
    private lateinit var store: ReadingProgressStore
    private lateinit var model: PositionBackupViewModel
    private val book = CatalogBookId("bk_abcdefghijklmnopqrstuv")
    private val edition = EditionFingerprint.calculate("fixture".byteInputStream(), 100)
    private val initial = ReadingPosition(book, edition, LocatorFormat.EPUBJS_CFI, "epubcfi(/6/2)", 100)
    private val nextResult = AtomicReference<Uri?>()
    private val actions = CopyOnWriteArrayList<String>()
    private val owner = object : ActivityResultRegistryOwner {
        override val activityResultRegistry = object : ActivityResultRegistry() {
            override fun <I, O> onLaunch(requestCode: Int, contract: ActivityResultContract<I, O>, input: I, options: ActivityOptionsCompat?) {
                actions.add(contract.createIntent(context, input).action.orEmpty())
                val uri = nextResult.getAndSet(null)
                if (uri == null) dispatchResult(requestCode, Activity.RESULT_CANCELED, null)
                else dispatchResult(requestCode, Activity.RESULT_OK, Intent().setData(uri))
            }
        }
    }

    @Before fun setUp() {
        store = ReadingProgressStore(context, databaseName)
        instrumentation.runOnMainSync { model = PositionBackupViewModel(context.applicationContext as Application, store) }
    }

    @After fun tearDown() {
        store.close()
        context.deleteDatabase(databaseName)
        files.forEach { it.deleteRecursively() }
    }

    @Test fun exportUsesCreateDocumentAndWritesAValidatedPositionBackup() {
        assertEquals(ProgressSaveResult.Saved(1), store.save(initial, null))
        val file = tempFile("export.json")
        nextResult.set(documentUri(file))
        showScreen()
        composeRule.onNodeWithText("Export positions").performScrollTo().performClick()
        waitForMessage("Reading-position backup saved.")
        assertEquals(listOf(Intent.ACTION_CREATE_DOCUMENT), actions.toList())
        val saved = file.inputStream().use { ReadingPositionBackup.read(it) }
        assertEquals(listOf(initial), saved)
    }

    @Test fun restoreShowsConflictAndRequiresOverwriteConfirmation() {
        assertEquals(ProgressSaveResult.Saved(1), store.save(initial, null))
        val backup = initial.copy(locator = "epubcfi(/6/8)", recordedAtMillis = 200)
        val file = tempFile("restore.json")
        file.outputStream().use { ReadingPositionBackup.write(it, listOf(backup)) }
        nextResult.set(documentUri(file))
        showScreen()
        composeRule.onNodeWithText("Restore positions").performScrollTo().performClick()
        waitForMessage("Review the backup before restoring.")
        composeRule.onNodeWithText("New: 0   Unchanged: 0   Conflicts: 1").performScrollTo().assertIsDisplayed()
        assertEquals(listOf(Intent.ACTION_OPEN_DOCUMENT), actions.toList())
        composeRule.onNodeWithText("Overwrite conflicts").performScrollTo().performClick()
        composeRule.onNodeWithText("Overwrite conflicting positions?").assertIsDisplayed()
        composeRule.onNodeWithText("Cancel", useUnmergedTree = true).performClick()
        assertSaved(initial, 1)
        composeRule.onNodeWithText("Overwrite conflicts").performScrollTo().performClick()
        composeRule.onNodeWithText("Overwrite positions").performClick()
        waitForMessage("Restore complete: 0 added, 1 overwritten, 0 unchanged, 0 kept.")
        assertSaved(backup, 2)
    }

    @Test fun invalidBackupAndFailedExportDoNotChangeProgress() {
        assertEquals(ProgressSaveResult.Saved(1), store.save(initial, null))
        val invalid = tempFile("invalid.json").apply { writeText("not a backup") }
        nextResult.set(documentUri(invalid))
        showScreen()
        composeRule.onNodeWithText("Restore positions").performScrollTo().performClick()
        composeRule.waitUntil(20_000) { model.state.value.message?.startsWith("Could not read this backup.") == true }
        assertSaved(initial, 1)
        val directory = tempFile("directory").apply { mkdirs() }
        nextResult.set(documentUri(directory))
        composeRule.onNodeWithText("Export positions").performScrollTo().performClick()
        composeRule.waitUntil(20_000) { model.state.value.message?.startsWith("Backup failed.") == true }
        assertSaved(initial, 1)
    }

    @Test fun emptyAndInterruptedExportsNeverOpenOrOverwriteADestination() {
        val file = tempFile("untouched.json").apply { writeText("untouched") }
        showScreen()
        composeRule.onNodeWithText("Export positions").performScrollTo().performClick()
        waitForMessage("There are no saved reading positions to back up yet.")
        assertTrue(actions.isEmpty())
        instrumentation.runOnMainSync { model.exportDestination(documentUri(file)) }
        waitForMessage("Backup was interrupted. Please try again.")
        assertEquals("untouched", file.readText())
    }

    @Test fun changedProgressInvalidatesThePreviewWithoutOverwriting() {
        assertEquals(ProgressSaveResult.Saved(1), store.save(initial, null))
        val file = tempFile("stale.json")
        file.outputStream().use { ReadingPositionBackup.write(it, listOf(initial.copy(locator = "backup"))) }
        nextResult.set(documentUri(file))
        showScreen()
        composeRule.onNodeWithText("Restore positions").performScrollTo().performClick()
        waitForMessage("Review the backup before restoring.")
        val live = initial.copy(locator = "updated-after-preview")
        assertEquals(ProgressSaveResult.Saved(2), store.save(live, 1))
        composeRule.onNodeWithText("Restore and keep existing").performScrollTo().performClick()
        waitForMessage("Saved positions changed after the preview. Choose the backup again to review it.")
        assertSaved(live, 2)
    }

    @Test fun cancelingThePickerDoesNotChangeProgress() {
        assertEquals(ProgressSaveResult.Saved(1), store.save(initial, null))
        showScreen()
        composeRule.onNodeWithText("Restore positions").performScrollTo().performClick()
        waitForMessage("Restore canceled.")
        assertEquals(listOf(Intent.ACTION_OPEN_DOCUMENT), actions.toList())
        assertSaved(initial, 1)
    }

    @Test fun nonDocumentDestinationCannotOverwriteAnAppPrivateFile() {
        assertEquals(ProgressSaveResult.Saved(1), store.save(initial, null))
        val file = tempFile("private-target").apply { writeText("untouched") }
        nextResult.set(Uri.fromFile(file))
        showScreen()
        composeRule.onNodeWithText("Export positions").performScrollTo().performClick()
        waitForMessage("The selected destination is not a document. Please try again.")
        assertEquals("untouched", file.readText())
        assertSaved(initial, 1)
    }

    private fun showScreen() = composeRule.setContent {
        CompositionLocalProvider(LocalActivityResultRegistryOwner provides owner) { MaterialTheme { PositionBackupScreen(model) } }
    }
    private fun waitForMessage(message: String) {
        composeRule.waitUntil(20_000) { model.state.value.message == message }
        composeRule.onNodeWithText(message).performScrollTo().assertIsDisplayed()
    }
    private fun tempFile(name: String): File = File(context.cacheDir, "backup-ui-${UUID.randomUUID()}-$name").also { files.add(it) }
    private fun documentUri(file: File): Uri = Uri.Builder().scheme("content")
        .authority("${context.packageName}.backup-test").appendPath(file.name).build()
    private fun assertSaved(position: ReadingPosition, revision: Long) {
        assertEquals(ProgressLookup.Exact(StoredReadingPosition(position, revision)),
            store.lookup(position.bookId, position.edition, position.format))
    }
}
